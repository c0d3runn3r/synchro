const EventEmitter = require('node:events').EventEmitter;
const Notion = require('./Notion');
const v4 = require('node:crypto').randomUUID;

/**
 * @event SynchroItem#changed
 * @type {object}
 * @property {string} property - The name of the changed property.
 * @property {*} old_value - The previous value of the property.
 * @property {*} new_value - The new value of the property.
 */



/**
 * SynchroItem is a base class for items that can be synchronized.
 */
class SynchroItem extends EventEmitter {

    #observed_properties = {};
    #notions = {};
    #id;

    constructor(id) {
        super();
        this.#id = id || v4();
    }

    /**
     * Get our ID
     * 
     * @abstract please override this in your subclass to use your actual ID
     * @returns {string} the ID of this item
     */
    get id() {
        return this.#id;
    }

    /**
     * Sets the properties to observe.
     * @param {string[]} properties - An array of property names to observe.
     * @throws {TypeError} If the input is not an array.
     */
    set observed_properties(properties) {
        
        // Properties must be an array of strings
        if (!properties || !Array.isArray(properties)) { throw new TypeError('Expected an array of properties to observe'); }
        if(properties.reduce((acc, item) => acc && typeof item === 'string', true) === false) { throw new TypeError('All items in the array must be strings'); }

        // Each property must result in a string, number, boolean, undefined, or null
        for (const name of properties) {
            const val = this[name];
            if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean' && val !== undefined && val !== null) {
                throw new TypeError(`Property ${name} must be a string, number, boolean, undefined, or null`);
            }
        }

        // Reset the observed properties
        this.#observed_properties = properties.reduce((acc, name) => { acc[name] = { name, old_value: undefined }; return acc; }, {});
        this.dirty();
    }

    /**
     * Gets the names of the observed properties.
     * @returns {string[]} An array of observed property names.
     */
    get observed_properties() {
        return Object.keys(this.#observed_properties);
    }

    /**
     * Sets a notion value, adding it if it doesn't exist.
     * 
     * This is an alternative to subclassing the SynchroItem and using properties.
     * 
     * @param {string} name the name of the notion
     * @param {*} value the value of the notion
     * @param {Date|string} [timestamp] the timestamp of the notion
     * @emits SynchroItem#changed (actually Notion#changed)
     */
    set(name, value, timestamp) {
        
        if (typeof name !== 'string') { throw new TypeError('Expected name to be a string'); }

        // Get the notion or create a new one
        let notion = this.#notions[name];
        if (!this.#notions[name]) { 

            notion = new Notion(name);
            this.#notions[name] = notion;
            notion.on('changed', this._notion_changed.bind(this));
        }
    
        notion.set_value(value, timestamp || new Date());
    }

    /**
     * Remove a notion by name
     * @param {string} name the name of the notion
     */
    unset(name) {

        if (typeof name !== 'string') { throw new TypeError('Expected name to be a string'); }

        const notion = this.#notions[name];
        if (!notion) { throw new Error(`No notion with name ${name}`); }
        notion.removeAllListeners('changed');

        delete this.#notions[name];

    }

    /**
     * Handle notion change events
     * 
     * We don't check to see if the notion has really changed... maybe we should?  Though notions come with timestamps, so
     * it is often the case that the value has not changed but the timetamp has.  We can optimize this later if it becomes a problem.
     * 
     * @private
     * @param {*} event the event object from the notion
     */
    _notion_changed(event) { this.emit('changed', event); }

    /**
     * Get a notion by name
     * @param {string} name the name of the notion
     * @returns {Notion} the notion object
     */
    notion(name) {

        if (typeof name !== 'string') { throw new TypeError('Expected name to be a string'); }
        const notion = this.#notions[name];
        if (!notion) { throw new Error(`No notion with name ${name}`); }
        return notion;
    }

    /**
     * Get a notion value by name
     * @param {string} name the name of the notion
     * @returns {*} the value of the notion
     */
    get(name) { return this.notion(name).value; }
            
        

    /**
     * Something has changed that may result in a change to a watched property.
     * 
     * This function should be called whenever a property that is being observed may have changed.
     * It will check all observed properties and emit a 'changed' event if any of them
     * have changed since the last time this function was called.
     * 
     * Notions are handled separately and do not need to be checked here.
     * 
     * @emits SynchroItem#changed
     */
    dirty() {

        for (const property in this.#observed_properties) {

            const item = this.#observed_properties[property];
            const old_value = item.old_value;
            const new_value = this[property];

            if (new_value != old_value) {
                item.old_value = new_value;
                this.emit('changed', { property, new_value, old_value });
            }
        }
    }

    toObject() {

        const obj = {
            id: this.id,
            type: this.constructor.name,
            notions: {},
            properties: {}
        };

        for (const name in this.#notions) {
            obj.notions[name] = this.#notions[name].toObject();
        }

        for (const name in this.#observed_properties) {
            obj.properties[name] = this.#observed_properties[name].old_value;  // This is the last known value of the property
        }

        return obj;
    }

    static fromObject(obj) {
        if (!obj || typeof obj !== 'object') { throw new TypeError('Expected an object'); }
        if (typeof obj.id !== 'string') { throw new TypeError('Expected id to be a string'); }
        if (typeof obj.type !== 'string') { throw new TypeError('Expected type to be a string'); }
        if(obj.type !== this.name) { throw new TypeError(`Expected type to be ${this.name}`); }

        const instance = new this(obj.id);

        for (const item of Object.values(obj.notions)) {
            instance.set(item.name, item.value, item.timestamp);
        }

        for (const name in obj.properties) {
            instance[name] = obj.properties[name];
        }
        instance.observed_properties = Object.keys(obj.properties);

        return instance;
    }

}

module.exports = SynchroItem;
