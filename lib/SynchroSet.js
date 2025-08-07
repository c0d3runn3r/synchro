const SynchroItem = require('./SynchroItem');
const EventEmitter = require('node:events').EventEmitter;
const crypto = require('node:crypto');

/**
 * @event SynchroSet#added
 * @property {SynchroItem} item - The item that was added
 */

/**
 * @event SynchroSet#removed
 * @property {SynchroItem} item - The item that was removed
 */

/**
 * @event SynchroSet#changed
 * @property {SynchroItem} item - The item that was changed
 * @property {SynchroItem#changed} event - The change event from the item
 */



/**
 * SynchroSet manages a set of objects of a given class, providing event-driven synchronization and transmission of changes.
 * 
 * @param {Class} my_class - The class constructor for the objects being managed.
 * 
 * @example
 * class MyItem extends EventEmitter { ... }
 * const set = new SynchroSet(MyItem);
 * 
 * @fires SynchroSet#added
 * @fires SynchroSet#removed
 * @fires SynchroSet#changed
 */
class SynchroSet extends EventEmitter {

    #my_class;
    #transmit;
    #items = new Map();
    #last_receive = null;
    #checksum = null;

    /**
     * SynchroSet manages a class of objects 
     * 
     * @param {Class} my_class the class of objects we are managing
     */
    constructor(my_class = SynchroItem) {

        super();
        this.#my_class = my_class;
        this._on_changed = this._on_changed.bind(this);     // This is CRAZY but it works and lets us call .off() instead of .removeAllListeners(), which would break the ability to listen to SynchroItem events externally
    }

    /**
     * Get the last receive time in seconds
     * 
     * @return {number} the age of the last receive in seconds, or Infinity if no receive has occurred
     */
    get last_receive_age_seconds() {
       
        return this.#last_receive ? (Date.now() - this.#last_receive.getTime()) / 1000 : Infinity;
    }

    /**
     * Set the transmit function to be used to send changes to remote listeners
     *
     * @param {function({string} payload)|[function({string} payload)]|Pulsar|[Pulsar]} fn function or array of functions or Pulsars that will transmit our event payloads. Set to null to disable transmission.
     * @throws {TypeError} if the input is not a function or array of functions
     */
    set transmit(fn) {

        // If fn is null or undefined, we disable transmission
        if (fn === null || fn === undefined) {
            this.#transmit = null;
            return;
        }
        
        // If fn is a function or a Pulsar, we set it as the transmit function
        if (typeof fn === 'function' || fn?.constructor?.name === 'Pulsar') {
            this.#transmit = [fn];

        // If fn is an array, we check that all items are functions
        } else if (Array.isArray(fn)) {

            if (fn.every(f => typeof f === 'function' || f?.constructor?.name === 'Pulsar')) {
                this.#transmit = fn;
            } else {
                throw new TypeError('All items in the array must be functions or Pulsars');
            }
        } else {
            throw new TypeError('Expected a function, Pulsar, array of functions, array of Pulsars, or null');
        }
    }

