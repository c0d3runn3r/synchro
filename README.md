# Synchro - Remote Set Synchronization
<img src="mascot.jpg" width="200" alt="Synchro Mascot" style="float: left; margin-right: 15px; margin-bottom: 10px;">
Welcome to Synchro, a zero-dep NodeJS library designed to synchronize sets of objects across different locations using message passing, checksums, and just a pinch of magic. 

## Example
```node
const Synchro = require("synchro.js");
const master = new Synchro.master();
const slave = new Synchro.slave();

master.transmit((msg)=>slave.receive(msg));

```

## Installation
```bash
npm install synchro
```


## Implementation Notes
Something here

```javascript
const synchro = require('synchro');
synchro.syncObjects(myData, { location: 'remote' });
```

Check the [API documentation](docs/API.md) for advanced usage and options.

