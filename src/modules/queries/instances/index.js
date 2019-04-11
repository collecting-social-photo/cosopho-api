const elasticsearch = require('elasticsearch')
const utils = require('../../../modules/utils')
const crypto = require('crypto')

/*
 *
 * Make sure the actual index exists
 *
 */
const creatIndex = async () => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `instances_${process.env.KEY}`
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }
}

/*
 *
 * This gets all the instances
 *
 */
const getInstances = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `instances_${process.env.KEY}`
  let results = await esclient.search({
    index
  })
  if (results.hits && results.hits.hits) {
    const instances = results.hits.hits.map((instance) => instance._source)
    return instances
  }

  return []
}
exports.getInstances = getInstances

/*
 *
 * This gets a single instance
 *
 */
const getInstance = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  creatIndex()

  //  If we don't have an id
  if (!args.id) return []

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `instances_${process.env.KEY}`
  const type = 'instance'
  let instance = null
  try {
    instance = await esclient.get({
      index,
      type,
      id: args.id
    })
  } catch (er) {
    return null
  }

  //  If we didn't get a match, return nothing
  if (!instance.found || instance.found !== true || !instance._source) return null

  return instance._source
}
exports.getInstance = getInstance

/*
 *
 * This writes a single instance
 *
 */
const createInstance = async (args, context) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have a title
  if (!args.title) return null

  //  Convert the title into a slug
  const slug = utils.slugify(args.title).substring(0, 12)
  const slugTail = crypto
    .createHash('md5')
    .update(`${Math.random()}`)
    .digest('hex')
    .substring(0, 16)
  const id = `${slug}-${slugTail}`

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `instances_${process.env.KEY}`
  const type = 'instance'
  const d = new Date()
  const newInstance = {
    id,
    created: d,
    title: args.title
  }
  await esclient.update({
    index,
    type,
    id,
    body: {
      doc: newInstance,
      doc_as_upsert: true
    }
  })

  return {
    id,
    title: args.title
  }
}
exports.createInstance = createInstance

/*
 *
 * This updates a single instance
 *
 */
const updateInstance = async (args, context) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  if (!args.title) return null
  if (!args.id) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `instances_${process.env.KEY}`
  const type = 'instance'
  const updatedInstance = {
    id: args.id,
    title: args.title
  }
  await esclient.update({
    index,
    type,
    id: args.id,
    body: {
      doc: updatedInstance,
      doc_as_upsert: true
    }
  })

  return {
    id: args.id,
    title: args.title
  }
}
exports.updateInstance = updateInstance

/*
 *
 * This deletes a single instance
 *
 * We actually have a lot of stuff to do here, checking if there are any users connected
 * to it, photos in it and so on
 */
const deleteInstance = async (args, context) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  if (!args.id) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `instances_${process.env.KEY}`
  const type = 'instance'
  try {
    await esclient.delete({
      index,
      type,
      id: args.id
    })
  } catch (er) {
    return null
  }
  return null
}
exports.deleteInstance = deleteInstance
