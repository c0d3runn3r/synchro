const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');

class TestItem extends SynchroItem {

    #name;
    #id;
    constructor(id) {
        super();
        this.#id = id;

        this.observed_properties = ['name'];
    }

    get id() {
        return this.#id;
    }
    set name(value) {
        this.#name = value;
        this.dirty();
    }
    get name() {
        return this.#name;
    }
}


describe('SynchroSet', function () {

    let test_item;
    let test_set;
    beforeEach(function () {
        test_item = new TestItem("test-id");
        test_set = new SynchroSet(TestItem);
    });

    describe('basic set operations', function () {

        it('should accept a test item and add it to the set', function () {

            test_set.add(test_item);
            assert.strictEqual(test_set.find(test_item.id), test_item);
        });

        it('should throw an error if a non-instance of the managed class is added', function () {

            assert.throws(() => test_set.add({}), TypeError);
        });
    });

    describe('events', function () {
        it('should emit a SynchroSet#added event when an item is added', function (done) {
            test_set.on('added', (event) => {
                assert.strictEqual(event.item, test_item);
                done();
            });

            test_set.add(test_item);
        });

        it('should emit a SynchroSet#removed event when an item is removed', function (done) {
            test_set.on('removed', (event) => {
                assert.strictEqual(event.item, test_item);
                done();
            });

            test_set.add(test_item);
            test_set.remove(test_item);
        });

        it('should emit a SynchroSet#changed event when an item changes', function (done) {
            test_set.add(test_item);
            test_set.on('changed', ({ item, event }) => {

                assert.strictEqual(item, test_item);
                assert.strictEqual(event.property, 'name');
                assert.strictEqual(event.old_value, undefined);
                assert.strictEqual(event.new_value, 'new name');
                done();
            });

            test_item.name = 'new name';
        });

        it('should emit a SynchroSet#changed event when a notion is changed', function (done) {
            test_set.add(test_item);

            test_set.on('changed', ({ item, event }) => {

                assert.strictEqual(item, test_item);
                assert.strictEqual(event.property, 'nickname');
                assert.strictEqual(event.old_value, undefined);
                assert.strictEqual(event.new_value, 'benny');
                done();
            });

            test_item.set('nickname', 'benny');
        });
    });

    describe('transmission', function () {

        it("should transmit 'added' events", function (done) {

            const expected = `{"event_name":"added","item":{"id":"test-id","type":"TestItem","notions":{},"properties":{}}}`;
            test_set.transmit = (payload) => {

                assert.strictEqual(payload, expected);
                done();
            };

            test_set.add(test_item);
        });

        it("should transmit 'removed' events", function (done) {

            const expected = {"event_name":"removed","item":{"id":"test-id"}};
            test_set.add(test_item);
            test_set.transmit = (payload) => {

                assert.deepStrictEqual(JSON.parse(payload), expected);
                done();
            };

            test_set.remove(test_item);
        });

        it("should transmit 'changed' events when a tracked property changes", function (done) {

            const expected = {"event_name":"changed","change":{"property":"name","old_value":"old name","new_value":"new name"}};
            test_item.name = 'old name';
            test_set.add(test_item);
            test_set.transmit = (payload) => {

                assert.deepStrictEqual(JSON.parse(payload), expected);
                done();
            };

            test_item.name = 'new name';
        });

        it("should transmit 'changed' events when a notion changes", function (done) {

            const expected = {"event_name":"changed","change":{"property":"nickname","new_value":"benny","new_timestamp":"2025-07-24T22:45:58.729Z"}};
            test_set.add(test_item);
            test_set.transmit = (payload) => {

                assert.deepStrictEqual(JSON.parse(payload), expected);
                done();
            };

            test_item.set('nickname', 'benny', new Date('2025-07-24T22:45:58.729Z'));
        });
    });
});