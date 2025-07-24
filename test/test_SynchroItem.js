const assert = require('assert');
const SynchroItem = require('../lib/SynchroItem');

class TestClass extends SynchroItem {
    constructor() {
        super();
        this.prop1 = 'initial1';
        this.prop2 = 'initial2';
        this.nonObserved = 'initialNon';
        this.observed_properties = ['prop1', 'prop2'];
    }
    
    set prop1(value) { this._prop1 = value; this.dirty(); }
    get prop1() { return this._prop1; }
    
    set prop2(value) { this._prop2 = value; this.dirty(); }
    get prop2() { return this._prop2; }
    
    set nonObserved(value) { this._nonObserved = value; this.dirty(); }
    get nonObserved() { return this._nonObserved; }

    get an_array() { return ['a', 'b', 'c']; }
    get an_object() { return { key: 'value' }; }
};


describe('SynchroItem', function() {
    
    let instance;
    beforeEach(function() { instance = new TestClass(); });

    it('should emit change event for observed properties', function(done) {
        let eventCount = 0;
        const expectedEvents = [
            { property: 'prop1', current_value: 'new1', previous_value: 'initial1' },
            { property: 'prop2', current_value: 'new2', previous_value: 'initial2' }
        ];

        instance.on('change', (event) => {
            const expected = expectedEvents[eventCount];
            assert.strictEqual(event.property, expected.property, `Expected property ${expected.property}`);
            assert.strictEqual(event.current_value, expected.current_value, `Expected current_value ${expected.current_value}`);
            assert.strictEqual(event.previous_value, expected.previous_value, `Expected previous_value ${expected.previous_value}`);
            eventCount++;
            
            if (eventCount === 2) {
                done();
            }
        });

        instance.prop1 = 'new1';
        instance.prop2 = 'new2';
    });

    it('should not emit change event for non-observed properties', function(done) {
        let eventEmitted = false;

        instance.on('change', () => {
            eventEmitted = true;
        });

        instance.nonObserved = 'newNon';

        // Wait briefly to ensure no event is emitted
        setTimeout(() => {
            assert.strictEqual(eventEmitted, false, 'No change event should be emitted for non-observed property');
            done();
        }, 50);
    });

    it('should throw error for invalid observed properties', function() {

        assert.throws(() => {
            instance.observed_properties = 'an_array';
        }, TypeError);

        assert.throws(() => {
            instance.observed_properties = 'an_object';
        }, TypeError);

    });

});