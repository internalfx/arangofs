# ArangoFS

[![npm version](https://img.shields.io/npm/v/@internalfx/arangofs.svg)](https://www.npmjs.com/package/@internalfx/arangofs) [![license](https://img.shields.io/npm/l/@internalfx/arangofs.svg)](https://github.com/internalfx/@internalfx/arangofs/blob/master/LICENSE)

ArangoFS is a library for storing files using an ArangoDB database.

Using RethinkDB? Try [rethinkdb-regrid](https://github.com/internalfx/rethinkdb-regrid)<br>
Using SQL? Try [SQLGrid](https://github.com/internalfx/sqlgrid)

### Features

- **Efficient** - Save space with automatic inline deduplication.
- **Easy** - Read and write files as if they were on disk with developer friendly APIs.
- **Revisions** - Keeps multiple versions of files.
- **Byte-range Capable** - Supports byte ranges to allow for streaming media.
- **Consistent** - Sha256 hashes are calculated when the file is written, and verified when read back out.

View the [Changelog](https://github.com/internalfx/arangofs/blob/master/CHANGELOG.md)

---

Special thanks to [Arthur Andrew Medical](http://www.arthurandrew.com/) for sponsoring this project.

Arthur Andrew Medical manufactures products with ingredients that have extensive clinical research for safety and efficacy. They specialize in Enzymes, Probiotics and Antioxidants.

---

## Installation

Supports node v10.12+

```
npm install --save @internalfx/arangofs
```

## TL;DR

```javascript
var ArangoFS = require('arangofs')

var bucket = ArangoFS()

// initBucket creates tables and indexes if they don't exist, returns a promise.
bucket.initBucket().then(function () {
  // We are now ready to read and write files
})
```

## API Documentation

Coming soon...
