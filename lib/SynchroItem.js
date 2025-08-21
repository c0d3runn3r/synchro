const EventEmitter = require('node:events').EventEmitter;
const Notion = require('./Notion');
const v4 = require('node:crypto').randomUUID;
const crypto = require('node:crypto');

/**
 * @event SynchroItem#changed
 * @type {object}
 * @property {SynchroItem} item - The item that changed 
 * @property {string} property - The name of the changed property.
 * @property {*} old_value - The previous value of the property.
 * @property {*} new_value - The new value of the property.
 */



/**
 * SynchroItem is a base class for items that can be synchronized.
 * 
 * It stores both properties and notions, allowing change observation for both.
 * A checksum is available to uniquely identify the state of the item.  Note that the checksum calculation
 * attempts to be deterministic, but relies on JSON.stringify() if you set a property to an object or array.
 * This won't necessarily break anything, but it may be worth digging deeper into if it causes issues.
 */
class SynchroItem extends EventEmitter {

    #observed_properties = {};
    #notions = {};
    #id;
    #checksum = null;

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
     * Convert a value to a deterministic string representation
     * @private
     * @static
     */
    static _value_to_string(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value.toString();
        return JSON.stringify(value); // fallback
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
            notion.on('changed', (event)=>{ 
                this.#checksum = null; // Invalidate checksum when notion changes, before emitting events
                this.emit('changed', { item: this, ...event }); 
                this.emit(`changed:${name}`, { item: this, ...event });
            });
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
     * Get a notion by name
     * @param {string} name the name of the notion
     * @returns {Notion} the notion object
     */
    notion(name) {

        if (typeof name !== 'string') { throw new TypeError('Expected name to be a string'); }
        const notion = this.#notions[name];
//        if (!notion) { throw new Error(`No notion with name ${name}`); }
        return notion;
    }

    /**
     * Get a notion value by name
     * @param {string} name the name of the notion
     * @returns {*} the value of the notion
     */
    get(name) { return this.notion(name)?.value; }
            
        

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

        for (const propertyname in this.#observed_properties) {

            const property = this.#observed_properties[propertyname];
            const old_value = property.old_value;
            const new_value = this[propertyname];

            if (new_value !== old_value) {
                property.old_value = new_value;
                this.#checksum = null;  // Have to do this before emitting events to ensure checksum will be recalculated if they need it 
                this.emit('changed', { item: this, property: propertyname, new_value, old_value });
                this.emit(`changed:${propertyname}`, { item: this, property: propertyname, new_value, old_value });
            }
        }

    }

    /**
     * Recalculate the checksum for this item
     * @private
     */
    recalculate_checksum() {
        
        const parts = [];
        
        // Always include ID and type first
        parts.push(`id:${this.id}`);
        parts.push(`type:${this.constructor.name}`);
        
        // Sort and include observed properties
        const prop_keys = Object.keys(this.#observed_properties).sort();
        for (const key of prop_keys) {
            const value = this.#observed_properties[key].old_value;
            parts.push(`prop:${key}:${SynchroItem._value_to_string(value)}`);
        }
        
        // Sort and include notions
        const notion_keys = Object.keys(this.#notions).sort();
        for (const key of notion_keys) {
            const notion = this.#notions[key];
            parts.push(`notion:${key}:${SynchroItem._value_to_string(notion.value)}:${notion.timestamp.toISOString()}`);
        }
        
        const deterministic_string = parts.join('|');
        this.#checksum = crypto.createHash('sha256').update(deterministic_string, 'utf8').digest('hex');
    }

    /**
     * Get the checksum for this item
     * @returns {string} The SHA256 checksum of this item's state
     */
    get checksum() {
        if (this.#checksum === null) {
            this.recalculate_checksum();
        }
        return this.#checksum;
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

    /**
     * Create a new instance of this class from a plain object
     * 
     * Note that throwing an error in this constructor will trigger a resync with the server (since it indicates a fundamental misunderstanding).
     * Be thoughtful therefore...
     * 
     * @throws {TypeError} if the input is not a valid object
     * @param {object} obj The plain object to create the instance from
     * @returns {SynchroItem} The created instance
     */
    static fromObject(obj) {
        if (!obj || typeof obj !== 'object') { throw new TypeError(`${this.constructor.name}.fromObject() expects an object but got ${typeof obj}`); }
        if (typeof obj.id !== 'string') { throw new TypeError(`${this.constructor.name}.fromObject() expects id to be a string but got ${typeof obj.id}`); }
        if (typeof obj.type !== 'string') { throw new TypeError(`${this.constructor.name}.fromObject() expects type to be a string but got ${typeof obj.type}`); }
        if(obj.type !== this.name) { throw new TypeError(`${this.constructor.name}.fromObject() expects type to be ${this.name} but got ${obj.type}`); }

        const instance = new this(obj.id);

        for (const item of Object.values(obj.notions)) {
            instance.set(item.name, item.value, item.timestamp);
        }

        for (const name in obj.properties) {
            instance[name] = obj.properties[name];
        }

        return instance;
    }

    serialize() {
        return JSON.stringify(this.toObject());
    }

    /**
     * Get all notions
     * 
     * @returns {Notion[]}
     */
    get notions() { return Object.values(this.#notions); }

    static deserialize(serialized) {
        if (typeof serialized !== 'string') { throw new TypeError('Expected serialized to be a string'); }
        const obj = JSON.parse(serialized);
        return this.fromObject(obj);
    }

    /**
     * Update this item to another SynchroItem instance, causing relevant events to be emitted.
     * 
     * This will copy all observed properties and notions from the given item to this item.
     * @param {SynchroItem} target the item to update to
     * @throws {TypeError} if the item is not an instance of SynchroItem
     */ 
    update_to(target) {

        if (!(target instanceof this.constructor)) { throw new TypeError(`Expected an instance of ${this.constructor.name}`); }

        // Iterate all our watched properties and set each one to the value from the new item, if diffent
        for (const propertyname in this.#observed_properties) {
            const old_value = this[propertyname];
            const new_value = target[propertyname];
            if (new_value !== old_value) { this[propertyname] = new_value; }
        }

        // We need to update our notions to match the new item. 
        for (const my_notion of this.notions) {

            // If the new item has the notion, we update ours
            const target_notion = target.notion(my_notion.name);
            if (target_notion) {

                if (target_notion.value !== my_notion.value || target_notion.timestamp !== my_notion.timestamp) {
                    this.set(my_notion.name, target_notion.value, target_notion.timestamp);
                }
            // If the new item does not have the notion, we remove it
            } else {
                this.unset(my_notion.name);
            }
        }

        // If the new item has notions that we don't have, we add them
        for (const notion of target.notions) {

            if (!(notion.name in this.#notions)) {this.set(notion.name, notion.value, notion.timestamp); }
        }

        
    }

}

module.exports = SynchroItem;
