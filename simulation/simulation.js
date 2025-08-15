const SynchroItem = require('../lib/SynchroItem');
const SynchroSet = require('../lib/SynchroSet');
const DatastoreServer = require('../lib/DatastoreServer');
const DatastoreClient = require('../lib/DatastoreClient');
const Entangld = require('entangld');
const { Logger } = require('yalls');
const Dog = require('./Dog');
const blessed = require('neo-blessed');
const ColorConverter = require('./ColorConverter');
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
        // Update server box content
        const server_content = (server_items || []).map(item => item.toString()).join('\n');
        this.server_box.setContent(server_content);
        
        // Update client box content
        const client_content = (client_items || []).map(item => item.toString()).join('\n');
        this.client_box.setContent(client_content);
        
        // Render the screen
        this.screen.render();
    }

    destroy() {
        this.screen.destroy();
    }
}

class DogSimulation {
    constructor() {
        this.display = new SimulationDisplay();
        this.datastore = new Entangld();
        this.server_synchroset = new SynchroSet(Dog);
        this.client_synchroset = new SynchroSet(Dog);
        this.color_converter = new ColorConverter();
        
        // Create a yalls logger using callback that sends formatted output to blessed
        this.logger = Logger.callback((type, formatted_message) => {
            // Convert ANSI color codes to blessed format
            const blessed_message = this.color_converter.convert_to_blessed_format(formatted_message);
            this.display.log(blessed_message);
        }, "simulation");
        this.logger.set_log_level('debug');
        
        // Create server
        this.server = new DatastoreServer({
            datastore: this.datastore,
            base_path: 'simulation',
            synchroset: this.server_synchroset,
            update_intervals: [1],
            allow_empty_transmissions: true
        });
        
        // Create client and use our display logger
        this.client = new DatastoreClient({
            datastore: this.datastore,
            path: 'simulation.dogs',
            pulsar: '1s',
            synchroset: this.client_synchroset,
            allow_empty_transmissions: true,
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
        this.setup_event_listeners();
        
        // Set up keyboard input
        this.setup_input();
    }

    setup_event_listeners() {
        this.server_synchroset.on('added', (event) => {
            this.logger.info(`server SynchroSet#added ${event.item.name}`);
            this.render();
        });
        
        this.server_synchroset.on('removed', (event) => {
            this.logger.info(`server SynchroSet#removed ${event.item.name}`);
            this.render();
        });
        
        this.client_synchroset.on('added', (event) => {
            this.logger.info(`client SynchroSet#added ${event.item.name}`);
            this.render();
        });
        
        this.client_synchroset.on('removed', (event) => {
            this.logger.info(`client SynchroSet#removed ${event.item.name}`);
            this.render();
        });
    }

    setup_input() {
        // Use blessed's built-in key handling
        this.display.screen.key(['a'], () => {
            this.server_synchroset.add(new Dog());
        });
        
        this.display.screen.key(['d'], () => {
            const dog = this.server_synchroset.all()[0];
            if (dog) {
                this.server_synchroset.remove(dog);
            } else {
                this.logger.info('No dogs to remove');
            }
        });
        
        this.display.screen.key(['q', 'escape', 'C-c'], () => {
            this.quit();
        });
    }


    render() {
        const server_items = this.server_synchroset.all();
        const client_items = this.client_synchroset.all();
        this.display.render(server_items, client_items);
    }

    async start() {
        this.logger.info('Starting Dog Synchronization Simulation...');
        this.logger.info('Press [a] to add dogs, [d] to delete dogs, [q] to quit');
        
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
