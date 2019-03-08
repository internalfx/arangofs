'use strict'

let Promise = require('bluebird')
Promise.config({
  warnings: {
    wForgottenReturn: false
  }
})

let fs = Promise.promisifyAll(require('fs'))

let _ = require('lodash')
let ifxUtils = require('./ifx-utils')
let arangoConn = require('./arango.js')
let initDatabase = require('./initDatabase')

let Readable = require('stream').Readable
let Writable = require('stream').Writable
let crypto = require('crypto')
let path = require('path')

let defaultOptions = {
  bucketName: 'arangofs',
  concurrency: 10,
  path: null
}

let randomHash = function () {
  let hash = crypto.createHash('sha256')
  hash.update(crypto.randomBytes(50))
  return hash.digest('hex')
}

let forceArray = function (value) {
  if (value == null) {
    return []
  }

  if (_.isArray(value)) {
    return value
  }

  return [value]
}

let arangoFS = function (arangoConfig, options = {}) {
  let conf = { ...defaultOptions, ...options }

  let arango = arangoConn(arangoConfig)
  let aql = arango.aql

  let fileCollection = arango.collection(`${conf.bucketName}_files`)

  let getPath = function (name) {
    if (_.isString(name) !== true) {
      throw new Error('name is required')
    }

    let dir1 = name.slice(0, 2).length === 2 ? name.slice(0, 2) : '__'
    let dir2 = name.slice(2, 4).length === 2 ? name.slice(2, 4) : '__'

    return path.join(conf.path, dir1, dir2, name)
  }

  let getFolder = function (name) {
    if (_.isString(name) !== true) {
      throw new Error('name is required')
    }

    let dir1 = name.slice(0, 2).length === 2 ? name.slice(0, 2) : '__'
    let dir2 = name.slice(2, 4).length === 2 ? name.slice(2, 4) : '__'

    return path.join(conf.path, dir1, dir2)
  }

  let destroyFileById = async function (_id) {
    let file = await arango.qNext(aql`
      FOR file IN ${fileCollection}
        FILTER file._id == ${_id}
        return file
    `)

    file.status = 'Deleted'
    await arango.q(aql`
      UPDATE ${file} IN ${fileCollection}
    `)

    let duplicateCount = await arango.qNext(aql`
      FOR file IN ${fileCollection}
        FILTER file.status != "Deleted" AND file.sha256 == ${file.sha256}
        COLLECT WITH COUNT INTO length
        return length
    `)

    if (duplicateCount === 0) {
      try {
        await fs.unlinkAsync(getPath(file.sha256))
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.log(err)
        }
      }
    }

    await arango.q(aql`
      REMOVE ${file} IN ${fileCollection}
    `)
  }

  let fetchFileById = async function (_id) {
    return arango.qNext(aql`
      FOR file IN ${fileCollection}
        FILTER file._id == ${_id}
        return file
    `)
  }

  let fetchFileByName = async function (filename, revision = -1) {
    let sort = 'DESC'
    let revSteps = revision

    if (revision >= 0) {
      sort = 'ASC'
    } else if (revision < 0) {
      revSteps = (revision * -1) - 1
    }

    let fileList = await arango.qAll(aql`
      FOR file IN ${fileCollection}
        FILTER file.status == "Complete" AND file.filename == ${filename}
        SORT file.finishedAt ${sort}
        return file
    `)

    if (fileList.length === 0) { throw new Error('File not found!') }

    if (revision === 'all') {
      return fileList
    }

    if (fileList.length < (revSteps + 1)) { throw new Error('File revision does not exist!') }

    return fileList[revSteps]
  }

  let initBucket = async function () {
    return initDatabase(arango, conf)
  }

  let writeFile = async function (spec = {}) {
    spec = {
      filename: null,
      buffer: null,
      ...spec
    }

    if (spec.buffer == null) { throw new Error('buffer must not be null') }

    let wstream = await createWriteStream(spec)
    let uploadPromise = ifxUtils.writeStreamPromise(wstream)
    wstream.write(spec.buffer)
    wstream.end()
    await uploadPromise

    let file = await fetchFileByName(spec.filename)
    return file
  }

  let createWriteStream = async function (spec = {}) {
    spec = Object.assign({
      filename: null
    }, spec)

    if (spec.filename == null) { throw new Error('filename must not be null') }

    let hash = crypto.createHash('sha256')
    let tempHash = randomHash()
    let size = 0

    let file = {
      filename: spec.filename,
      status: 'Incomplete'
    }

    file = await arango.qNext(aql`
      INSERT ${file} INTO ${fileCollection} RETURN NEW
    `)
    await fs.mkdirAsync(getFolder(tempHash), { recursive: true })

    let fd = await fs.openAsync(getPath(tempHash), 'w')

    let stream = new Writable()

    stream._write = async function (chunk, encoding, cb) {
      hash.update(chunk)
      size += chunk.length

      await fs.writeAsync(fd, chunk)

      cb()
    }

    stream._final = async function (cb) {
      let sha256 = hash.digest('hex')

      let exists = true
      try {
        await fs.accessAsync(getPath(sha256), fs.constants.F_OK)
      } catch (err) {
        exists = false
      }

      if (exists === false) {
        await fs.mkdirAsync(getFolder(sha256), { recursive: true })
        await fs.renameAsync(getPath(tempHash), getPath(sha256))
      } else {
        await fs.unlinkAsync(getPath(tempHash))
      }

      file.filename = spec.filename
      file.finishedAt = new Date()
      file.size = size
      file.status = 'Complete'
      file.sha256 = sha256

      await arango.q(aql`
        UPDATE ${file} IN ${fileCollection}
      `)

      cb()
    }

    return stream
  }

  let getFile = async function (spec = {}) {
    spec = Object.assign({
      filename: null,
      revision: -1,
      _id: null
    }, spec)

    if (spec._id == null && spec.filename == null) { throw new Error('filename or _id required') }

    let result

    if (spec._id != null) {
      result = await fetchFileById(spec._id)
    } else {
      result = await fetchFileByName(spec.filename, spec.revision)
    }

    return result
  }

  let readFile = async function (spec = {}) {
    spec = Object.assign({
      seekStart: null,
      seekEnd: null
    }, spec)

    let result = await getFile(spec)

    if (result != null) {
      if (_.isArray(result)) {
        for (let file of result) {
          let stream = await createReadStream({ _id: file._id, seekStart: spec.seekStart, seekEnd: spec.seekEnd })
          file.buffer = await ifxUtils.readStreamPromise(stream)
        }
      } else {
        let stream = await createReadStream({ _id: result._id, seekStart: spec.seekStart, seekEnd: spec.seekEnd })
        result.buffer = await ifxUtils.readStreamPromise(stream)
      }
    }

    return result
  }

  let createReadStream = async function (spec = {}) {
    spec = Object.assign({
      _id: null,
      seekStart: null,
      seekEnd: null
    }, spec)

    if (spec._id == null) {
      throw new Error('_id must not be null')
    }
    let file = await fetchFileById(spec._id)

    let verifyHash = false

    if (spec.seekStart == null && spec.seekEnd == null) {
      spec.seekStart = 0
      spec.seekEnd = file.size
      verifyHash = true
    }

    let hash = crypto.createHash('sha256')
    let fd = await fs.openAsync(getPath(file.sha256), 'r')
    let position = spec.seekStart

    let stream = new Readable()

    stream._read = function (size) {
      let readSize = spec.seekEnd - position

      if (readSize > size) {
        readSize = size
      }

      if (readSize < 0) {
        readSize = 0
      }

      let buffer = Buffer.alloc(readSize)

      fs.read(fd, buffer, 0, readSize, position, function (err, bytesRead, chunk) {
        if (err) {
          console.log(err)
        }

        if (chunk.length > 0) {
          position += chunk.length

          if (verifyHash) {
            hash.update(chunk)
          }

          stream.push(chunk)
        } else {
          let sha256 = hash.digest('hex')
          if (verifyHash && sha256 !== file.sha256) {
            stream.emit('error', new Error('sha256 hash mismatch: File is likely corrupted!'))
            return
          }

          stream.push(null)
        }
      })
    }

    return stream
  }

  let deleteFiles = async function (spec = {}) {
    spec = Object.assign({
      _id: null,
      filename: null,
      revision: 'all'
    }, spec)

    if (spec._id == null && spec.filename == null) { throw new Error('filename or _id required') }

    let fileList = forceArray(await getFile(spec))

    if (fileList.length > 0) {
      await Promise.map(fileList, async function (file) {
        await destroyFileById(file._id)
      }, { concurrency: conf.concurrency })
      return true
    }

    return false
  }

  return Object.freeze({
    initBucket,
    writeFile,
    createWriteStream,
    getFile,
    readFile,
    createReadStream,
    deleteFiles
  })
}

module.exports = arangoFS
