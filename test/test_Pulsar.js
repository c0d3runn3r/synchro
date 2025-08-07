const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const Pulsar = require('../lib/Pulsar');

describe('Pulsar', function () {

    let pulsar, ss, result;
    beforeEach(function () {
        pulsar = new Pulsar({include_checksums: false});
        pulsar.transmit = (payload) => { result = payload; };
        ss = new SynchroSet();
        ss.transmit = pulsar;
    });

    it('should properly queue a single added item', function () {
        const item = new SynchroItem('item1');
        ss.add(item);
        pulsar.trigger();
        assert.strictEqual(result.length, 1);
        assert.deepStrictEqual(JSON.parse(result[0]), {"event_name":"added","item":{"id":"item1","type":"SynchroItem","notions":{},"properties":{}}});
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

    });

    it('adding multiple items and events, triggering, then removing one item shoud result in properly collapsed set', function(){

        const item = new SynchroItem('item1');
        const item2 = new SynchroItem('item2');

        ss.add(item);    
        ss.add(item2);
        item.set('testN', 'value1', new Date("2025-07-28T16:47:03Z"));
        item2.set('testN2', 'value1', new Date("2025-07-28T16:47:03Z"));

        pulsar.trigger();

        item.set('testN', 'value2', new Date("2025-07-28T16:47:04Z"));
        item.set('testN', 'value3', new Date("2025-07-28T16:47:05Z"));

        item2.set('testN2', 'value2', new Date("2025-07-28T16:47:04Z"));
        item2.set('testN2', 'value3', new Date("2025-07-28T16:47:05Z"));
        ss.remove(item);

        pulsar.trigger();

        // We should now only have item2, with a single change from value1 -> value3 and the removal of item1
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(JSON.parse(result[0]), {"event_name":"changed","item":{"id":"item2"},"change":{"property":"testN2","new_value":"value3","old_value":"value1","new_timestamp":"2025-07-28T16:47:05.000Z"}});
        assert.deepStrictEqual(JSON.parse(result[1]), {"event_name":"removed","item":{"id":"item1"}});

    });

    it('should not transmit automatically if there is nothing to send and empty transmissions are disallowed', function (done) {

        pulsar.interval = 100; // Set a short interval for testing
        pulsar.allow_empty = false; // Disable empty transmissions
        pulsar.transmit = (payload) => { 
            
            // If we receive a payload, we fail the test
            assert.fail(`the pulsar just sent a payload, but it should not have: ${payload}`);
        };
        pulsar.start(); // Start the Pulsar

        // Wait 150ms to ensure no transmission occurs
        setTimeout(() => {
            pulsar.stop(); // Stop the Pulsar
            done();
        }, 150);
    });

    it('should transmit if there is something to send even if empty transmissions are disallowed', function (done) {

        pulsar.interval = 100; // Set a short interval for testing
        pulsar.allow_empty = false; // Disable empty transmissions
        pulsar.transmit = (payload) => { 
            assert.ok(payload.length > 0, 'the pulsar sent a payload, but it should not have been empty');
            pulsar.stop(); // Stop the Pulsar after sending
            done();
        };
        pulsar.start(); // Start the Pulsar

        // Add an item to trigger a transmission
        const item = new SynchroItem('item1');
        ss.add(item);

    });

    it('should include checksum metadata when include_checksums is enabled', function () {
        // Create a new Pulsar with checksums enabled
        const p = new Pulsar({include_checksums: true});
        let checksumResult;
        p.transmit = (payload) => { checksumResult = payload; };
        
        const s = new SynchroSet();
        s.transmit = p;

        const item = new SynchroItem('item1');
        s.add(item);
        p.trigger();

        // Should have 2 elements: metadata comment first, then the actual event
        assert.strictEqual(checksumResult.length, 2);
        
        // First element should be the checksum metadata
        const metadata = JSON.parse(checksumResult[0]);
        assert.strictEqual(metadata.event_name, 'comment');
        assert.strictEqual(metadata._metadata, true);
        assert.ok(metadata.start_checksum);
        assert.ok(metadata.end_checksum);
        
        // Second element should be the actual event
        const event = JSON.parse(checksumResult[1]);
        assert.strictEqual(event.event_name, 'added');
        assert.strictEqual(event.item.id, 'item1');
    });

    it('should not include checksum metadata when include_checksums is disabled', function () {
        // This is already tested in the existing tests, but let's be explicit
        const p = new Pulsar({include_checksums: false});
        let noChecksumResult;
        p.transmit = (payload) => { noChecksumResult = payload; };
        
        const s = new SynchroSet();
        s.transmit = p;

        const item = new SynchroItem('item1');
        s.add(item);
        p.trigger();

        // Should have 1 element: just the actual event
        assert.strictEqual(noChecksumResult.length, 1);
        
        // Should be the actual event, not metadata
        const event = JSON.parse(noChecksumResult[0]);
        assert.strictEqual(event.event_name, 'added');
        assert.strictEqual(event.item.id, 'item1');
    });

});