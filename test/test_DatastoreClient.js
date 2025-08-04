const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const DatastoreClient = require('../lib/DatastoreClient');
const DatastoreServer = require('../lib/DatastoreServer');
const Entangld = require('entangld');

class Dog extends SynchroItem { }

describe('DatastoreClient', function () {

    let datastore, synchroset, client;

    beforeEach(function () {
        datastore = new Entangld();
        synchroset = new SynchroSet(Dog);
        client = new DatastoreClient({
            datastore: datastore,
            path: 'test.dogs',
            synchroset: synchroset,
            runloop_interval: 50 // Short interval for testing
        });
    });

    describe('start()', function () {

        it('should keep checking the server until it gets a response', async function () {

            this.slow(400); // Allow time for polling

            // Start the client - it should begin polling
            await client.start();
            assert.strictEqual(client.state, 'INITIAL'); // Should start in INITIAL state

            // Wait a bit to let it poll and stay in INITIAL state (no classname yet)
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.strictEqual(client.state, 'INITIAL'); // Should still be in INITIAL state

            // Wait longer to verify it keeps polling
            await new Promise(resolve => setTimeout(resolve, 120));
            assert.strictEqual(client.state, 'INITIAL'); // Should still be in INITIAL state
            assert.strictEqual(client.running, true); // Should still be running

            // Clean up
            client.stop();
        });

        it('should stop if it receives an incorrect class name', async function () {

            this.slow(400); // Allow time for polling

            // Start the client
            await client.start();
            assert.strictEqual(client.state, 'INITIAL');

            // Set an incorrect class name - client should stop with error
            await datastore.set('test.dogs.classname', 'Cat');
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.strictEqual(client.state, 'INITIAL'); 
            assert.strictEqual(client.running, false); // Should have stopped

            // No cleanup needed - client already stopped itself
        });

        it('should move to POLLING state once correct class name is received', async function () {

            this.slow(400); // Allow time for polling

            // Start the client
            await client.start();
            assert.strictEqual(client.state, 'INITIAL');

            // Set the correct class name and data
            await datastore.set('test.dogs.classname', 'Dog');
            await datastore.set('test.dogs.all', []);
            
            // Wait for the polling interval to pick up the correct classname
            await new Promise(resolve => setTimeout(resolve, 60));
            assert.strictEqual(client.state, 'POLLING'); // Should now be in POLLING state
            assert.strictEqual(client.running, true); // Should still be running

            // Clean up
            client.stop();
        });
    });

});