    /**
     * Get the transmit functions
     * @returns {[function]} the transmit functions
     */
    get transmit() { return this.#transmit; }

    /**
     * Transmit an event to remote listener, if any
     * @private
     * @param {string} event_name the name of the event to transmit, like 'added', 'removed', or 'changed'
     * @param {SynchroItem} item the item associated with the event
     * @param {object} [event] the event object containing the change details
     */
    _transmit(event_name, item, event) {

        if (!this.#transmit) return;    // No transmission function set

        const change = {
            property: event?.property,
            old_value: event?.old_value,
            new_value: event?.new_value,
            new_timestamp: event?.new_timestamp
        };

        // Call all transmit functions.  Pulsars get raw data, all others get string payloads
        for (const fn of this.#transmit) {

            const payload = SynchroSet.payload(event_name, item, change);
            if(fn?.constructor?.name === 'Pulsar') { fn.queue(event_name, item, change); continue; }
            fn(payload);
        }
    }

    /**
     * Create a payload for transmission based on the event type
     * @param {string} event_name the name of the event, like 'added', 'removed', or 'changed'
     * @param {SynchroItem} item the item associated with the event
     * @param {object} [change] the change details
     * @returns {string} the JSON stringified payload
     */
    static payload(event_name, item, change) {

        let payload;

        switch(event_name) {
            case 'added':
                payload = JSON.stringify({ event_name, item: item.toObject() });
                break;
            case 'removed':
                payload = JSON.stringify({ event_name,  item: { id:item.id } });
                break;
            case 'changed':
                payload = JSON.stringify({ event_name, item: { id:item.id }, change });
                break;
        }
        return payload;
    }

    /**
     * Handle incoming events from remote listeners
     * @param {string} str
     */
    receive(str) {

        const payload = JSON.parse(str);
        if (!payload?.event_name) { throw new TypeError('payload does not contain an event_name'); }

        let item;

        switch(payload.event_name) {
            case 'added':
                this.add(this.#my_class.fromObject(payload.item));
                break;
            case 'removed':
                this.remove(payload.item);
                break;
            case 'changed':
                item = this.find(payload.item.id);
                if (!item) { throw new Error(`Item with ID ${payload.item.id} not found for change event`); }

                // If the change has a new_timestamp, it is a notion change.  Not sure if this is hacky or not
                if (payload.change.new_timestamp) {
                    item.set(payload.change.property, payload.change.new_value, payload.change.new_timestamp);
                } else {
                    item[payload.change.property] = payload.change.new_value;
                }
                break;
            default:
                throw new Error(`Unknown event type: ${payload.event_name}`);
        }

        this.#last_receive = new Date();

    }

    /**
     * Add an item to the master set
     * @param {Class} item item that is an instance of the class we are managing
     * @throws {TypeError} if the item is not an instance of the class we are managing
     * @throws {Error} if the item already exists in the master set 
     */
    add(item) {

        if (!(item instanceof this.#my_class)) { throw new TypeError(`Expected an instance of ${this.#my_class.name}`); }
        if (this.#items.has(item.id)) { throw new Error(`Item with ID ${item.id} already exists`); }

        this.#items.set(item.id, item);
        item.on('changed', this._on_changed);

        this.#checksum = null; // Invalidate checksum before emitting events
        this.emit('added', { item });
        this._transmit('added', item);
    }

    /**
     * Called when an item changes
     * 
     * We do this here so that we can have a single event handler that can be removed with .off() instead of .removeAllListeners()
     * @private
     * @param {SynchroItem#changed} event 
     */
    _on_changed(event) {
        this.#checksum = null; // Invalidate checksum before emitting events
        this.emit('changed', {item: event.item, event });
        this._transmit('changed', event.item, event);
    }

    /**
     * Remove an item from the master set
     * @param {*} item the item to remove or an object with an id property
     * @param {string} item.id the ID of the item to remove 
     */
    remove(item) {

        // If we are given a string, see if it is an item ID
        if (!item.id) { throw new TypeError('Expected item to have an id property'); }

        if (!this.#items.has(item.id)) { throw new Error(`Item with ID ${item.id} not found`); }

        this.#items.delete(item.id);
        if(typeof item.off === 'function') item.off('changed', this._on_changed); // Must test first since sometimes item is just a stub object with an id property

        this.#checksum = null; // Invalidate checksum before emitting events
        this.emit('removed', { item });
        this._transmit('removed', item);
    }

    /**
     * Find an item by its ID
     * @param {string} id the ID of the item to find
     * @returns {Class} the item with the given ID
     * @throws {TypeError} if the ID is not a string
     */
    find(id) {

        if (typeof id !== 'string') { throw new TypeError('Expected id to be a string'); }
        return this.#items.get(id);
    }

    /**
     * Return an array of all items in the set
     * @returns {Class[]} an array of all items in the set
     */
    all() {
        return Array.from(this.#items.values());
    }

    /**
     * Update the set to match a given array of items, causing relevant events to be emitted
     * 
     * This is useful for forcefully synchronizing the set with a known state
     * 
     * @param {Class[]} items an array of items to update to
     * @throws {TypeError} if any item in the array is not an instance of the class we are managing
     * @emits SynchroSet#added
     * @emits SynchroSet#removed
     * @emits SynchroSet#changed
     */
    update_set_to(items = []) {

        // Make sure items is an array
        if (!Array.isArray(items)) { throw new TypeError('Expected items to be an array'); }

        // Make three lists: to add, to remove, and to update
        const add = [];
        const remove = [];
        const existing = [];   
        for(let item of items) {

            // Make sure the item is an instance of the managed class
            if (!(item instanceof this.#my_class)) { throw new TypeError(`Expected an instance of ${this.#my_class.name}, found ${item.constructor.name}`); }

            // Each of the new items will cause an add or update
            if (this.#items.has(item.id)) { existing.push(item); } else { add.push(item); }
        }

        // Now we need to find out which items to remove
        for(let item of this.#items.values()) { if (!items.some(i => i.id === item.id)) { remove.push(item); } }

        // Perform the adds, removes, and updates
        add.forEach(item => this.add(item));
        remove.forEach(item => this.remove(item));
        existing.forEach(item => this.#items[item.id].update_to(item));

    }

    /**
     * Get the managed class
     * @returns {Class} the class constructor for the objects being managed
     */
    get managed_class() {
        return this.#my_class;
    }

    /**
     * Generate a checksum for the entire set
     * @returns {string} A SHA256 checksum representing the state of all items in the set
     */
    get checksum() {
        if (this.#checksum === null) {
            this._recalculate_checksum();
        }
        return this.#checksum;
    }

    /**
     * Recalculate the checksum for the entire set
     * @private
     */
    _recalculate_checksum() {
        
        // Sort items by ID for consistent ordering
        const sorted_items = this.all().sort((a, b) => a.id.localeCompare(b.id));
        
        // Combine all individual item checksums
        const combined_checksums = sorted_items.map(item => item.checksum).join('');
        
        this.#checksum = crypto.createHash('sha256').update(combined_checksums, 'utf8').digest('hex');
    }

}

module.exports = SynchroSet;