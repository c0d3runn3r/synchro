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

        it('.unset() should remove a notion and not emit a change event', function () {
            instance.set('testN', 'testValue');
            let eventEmitted = false;

            instance.on('changed', () => {
                eventEmitted = true;
            });

            instance.unset('testN');
            assert.strictEqual(eventEmitted, false, 'No changed event should be emitted when a notion is unset');
        });

    });

    describe('subclassing', function () {

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

});