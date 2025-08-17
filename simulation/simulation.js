const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const DatastoreServer = require('../lib/DatastoreServer');
const DatastoreClient = require('../lib/DatastoreClient');
const Entangld = require('entangld');
const { Logger } = require('yalls');
const Dog = require('./Dog');
const blessed = require('neo-blessed');
const ColorConverter = require('./ColorConverter');
const Corrupt = require('./Corrupt');
const config = require('./config.json');

class SimulationDisplay {
    constructor() {
        
        // Setup screen
        this.screen = blessed.screen(config.blessed.screen);
        this.server_box = blessed.box(config.blessed.server_box);
        this.client_box = blessed.box(config.blessed.client_box);
        this.log_box = blessed.log(config.blessed.log_box);
        this.instructions_box = blessed.box(config.blessed.instructions_box);

        // Store clean log messages for copying/saving
        this.clean_log_messages = [];

        // Append all boxes to screen
        this.screen.append(this.server_box);
        this.screen.append(this.client_box);
        this.screen.append(this.log_box);
        this.screen.append(this.instructions_box);

        // Key bindings
        this.screen.key(['escape', 'q', 'C-c'], () => {
            return process.exit(0);
        });
        
        // Add copy and save functionality
        this.screen.key(['C-l'], () => {
            this.copy_log_to_clipboard();
        });
        
        this.screen.key(['C-s'], () => {
            this.save_log_to_file();
        });

        // Render the screen initially
        this.screen.render();
    }

    // Method to strip blessed color tags
    strip_blessed_tags(text) {
        return text.replace(/\{[^}]*\}/g, '');
    }

    // Method that receives yalls formatted output
    log(message, clean_message = null) {
        this.log_box.log(message);
        
        // Store clean version for copying/saving
        const clean = clean_message || this.strip_blessed_tags(message);
        this.clean_log_messages.push(clean);
        
        // Keep only the last 100 messages
        if (this.clean_log_messages.length > 100) {
            this.clean_log_messages.shift();
        }
        
        this.screen.render();
    }

    // Copy clean log content to clipboard
    copy_log_to_clipboard() {
        const { execSync } = require('child_process');
        
        try {
            const log_content = this.clean_log_messages.join('\n');
            execSync(`echo ${JSON.stringify(log_content)} | pbcopy`);
            
            // Show temporary message
            const original_label = this.log_box.options.label;
            this.log_box.setLabel(' Log Messages - Copied to Clipboard! ');
            this.screen.render();
            
            setTimeout(() => {
                this.log_box.setLabel(original_label);
                this.screen.render();
            }, 2000);
            
        } catch (error) {
            const original_label = this.log_box.options.label;
            this.log_box.setLabel(' Log Messages - Copy Failed ');
            this.screen.render();
            setTimeout(() => {
                this.log_box.setLabel(original_label);
                this.screen.render();
            }, 2000);
        }
    }
    
    // Save clean log content to file
    save_log_to_file() {
        const fs = require('fs');
        
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `simulation-log-${timestamp}.txt`;
            const log_content = this.clean_log_messages.join('\n');
            
            fs.writeFileSync(filename, log_content);
            
            const original_label = this.log_box.options.label;
            this.log_box.setLabel(` Log Messages - Saved to ${filename} `);
            this.screen.render();
            
            setTimeout(() => {
                this.log_box.setLabel(original_label);
                this.screen.render();
            }, 3000);
            
        } catch (error) {
            const original_label = this.log_box.options.label;
            this.log_box.setLabel(' Log Messages - Save Failed ');
            this.screen.render();
            setTimeout(() => {
                this.log_box.setLabel(original_label);
                this.screen.render();
            }, 2000);
        }
    }

    render(server_items, client_items) {

        // This is stupid but it seems to be one of the only reliable ways to get the dang boxes to actually empty
        this.server_box.setContent(Array(30).fill('........................................................').join('\n'));
        this.client_box.setContent(Array(30).fill('........................................................').join('\n'));
        this.screen.render();

        // Update server box content
        const server_content = (server_items || []).map(item => item.toString()).join('\n');
        this.server_box.setContent(server_content);
        
        // Update client box content
        const client_content = (client_items || []).map(item => item.toString()).join('\n');
        this.client_box.setContent(client_content);
        
        // Render the screen
        this.screen.render();
    }

    update_instructions(instructions) {
        this.instructions_box.setContent(instructions);
        this.screen.render();
    }

    destroy() {
        this.screen.destroy();
    }
}

