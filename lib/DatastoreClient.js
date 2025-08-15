const SynchroSet = require('./SynchroSet');
const SynchroItem = require('./SynchroItem');
const Backoff = require('./Backoff');

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
    #backoff;

    /**
     * Creates an instance of DatastoreClient.
     * @param {object} options 
     * @param {object} options.datastore the datastore to use, e.g. an Entangld instance. Must implement `get(key)` method.
     * @param {string} options.path the full path to the resource namespace, e.g. "api.v1.dogs"
     * @param {string} options.pulsar the pulsar to consume, e.g. "10s" for 10 second updates.  Must be one of the intervals defined in the server.  Call .pulsars() to get available pulsars.
     * @param {SynchroSet} options.synchroset the SynchroSet to populate with data from the server
     * @param {object} [options.logger] optional logger object with methods: debug, info, warn, error
     * @param {number[]} [options.backoff_steps] array of backoff intervals in seconds (default: [1,2,4,8,16,32,60])
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
        this.#log = options.logger || { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
        
        this.#backoff = new Backoff(options.backoff_steps ?? [1, 2, 4, 8, 16, 32, 60]);
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

                // Verify the classname matches what we expect.  
                this.#log.debug(`Validating server (attempt ${this.#backoff.current_step + 1})`);
                const server_class_name = await this.#datastore.get(`${this.#path}.classname`);
                if (!server_class_name || server_class_name !== this.#synchroset.managed_class?.name) {
                    throw new Error(`Class name mismatch: expected ${this.#synchroset.managed_class?.name}, got ${server_class_name}.`);
                }
                this.#log.info(`class name ${server_class_name} validated`);

                // Verify the specified pulsar is available
                const available_pulsars = await this.pulsars();
                if (!(this.#pulsar in available_pulsars)) {
                    throw new Error(`Pulsar ${this.#pulsar} is not available. Available pulsars: ${Object.keys(available_pulsars).join(', ')}`);
                }
                this.#log.debug(`pulsar '${this.#pulsar}' validated`);

                // Fetch the initial data and update the SynchroSet
                this.#log.info(`fetching initial data from ${this.#path}.all`);
                const all_items = await this.#datastore.get(`${this.#path}.all`);

                // Convert plain objects to class instances.  Errors thrown here will cause a resync!
                const class_instances = all_items ? all_items.map(item => this.#synchroset.managed_class.fromObject(item)) : [];
                this.#synchroset.update_set_to(class_instances);

                // All good - transition to POLLING
                this.#backoff.reset();
                this.#log.debug(`moving to POLLING state`);
                this.#polling_interval_ms = DatastoreClient.polling_interval_to_ms(this.#pulsar);
                this.#state = STATE.POLLING;
                this.#runloop_iterations = 0;   // Reset

            } else if (this.#state === STATE.POLLING) {

                const elapsed_ms = this.#runloop_iterations * this.#runloop_interval;
                if (elapsed_ms >= this.#polling_interval_ms) {

                    //this.#log.debug(`polling for updates after ${elapsed_ms}ms`);
                    this.#runloop_iterations = 0; // Reset for next interval

                    // Fetch the latest data from the pulsar
                    const updates = await this.#datastore.get(`${this.#path}.pulsars.${this.#pulsar}`);
                    await this._process_updates(updates);
                }

                this.#backoff.reset();
            }
        } catch (error) {

            // Throwing an error will move us back to an INITIAL state and trigger backoff 
            if (this.#state != STATE.INITIAL) { this.#state = STATE.INITIAL; }
            this.#log.error(error.message);
            this.#log.warn(`waiting ${this.#backoff.current_delay_ms}ms before retrying...`);
            await this.#backoff.interval();

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
        this.#backoff.reset();

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
        this.#backoff.reset();
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
        this.#backoff.reset();
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

}

module.exports = DatastoreClient;
