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
	#available_pulsars = [];
	#active_pulsar = null;
    #runloop_interval = 1000; // Default to 1 second
	#pulsar_interval = null;
    #state = STATE.INITIAL;
    #running = false;
    #interval_id = null;
    #log;

	/**
	 * Creates an instance of DatastoreClient.
	 * @param {object} options 
	 * @param {object} options.datastore the datastore to use, e.g. an Entangld instance. Must implement `get(key)` method.
	 * @param {string} options.path the full path to the resource namespace, e.g. "api.v1.dogs"
	 * @param {SynchroSet} options.synchroset the SynchroSet to populate with data from the server
     * @param {object} [options.log] optional logger object with methods: debug, info, warn, error
     * @param {number} [options.runloop_interval=1000] the interval in milliseconds to run the client loop, default is 1000ms.  This should only really be changed for testing purposes.
     * @throws {TypeError} if required options are missing or invalid
	 */
	constructor(options = {}) {

		if (!options.datastore) { throw new TypeError('datastore is required'); }
		if (!options.synchroset) { throw new TypeError('synchroset is required'); }
		if (!options.path) { throw new TypeError('path is required'); }

		this.#datastore = options.datastore;
		this.#path = options.path;
		this.#synchroset = options.synchroset;
        this.#runloop_interval = options.runloop_interval || 1000;
        this.#log = options.log || { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
	}

    async _runloop() {

        if(!this.#running) { return;  };    // In case we are shutting down

        if(this.#state === STATE.INITIAL) {

            // Verify the classname matches what we expect.  Keep trying if no name, but stop if it's wrong. This is to handle the case where the server is not ready / available
            this.#log.debug(`Validating server`);
            const server_class_name = await this.#datastore.get(`${this.#path}.classname`);
            if (server_class_name) {
     
                if(server_class_name !== this.#synchroset.managed_class?.name) { 
                    this.#log.error(`Class name mismatch: expected ${this.#synchroset.managed_class?.name}, got ${server_class_name}.`);
                    this.stop();
                    return;
                } else {
                    this.#log.debug(`Server validated with class name: ${server_class_name}`);
                }
            } else {

                this.#log.debug(`No class name found, waiting for server to be ready (make sure your path is correct)`);
                return;
            }

            // Fetch the initial data and update the SynchroSet
            const all_items = await this.#datastore.get(`${this.#path}.all`);
            this.#synchroset.update_set_to(all_items);
            this.#state = STATE.POLLING;

        }
    }

	/**
	 * Connect to the datastore server and validate the connection
	 * @throws {Error} if the connection fails or class name doesn't match
	 */
	async start() {

        this.#log.info(`starting client for path: ${this.#path}`);
        if (this.#running) { throw new Error('client is already running'); }
        this.#running = true;
        this.#interval_id = setInterval(async () => { await this._runloop(); }, this.#runloop_interval);

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
        if (this.#interval_id) { clearInterval(this.#interval_id); this.#interval_id = null; }
        this.#state = STATE.INITIAL; 
	}


	get synchroset() { return this.#synchroset; }
	get path() { return this.#path; }
	get active_pulsar() { return this.#active_pulsar; }
    get running() { return this.#running; }

    /**
     * Get the current state of the client.
     * 
     * @returns {string} the current state as a string, e.g., 'INITIAL', 'POLLING'
     */
    get state() { return Object.keys(STATE).find(key => STATE[key] === this.#state) || 'UNKNOWN'; }
}

module.exports = DatastoreClient;
