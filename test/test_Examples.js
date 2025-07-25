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

    it("example 1 - synchronizing a bot between sets", function () {

        // Create synchronized sets
        const master = new SynchroSet(Bot);
        const slave = new SynchroSet(Bot);
        master.transmit = (payload) => { slave.receive(payload); };


        // A bot added the master should exist in the slave
        master.add(new Bot('bot-123'));
        assert.ok(slave.all().length == 1);

        // // But wait, we wanted to watch it happen!
        master.on('added', (event) => { assert.equal(event.item.id, 'bot-456'); });
        slave.on('added', (event) => { assert.equal(event.item.id, 'bot-456'); });
        master.add(new Bot('bot-456'));

        // Let's watch the bot's name change
        slave.find('bot-123').on('changed', (event) => { assert.equal(event.property, 'name'); assert.equal(event.new_value, 'New Bot Name'); });
        master.find('bot-123').name = 'New Bot Name';


    });

});