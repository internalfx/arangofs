
// let aql = require('arangojs').aql

module.exports = async function (arango, conf) {
  let files = await arango.collection(`${conf.bucketName}_files`).exists()
  if (files === false) {
    arango.collection(`${conf.bucketName}_files`).create()
  }
  return true
}
