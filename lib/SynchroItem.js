const EventEmitter = require('node:events').EventEmitter;
const v4 = require('node:crypto').randomUUID;

class SynchroItem extends EventEmitter {

    #observed_properties = {};
    #id;

    constructor() {
        super();
        this.#id = v4();
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

    dirty() {

        for (const property in this.#observed_properties) {

            const item = this.#observed_properties[property];
            const old_value = item.old_value;
            const new_value = this[property];

            if (new_value != old_value) {
                item.old_value = new_value;
                this.emit('change', { property, new_value, old_value });
            }
        }
    }
}
   
module.exports = SynchroItem;