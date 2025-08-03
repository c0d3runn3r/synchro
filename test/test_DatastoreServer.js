const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const DatastoreServer = require('../lib/DatastoreServer');
const Entangld = require('entangld');

class Dog extends SynchroItem { }

describe('DatastoreServer', function () {

    let datastore, server, synchroset;

    beforeEach(function () {
        datastore = new Entangld();
        synchroset = new SynchroSet(Dog);
        server = new DatastoreServer({
            datastore: datastore,
            base_path: 'test.dogs',
            synchroset: synchroset,
            update_intervals: [10],
            allow_empty_transmissions: true
        });
    });

    describe('constructor', function () {

        it('constructing with an invalid update_intervals throws', function () {
            assert.throws(() => new DatastoreServer({ update_intervals: [10, -5] }), TypeError);
            assert.throws(() => new DatastoreServer({ update_intervals: [10, 'string'] }), TypeError);
        });

        it('constructor creates a default, empty 10s update endpoint', async function () {

            assert.strictEqual((await datastore.get('test.dogs.pulsars.10s')).length, 0);
        });

        it('constructor with multiple custom update intervals create multiple update endpoints', async function () {

            const server = new DatastoreServer({
                datastore: datastore,
                base_path: 'test.dogs',
                synchroset: synchroset,
                update_intervals: [0.1, 0.5, 1, 10],
                allow_empty_transmissions: true
            });
            const result = await datastore.get('test.dogs.pulsars');
            assert.ok(result.hasOwnProperty('100ms'));
            assert.ok(result.hasOwnProperty('500ms'));
            assert.ok(result.hasOwnProperty('1s'));
            assert.ok(result.hasOwnProperty('10s'));
        });

    });

    describe('datastore endpoints', function () {

        it(`'.all' endpoint serves all items`, async function () {

            // Add a dog to the synchroset
            const dog = new Dog('dog1');
            synchroset.add(dog);
            const result = await datastore.get('test.dogs.all');
            assert.strictEqual(result[0].id, 'dog1');
        });


        it(`'.pulsars.{nnn}{s|ms}' produces updates`, async function () {

            this.slow(400); // Set timeout to prevent warnings for the delay

            // Create a new server with a 100ms update interval
            datastore = new Entangld();
            server = new DatastoreServer({
                datastore: datastore,
                base_path: 'test.dogs',
                synchroset: synchroset,
                update_intervals: [0.1], // 100ms
                allow_empty_transmissions: true
            });

            // Start the server, which will connect the pulsars
            server.start();

            // Add a dog to the synchroset
            const dog = new Dog('dog1');
            synchroset.add(dog);

            // Wait 120ms to ensure the pulsar has time to transmit
            await new Promise(resolve => setTimeout(resolve, 120));
            const result = await datastore.get('test.dogs.pulsars.100ms');
            assert.deepStrictEqual(JSON.parse(result[0]), {"event_name":"added","item":{"id":"dog1","type":"Dog","notions":{},"properties":{}}});
            server.stop();
        });
    }); 

    // describe('paired datastores', function () {

    //     // Set up a connected pair of Entangld instances
    //     let parent = new Entangld();
    //     let child = new Entangld();
    //     parent.attach("child",child);
    //     parent.transmit((msg, store) => store.receive(msg,parent)); // store will always be child
    //     child.transmit((msg, store) => store.receive(msg, child)); // store will always be parent

    // });
});