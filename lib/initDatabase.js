
// let aql = require('arangojs').aql

module.exports = async function (arango, conf) {
  let files = await arango.collection(`${conf.bucketName}_files`).exists()
  if (files === false) {
    arango.collection(`${conf.bucketName}_files`).create()
  }
  let pointers = await arango.collection(`${conf.bucketName}_pointers`).exists()
  if (pointers === false) {
    arango.collection(`${conf.bucketName}_pointers`).create()
  }
  return true
}
