class Corrupt {
    constructor() {
        this.enabled = false;
    }

    /**
     * Corrupts a string by changing one character 50% of the time when enabled
     * @param {string|string[]} item - string or array of strings to potentially corrupt
     * @returns {string|string[]} - Original or corrupted item
     */
    corrupt(item) {
        // If corruption is disabled, return unchanged
        if (!this.enabled) { return item; }

        // Only corrupt 50% of the time
        if (Math.random() > 0.5) { return item; }

        // If string or array is empty, return unchanged
        if (item.length === 0) { return item; }

        // If item is an array of strings, pick one element to corrupt
        if (Array.isArray(item)) {

            const index = Math.floor(Math.random() * item.length);
            let element = item[index];
            const pos = Math.floor(Math.random() * element.length);
            const char = element[pos];

            // Replace with a random printable ASCII character (33-126)
            const new_char = String.fromCharCode(33 + Math.floor(Math.random() * 94));
            let new_element = element.substring(0, pos) + new_char + element.substring(pos + 1);
            item[index] = new_element;
            return item;
        }

        // Item is a string. Pick a random position to corrupt
        const pos = Math.floor(Math.random() * item.length);
        const char = item[pos];
        
        // Replace with a random printable ASCII character (33-126)
        const new_char = String.fromCharCode(33 + Math.floor(Math.random() * 94));

        return item.substring(0, pos) + new_char + item.substring(pos + 1);
    }



    /**
     * Toggle corruption on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        console.log(`Corruption ${this.enabled ? 'enabled' : 'disabled'}`);
    }
}

module.exports = Corrupt;
