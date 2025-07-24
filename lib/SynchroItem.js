const EventEmitter = require('node:events').EventEmitter;

class SynchroItem extends EventEmitter {

    #observed_properties = {};

    /**
     * Sets the properties to observe.
     * @param {string[]} properties - An array of property names to observe.
     * @throws {TypeError} If the input is not an array.
     */
    set observed_properties(properties) {
        
        // Properties must be an array of strings
        if (!properties || !Array.isArray(properties)) { throw new TypeError('Expected an array of properties to observe'); }
        if(properties.reduce((acc, item) => acc && typeof item === 'string', true) === false) { throw new TypeError('All items in the array must be strings'); }

        // Reset the observed properties
        this.#observed_properties = properties.reduce((acc, name) => { acc[name] = { name, previous_value: undefined }; return acc; }, {});
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
            const previous_value = item.previous_value;
            const current_value = this[property];

            if (current_value != previous_value) {
                item.previous_value = current_value;
                this.emit('change', { property, current_value, previous_value });
            }
        }
    }
}
   
module.exports = SynchroItem;