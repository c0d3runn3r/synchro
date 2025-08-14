const SynchroSet = require('./SynchroSet');
const SynchroItem = require('./SynchroItem');

const STATE = { INITIAL: 0, POLLING: 3 };

/**
 * Client for connecting to a DatastoreServer and consuming SynchroSet data
 * 
 * @class DatastoreClient
 */
class DatastoreClient {

    #datastore;
    #synchroset;
    #path;
    #runloop_interval = 1000; // Default to 1s
    #pulsar = "10s";
    #polling_interval_ms = 10000; // Default to 10s
    #state = STATE.INITIAL;
    #running = false;
    #_runloop_busy = false; // Used to prevent re-entrancy issues
    #runloop_interval_id = null;
    #runloop_iterations = 0;
    #log;
    // Exponential backoff for INITIAL state reconnection attempts
    #backoff_max_delay_ms = 60000; // Maximum delay: 60 seconds (user configurable)
    #backoff_current_delay_ms = 0; // Current delay (calculated)
    #backoff_attempt_count = 0; // Number of failed attempts

    /**
     * Creates an instance of DatastoreClient.
     * @param {object} options 
     * @param {object} options.datastore the datastore to use, e.g. an Entangld instance. Must implement `get(key)` method.
     * @param {string} options.path the full path to the resource namespace, e.g. "api.v1.dogs"
     * @param {string} options.pulsar the pulsar to consume, e.g. "10s" for 10 second updates.  Must be one of the intervals defined in the server.  Call .pulsars() to get available pulsars.
     * @param {SynchroSet} options.synchroset the SynchroSet to populate with data from the server
     * @param {object} [options.log] optional logger object with methods: debug, info, warn, error
     * @param {number} [options.backoff_max_delay_ms=60000] maximum delay in milliseconds for exponential backoff during reconnection attempts
     * @throws {TypeError} if required options are missing or invalid
     */
    constructor(options = {}) {

        if (!options.datastore) { throw new TypeError('datastore is required'); }
        if (!options.synchroset) { throw new TypeError('synchroset is required'); }
        if (!options.path) { throw new TypeError('path is required'); }
        if (!(options.synchroset instanceof SynchroSet)) { throw new TypeError('synchroset must be an instance of SynchroSet'); }
        if (!options.pulsar) { throw new TypeError('pulsar is required'); }

        this.#datastore = options.datastore;
        this.#path = options.path;
        this.#synchroset = options.synchroset;
        this.#pulsar = options.pulsar;
        this.#runloop_interval = options.runloop_interval || 1000; // This is intentionally undocumented and only exists for testing purposes
        this.#log = options.log || { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        
        // Initialize exponential backoff parameters
        this.#backoff_max_delay_ms = options.backoff_max_delay_ms || 60000;
        this.#backoff_current_delay_ms = 0; // Start with no delay
        this.#backoff_attempt_count = 0;
    }

