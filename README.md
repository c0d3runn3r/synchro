# Synchro - Remote Set Synchronization
<img src="mascot.jpg" width="200" alt="Synchro Mascot" style="float: left; margin-right: 15px; margin-bottom: 10px;">
Welcome to Synchro, a zero dependency NodeJS library designed to synchronize sets of objects across different locations using message passing, checksums, and just a pinch of magic. 

Synchro provides two classes: `SynchroItem`, which can be used on it's own to observe property changes, and `SynchroSet` to synchronize sets of items by passing messages.


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

## Installation
```bash
npm install --save synchro
```


```nodejs
const synchro = require('synchro');
synchro.syncObjects(myData, { location: 'remote' });
```

Check the [API documentation](docs/API.md) for advanced usage and options.

