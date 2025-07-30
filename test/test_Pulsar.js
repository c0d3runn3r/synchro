const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const Pulsar = require('../lib/Pulsar');

describe('Pulsar', function () {

    let pulsar, ss, result;
    beforeEach(function () {
        pulsar = new Pulsar();
        pulsar.transmit = (payload) => { result = payload; };
        ss = new SynchroSet();
        ss.transmit = pulsar;
    });

    it('should properly queue a single added item', function () {
        const item = new SynchroItem('item1');
        ss.add(item);
        pulsar.trigger();
        assert.strictEqual(result.length, 1);
        assert.equal(result[0], '{"event_name":"added","item":{"id":"item1","type":"SynchroItem","notions":{},"properties":{}}}');
    });

    it('should result in no events when an item is added and then removed', function () {
        const item = new SynchroItem('item1');
        ss.add(item);
        ss.remove(item);
        pulsar.trigger();
        assert.strictEqual(result.length, 0);
    });

    it('multiple change events for the same item should be collapsed', function () {
        const item = new SynchroItem('item1');
        ss.add(item);
        item.set('testN', 'value1', new Date("2025-07-28T16:47:03Z"));
        item.set('testN', 'value2', new Date("2025-07-28T16:47:04Z"));
        item.set('testN', 'value3', new Date("2025-07-28T16:47:05Z"));
        pulsar.trigger();
        assert.deepStrictEqual(JSON.parse(result[0]), {"event_name":"added","item":{"id":"item1","type":"SynchroItem","notions":{},"properties":{}}});
        assert.deepStrictEqual(JSON.parse(result[1]), {"event_name":"changed","item":{"id":"item1"},"change":{"property":"testN","new_value":"value3","new_timestamp":"2025-07-28T16:47:05.000Z"}});
        assert.ok(typeof JSON.parse(result[1]).change.old_value == 'undefined'); // Because the initial value is undefined

        //assert.strictEqual(result.length, 1);
    });

});