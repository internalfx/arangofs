
// let aql = require('arangojs').aql

let _ = require('lodash')

module.exports = async function (arango, conf) {
  let filesCollection = arango.collection(`${conf.bucketName}_files`)
  let exists = await filesCollection.exists()

  if (exists === false) {
    await filesCollection.create()
  }

  let indexes = (await filesCollection.indexes()).filter(idx => idx.type !== 'primary')

  let filenameIndex = indexes.find(i => i.type === 'skiplist' && _.isEqual(i.fields, ['status', 'filename', 'finishedAt']))
  if (filenameIndex == null) {
    await filesCollection.createIndex({
      type: 'skiplist',
      fields: ['status', 'filename', 'finishedAt'],
      unique: false,
      sparse: false,
      deduplicate: false
    })
  }

  let hashIndex = indexes.find(i => i.type === 'skiplist' && _.isEqual(i.fields, ['status', 'sha256']))
  if (hashIndex == null) {
    await filesCollection.createIndex({
      type: 'skiplist',
      fields: ['status', 'sha256'],
      unique: false,
      sparse: false,
      deduplicate: false
    })
  }

  return true
}
