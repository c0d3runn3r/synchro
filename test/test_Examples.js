const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');


class Bot extends SynchroItem {
    constructor(id) {
        super(id);
        this.observed_properties = ['name'];
    }

    set name(value) {
        this._name = value;
        this.dirty();
    }
    get name() {
        return this._name;
    }
}

describe('Examples', function () {

    it("example 1 - ad hoc properties", function () {
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
    });

    it("example 2 - synchronizing a bot between sets", function () {

        // Create synchronized sets
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


    });

});