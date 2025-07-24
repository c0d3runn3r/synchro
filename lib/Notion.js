EventEmitter = require('events').EventEmitter;

/**
 * Emitted when the value changes.
 * @event Notion#changed
 * @type {object}
 * @property {string} property - The name of the changed property.
 * @property {*} old_value - The previous value of the property.
 * @property {*} new_value - The new value of the property.
 */

/**
 * Represents a Notion, which is a key-value pair with a timestamp.
 * @fires Notion#changed
 */
class Notion extends EventEmitter {

    #name;
    #value;
    #timestamp;
    #default_value;
    #setter_mapping;

    /**
     * Creates a new Notion instance.
     * @param {string} name - The name of the notion.
     * @param {*} default_value - The default value of the notion.
     * @param {object} [setter_mapping] - Optional mapping for setter. Will cause .set_value() to set value and timestamp using specific keys instead of the raw values passed to it.
     * @param {string} [setter_mapping.value] - The key to use to find the value when set with an object.
     * @param {string} [setter_mapping.timestamp] - The key to use to find the timestamp when set with an object.
     * @throws {Error} If setter_mapping is provided but not an object or is missing the required keys.
     */
    constructor(name, default_value, setter_mapping) {

        super();
        this.#name = name;
        this.#default_value = default_value;

        if (setter_mapping) {
            if (typeof setter_mapping?.value !== 'string') { throw new Error('setter_mapping must have a "value" key of type string.'); }
            if (typeof setter_mapping?.timestamp !== 'string') { throw new Error('setter_mapping must have a "timestamp" key of type string'); }
            this.#setter_mapping = setter_mapping;
        }
    }

    toObject() {

        return {
            name: this.#name,
            value: this.value,
            timestamp: this.#timestamp
        };
    }

    /**
     * Creates a Notion instance from an object.
     * @param {object} obj - The object to create the Notion from.
     * @throws {TypeError} If the object is not valid or missing required properties.
     * @returns {Notion} A new Notion instance.
     */
    static fromObject(obj) {

        if (!obj || typeof obj !== 'object') { throw new TypeError('Expected an object'); }
        if (typeof obj.name !== 'string') { throw new TypeError('Expected name to be a string'); }

        return new Notion(obj.name, obj.value, { timestamp: obj.timestamp });
    }

    /**
     * Returns the name of the notion.
     * @returns {string} The name of the notion.
     */
    get name() {
        return this.#name;
    }

    /**
     * Returns the value of the notion.
     * If the value is not set, it returns the default value.
     * @returns {*} The value of the notion or the default value if not set.
     */
    get value() {
        return this.#value ?? this.#default_value;
    }

    /**
     * Returns the timestamp of the last update.
     * @returns {Date} The timestamp of the last update, or undefined if not set.
     */
    get timestamp() {
        return this.#timestamp;
    }

    /**
     * Convenience setter for set_value()
     * @param {*} value - The value to set for the notion.
     */
    set value(value) { this.set_value(value, new Date()); }

    /**
     * Sets the value and timestamp of the notion.
     * 
     * If setter_mapping was set in the constructor, and if we pass an object with matching keys,
     * we will use those values instead of the raw `value` and `timestamp` parameters.
     * 
     * @param {*} value 
     * @param {Date|string} timestamp - A Date object or a string that can be parsed by the Date constructor
     * @throws {Error} If timestamp is neither a valid Date object nor a valid date string
     */
    set_value(value, timestamp) {

        // Use setter_mapping to find keys in the object if possible
        if (this.#setter_mapping) {
            if (typeof value === 'object') {
                let value_object = value;
                if (this.#setter_mapping.value in value_object) {
                    value = value_object[this.#setter_mapping.value];
                }
                if (this.#setter_mapping.timestamp in value_object) {
                    timestamp = value_object[this.#setter_mapping.timestamp];
                }
            }
        }

        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid timestamp string. Must be a valid date string parseable by Date.');
            }
        } else {
            throw new Error('Invalid timestamp type. Must be a Date object or a valid date string.');
        }

        let old_value = this.#value; // Store the old value for event emission
        let old_timestamp = this.#timestamp; // Store the old timestamp for event emission
        this.#value = value;
        this.#timestamp = date;

        this.emit('changed', {
            property: this.#name,
            old_value: old_value,
            new_value: this.#value,
            old_timestamp: old_timestamp,
            new_timestamp: this.#timestamp
        });
    }
}

module.exports = Notion;