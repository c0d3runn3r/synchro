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

    #classname;
    #transmit;
    #items = new Map();

    /**
     * SynchroSet manages a class of objects 
     * 
     * @param {Class} classname the class of objects we are managing
     */
    constructor(classname) {

        super();
        this.#classname = classname;
    }

    /**
     * Add an item to the master set
     * @param {Class} item item that is an instance of the class we are managing
     * @throws {TypeError} if the item is not an instance of the class we are managing
     * @throws {Error} if the item already exists in the master set 
     */
    add(item) {

        if (!(item instanceof this.#classname)) { throw new TypeError(`Expected an instance of ${this.#classname.name}`); }
        if (this.#items.has(item.id)) { throw new Error(`Item with ID ${item.id} already exists`); }

        this.#items.set(item.id, item);
        item.on('changed', (event) => this.emit('changed', { item, event }));
        this.emit('added', { item });
    }

    /**
     * Remove an item from the master set
     * @param {Class} item 
     */
    remove(item) {

        if (!(item instanceof this.#classname)) { throw new TypeError(`Expected an instance of ${this.#classname.name}`); }
        if (!this.#items.has(item.id)) { throw new Error(`Item with ID ${item.id} does not exist`); }

        this.#items.delete(item.id);
        item.removeAllListeners('changed');
        this.emit('removed', { item });
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

}

module.exports = SynchroSet;