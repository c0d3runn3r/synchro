# Synchro 🔄 Real-time Object Synchronization 
<img src="mascot.jpg" width="200" alt="Synchro Mascot" style="float: left; margin-right: 15px; margin-bottom: 10px;">

**Keep your objects in perfect sync across any network, anywhere.**

Synchro is a zero-dependency Node.js library that makes distributed object synchronization feel like magic. Whether you're building autonomous systems, collaborative tools, or distributed applications, Synchro ensures your objects stay perfectly synchronized with minimal bandwidth and maximum reliability.

## 🚀 Why Synchro is Awesome

- **Object Identity Preservation**: Unlike other sync libraries, your `Robot` objects remain `Robot` objects on both ends
- **⚡ Ultra-Low Bandwidth**: Smart bundling with Pulsars means minimal network traffic
- **Master-Slave Sync**: Changes propagate from master to slave automatically
- **Zero Dependencies**: No bloat, just pure synchronization magic
- **Bulletproof Reliability**: Built-in checksums and conflict resolution
- **Real-time Ready**: Perfect for autonomous systems, monitoring, collaborative tools
- **Datastore Agnostic**: Works with Redis, MongoDB, or any key-value store

## 🌟 What Makes It Special

Synchro solves the hard problem of keeping objects synchronized from master to slave without losing their identity or behavior. When you sync a `Robot` object from control center to field station, it arrives as a fully functional `Robot` with all methods intact. Native Node.js events work seamlessly across the network, making distributed programming feel local.

## 🎯 Quick Start

```bash
npm install @novadynamics/synchro
```

### Simple Master-Slave Sync
```javascript
const {SynchroSet, SynchroItem} = require("@novadynamics/synchro");

// Create master and slave sets
const master = new SynchroSet(SynchroItem);
const slave = new SynchroSet(SynchroItem);

// Connect master to slave (one-way sync)
master.transmit = (payload) => slave.receive(payload);

// Add an item to master - it appears on slave!
master.add(new SynchroItem('robot-123'));
console.log(slave.find('robot-123')); // It's there! ✨

// Changes on master sync to slave automatically
master.find('robot-123').set('status', 'active');
console.log(slave.find('robot-123').get('status')); // 'active'
```

### Real-World Example: Autonomous Robot Fleet
```javascript
const {SynchroSet, SynchroItem} = require("@novadynamics/synchro");

class Robot extends SynchroItem {
    constructor(id) {
        super(id);
        this.observed_properties = ['status', 'battery_level', 'location', 'task'];
    }

    set status(value) { this._status = value; this.dirty(); }
    get status() { return this._status; }
    
    set battery_level(value) { this._battery_level = value; this.dirty(); }
    get battery_level() { return this._battery_level; }
    
    set location(value) { this._location = value; this.dirty(); }
    get location() { return this._location; }
    
    set task(value) { this._task = value; this.dirty(); }
    get task() { return this._task; }
}

// Set up control center (master) and field station (slave)
const controlCenter = new SynchroSet(Robot);
const fieldStation = new SynchroSet(Robot);
controlCenter.transmit = (payload) => fieldStation.receive(payload);

// Watch for new robots being deployed (on field station)
fieldStation.on('added', (event) => {
    console.log(`Robot ${event.item.id} deployed to field`);
});

// Watch for status changes (on field station)
fieldStation.on('changed', (event) => {
    if (event.event.property === 'battery_level') {
        console.log(`Robot ${event.item.id} battery: ${event.event.new_value}%`);
    }
});

// Control Center: Deploy a robot (changes flow to field station)
const robot = new Robot('rover-1');
robot.status = 'idle';
robot.battery_level = 100;
robot.location = { x: 0, y: 0 };
robot.task = 'patrol';
controlCenter.add(robot);

// Field station sees: "Robot rover-1 deployed to field"

// Control Center: Update robot status (changes flow to field station)
controlCenter.find('rover-1').battery_level = 85;
// Field station sees: "Robot rover-1 battery: 85%"
```

## 🌐 Production-Ready: DatastoreServer & DatastoreClient

For real applications, use Synchro over any datastore (Redis, MongoDB, Entangld, etc.):