class DogSimulation {
    constructor() {
        this.display = new SimulationDisplay();
        const datastore = new Entangld();
        this.server_synchroset = new SynchroSet(Dog);
        this.client_synchroset = new SynchroSet(Dog);
        this.color_converter = new ColorConverter();
        
        // Autorun state
        this.autorun_enabled = false;
        this.autorun_timer = null;
        
        // Corruption handler
        this._corruptor = new Corrupt();

        // Create a yalls logger using callback that sends formatted output to blessed
        this.logger = Logger.callback((type, formatted_message) => {
            // Convert ANSI color codes to blessed format
            const blessed_message = this.color_converter.convert_to_blessed_format(formatted_message);
            this.display.log(blessed_message);
        }, "simulation");
        this.logger.set_log_level('debug');
        
        // Create server
        this.server = new DatastoreServer({
            datastore: datastore,
            base_path: 'simulation',
            synchroset: this.server_synchroset,
            update_intervals: [1],
            allow_empty_transmissions: true
        });
        
        // Create client and use our display logger
        this.client = new DatastoreClient({
            datastore: { get: async (key) => { 
            
                if(key == "simulation.dogs.pulsars.1s") {

                   return this._corruptor.corrupt(await datastore.get(key));

                } else {
                    return await datastore.get(key);
                }
             } },
            path: 'simulation.dogs',
            pulsar: '1s',
            synchroset: this.client_synchroset,
            logger: this.logger.create_child("client")
        });
                
        // Capture any uncaught errors
        process.on('uncaughtException', (err) => {
            this.logger.error(`Uncaught Exception: ${err.message}`);
            this.logger.error(`Stack: ${err.stack}`);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error(`Unhandled Rejection: ${reason}`);
        });
        
        // Set up event listeners
        this.server_synchroset.on('added', (event) => { this.logger.info(`server SynchroSet#added ${event.item.name}`); this.render(); });
        this.server_synchroset.on('removed', (event) => { this.logger.info(`server SynchroSet#removed ${event.item.name}`); this.render(); });
        this.server_synchroset.on('changed', (event) => { this.logger.info(`server SynchroSet#changed ${event.item.name} ${event.event.property}`); this.render();  });
        this.client_synchroset.on('added', (event) => { this.logger.info(`client SynchroSet#added ${event.item.name}`); this.render(); });
        this.client_synchroset.on('removed', (event) => { this.logger.info(`client SynchroSet#removed ${event.item.name}`); this.render(); });
        this.client_synchroset.on('changed', (event) => { this.logger.info(`client SynchroSet#changed ${event.item.name} ${event.event.property}`); this.render(); });
        
        // Set up keyboard input
        this.display.screen.key(['a'], () => this.server_synchroset.add(new Dog()));
        this.display.screen.key(['d'], () => { const dog = this.server_synchroset.all()[0]; dog ? this.server_synchroset.remove(dog) : this.logger.info('No dogs to remove'); });
        this.display.screen.key(['b'], () => this.toggle_random_dog_barking());
        this.display.screen.key(['space'], () => this.toggle_autorun());
        this.display.screen.key(['c'], () => { this._corruptor.toggle(); this.update_instructions(); });
        this.display.screen.key(['q', 'escape', 'C-c'], () => this.quit());
    }



    toggle_random_dog_barking() {
        const dogs = this.server_synchroset.all();
        if (dogs.length === 0) {
            this.logger.info('No dogs to toggle barking');
            return;
        }
        
        // Pick a random dog
        const random_index = Math.floor(Math.random() * dogs.length);
        const random_dog = dogs[random_index];
        
        // Toggle its barking status
        random_dog.barking = !random_dog.barking;
        
        const action = random_dog.barking ? 'started' : 'stopped';
        this.logger.info(`${random_dog.name} ${action} barking`);
        
    }

    toggle_autorun() {
        this.autorun_enabled = !this.autorun_enabled;
        
        if (this.autorun_enabled) {
            // Start autorun timer
            if (this.autorun_timer) {
                clearInterval(this.autorun_timer);
            }
            
            this.autorun_timer = setInterval(() => {
                this.perform_random_action();
            }, 100);
        } else {
            // Stop autorun timer
            if (this.autorun_timer) {
                clearInterval(this.autorun_timer);
                this.autorun_timer = null;
            }
        }
        
        // Update instructions to show current status
        this.update_instructions();
    }
    
