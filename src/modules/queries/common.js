const elasticsearch = require('elasticsearch')
const utils = require('../utils')

exports.throwError = (msg) => {
  utils.throwError(msg)
}

exports.createIndex = async (thing) => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH,
    requestTimeout: 30000
  })
  const index = `${thing}_${process.env.KEY}`
  let exists = false
  try {
    exists = await esclient.indices.exists({
      index
    })
  } catch (er) {
    utils.throwError('503 Service Unavailable')
  }
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }
}

const runSearch = async (index, body) => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH,
    requestTimeout: 30000
  })
  let results = null
  try {
    results = await esclient.search({
      index,
      body
    })
  } catch (er) {
    utils.throwError('503 Service Unavailable')
  }
  return results
}
exports.runSearch = runSearch

const runUpdate = async (index, type, id, doc) => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH,
    requestTimeout: 30000
  })
  let results = null
  try {
    results = await esclient.update({
      index,
      type: "_doc",
      id,
      refresh: true,
      body: {
        doc,
        doc_as_upsert: true
      }
    })
  } catch (er) {
    utils.throwError('503 Service Unavailable')
  }
  return results
}
exports.runUpdate = runUpdate

const getPage = (args) => {
  const defaultPage = 0
  if ('page' in args) {
    try {
      const page = parseInt(args.page, 10)
      if (page < 0) {
        return defaultPage
      }
      return page
    } catch (er) {
      return defaultPage
    }
  }
  return defaultPage
}
exports.getPage = getPage

const getPerPage = (args) => {
  const defaultPerPage = 50
  if ('per_page' in args) {
    try {
      const perPage = parseInt(args.per_page, 10)
      if (perPage < 0) {
        return defaultPerPage
      }
      return perPage
    } catch (er) {
      return defaultPerPage
    }
  }
  return defaultPerPage
}
exports.getPerPage = getPerPage
