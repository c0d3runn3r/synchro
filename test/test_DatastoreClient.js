const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const DatastoreClient = require('../lib/DatastoreClient');
const DatastoreServer = require('../lib/DatastoreServer');
const Entangld = require('entangld');
const { Logger } = require('yalls');

class Dog extends SynchroItem { }

describe('DatastoreClient', function () {

    let datastore, synchroset, client, logger;

    beforeEach(function () {
        datastore = new Entangld();
        synchroset = new SynchroSet(Dog);
        logger = Logger.console("test");
        logger.set_log_level('debug'); 
        client = new DatastoreClient({
            datastore: datastore,
            path: 'test.dogs',
            synchroset: synchroset,
            pulsar: '100ms',     // Short interval for testing, normally would be e.g. '10s'
            runloop_interval: 50 // Short interval for testing
        });
    });

    afterEach(function () {

        // In case an assert blows things up before we can clean up
        if (client.running) {
            client.stop();
        }
    });

    describe('start()', function () {

        it('should keep checking the server until it gets a response', async function () {

            this.slow(400); // Allow time for polling

            let attempts = 0;
            datastore.set('test.dogs.classname', ()=>{ attempts++; return null; }); // Null response will keep client polling

            // Start the client - it should begin polling
            assert.strictEqual(client.state, 'INITIAL'); // Should start in INITIAL state
            await client.start();
            assert.strictEqual(client.state, 'INITIAL'); 

            // Wait a bit to let it poll and stay in INITIAL state (no classname yet)
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.strictEqual(client.state, 'INITIAL'); // Should still be in INITIAL state
            assert.strictEqual(attempts, 1); // Should have polled at least once

            // Wait longer to verify it keeps polling
            await new Promise(resolve => setTimeout(resolve, 120));
            assert.strictEqual(client.state, 'INITIAL'); // Should still be in INITIAL state
            assert.strictEqual(attempts, 3); // Should have polled at least 3 times
            assert.strictEqual(client.running, true); // Should still be running

            // Clean up
            client.stop();
        });

        it('should stop if it receives an incorrect class name', async function () {

            this.slow(400); // Allow time for polling

                // Mock a server with an incorrect class name
                datastore.set('test.dogs.classname', 'Cat');
                datastore.set('test.dogs.all', []);
                datastore.set('test.dogs.pulsars', { '10s': [] }); // Set a pulsar to avoid errors

                // Start the client
                await client.start();
                assert.strictEqual(client.state, 'INITIAL');

                // Wait for the client to poll and receive the incorrect class name.  It should then stop itself
                await new Promise(resolve => setTimeout(resolve, 60));
                assert.strictEqual(client.state, 'INITIAL'); 
                assert.strictEqual(client.running, false); // Should have stopped

            // No cleanup needed - client already stopped itself
        });

        it('should stop if the specified pulsar is not available', async function () {

            this.slow(400); // Allow time for polling

            // Mock a server with an incorrect pulsar
            datastore.set('test.dogs.classname', 'Dog');
            datastore.set('test.dogs.pulsars', { '5s': [] }); // Set a pulsar that is not the one we want
            datastore.set('test.dogs.all', []); // Set an empty all endpoint

            // Start the client
            await client.start();
            assert.strictEqual(client.state, 'INITIAL');

            // Wait for the client to poll and receive the incorrect pulsar.  It should then stop itself
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.strictEqual(client.state, 'INITIAL'); 
            assert.strictEqual(client.running, false); // Should have stopped
        });


        it('should move to POLLING state once everything is verified', async function () {

            this.slow(400); // Allow time for polling

            // Mock a server 
            datastore.set('test.dogs.classname', 'Dog');
            datastore.set('test.dogs.all', []); 
            datastore.set('test.dogs.pulsars', { '100ms': [] }); 

            // Start the client
            await client.start();
            assert.strictEqual(client.state, 'INITIAL');
            
            // Wait for the polling interval to pick up the correct classname
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.strictEqual(client.state, 'POLLING'); // Should now be in POLLING state
            assert.strictEqual(client.running, true); // Should still be running

            // Clean up
            client.stop();
        });
    });

    describe('polling', function () {

        it('should poll for updates at the specified interval', async function () {

            this.slow(400); // Allow time for polling

            // Mock a server with a 100ms pulsar
            let started = null;
            let checked = null;
            datastore.set('test.dogs.classname', 'Dog');
            datastore.set('test.dogs.all', []); 
            datastore.set('test.dogs.pulsars.100ms', function() { checked = new Date(); return []; }); 
            client.start();

            // Wait until the state changes to POLLING, then record the start time
            do { await new Promise(resolve => setTimeout(resolve, 20)); } while (client.state !== 'POLLING');
            started = new Date();

            // Wait until the first polling interval has passed
            do { await new Promise(resolve => setTimeout(resolve, 20));  } while (!checked);

            // Measure the time it took to check the pulsar
            const elapsed = new Date() - started;
            assert(elapsed >= 100 && elapsed < 120, `Pulsar should have been checked after about 100ms, but took ${elapsed}ms`);

            // Stop the client
            client.stop();
        });
    });

    describe('misc functions', function () {

        it('pulsars() should return available pulsar intervals', async function () {

            datastore.set('test.dogs.pulsars', {
                '10s': [],
                '500ms': [],
            });
            const pulsars = await client.pulsars();
            assert.ok(pulsars.hasOwnProperty('10s'));
            assert.ok(pulsars.hasOwnProperty('500ms'));
        });

        it('polling_interval_to_ms() should convert polling intervals to milliseconds', function () {

            assert.strictEqual(DatastoreClient.polling_interval_to_ms('10s'), 10000);
            assert.strictEqual(DatastoreClient.polling_interval_to_ms('500ms'), 500);
            assert.strictEqual(DatastoreClient.polling_interval_to_ms('1s'), 1000);
            assert.throws(() => DatastoreClient.polling_interval_to_ms(10), TypeError);
            assert.throws(() => DatastoreClient.polling_interval_to_ms('invalid'), TypeError);
        });
    });

});