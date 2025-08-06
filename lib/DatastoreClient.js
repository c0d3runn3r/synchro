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

	/**
	 * Creates an instance of DatastoreClient.
	 * @param {object} options 
	 * @param {object} options.datastore the datastore to use, e.g. an Entangld instance. Must implement `get(key)` method.
	 * @param {string} options.path the full path to the resource namespace, e.g. "api.v1.dogs"
     * @param {string} options.pulsar the pulsar to consume, e.g. "10s" for 10 second updates.  Must be one of the intervals defined in the server.  Call .pulsars() to get available pulsars.
	 * @param {SynchroSet} options.synchroset the SynchroSet to populate with data from the server
     * @param {object} [options.log] optional logger object with methods: debug, info, warn, error
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
        this.#log = options.log || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
	}


    async _runloop() {

        if(!this.#running) { return;  };    // In case we are shutting down
        if(this.#_runloop_busy) {
            this.#log.warn(`runloop is busy, skipping this iteration`);
            return;
        }
        this.#_runloop_busy = true;
        this.#runloop_iterations++;

        if(this.#state === STATE.INITIAL) {

            // Verify the classname matches what we expect.  Keep trying if no name, but stop if it's wrong. This is to handle the case where the server is not ready / available
            this.#log.debug(`Validating server`);
            const server_class_name = await this.#datastore.get(`${this.#path}.classname`);
            if (server_class_name) {
     
                if(server_class_name !== this.#synchroset.managed_class?.name) { 
                    this.#log.error(`Class name mismatch: expected ${this.#synchroset.managed_class?.name}, got ${server_class_name}.`);
                    this.stop();
                    this.#_runloop_busy = false;
                    return;
                }
            } else {

                this.#log.debug(`No class name found, waiting for server to be ready (make sure your path is correct)`);
                this.#_runloop_busy = false;
                return;
            }
            this.#log.info(`class name ${server_class_name} validated`);

            // Verify the specified pulsar is available
            const available_pulsars = await this.pulsars();
            if (!(this.#pulsar in available_pulsars)) {
                this.#log.error(`Pulsar ${this.#pulsar} is not available. Available pulsars: ${Object.keys(available_pulsars).join(', ')}`);
                this.stop();
                this.#_runloop_busy = false;
                return;
            }
            this.#log.debug(`pulsar '${this.#pulsar}' validated`);

            // Fetch the initial data and update the SynchroSet
            this.#log.info(`fetching initial data from ${this.#path}.all`);
            const all_items = await this.#datastore.get(`${this.#path}.all`);
            this.#synchroset.update_set_to(all_items);

            this.#log.debug(`moving to POLLING state`);
            this.#polling_interval_ms = DatastoreClient.polling_interval_to_ms(this.#pulsar);
            this.#state = STATE.POLLING;
            this.#runloop_iterations = 0;   // Reset

        } else if (this.#state === STATE.POLLING) {

            const elapsed_ms = this.#runloop_iterations * this.#runloop_interval;
            if(elapsed_ms >= this.#polling_interval_ms) {

                this.#log.debug(`polling for updates after ${elapsed_ms}ms`);
                this.#runloop_iterations = 0; // Reset for next interval

                // Fetch the latest data from the pulsar
                const updates = await this.#datastore.get(`${this.#path}.pulsars.${this.#pulsar}`);
                if (updates && updates.length > 0) {

                    this.#log.debug(`applying ${updates.length} updates from pulsar ${this.#pulsar}`);
                    updates.forEach(update => { this.#synchroset.receive(update); });

                } else {

                    this.#log.debug(`no updates received from pulsar ${this.#pulsar}`);
                }
            }

        }

        this.#_runloop_busy = false;
    }

	/**
	 * Connect to the datastore server and validate the connection
	 * @throws {Error} if the connection fails or class name doesn't match
	 */
	async start() {

        this.#log.info(`starting client for path: ${this.#path}`);
        if (this.#running) { throw new Error('client is already running'); }
        this.#running = true;
        this.#runloop_interval_id = setInterval(async () => { await this._runloop(); }, this.#runloop_interval);

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
        if (this.#runloop_interval_id) { clearInterval(this.#runloop_interval_id); this.#runloop_interval_id = null; }
        this.#state = STATE.INITIAL; 
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
