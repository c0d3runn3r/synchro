const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const DatastoreServer = require('../lib/DatastoreServer');
const DatastoreClient = require('../lib/DatastoreClient');
const Entangld = require('entangld');
const { Logger } = require('yalls');

class Dog extends SynchroItem { }


describe('DatastoreServer <-> DatastoreClient', function () {

    let datastore, server, client, client_synchroset, server_synchroset, logger;

    beforeEach(async function () {

        datastore = new Entangld();
        client_synchroset = new SynchroSet(Dog);
        server_synchroset = new SynchroSet(Dog);
        logger = Logger.console("test");
        logger.set_log_level('debug'); 
        server = new DatastoreServer({
            datastore: datastore,
            base_path: 'test',
            synchroset: server_synchroset,
            update_intervals: [.1],
            allow_empty_transmissions: true
        });
        client = new DatastoreClient({
            datastore: datastore,
            path: 'test.dogs',
            pulsar: '100ms', 
            synchroset: client_synchroset,
            allow_empty_transmissions: true,
            runloop_interval: 50 // rediculously short interval for testing

        });


        // Start the server
        await server.start();

    });

    afterEach(function () {

        if (client.running) {
            client.stop();
        }
        if (server.running) {
            server.stop();
        }
    }); 

    it('client should synchronize objects on connect', async function () {

        this.slow(500); 

        // Capture any errors that occur
        let errors=[];
        client.log = { debug: () => {}, info: () => {}, warn: () => {}, error: (msg) => { errors.push(msg); } };

        // Add a dog to the server
        const dog = new Dog('dog1');
        server_synchroset.add(dog);
        assert.equal(server_synchroset.find('dog1').id, 'dog1');

        // Connect the client and wait for it to start polling
        //client.log = logger; 
        await client.start();
        while (client.state === 'INITIAL') { await new Promise(resolve => setTimeout(resolve, 50)); }

        // Make sure the dog is in the client
        await new Promise(resolve => setTimeout(resolve, 150)); 
        assert.strictEqual(client_synchroset.find('dog1').id, 'dog1');

        // Make sure the client did not try to apply the updates payload (this tests the checksum check)
        assert.ok(!errors.some(e => e.includes('already exists')), 'client should skip applying irrelevant updates');

        // Anything else
        assert.equal(errors.length, 0, 'No errors should have occurred during synchronization');
        
    });

    it('adding an object to a running server should make it appear in already connected client', async function () {

        this.slow(500); 

        // Connect the client and wait for it to start polling
        // client.log = logger; 
        await client.start();
        while (client.state === 'INITIAL') { await new Promise(resolve => setTimeout(resolve, 50)); }

        // Add a dog to the server
        const dog = new Dog('dog1');
        server_synchroset.add(dog);
        assert.equal(server_synchroset.find('dog1').id, 'dog1');

        // Make sure the dog is in the client
        await new Promise(resolve => setTimeout(resolve, 150)); // Wait for the pulsar to transmit
        assert.strictEqual(client_synchroset.find('dog1').id, 'dog1');
    });


});
