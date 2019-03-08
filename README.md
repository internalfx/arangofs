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
var ArangoFS = require('@internalfx/arangofs')

var bucket = ArangoFS()

// initBucket creates tables and indexes if they don't exist, returns a promise.
bucket.initBucket().then(function () {
  // We are now ready to read and write files
})
```

## API Documentation

### `ArangoFS([connectionOptions, bucketOptions])`

##### Parameters

| key | default | type | description |
| --- | --- | --- | --- |
| connectionOptions | {}| Object | `connectionOptions` is used to create an ArangoDB connection, see parameters below. |
| bucketOptions | {} | Object |  Optional parameters listed below |

###### connectionOptions

| key | default | type | description |
|---|---|---|---|
| url | undefined | String | Server URL |
| database | undefined | String | Database name. |
| username | undefined | String |  |
| password | undefined | String |  |

###### bucketOptions

| key | default | type | description |
|---|---|---|---|
| bucketName | `arangofs` | String | The name of the bucket. Table names are prefixed by this. |
| path | undefined | String | The folder where blobs are stored |

##### returns

`Bucket instance`

##### Description

Creates a new ArangoFS bucket instance.

##### Example

```javascript
var ArangoFS = require('@internalfx/arangofs')

var bucket = ArangoFS({url: 'http://localhost:8529', database: 'test'}, {path: '/tmp/blobs'})
```

---

### `initBucket()`

##### Parameters

none

##### returns

Promise

##### Description

Verifies required tables and indexes exist and will create them if missing.

##### Example

```javascript
bucket.initBucket().then(function () {
  // bucket is ready for use.....
})
```

---

### `writeFile(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| filename | *required* | String | The name of the file. |
| buffer | *required* | Buffer | A buffer of file contents. |

##### returns

Promise

##### Description

Returns a promise that resolves to the newly written file.

##### Example

```javascript
let fileBuffer = fs.readFileSync('./myVid.mp4')

let newFile = await bucket.writeFile({filename: '/videos/myVid.mp4', buffer: fileBuffer})
```

---

### `createWriteStream(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| filename | *required* | String | The name of the file. |

##### returns

WriteStream

##### Description

Returns a write stream for storing a file in ArangoFS.

##### Example

```javascript
var writeStream = bucket.createWriteStream({
  filename: '/videos/myVid.mp4'
})

writeStream.on('finish', function () {
  // File is now stored in ArangoFS
})

fs.createReadStream('./myVid.mp4').pipe(writeStream)
```

---

### `getFile(options)`

Gets only the files metadata.

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | Null | String | The `id` of the file to retrieve. |
| filename | Null | String | Ignored if `id != null`. The `filename` of the file to retrieve |
| revision | `-1` | Number | Ignored if `id != null`. The revision of the file to retrieve. If multiple files are uploaded under the same `filename` they are considered revisions. This may be a positive or negative number. (see chart below) Passing `'all'` will return an array of all revisions. |

###### How revision numbers work

If there are five versions of a file, the below chart would be the revision numbers

| Number | Description |
| --- | --- |
| `0` or `-5` | The original file |
| `1` or `-4` | The first revision |
| `2` or `-3` | The second revision |
| `3` or `-2` | The second most recent revision |
| `4` or `-1` | The most recent revision |

##### Description

If `revision` is a number a promise will be returned that resolves to an object of the files information.
If `revision` is `'all'` a promise will be returned that resolves to an array of all file revisions.

##### Example

```javascript
let file1 = await bucket.getFile({id: 'ca608825-15c0-44b5-9bef-3ccabf061bab'})
let file2 = await bucket.getFile({filename: 'catVideo.mp4', revision: 2})
let allVersionsOfCatVideo = await bucket.getFile({filename: 'catVideo.mp4', revision: 'all'})
```

---

### `readFile(options)`

Gets the files metadata and contents.

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | Null | String | The `id` of the file to retrieve. |
| filename | Null | String | Ignored if `id != null`. The `filename` of the file to retrieve |
| revision | `-1` | Number/String | Ignored if `id != null`. The revision of the file to retrieve. If multiple files are uploaded under the same `filename` they are considered revisions. This may be a positive or negative number. (see chart below) Passing `'all'` will return an array of all revisions. |
| seekStart | Null | Number | The start of the byte range. |
| seekEnd | Null | Number | The end of the byte range. If omitted the stream will continue to the end of file. |

###### How revision numbers work

If there are five versions of a file, the below chart would be the revision numbers

| Number | Description |
| --- | --- |
| `0` or `-5` | The original file |
| `1` or `-4` | The first revision |
| `2` or `-3` | The second revision |
| `3` or `-2` | The second most recent revision |
| `4` or `-1` | The most recent revision |

##### Description

If `revision` is a number a promise will be returned that resolves to an object of the files information and contents.
If `revision` is `'all'` a promise will be returned that resolves to an array of all file revisions and contents.

##### Example

```javascript
let file1 = await bucket.readFile({id: 'ca608825-15c0-44b5-9bef-3ccabf061bab'})
let file2 = await bucket.readFile({filename: 'catVideo.mp4', revision: 2})
let allVersionsOfCatVideo = await bucket.readFile({filename: 'catVideo.mp4', revision: 'all'})
```

---

### `createReadStream(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | *required* | String | The `id` of the file to retrieve |
| seekStart | Null | Number | The start of the byte range. |
| seekEnd | Null | Number | The end of the byte range. If omitted the stream will continue to the end of file. |

##### returns

ReadStream

##### Description

Returns a read stream for reading a file from ArangoFS.

##### Example

```javascript
var readStream = bucket.createReadStream({id: 'ca608825-15c0-44b5-9bef-3ccabf061bab'})

readStream.pipe(fs.createWriteStream('./mySavedVideo.mp4'))
```

---

### `deleteFileById(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| id | *required* | String | The `id` of the file to delete |

##### returns

Boolean, `true` if successful, `false` otherwise.

##### Description

Deletes a file from ArangoFS.

##### Example

```javascript
let result = await arangoFS.deleteFileById({id: 1})
```

---

### `deleteFileByName(options)`

###### Options

| key | default | type | description |
| --- | --- | --- | --- |
| filename | Null | String | The `filename` of the file to delete |
| revision | `all` | Number | The revision of the file to delete. If multiple files are uploaded under the same `filename` they are considered revisions. This may be a positive or negative number (see chart below). The default is to delete *all* revisions. |

###### How revision numbers work

If there are five versions of a file, the below chart would be the revision numbers

| Number | Description |
| --- | --- |
| `0` or `-5` | The original file |
| `1` or `-4` | The first revision |
| `2` or `-3` | The second revision |
| `3` or `-2` | The second most recent revision |
| `4` or `-1` | The most recent revision |

##### returns

Boolean, `true` if successful, `false` otherwise.

##### Description

Deletes a file from ArangoFS.

##### Example

```javascript
let result = await arangoFS.deleteFileByName({filename: 'video.mp4'})
// Deletes all revisions of video.mp4

let result = await arangoFS.deleteFileByName({filename: 'video.mp4', revision: -1})
// Deletes only the most recent revision of video.mp4
```

---

# Thanks

Videos used in tests acquired from [Pexels](https://videos.pexels.com/)