    update_instructions() {
        const autorun_status = this.autorun_enabled ? ' (ENABLED)' : '';
        const corruption_status = this._corruptor.enabled ? ' (ENABLED)' : '';
        
        const instructions = `Press [a] to add dogs, [d] to delete dogs, [b] to toggle random dog barking, [space] to toggle autorun${autorun_status}, [c] to toggle corruption${corruption_status}, [q] to quit`;
        this.display.update_instructions(instructions);
    }

    perform_random_action() {
        const dogs = this.server_synchroset.all();
        const dog_count = dogs.length;
        const barking_count = dogs.filter(dog => dog.barking).length;
        
        // Calculate probabilities to maintain ~20 dogs and ~2 barking
        const target_dogs = 20;
        const target_barking = 2;
        
        // Adjust probabilities based on current state
        let add_weight = Math.max(0, target_dogs - dog_count) * 2 + 1;
        let remove_weight = Math.max(0, dog_count - target_dogs) * 2 + (dog_count > 1 ? 1 : 0);
        let bark_weight = Math.max(0, target_barking - barking_count) * 3 + 1;
        let stop_bark_weight = Math.max(0, barking_count - target_barking) * 3 + (barking_count > 0 ? 1 : 0);
        
        // Ensure minimum weights
        if (dog_count === 0) {
            add_weight = 10;
            remove_weight = 0;
            bark_weight = 0;
            stop_bark_weight = 0;
        }
        
        const total_weight = add_weight + remove_weight + bark_weight + stop_bark_weight;
        const random = Math.random() * total_weight;
        
        let current_weight = 0;
        
        if (random < (current_weight += add_weight)) {
            // Add random dog
            const new_dog = new Dog();
            this.server_synchroset.add(new_dog);
            this.logger.debug(`Autorun: Added ${new_dog.name}`);
        } else if (random < (current_weight += remove_weight)) {
            // Remove random dog
            if (dogs.length > 1) {
                const random_index = Math.floor(Math.random() * dogs.length);
                const dog_to_remove = dogs[random_index];
                this.server_synchroset.remove(dog_to_remove);
                this.logger.debug(`Autorun: Removed ${dog_to_remove.name}`);
            }
        } else if (random < (current_weight += bark_weight)) {
            // Make dog bark
            const non_barking_dogs = dogs.filter(dog => !dog.barking);
            if (non_barking_dogs.length > 0) {
                const random_dog = non_barking_dogs[Math.floor(Math.random() * non_barking_dogs.length)];
                random_dog.barking = true;
                this.logger.debug(`Autorun: ${random_dog.name} started barking`);
            }
        } else {
            // Make dog stop barking
            const barking_dogs = dogs.filter(dog => dog.barking);
            if (barking_dogs.length > 0) {
                const random_dog = barking_dogs[Math.floor(Math.random() * barking_dogs.length)];
                random_dog.barking = false;
                this.logger.debug(`Autorun: ${random_dog.name} stopped barking`);
            }
        }
    }


    render() {
        const server_items = this.server_synchroset.all();
        const client_items = this.client_synchroset.all();
        this.display.render(server_items, client_items);
    }

    async start() {
        this.logger.info('Starting Dog Synchronization Simulation...');
        
        // Set initial instructions
        this.update_instructions();
        
        // Start server
        await this.server.start();
        this.logger.info('Server started');
        
        // Start client
        await this.client.start();
        this.logger.info('Client started');
        
        // Wait for client to connect
        while (this.client.state === 'INITIAL') {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        this.logger.info(`Client connected (state: ${this.client.state})`);
        
        // Initial render
        this.render();
    }

    quit() {
        this.logger.info('Shutting down simulation...');
        
        // Stop autorun timer
        if (this.autorun_timer) {
            clearInterval(this.autorun_timer);
            this.autorun_timer = null;
        }
        
        if (this.client.running) {
            this.client.stop();
        }
        if (this.server.running) {
            this.server.stop();
        }
        
        // Clean up blessed display
        this.display.destroy();
        process.exit(0);
    }
}

// Main execution
if (require.main === module) {
    const simulation = new DogSimulation();
    simulation.start().catch(error => {
        console.error('Failed to start simulation:', error);
        process.exit(1);
    });
}

module.exports = Dog;
