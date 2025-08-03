const SynchroSet = require('./SynchroSet');
const SynchroItem = require('./SynchroItem');
const Pulsar = require('./Pulsar');

/**
 * Publishes a SynchroSet over a datastore, e.g. Entangld
 * 
 * @class DatastoreServer
 */
class DatastoreServer {

	#datastore;
	#synchroset;
	#base_path;
	#update_intervals = [];
	#running = false;
	#allow_empty_transmissions = true;
	#pulsars = [];

	/**
	 * Creates an instance of DatastoreServer.
	 * @param {*} options 
	 * @param {object} [options.datastore] the datastore to use, e.g. and Entangld instance.  Anything that implements a `set(key, value)` will work.
	 * @param {string} [options.base_path=""] the base path for the datastore, e.g. "my.server.lives.here"
	 * @param {SynchroSet} [options.synchroset=new SynchroSet(SynchroItem)] the SynchroSet to publish
	 * @param {number[]} [options.update_intervals=[10]] the intervals at which to update the datastore, in seconds
	 * @param {boolean} [options.allow_empty_transmissions=true] whether to allow empty transmissions, e.g. broadcasting [] on intervals (useful for clients to know they are still connected)
	 */
	constructor(options = {}) {

		// Sanity checks
		if(options.update_intervals && !Array.isArray(options.update_intervals)) { throw new TypeError('update_intervals must be an array of numbers'); }
		if(options.update_intervals && options.update_intervals.some(i => typeof i !== 'number' || i <= 0)) { throw new TypeError('update_intervals must be an array of positive numbers'); }	

		this.#datastore = options.datastore ?? { set: (key, value) => {} };
		this.#base_path = options.base_path ?? '';
		this.#synchroset = options.synchroset ?? new SynchroSet(SynchroItem);
		this.#update_intervals = options.update_intervals ?? [10]; // Default to 10 seconds, sanity checks built into the setter
		this.#allow_empty_transmissions = options.allow_empty_transmissions ?? true;

		// Expose the entire set at the endpoint '{base_path}.all'
		this.#datastore.set(`${this.#base_path}.all`, () => { return this.#synchroset.all().map(item => item.toObject()); });

		// Put default values (empty arrays) at the pulsar update endpoints
		for(let interval of this.#update_intervals) { this.#datastore.set(`${this.#base_path}.pulsars.${DatastoreServer.interval_string(interval)}`, []); }
	}

	start() {
		if (this.#running) { throw new Error('DatastoreServer is already running'); }

		// Set up the pulsars
		this.#pulsars = [];
		for(let interval of this.#update_intervals) {

			let pulsar = new Pulsar({
				interval: interval * 1000, // Convert seconds to milliseconds
				allow_empty: this.#allow_empty_transmissions,
			});

			pulsar.transmit = (payload) => { this.#datastore.set(`${this.#base_path}.pulsars.${DatastoreServer.interval_string(interval)}`, payload); };
			this.#pulsars.push(pulsar);
		}

		// Set the transmit function for the SynchroSet
		this.#synchroset.transmit = this.#pulsars;

		// Start all pulsars
		for(let pulsar of this.#pulsars) { pulsar.start(); }

		this.#running = true;
	}

	stop() {

		if (!this.#running) { throw new Error('DatastoreServer is not running'); }

		// Stop all pulsars
		for(let pulsar of this.#pulsars) { pulsar.stop(); }
		this.#running = false;
	}

	/**
	 * Returns a string representation for an update interval, e.g. "10s" or "500ms".
	 * 
	 * @param {number} interval - The update interval in seconds.
	 * @returns {string} The string representation of the update interval.
	 */
	static interval_string(interval) {
		return (interval >= 1) ? `${Math.round(interval)}s` : `${Math.round(interval * 1000)}ms`;
	}

	get running() { return this.#running; }
	get synchroset() { return this.#synchroset; }
	get update_intervals() { return this.#update_intervals; }
}

module.exports = DatastoreServer;