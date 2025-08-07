# Synchro - Remote Set Synchronization
<img src="mascot.jpg" width="200" alt="Synchro Mascot" style="float: left; margin-right: 15px; margin-bottom: 10px;">
Welcome to Synchro, a zero dependency NodeJS library designed to synchronize sets of objects across different locations using message passing, checksums, and just a pinch of magic. 

Synchro provides `SynchroItem`, which can be used on its own to observe property changes, and `SynchroSet` to synchronize sets of items by passing messages. `Pulsar` coalesces updates into low bandwith bundles and sends them at specified intervals, also functioning as a sort of ping so you can know if your client and server are connected.  `DatastoreServer` will automatically wire everything up to run over Pulsars using a datastore (like [Entangld](https://www.npmjs.com/package/entangld)).


## Example using ad-hoc properties
```nodejs
    const {SynchroSet, SynchroItem} = require("@novadynamics/synchro");

    // Create synchronized sets
    const master = new SynchroSet(SynchroItem);
    const slave = new SynchroSet(SynchroItem);
    master.transmit = (payload) => { slave.receive(payload); };

    // An item added to the master appears in the slave
    master.add(new SynchroItem('item-123'));
    assert.ok(slave.all().length == 1);

    // Changes to master items mirror to the slave set
    slave.find('item-123').on("change:giraffe", (event) => { console.log(`my ${event.property} just changed`); })
    master.find('item-123').set('giraffe', 'tall');

```

## Example using subclassing
```nodejs
    const {SynchroSet, SynchroItem} = require("@novadynamics/synchro");

    // Subclass to create a Bot with a managed .name property
    class Bot extends SynchroItem {

        constructor(id) {
            super(id);                              
            this.observed_properties = ['name'];    // required for property observation
        }

        set name(value) {
            this._name = value;
            this.dirty();                           // required for property observation
        }
        get name() { return this._name; }
    }

    // Create synchronized sets of Bots
    const master = new SynchroSet(Bot);     
    const slave = new SynchroSet(Bot);
    master.transmit = (payload) => { slave.receive(payload); };

    // A bot added the master appears in the slave
    master.add(new Bot('bot-123'));
    assert.ok(slave.all().length == 1);

    // But wait, we wanted to watch it happen - on both ends
    master.on('added', (event) => { assert.equal(event.item.id, 'bot-456'); });
    slave.on('added', (event) => { assert.equal(event.item.id, 'bot-456'); });
    master.add(new Bot('bot-456'));

    // Let's watch the bot's name change
    slave.find('bot-123').on('changed', (event) => { assert.equal(event.property, 'name'); assert.equal(event.new_value, 'New Bot Name'); });
    master.find('bot-123').name = 'New Bot Name';

    // Named events are also supported
    slave.find('bot-456').on('changed:name', (event) => { assert.equal(event.new_value, 'Another Bot Name'); });
    master.find('bot-456').name = 'Another Bot Name';

```

## Property observation example
Property observation is built in to SynchroItem subclasses, it works like this:

```nodejs
    const {SynchroItem} = require("@novadynamics/synchro");

    const o = new Bot("abc-123");
    o.on("changed:name",(event)=>{ /* event.old_value, event.new_value, etc */});

```

## How is this different from Entangld?  
Entangld synchronizes endpoints, but does not provide tools for managing discrete objects.  So if you put a Dog into Entangld, the thing you get out won't be a Dog anymore.  Synchro makes it so that the thing going in is also the thing going out.  Synchro also causes the two objects to be synchronized, so a change to one Dog will happen to the other Dog, and native Nodejs events work magically on both ends.  Synchro does all of this using extremely low bandwidth, thanks to Pulsars.  

## DatastoreServer/Client: using Synchro over a datastore
The `DatastoreServer` and `DatastoreClient` classes in this library provide a uniform way to use Synchro functionality over a datastore, i.e. a service that provides get/set functionality.  While Entangld uses subscriptions, these can be somewhat fragile over a network; and managing this fragility is complex, especially without accidentally making multiple subscriptions.  This may be a well-solved problem with services like `Redis`, but rather than creating a complex state engine I simply made a polling loop that polls the Pulsar.  This is not really the bad thing that it sounds since it is extremely robust, uses almost no bandwidth when nothing has changed, and only costs us "realtime-ness" by degree since we are using Pulsars anyway.  It also means we can use datastore services that do not support pub/sub.  The tradeoff is that for a Pulsar interval of `n` seconds, our data now has a limiting case lag of `2n` seconds (since we may poll right after the update).

## Installation
```bash
npm install --save synchro
```


```nodejs
const synchro = require('synchro');
synchro.syncObjects(myData, { location: 'remote' });
```

Check the [API documentation](docs/API.md) for advanced usage and options.

## TODO
- [ ] Add a test (that fails) for when we apply a payload that is not needed
- [ ] Update SynchroSet to be able to generate checksums
- [ ] Update Pulsar so it shares before and after checksums
- [ ] Update the client so it checks before/after checksums and only applies needed payloads
- [ ] Make sure the test from part 1 passes
- [ ] Capture out-of-sync problems and refresh (write a test, update the client, etc)