```javascript
const {DatastoreServer, DatastoreClient, SynchroSet} = require("@novadynamics/synchro");
const Redis = require('redis'); // or any datastore

// Server setup
const datastore = new Redis();
const serverItems = new SynchroSet(Robot);
const server = new DatastoreServer({
    datastore: datastore,
    base_path: 'robotics',
    synchroset: serverItems,
    update_intervals: [1, 10], // Send updates every 1s and 10s
});

await server.start();

// Client setup  
const clientItems = new SynchroSet(Robot);
const client = new DatastoreClient({
    datastore: datastore,
    path: 'robotics.robots',
    synchroset: clientItems,
    pulsar: '1s', // Subscribe to 1-second updates
});

await client.start();

// Now they're synchronized! Server is master, client is slave
// Deploy robots on server, they appear on client automatically
// Update robot status on server, changes propagate to client
```

### 🔥 Smart Bandwidth Management with Pulsars

Pulsars bundle changes and transmit them efficiently.  Pulsars are automatically used in DatastoreServer/Client:

```javascript
const {Pulsar} = require("@novadynamics/synchro");

// Bundle updates for 5 seconds before sending
const pulsar = new Pulsar({
    interval: 5000,
    allow_empty: false // Don't send empty heartbeats
});

// Changes get bundled automatically
mySet.transmit = pulsar.transmit;
pulsar.transmit = (payload) => sendOverNetwork(payload);
```

## 🎭 Core Concepts

### SynchroItem: Smart Objects
- **Property Observation**: Automatically detects and syncs property changes
- **Event-Driven**: Uses Node.js events for real-time notifications  
- **Timestamped**: Every change includes precise timestamps
- **Conflict Resolution**: Handles concurrent updates gracefully

### SynchroSet: Collections That Sync
- **Automatic Management**: Add/remove items and they sync everywhere
- **Type Safety**: Enforces consistent object types across the network
- **Event Propagation**: Bubbles up item changes to set-level events
- **Efficient Diffing**: Only sends what actually changed

### Pulsar: Bandwidth Optimizer
- **Smart Bundling**: Coalesces multiple changes into single transmissions
- **Configurable Intervals**: From milliseconds to minutes
- **Heartbeat Detection**: Keeps connections alive with minimal traffic
- **Empty Suppression**: Skip transmissions when nothing changed

### DatastoreServer/Client: Production Scale
- **Datastore Agnostic**: Redis, MongoDB, SQL, or any key-value store
- **Robust Polling**: Handles network failures gracefully
- **Class Validation**: Ensures type safety across distributed systems
- **Multiple Update Channels**: Different intervals for different priorities

## Use Cases

- **🤖 Autonomous Systems**: Sync robot fleet status, sensor data, and mission updates
- **💬 Chat Applications**: Real-time message synchronization
- **📝 Collaborative Editing**: Shared documents and workspaces  
- **📊 Live Dashboards**: Real-time data visualization
- **🛒 E-commerce**: Inventory and cart synchronization
- **Enterprise Apps**: Distributed state management

## Advanced Features

### Property-Level Events
```javascript
robot.on('changed:battery_level', (event) => {
    console.log(`Battery changed from ${event.old_value}% to ${event.new_value}%`);
});
```

### Efficient Network Usage
```javascript
// Only sends changes, not full objects
// Automatically deduplicates rapid updates
// Configurable update intervals for different priorities
```

### Robust Error Handling
```javascript
client.on('error', (error) => {
    console.log('Connection issue:', error);
    // Auto-reconnection and sync recovery built-in
});
```

## 🤔 How is this different from other libraries?

**vs. Entangld**: Synchro preserves object identity and behavior. Your `Robot` stays a `Robot` with all its methods.

**vs. Socket.io**: Synchro handles state management automatically. No manual event handling for every property change.

**vs. Redux/MobX**: Synchro works across networks out of the box. Built for distributed systems from day one.

**vs. WebRTC**: Synchro uses reliable datastore-based transport. Works through firewalls and NAT without peer discovery complexity.

## 📚 API Reference

For detailed API documentation, see [docs/API.md](docs/API.md).

## 🚧 TODO
- [x] Add a test (that fails) for when we apply a payload that is not needed
- [x] Update SynchroSet to be able to generate checksums
- [x] Update Pulsar so it shares before and after checksums
- [x] Update the client so it checks before/after checksums and only applies needed payloads
- [x] Remove unneeded synchroset event
- [x] Make sure the test from part 1 passes
- [ ] Capture out-of-sync problems and refresh (write a test, update the client, etc)

## License

ISC

---

*Built with ❤️ for developers who want object synchronization that just works.*