const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');

class TestItem extends SynchroItem {

    #name;
    #id;
    constructor(id) {
        super();
        this.#id = id;
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

    it('should accept a test item and add it to the set', function () {

        test_set.add(test_item);
        assert.strictEqual(test_set.find(test_item.id), test_item);
    });

    it('should throw an error if a non-instance of the managed class is added', function () {

        assert.throws(() => test_set.add({}), TypeError);
    });

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
});