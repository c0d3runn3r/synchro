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
	#node_name;
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
	 * @param {string} [options.node_name] the node name to use for the namespace. If not provided, will be auto-generated from the managed class name
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

		// Get the class name from the synchroset's managed class
		const class_name = this.#synchroset.managed_class?.name || 'SynchroItem';

		// Generate node name or use provided one
		this.#node_name = options.node_name ?? DatastoreServer.pluralize(class_name.toLowerCase());

		// Set up the datastore endpoints
		const namespace = this.#base_path ? `${this.#base_path}.${this.#node_name}` : this.#node_name;
		this.#datastore.set(`${namespace}.all`, () => { return this.#synchroset.all().map(item => item.toObject()); });
		this.#datastore.set(`${namespace}.classname`, class_name);
		this.#datastore.set(`${namespace}.pulsars`, this.#update_intervals.reduce((acc, interval) => { acc[DatastoreServer.interval_string(interval)] = []; return acc; }, {}));
	}

	start() {
		if (this.#running) { throw new Error('DatastoreServer is already running'); }

		const namespace = this.#base_path ? `${this.#base_path}.${this.#node_name}` : this.#node_name;

		// Set up the pulsars
		this.#pulsars = [];
		for(let interval of this.#update_intervals) {

			let pulsar = new Pulsar({
				interval: interval * 1000, // Convert seconds to milliseconds
				allow_empty: this.#allow_empty_transmissions,
				include_checksums: true, // Enable checksums for integrity checking
			});

			pulsar.transmit = (payload) => { this.#datastore.set(`${namespace}.pulsars.${DatastoreServer.interval_string(interval)}`, payload); };
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

	/**
	 * Simple pluralization function for class names
	 * @param {string} word - The word to pluralize
	 * @returns {string} The pluralized word
	 */
	static pluralize(word) {
		if (!word) return 'items';
		
		// Handle some common irregular plurals
		const irregulars = {
			'child': 'children',
			'person': 'people',
			'man': 'men',
			'woman': 'women',
			'tooth': 'teeth',
			'foot': 'feet',
			'mouse': 'mice',
			'goose': 'geese'
		};
		
		if (irregulars[word]) return irregulars[word];
		
		// Handle words ending in 'y'
		if (word.endsWith('y') && word.length > 1 && !'aeiou'.includes(word[word.length - 2])) {
			return word.slice(0, -1) + 'ies';
		}
		
		// Handle words ending in 's', 'ss', 'sh', 'ch', 'x', 'z'
		if (word.endsWith('s') || word.endsWith('ss') || word.endsWith('sh') || 
			word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
			return word + 'es';
		}
		
		// Handle words ending in 'f' or 'fe'
		if (word.endsWith('f')) {
			return word.slice(0, -1) + 'ves';
		}
		if (word.endsWith('fe')) {
			return word.slice(0, -2) + 'ves';
		}
		
		// Default: just add 's'
		return word + 's';
	}

	get running() { return this.#running; }
	get synchroset() { return this.#synchroset; }
	get update_intervals() { return this.#update_intervals; }
	get node_name() { return this.#node_name; }
}

module.exports = DatastoreServer;