    /**
     * Waits for the current backoff delay if needed.
     * @private
     */
    async _waitForBackoff() {
        if (this.#backoff_current_delay_ms > 0) {
            this.#log.info(`waiting ${this.#backoff_current_delay_ms}ms before reconnection attempt ${this.#backoff_attempt_count + 1}`);
            await new Promise(resolve => setTimeout(resolve, this.#backoff_current_delay_ms));
        }
    }

    /**
     * Increments the backoff attempt counter and calculates the next delay.
     * @private
     */
    _incrementBackoff() {
        this.#backoff_attempt_count++;
        // Exponential backoff: 0ms, 1s, 2s, 4s, 8s, etc.
        if (this.#backoff_attempt_count === 1) {
            this.#backoff_current_delay_ms = 0; // No delay on first retry
        } else {
            const multiplier = 2;
            const base_delay = 1000; // 1 second
            this.#backoff_current_delay_ms = Math.min(
                base_delay * Math.pow(multiplier, this.#backoff_attempt_count - 2),
                this.#backoff_max_delay_ms
            );
        }
        this.#log.warn(`connection attempt ${this.#backoff_attempt_count} failed, next attempt in ${this.#backoff_current_delay_ms}ms`);
    }

    /**
     * Resets the backoff state when a successful connection is made.
     * @private
     */
    _resetBackoff() {
        if (this.#backoff_attempt_count > 0) {
            this.#log.info(`connection successful after ${this.#backoff_attempt_count} attempts, resetting backoff`);
        }
        this.#backoff_attempt_count = 0;
        this.#backoff_current_delay_ms = 0; // Reset to no delay
    }


    async _runloop() {

        if (!this.#running) { return; };    // In case we are shutting down
        if (this.#_runloop_busy) {
            this.#log.warn(`runloop is busy, skipping this iteration`);
            return;
        }
        this.#_runloop_busy = true;
        this.#runloop_iterations++;

        try {
            if (this.#state === STATE.INITIAL) {

                // Verify the classname matches what we expect.  Keep trying if no name, but stop if it's wrong. This is to handle the case where the server is not ready / available
                this.#log.debug(`Validating server (attempt ${this.#backoff_attempt_count + 1})`);
                const server_class_name = await this.#datastore.get(`${this.#path}.classname`);
                if (server_class_name) {

                    if (server_class_name !== this.#synchroset.managed_class?.name) {
                        this.#log.error(`Class name mismatch: expected ${this.#synchroset.managed_class?.name}, got ${server_class_name}.`);
                        this.stop();
                        return;
                    }
                } else {

                    this.#log.debug(`No class name found, waiting for server to be ready (make sure your path is correct)`);
                    // This is normal "waiting for server" behavior, not a connection failure
                    // Don't trigger backoff, just return and try again on next runloop
                    return;
                }
                this.#log.info(`class name ${server_class_name} validated`);

                // Verify the specified pulsar is available
                const available_pulsars = await this.pulsars();
                if (!(this.#pulsar in available_pulsars)) {
                    this.#log.error(`Pulsar ${this.#pulsar} is not available. Available pulsars: ${Object.keys(available_pulsars).join(', ')}`);
                    this.stop();
                    return;
                }
                this.#log.debug(`pulsar '${this.#pulsar}' validated`);

                // Fetch the initial data and update the SynchroSet
                this.#log.info(`fetching initial data from ${this.#path}.all`);
                const all_items = await this.#datastore.get(`${this.#path}.all`);

                // Convert plain objects to class instances
                const class_instances = all_items ? all_items.map(item => this.#synchroset.managed_class.fromObject(item)) : [];
                this.#synchroset.update_set_to(class_instances);

                // Connection successful - reset backoff and transition to POLLING
                this._resetBackoff();
                this.#log.debug(`moving to POLLING state`);
                this.#polling_interval_ms = DatastoreClient.polling_interval_to_ms(this.#pulsar);
                this.#state = STATE.POLLING;
                this.#runloop_iterations = 0;   // Reset

            } else if (this.#state === STATE.POLLING) {

                const elapsed_ms = this.#runloop_iterations * this.#runloop_interval;
                if (elapsed_ms >= this.#polling_interval_ms) {

                    this.#log.debug(`polling for updates after ${elapsed_ms}ms`);
                    this.#runloop_iterations = 0; // Reset for next interval

                    // Fetch the latest data from the pulsar
                    const updates = await this.#datastore.get(`${this.#path}.pulsars.${this.#pulsar}`);
                    await this._process_updates(updates);
                }

            }
        } catch (error) {
            if (this.#state === STATE.INITIAL) {
                // Connection attempt failed in INITIAL state - apply backoff
                this.#log.warn(`connection attempt failed: ${error.message}`);
                this._incrementBackoff();
                // Wait for backoff delay before next attempt
                await this._waitForBackoff();
            } else {
                // Error in other states - just log
                this.#log.error(`runloop error: ${error.message}`);
            }
        } finally {
            this.#_runloop_busy = false;
        }
    }

    /**
     * Process updates from the pulsar, including checksum verification
     * @private
     * @param {string[]} updates - Array of update strings from the pulsar
     */
    async _process_updates(updates) {

        // If no updates, just return
        if (!updates || updates.length === 0) { return; }

        // Check if the first update is checksum metadata
        let metadata = null;

        try {
            const firstUpdate = JSON.parse(updates[0]);
            if (firstUpdate.event_name === 'comment' && firstUpdate._metadata === true) {
                metadata = firstUpdate;
                this.#log.debug(`received checksum metadata: start=${metadata.start_checksum}, end=${metadata.end_checksum}`);
            }
        } catch (e) { }  // Not valid JSON or not metadata, treat as regular update
        

        // Perform integrity checks if we have metadata
        if (metadata) {
            const currentChecksum = this.#synchroset.checksum;

            // Check if we already have the end state
            if (metadata.end_checksum === currentChecksum) {
                this.#log.debug(`end checksum matches current state, ignoring updates`);
                return; // Skip processing
            }

            // Check if our current state matches the expected start state
            if (metadata.start_checksum && metadata.start_checksum !== currentChecksum) {
                this.#log.error(`checksum mismatch: expected start checksum ${metadata.start_checksum}, but current checksum is ${currentChecksum}. Processing updates anyway.`);
            }
        }

        // Apply all updates (SynchroSet will ignore comments)
        updates.forEach(update => { this.#synchroset.receive(update); });

        // Verify end checksum if we have metadata
        if (metadata && metadata.end_checksum) {
            const finalChecksum = this.#synchroset.checksum;
            if (finalChecksum !== metadata.end_checksum) {
                this.#log.error(`checksum mismatch after applying updates: expected ${metadata.end_checksum}, but got ${finalChecksum}`);
            } else {
                this.#log.debug(`checksum verification successful: ${finalChecksum}`);
            }
        }


    }

    /**
     * Schedule the next runloop iteration after the current one completes
     * @private
     */
    _scheduleNextRunloop() {
        if (!this.#running) { return; }

        this.#runloop_interval_id = setTimeout(async () => {
            await this._runloop();
            // Schedule the next iteration
            this._scheduleNextRunloop();
        }, this.#runloop_interval);
    }

    /**
     * Connect to the datastore server and validate the connection
     * @throws {Error} if the connection fails or class name doesn't match
     */
    async start() {

        this.#log.info(`starting client for path: ${this.#path}`);
        if (this.#running) { throw new Error('client is already running'); }
        this.#running = true;

        // Reset backoff state when starting
        this._resetBackoff();

        // Start the runloop with proper async handling
        this._scheduleNextRunloop();

        this.#log.info(`client started for path: ${this.#path}`);
    }

    /**
     * Get a list of available pulsar intervals
     * @returns {string[]} array of available pulsar interval strings (e.g., ['10s', '100ms'])
     */
    async pulsars() {

        return await this.#datastore.get(`${this.#path}.pulsars`);
    }


    /**
     * Stop updating
     */
    stop() {

        this.#log.info(`stopping`);
        if (!this.#running) { throw new Error('client is not running'); }
        this.#running = false;
        if (this.#runloop_interval_id) { clearTimeout(this.#runloop_interval_id); this.#runloop_interval_id = null; }
        this.#state = STATE.INITIAL;
        this.#_runloop_busy = false;
        
        // Reset backoff state when stopping
        this._resetBackoff();
    }

    /**
     * Convert a polling interval string to milliseconds.
     * @param {string} interval the interval string, e.g. '10s' or '500ms'
     * @returns {number} the interval in milliseconds
     * @throws {TypeError} if the interval is not a string or is in an invalid format
     */
    static polling_interval_to_ms(interval) {
        if (typeof interval !== 'string') { throw new TypeError('Interval must be a string'); }
        const match = interval.match(/^(\d+)(ms|s)$/);
        if (!match) { throw new TypeError('Invalid interval format, expected "10s" or "500ms"'); }
        const value = parseInt(match[1], 10);
        if (match[2] === 'ms') {
            return value; // milliseconds
        } else if (match[2] === 's') {
            return value * 1000; // convert seconds to milliseconds
        } else {
            throw new TypeError('Invalid interval unit, expected "ms" or "s"');
        }
    }

    /**
     * Trigger a resync by moving back to INITIAL state.
     * This will cause the client to re-fetch all data from the server.
     * Backoff state is reset to allow immediate reconnection attempt.
     */
    resync() {
        if (!this.#running) {
            throw new Error('client is not running, call start() first');
        }
        
        this.#log.info('triggering resync - moving to INITIAL state');
        this.#state = STATE.INITIAL;
        this._resetBackoff();
        this.#runloop_iterations = 0;
    }


    get synchroset() { return this.#synchroset; }
    get path() { return this.#path; }
    get pulsar() { return this.#pulsar; }
    get running() { return this.#running; }

    /**
     * Get the current state of the client.
     * 
     * @returns {string} the current state as a string, e.g., 'INITIAL', 'POLLING'
     */
    get state() { return Object.keys(STATE).find(key => STATE[key] === this.#state) || 'UNKNOWN'; }

    get log() { return this.#log; }
    set log(l) { this.#log = l; }

    /**
     * Get the current backoff attempt count.
     * @returns {number} number of failed connection attempts
     */
    get backoffAttemptCount() { return this.#backoff_attempt_count; }

    /**
     * Get the current backoff delay in milliseconds.
     * @returns {number} current backoff delay in milliseconds
     */
    get backoffCurrentDelayMs() { return this.#backoff_current_delay_ms; }
}

module.exports = DatastoreClient;
