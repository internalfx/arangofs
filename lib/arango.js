
let arangojs = require('arangojs')
let _ = require('lodash')

module.exports = function (config) {
  let arango = new arangojs.Database({
    url: config.url
  })

  if (config.database) {
    arango.useDatabase(config.database)
  }

  if (config.username && config.password) {
    arango.useBasicAuth(config.username, config.password)
  }

  let q = async function (...args) {
    let cursor = null
    let attempts = 0

    while (cursor == null) {
      attempts += 1
      try {
        cursor = await arango.query(...args)
      } catch (err) {
        if (err.errorNum !== 1200 || attempts >= 50) {
          console.log(_.get(args, '[0].query'))
          throw err
        }
      }
    }

    return cursor
  }

  let qNext = async function (query) {
    let cursor = await q(query)
    return cursor.next()
  }

  let qAll = async function (query) {
    let cursor = await q(query)
    return cursor.all()
  }

  arango.q = q
  arango.qNext = qNext
  arango.qAll = qAll

  return arango
}
