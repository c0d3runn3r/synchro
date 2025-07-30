const { clear } = require("jsdoc-to-markdown");
const SynchroItem = require("./SynchroItem");
const SynchroSet = require("./SynchroSet");


/**
 * A Pulsar collects events from a SynchroSet, optionall coalesces them, and 
 * transmits them a bundle at a set interval.
 */
class Pulsar {

    #interval_timer;
    #interval;
    #collapse;
    #transmit;
    #added={};
    #changes_by_id = {};
    #queue = [];
    #allow_empty;

    constructor(opts={ interval: 0, collapse: true, transmit: null, allow_empty: true }) {

        this.#interval = opts.interval ?? 0; // Default to never
        this.#collapse = opts.collapse ?? true; // Default to collapsing events
        this.#transmit = opts.transmit ?? null; // Default to no transmit function
        this.#allow_empty = opts.allow_empty ?? true; // Default to allowing empty transmissions

        if (this.#interval > 0 && this.#interval < 100) { throw new RangeError('Interval must be at least 100ms'); }
    }

    start() {

        // Clear any existing interval timer
        if (this.#interval_timer) { this.stop(); }

        // If we have a positive interval, start the timer
        if (this.#interval > 0) {
            this.#interval_timer = setInterval(() => this.trigger(), this.#interval);
        }
    }

    stop() {
        if (this.#interval_timer) {
            clearInterval(this.#interval_timer);
            this.#interval_timer = null;
        }
    }

    /**
     * Get whether empty transmissions are allowed.
     * 
     * @returns {boolean} true if empty transmissions are allowed, false otherwise
     */
    get allow_empty() { return this.#allow_empty; }

    /**
     * Set whether empty transmissions are allowed.
     * An empty transmission is where a .trigger() or the interval fires, but there are no events to send.
     * 
     * @param {boolean} value true to allow empty transmissions, false to disallow
     */
    set allow_empty(value) { this.#allow_empty = !!value; }

    /**
     * Get the current interval in milliseconds.
     * 
     * @returns {number} the current interval in milliseconds
     */
    get interval() { return this.#interval; }

    /**
     * Set the interval in milliseconds.
     * 
     * @throws {RangeError} if the interval is less than 100ms
     * @param {number} value the new interval in milliseconds
     */
    set interval(value) {  

        if (value > 0 && value < 100) { throw new RangeError('Interval must be at least 100ms'); }

        // If we are running, stop the current interval
        if (this.#interval_timer) { 
            this.stop();

            this.#interval = value; // Set the new interval
            if (this.#interval > 0) { this.start(); } // Start the new interval if it's positive
        } else {

            this.#interval = value; // Just set the new interval without starting it
         }
    }

    /**
     * Set the transmit function to be used to send changes to remote listeners
     *
     * @param {function({string} payload)|[function({string} payload)]} fn function or array of functions that will transmit our event payloads. Set to null to disable transmission.
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
     * Send all events, optionally collapsing them into a single bundle.
     * 
     * 
     */
    trigger() {

        // If #transmit is not set or empty, we do nothing
        if (!this.#transmit || this.#transmit.length === 0) { this.empty(); return; }

        // Collapse the queue to an array of non nul payloads
        let bundle = this.#queue.filter(e => e !== null).map(e => e.payload);

        // If the bundle is empty and empty transmissions are not allowed, we do nothing
        if (bundle.length === 0 && !this.#allow_empty) { this.empty(); return; }

        // Send the bundle to all transmit functions
        for (const fn of this.#transmit) { fn(bundle); }
        this.empty();
    }

    /**
     * Receive an event and add it to the queue.
     * 
     * @param {string} event_name the event name, like 'added', 'removed', or 'changed'
     * @param {SynchroItem} item the item associated with the event
     * @param {object} change the change details, like { property, old_value, new_value, new_timestamp }
     */
    queue(event_name, item, change) {


        // If we are not collapsing, we just push the event payload
        if (!this.#collapse) { return this.#queue.push({ payload: SynchroSet.payload(event_name, item, change) }); }

        // We are collapsing events.  
        if(event_name == "added") {   

            // Added items are also tracked in an index of added items in case they are later removed
            this.#added[item.id] = this.#queue.push({ payload: SynchroSet.payload(event_name, item, change) }) - 1; // Convert to zero-based index
            return;
        }

        // Removing an item causes us to check whether it was added in this queue run already
        if(event_name == "removed") {

            if(item.id in this.#added) {

                // We previously added this item. Delete the record of it being added
                const index = this.#added[item.id]; 
                this.#queue[index] = null; // Remove from the queue
                delete this.#added[item.id];   // Remove from the added index

            } else {

                this.#queue.push({payload: SynchroSet.payload(event_name, item, change) }); // Not previously added, just push the payload
            }

            // Whether or not we had added this item, we need to remove any change events for it
            let changes = this.#changes_by_id[item.id]||[];
            for (const index of changes) {
                this.#queue[index] = null; // Remove the change from the queue
            }
            delete this.#changes_by_id[item.id]; // Remove from the changes index
            return;
        }

        if(event_name == "changed") {

            // Ensure we have a change array for this item
            if (!(item.id in this.#changes_by_id)) { this.#changes_by_id[item.id] = []; }

            // Iterate through the changes for this item in reverse order, looking for the most recent change to this property
            let changes = this.#changes_by_id[item.id] || [];
            let not_yet_foud = true;
            for (let i = changes.length - 1; i >= 0; i--) {

                const index_of_previous_change_event = changes[i];
                const previous_change_event = this.#queue[index_of_previous_change_event];
                if (previous_change_event?.event_name !== 'changed') { continue; } // Not a change event, skip it
                if (previous_change_event?.change?.property === change.property) {

                    // The first time we find a change for this property is the most recent one
                    if(not_yet_foud){
                        change.old_value = previous_change_event?.change?.old_value; // Update the old value to the old old value
                        not_yet_foud = false; 
                    }

                    this.#queue[index_of_previous_change_event] = null; // Remove the change from the queue
                    changes[i] = null; // Remove from the changes index
                }
            }
            // Remove null entries from the changes index
            this.#changes_by_id[item.id] = changes.filter(c => c !== null);

            // Add the change to the queue and the changes index
            const index = this.#queue.push({payload: SynchroSet.payload(event_name, item, change), event_name, change, item: {id: item.id } }) - 1; // Convert to zero-based index
            this.#changes_by_id[item.id].push(index);
            return;
        }
    }

    /**
     * Empty the queue
     * 
     * This will clear the queue and reset everything to a clean state.
     */
    empty() {

        this.#queue = [];
        this.#added = {};
        this.#changes_by_id = {};
    }

}

module.exports = Pulsar;