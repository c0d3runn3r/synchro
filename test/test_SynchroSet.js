const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const { Test } = require('mocha');

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

        it('.add() should accept an item of the proper type', function () {

            test_set.add(test_item);
            assert.strictEqual(test_set.find(test_item.id), test_item);
        });

        it('.add() should throw an error if a non-instance of the managed class is added', function () {

            assert.throws(() => test_set.add({}), TypeError);
        });

        it('.find() should find an item by ID', function () {
            test_set.add(test_item);
            assert.strictEqual(test_set.find(test_item.id), test_item);
        });

        it('.find() should return undefined if an item is not found by ID', function () {
            assert.strictEqual(test_set.find('non-existent-id'), undefined);
        });

        it('.all() should return all items in the set', function () {
            test_set.add(test_item);
            const all_items = test_set.all();
            assert.strictEqual(all_items.length, 1);
            assert.strictEqual(all_items[0], test_item);
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

            const expected = {"event_name":"changed","item":{"id":"test-id"},"change":{"property":"name","old_value":"old name","new_value":"new name"}};
            test_item.name = 'old name';
            test_set.add(test_item);
            test_set.transmit = (payload) => {

                assert.deepStrictEqual(JSON.parse(payload), expected);
                done();
            };

            test_item.name = 'new name';
        });

        it("should transmit 'changed' events when a notion changes", function (done) {

            const expected = {"event_name":"changed","item":{"id":"test-id"},"change":{"property":"nickname","new_value":"benny","new_timestamp":"2025-07-24T22:45:58.729Z"}};
            test_set.add(test_item);
            test_set.transmit = (payload) => {

                assert.deepStrictEqual(JSON.parse(payload), expected);
                done();
            };

            test_item.set('nickname', 'benny', new Date('2025-07-24T22:45:58.729Z'));
        });
    });

    describe('reception', function () {

        it("should handle 'added' events", function () {

            const payload = `{"event_name":"added","item":{"id":"test-id","type":"TestItem","notions":{},"properties":{}}}`;
            test_set.receive(payload);
            assert.strictEqual(test_set.find('test-id').id, 'test-id');
        });

        it("should handle 'removed' events", function () {

            test_set.add(test_item);
            const payload = `{"event_name":"removed","item":{"id":"test-id"}}`;
            test_set.receive(payload);
            assert.strictEqual(test_set.find('test-id'), undefined);
        });

        it("should throw if a 'removed' event is received for an item that does not exist", function () {

            const payload = `{"event_name":"removed","item":{"id":"non-existent-id"}}`;
            assert.throws(() => test_set.receive(payload), {
                message: /Item with ID non-existent-id not found/
            });
        });

        it("should handle 'changed' events for properties", function () {

            test_set.add(test_item);
            test_item.name = 'old name';
            const payload = `{"event_name":"changed", "item":{"id":"test-id"}, "change":{"property":"name","old_value":"old name","new_value":"new name"}}`;
            test_set.receive(payload);
            assert.strictEqual(test_item.name, 'new name');
        });

        it("should handle 'changed' events for notions", function () {

            test_set.add(test_item);
            const payload = `{"event_name":"changed","item":{"id":"test-id"},"change":{"property":"nickname","new_value":"benny","new_timestamp":"2025-07-24T22:45:58.729Z"}}`;
            test_set.receive(payload);
            assert.strictEqual(test_item.get('nickname'), 'benny');
        });

    });
});