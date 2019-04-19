const elasticsearch = require('elasticsearch')
const utils = require('../../utils')
const crypto = require('crypto')
const delay = require('delay')

/*
 *
 * Make sure the actual index exists
 *
 */
const creatIndex = async () => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `initiatives_${process.env.KEY}`
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
 * This gets all the initiative
 *
 */
const getInitiatives = async (args, context, levelDown = 2, initialCall = false) => {
  //  If we haven't been passed an instance then reject it
  if (!args.instance) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `initiatives_${process.env.KEY}`

  const page = 0
  const perPage = 200

  //  This is the base query
  const body = {
    from: page * perPage,
    size: perPage
  }

  //  These are things we must find
  const must = []
  must.push({
    match: {
      'instance.keyword': args.instance
    }
  })

  //  If we are looking for a bunch of ids, then we do that here
  if ('ids' in args && Array.isArray(args.ids)) {
    must.push({
      terms: {
        'id.keyword': args.ids
      }
    })
  }

  //  If we are looking for a bunch of ids, then we do that here
  if ('slug' in args) {
    must.push({
      match: {
        'slug.keyword': args.slug
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

  let results = await esclient.search({
    index,
    body
  })

  if (!results.hits || !results.hits.hits) {
    return []
  }

  const initiatives = results.hits.hits.map((initiative) => initiative._source)
  return initiatives
}
exports.getInitiatives = getInitiatives

/*
 *
 * This gets a single initiative
 *
 */
const getInitiative = async (args, context, levelDown = 2, initialCall = false) => {
  //  If we haven't been passed an instance then reject it
  if (!args.instance) return null

  const newArgs = {
    instance: args.instance
  }
  if (args.id) newArgs.ids = [args.id]
  if (args.slug) newArgs.slug = args.slug

  const initiative = await getInitiatives(newArgs, context, levelDown, initialCall)

  if (initiative && initiative.length === 1) return initiative[0]

  return null
}
exports.getInitiative = getInitiative

/*
 *
 * This writes a single initiative
 *
 */
const createInitiative = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have a title and initiative
  if (!args.title) return null
  if (!args.instance) return null

  //  Convert the title into a slug
  const slug = utils.slugify(args.title)
  const slugTail = crypto
    .createHash('md5')
    .update(`${Math.random()}`)
    .digest('hex')
    .substring(0, 16)
  const id = `${slug.substring(0, 12)}-${slugTail}`
  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `initiatives_${process.env.KEY}`
  const type = 'initiative'
  const d = new Date()
  const newInitiative = {
    id,
    slug,
    created: d,
    title: args.title,
    instance: args.instance,
    isActive: args.isActive
  }
  await esclient.update({
    index,
    type,
    id,
    body: {
      doc: newInitiative,
      doc_as_upsert: true
    }
  })

  await delay(2000)

  //  Return back the values
  const newUpdatedInitiative = await getInitiative({
    id: id,
    instance: args.instance
  }, context)
  return newUpdatedInitiative
}
exports.createInitiative = createInitiative

/*
 *
 * This updates a single initiative
 *
 */
const updateInitiative = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id and an instance
  if (!args.id) return null
  if (!args.instance) return null
  //  Make sure we have at least a title or an isActive flag
  if (!args.title && !('isActive' in args)) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `initiatives_${process.env.KEY}`
  const type = 'initiative'
  const updatedInitiative = {
    id: args.id
  }
  if (args.title) updatedInitiative.title = args.title
  if ('isActive' in args) updatedInitiative.isActive = args.title

  await esclient.update({
    index,
    type,
    id: args.id,
    body: {
      doc: updatedInitiative,
      doc_as_upsert: true
    }
  })

  await delay(2000)

  //  Return back the values
  const newUpdatedInitiative = await getInitiative({
    id: args.id,
    instance: args.instance
  }, context)
  return newUpdatedInitiative
}
exports.updateInitiative = updateInitiative

/*
 *
 * This deletes a single initiative
 *
 */
const deleteInitiative = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id and an instance
  if (!args.id) return null
  if (!args.instance) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `initiatives_${process.env.KEY}`
  const type = 'initiative'

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
exports.deleteInitiative = deleteInitiative
