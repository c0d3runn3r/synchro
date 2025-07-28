const SynchroItem = require('./SynchroItem');

const EventEmitter = require('node:events').EventEmitter;

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



class SynchroSet extends EventEmitter {

    #my_class;
    #transmit;
    #items = new Map();

    /**
     * SynchroSet manages a class of objects 
     * 
     * @param {Class} my_class the class of objects we are managing
     */
    constructor(my_class) {

        super();
        this.#my_class = my_class;
        this._on_changed = this._on_changed.bind(this);     // This is CRAZY but it works and lets us call .off() instead of .removeAllListeners(), which would break the ability to listen to SynchroItem events externally
    }

    /**
     * Set the transmit function to be used to send changes to remote listeners
     * 
     * @param {function|function[]} fn function or array of functions that take an event name and payload to transmit. Set to null to disable transmission.
     * @throws {TypeError} if the input is not a function or array of functions
     */
    set transmit(fn) {

        // If fn is null or undefined, we disable transmission
        if (fn === null || fn === undefined) {
            this.#transmit = null;
            return;
        }
        
        // If fn is a function, we set it as the transmit function
        if (typeof fn === 'function') {
            this.#transmit = [fn];

        // If fn is an array, we check that all items are functions
        } else if (Array.isArray(fn)) {

            if (fn.every(f => typeof f === 'function')) {
                this.#transmit = fn;
            } else {
                throw new TypeError('All items in the array must be functions');
            }
        } else {
            throw new TypeError('Expected a function, array of functions, or null');
        }
    }

    /**
     * Get the transmit function
     * @returns {function} the transmit function
     */
    get transmit() { return this.#transmit; }

    /**
     * Transmit an event to remote listener, if any
     * @private
     * @param {string} event_name the name of the event to transmit 
     * @param {SynchroItem} item the item associated with the event
     * @param {object} [event] the event object containing the change details
     */
    _transmit(event_name, item, event) {

        if (!this.#transmit) return;    // No transmission function set

        let cleaned_event={};
        cleaned_event.property = event?.property;
        cleaned_event.old_value = event?.old_value;
        cleaned_event.new_value = event?.new_value;
        cleaned_event.new_timestamp = event?.new_timestamp;

        let payload;
        switch(event_name) {
            case 'added':
                payload = JSON.stringify({ event_name, item: item.toObject() });
                break;
            case 'removed':
                payload = JSON.stringify({ event_name,  item: { id:item.id } });
                break;
            case 'changed':
                payload = JSON.stringify({ event_name, item: { id:item.id }, change: cleaned_event });
                break;
        }

        // Call all transmit functions
        for (const fn of this.#transmit) { fn(payload); }
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

}

module.exports = SynchroSet;