const elasticsearch = require('elasticsearch')
const common = require('../common.js')
const utils = require('../../../modules/utils')
const crypto = require('crypto')
const request = require('request')

/*
 *
 * This gets all the instances
 *
 */
const getInstances = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  await common.createIndex('instances')

  const index = `instances_${process.env.KEY}`

  let page = common.getPage(args)
  let perPage = common.getPerPage(args)

  //  This is the base query
  const body = {
    from: page * perPage,
    size: perPage
  }

  //  These are things we must find
  const must = []

  //  If we are looking for a bunch of ids, then we do that here
  if ('ids' in args && Array.isArray(args.ids)) {
    must.push({
      terms: {
        'id.keyword': args.ids
      }
    })
  }

  //  If we have something with *must* do, then we add that
  //  to the search
  if (must.length > 0) {
    body.query = {
      bool: {
        must
      }
    }
  }

  let results = await common.runSearch(index, body)

  let total = null
  if (results.hits.total) total = results.hits.total
  if (!results.hits || !results.hits.hits) {
    return []
  }

  let instances = results.hits.hits.map((instance) => instance._source)

  //  If we are not only checking then go get more information
  if (!context.checkOnly) {
    for (const instance of instances) {
      const initiatives = await queryInitiatives.getInitiatives({
        instance: instance.id
      }, context)
      instance.initiatives = initiatives
    }
  }

  //  Finally, add the pagination information
  const sys = {
    pagination: {
      page,
      perPage,
      total
    }
  }
  if (total !== null) {
    sys.pagination.maxPage = Math.ceil(total / perPage) - 1
  }
  if (instances.length > 0) {
    instances[0]._sys = sys
  }

  instances = instances.map((instance) => {
    //  Set up default colour, logo and user fields if we don't have them
    if (!instance.colour) instance.colour = '000000'
    if (!instance.logo) instance.logo = 'iVBORw0KGgoAAAANSUhEUgAAAYAAAACACAYAAAACsL4LAAAA2klEQVR4nO3BAQ0AAAjAoOewf1BruAlUTQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALwHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcEG1EdcAGyFq6tsAAAAASUVORK5CYII='
    if (!instance.userFields) instance.userFields = '{}'
    return instance
  })

  return instances
}
exports.getInstances = getInstances

/*
 *
 * This gets a single instance
 *
 */
const getInstance = async (args, context, levelDown = 2, initialCall = false) => {
  const instance = await getInstances({
    ids: [args.id]
  }, context, levelDown, initialCall)
  if (instance && instance.length === 1) return instance[0]

  return null
}
exports.getInstance = getInstance

/*
 *
 * This checks for an instance
 *
 */
const checkInstance = async (args, context) => {
  context.checkOnly = true
  const instance = await getInstance(args, context)
  if (instance) return true
  return false
}
exports.checkInstance = checkInstance

/*
 *
 * This writes a single instance
 *
 */
const createInstance = async (args, context, levelDown = 2, initialCall = false) => {
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
  await common.createIndex('instances')

  const index = `instances_${process.env.KEY}`
  const type = 'instance'
  const d = new Date()
  const newInstance = {
    id,
    created: d,
    title: args.title,
    slug: id
  }
  //  Now the optional ones
  if (args.colour) newInstance.colour = args.colour
  if (args.logo) newInstance.logo = args.logo
  if (args.languages) newInstance.languages = args.languages
  if (args.defaultLanguage) newInstance.defaultLanguage = args.defaultLanguage
  if (args.userFields) newInstance.userFields = JSON.parse(args.userFields)

  await common.runUpdate(index, type, id, newInstance)

  //  Return back the values
  const newUpdatedInstance = await getInstance({
    id: id
  }, context)
  return newUpdatedInstance
}
exports.createInstance = createInstance

/*
 *
 * This updates a single instance
 *
 */
const updateInstance = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  if (!args.id) return null

  //  Make sure the index exists
  await common.createIndex('instances')

  const index = `instances_${process.env.KEY}`
  const type = 'instance'
  const updatedInstance = {
    id: args.id
  }
  if (args.title) updatedInstance.title = args.title
  if (args.colour) updatedInstance.colour = args.colour
  if (args.logo) updatedInstance.logo = args.logo
  if (args.languages) updatedInstance.languages = args.languages
  if (args.defaultLanguage) updatedInstance.defaultLanguage = args.defaultLanguage
  if (args.userFields) updatedInstance.userFields = JSON.parse(args.userFields)

  await common.runUpdate(index, type, args.id, updatedInstance)

  //  Return back the values
  const newUpdatedInstance = await getInstance({
    id: args.id
  }, context)
  //  Check to see if we have an endpoint for this instance
  //  If so then we call it
  if (global && global.config && global.config.auth0 && global.config.auth0[`AUTH0_CALLBACK_URL_${args.id}_FRONTEND`]) {
    const url = global.config.auth0[`AUTH0_CALLBACK_URL_${args.id}_FRONTEND`].replace('callback', `update/${global.config.handshake}`)
    request(url,
      function (error, response, body) {
        if (error) {
          console.warn('error:', 'Frontend endpoint unreachable.')
          console.warn(url)
        }
      })
  }

  return newUpdatedInstance
}
exports.updateInstance = updateInstance

/*
 *
 * This deletes a single instance
 *
 * We actually have a lot of stuff to do here, checking if there are any users connected
 * to it, photos in it and so on
 */
const deleteInstance = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  if (!args.id) return null

  //  Check to see if there are any initiatives connect to this instance
  const initiatives = await queryInitiatives.getInitiatives({
    instance: args.id
  })
  if (initiatives.length > 0) {
    return {
      status: 'Failed: Instance still contains initiatives',
      success: false
    }
  }

  //  Now we know there are no initiatives connected we can delete the instance

  //  Make sure the index exists
  await common.createIndex('instances')

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH,
    requestTimeout: 30000
  })
  const index = `instances_${process.env.KEY}`
  const type = 'instance'

  //  TODO: BEFORE WE DELETE THIS INITIATIVE WE NEED TO MAKE SURE
  //  IT DOESN'T CONTAIN ANY PHOTOS. WE ALSO NEED A WAY TO MASS DELETE
  //  ALL PHOTOS FROM AN INITIATIVE
  try {
    await esclient.delete({
      index,
      type,
      id: args.id
    })
    return {
      status: 'ok',
      success: true
    }
  } catch (er) {
    const response = JSON.parse(er.response)
    return {
      status: response.result,
      success: false
    }
  }
}
exports.deleteInstance = deleteInstance

const queryInitiatives = require('../initiatives')
