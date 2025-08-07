const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');

class TestClass extends SynchroItem {
    constructor() {
        super('my-test-id');
        this.prop1 = 'initial1';
        this.prop2 = 'initial2';
        this.nonObserved = 'initialNon';
        this.observed_properties = ['prop1', 'prop2'];
    }

    set prop1(value) { this._prop1 = value; this.dirty(); }
    get prop1() { return this._prop1; }

    set prop2(value) { this._prop2 = value; this.dirty(); }
    get prop2() { return this._prop2; }

    set nonObserved(value) { this._nonObserved = value; this.dirty(); }
    get nonObserved() { return this._nonObserved; }

    get an_array() { return ['a', 'b', 'c']; }
    get an_object() { return { key: 'value' }; }
};


describe('SynchroItem', function () {

    let instance;
    beforeEach(function () { instance = new TestClass(); });

    describe('notion handling', function () {

        it('Should set and get a notion', function () {

            instance.set('testN', 'testValue');
            assert.strictEqual(instance.get('testN'), 'testValue');
        });

        it('.set() should create a new notion and emit a changed event when a notion is set', function (done) {
            instance.on('changed', (event) => {
                assert.strictEqual(event.property, 'testN');
                assert.strictEqual(event.new_value, 'testValue');
                assert.strictEqual(event.old_value, undefined);
                done();
            });

            instance.set('testN', 'testValue');
        });

        it('.set() should update an existing notion, emitting a change event', function () {

            instance.set('testN', 'initialValue');
            instance.on('changed', (event) => {
                assert.strictEqual(event.property, 'testN');
                assert.strictEqual(event.new_value, 'updatedValue');
                assert.strictEqual(event.old_value, 'initialValue');
            });

            instance.set('testN', 'updatedValue');
        });

        it('.set() should not emit a change event if the value and timestamp are the same', function () {

            instance.set('testN', 'testValue', "2023-01-01T00:00:00Z");
            instance.on('changed', () => {
                assert.fail('Change event should not be emitted when value and timestamp are the same');
            });
            instance.set('testN', 'testValue', "2023-01-01T00:00:00Z");
        });

        it('.unset() should remove a notion and not emit a change event', function () {
            instance.set('testN', 'testValue');
            let eventEmitted = false;

            instance.on('changed', () => {
                eventEmitted = true;
            });

            instance.unset('testN');
            assert.strictEqual(eventEmitted, false, 'No changed event should be emitted when a notion is unset');
        });

        it('.set() should emit named events', function (done) {
            
            instance.set('testN', 'initialValue');
            instance.on('changed:testN', (event) => {
                assert.strictEqual(event.property, 'testN');
                assert.strictEqual(event.new_value, 'newValue');
                assert.strictEqual(event.old_value, 'initialValue');
                done();
            });

            instance.set('testN', 'newValue');
        });

    });

    describe('property observing', function () {

        it('should emit changed event for observed properties', function (done) {
            let eventCount = 0;
            const expectedEvents = [
                { property: 'prop1', new_value: 'new1', old_value: 'initial1' },
                { property: 'prop2', new_value: 'new2', old_value: 'initial2' }
            ];

            instance.on('changed', (event) => {
                const expected = expectedEvents[eventCount];
                assert.strictEqual(event.property, expected.property, `Expected property ${expected.property}`);
                assert.strictEqual(event.new_value, expected.new_value, `Expected new_value ${expected.new_value}`);
                assert.strictEqual(event.old_value, expected.old_value, `Expected old_value ${expected.old_value}`);
                eventCount++;

                if (eventCount === 2) {
                    done();
                }
            });

            instance.prop1 = 'new1';
            instance.prop2 = 'new2';
        });

        it('should not emit changed event for non-observed properties', function (done) {
            let eventEmitted = false;

            instance.on('changed', () => {
                eventEmitted = true;
            });

            instance.nonObserved = 'newNon';

            // Wait briefly to ensure no event is emitted
            setTimeout(() => {
                assert.strictEqual(eventEmitted, false, 'No changed event should be emitted for non-observed property');
                done();
            }, 5);
        });

        it('should throw error for invalid observed properties', function () {

            assert.throws(() => {
                instance.observed_properties = 'an_array';
            }, TypeError);

            assert.throws(() => {
                instance.observed_properties = 'an_object';
            }, TypeError);

        });

        it('should emit named events for observed properties', function (done) {

            instance.on('changed:prop1', (event) => {
                assert.strictEqual(event.property, 'prop1');
                assert.strictEqual(event.new_value, 'new1');
                assert.strictEqual(event.old_value, 'initial1');
                done();
            });

            instance.prop1 = 'new1';
        });

    });

    describe('serialization', function () {

        it('.toObject() properly serializes both properties and notions', function () {

            instance.set('testN', 'testValue', new Date("2023-01-01T00:00:00Z"));
            const obj = instance.toObject();
            assert.deepStrictEqual(obj, {
                id: 'my-test-id',
                type: 'TestClass',
                notions: {
                    testN: {
                        name: 'testN',
                        value: 'testValue',
                        timestamp: new Date("2023-01-01T00:00:00.000Z")
                    }
                },
                properties: { prop1: 'initial1', prop2: 'initial2' }
            });

        });

        it('.fromObject() creates an instance from a serialized object', function () {

            const obj = {
                id: 'my-test-id',
                type: 'TestClass',
                notions: {
                    testN: {
                        name: 'testN',
                        value: 'testValue',
                        timestamp: new Date("2023-01-01T00:00:00Z")
                    }
                },
                properties: { prop1: 'initial1', prop2: 'initial2' }
            };

            const new_instance = TestClass.fromObject(obj);
            assert.strictEqual(new_instance.id, 'my-test-id');
            assert.strictEqual(new_instance.get('testN'), 'testValue');
            assert.strictEqual(new_instance.prop1, 'initial1');
            assert.strictEqual(new_instance.prop2, 'initial2');
        });

        it('.fromObject created instances should still be able to bubble events', function (done) {

            const obj = {
                id: 'my-test-id',
                type: 'TestClass',
                notions: {},
                properties: {}
            };

            const new_instance = TestClass.fromObject(obj);
            new_instance.on('changed', (event) => { done(); });

            new_instance.prop1 = 'new1';
        });

        it('.serialize() -> .deserialize() round trip', function () {

            instance.set('testN', 'testValue', new Date("2023-01-01T00:00:00Z"));

            const serialized = instance.serialize();
            const new_instance = TestClass.deserialize(serialized);
            assert.strictEqual(new_instance.id, 'my-test-id');
            assert.strictEqual(new_instance.prop1, 'initial1');
            assert.strictEqual(new_instance.prop2, 'initial2');
            assert.strictEqual(new_instance.get('testN'), 'testValue');
        });
    });

    describe('other functionality', function () {

        it('update_to() should update our properties to the properties of the target item', function () {
            const target = new TestClass();
            target.prop1 = 'targetValue1';
            target.prop2 = 'targetValue2';

            instance.update_to(target);
            assert.strictEqual(instance.prop1, 'targetValue1');
            assert.strictEqual(instance.prop2, 'targetValue2');
        });

        it('update_to() should not change non-observed properties', function () {
            const target = new TestClass();
            target.nonObserved = 'targetNonValue';

            instance.update_to(target);
            assert.strictEqual(instance.nonObserved, 'initialNon'); // Should remain unchanged
        });

        it('update_to() should add any new notions', function () {
            const target = new TestClass();
            target.set('testN', 'targetValue', new Date('2025-07-28T16:47:00Z'));

            instance.update_to(target);
            const notion = instance.notion('testN');
            assert.ok(notion);
            assert.strictEqual(notion.value, 'targetValue');
            assert.strictEqual(notion.timestamp.toISOString(), '2025-07-28T16:47:00.000Z');
        });

        it('update_to() should remove any notions that are not in the target', function () {
            instance.set('testN', 'testValue');
            const target = new TestClass(); // No notions set

            instance.update_to(target);
            assert.strictEqual(instance.get('testN'), undefined); // Should be removed
        });

        it('update_to() should update existing notions', function () {
            instance.set('testN', 'initialValue', new Date('2025-07-28T16:47:00Z'));
            
            const target = new TestClass();
            target.set('testN', 'updatedValue', new Date('2025-07-28T16:47:01Z'));

            instance.update_to(target);
            const notion = instance.notion('testN');
            assert.strictEqual(notion.value, 'updatedValue');
            assert.strictEqual(notion.timestamp.toISOString(), '2025-07-28T16:47:01.000Z');
        });

    });

    describe('checksum functionality', function () {

        it('should generate a deterministic checksum', function () {
            const checksum = instance.checksum;
            assert.strictEqual(typeof checksum, 'string');
            assert.strictEqual(checksum.length, 64); // SHA256 hex string length
            
            // Same state should produce same checksum
            const instance2 = new TestClass();
            assert.strictEqual(instance.checksum, instance2.checksum);

            // Now change the properties of the two instances and make sure checksums differ
            instance.prop1 = 'changed1';
            instance2.prop1 = 'changed2';

            assert.notStrictEqual(instance.checksum, instance2.checksum);

            // Make the properties the same again
            instance.prop1 = 'changed1';
            instance.prop2 = { this: 'is', a: 'test', with: { nested: 123456.789 } };
            instance2.prop1 = 'changed1';
            instance2.prop2 = { this: 'is', a: 'test', with: { nested: 123456.789 } };

            assert.strictEqual(instance.checksum, instance2.checksum);
        });

        it('should invalidate checksum when state changes', function () {
            const originalChecksum = instance.checksum;
            
            // Property change should invalidate
            instance.prop1 = 'changed_value';
            assert.notStrictEqual(instance.checksum, originalChecksum);
            
            // Notion change should invalidate
            const newChecksum = instance.checksum;
            instance.set('testN', 'test_value');
            assert.notStrictEqual(instance.checksum, newChecksum);
        });

        it('should be deterministic regardless of order', function () {
            const instance1 = new TestClass();
            instance1.set('notionA', 'valueA');
            instance1.set('notionB', 'valueB');
            
            const instance2 = new TestClass();
            instance2.set('notionB', 'valueB');
            instance2.set('notionA', 'valueA');
            
            assert.strictEqual(instance1.checksum, instance2.checksum);
        });

        it('should include timestamps in checksum calculation', function () {
            const instance1 = new TestClass();
            const instance2 = new TestClass();
            
            instance1.set('testN', 'same_value', new Date('2023-01-01T00:00:00Z'));
            instance2.set('testN', 'same_value', new Date('2023-01-01T00:00:01Z'));
            
            assert.notStrictEqual(instance1.checksum, instance2.checksum);
        });

    });

});