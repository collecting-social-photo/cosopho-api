const elasticsearch = require('elasticsearch')
const common = require('../common.js')
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

  let page = common.getPage(args)
  let perPage = common.getPerPage(args)

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

  //  If we filtering by active
  if ('isActive' in args) {
    must.push({
      match: {
        'isActive': args.isActive
      }
    })
  }

  //  If we filtering by featured
  if ('isFeatured' in args) {
    must.push({
      match: {
        'isFeatured': args.isFeatured
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

  let total = null
  if (results.hits.total) total = results.hits.total
  if (!results.hits || !results.hits.hits) {
    return []
  }

  const initiatives = results.hits.hits.map((initiative) => initiative._source)

  //  Now we need to go and get all the photos for each initiative
  if (levelDown < 2) {
    const initiativeSlugs = initiatives.map((initiative) => initiative.slug)
    const newArgs = {
      instance: args.instance,
      initiatives: initiativeSlugs
    }

    //  Grab any 'photo' filters we want to pass through
    Object.entries(args).forEach((keyValue) => {
      const key = keyValue[0]
      const value = keyValue[1]
      const keySplit = key.split('_')
      if (keySplit.length > 1 && keySplit[0] === 'photos') newArgs[key.replace('photos_', '')] = value
    })

    const initiativePhotos = await photos.getPhotos(newArgs, context, levelDown)
    if (initiativePhotos) {
      initiativePhotos.forEach((photo) => {
        initiatives.forEach((initiative) => {
          if (initiative.slug === photo.initiative) {
            if (!initiative.photos) initiative.photos = []
            initiative.photos.push(photo)
          }
        })
      })
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
  if (initiatives.length > 0) {
    initiatives[0]._sys = sys
  }

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

  //  Grab any 'photo' filters we want to pass through
  Object.entries(args).forEach((keyValue) => {
    const key = keyValue[0]
    const value = keyValue[1]
    const keySplit = key.split('_')
    if (keySplit.length > 1 && keySplit[0] === 'photos') newArgs[key] = value
  })

  const initiative = await getInitiatives(newArgs, context, levelDown, initialCall)
  if (initiative && initiative.length === 1) return initiative[0]

  return null
}
exports.getInitiative = getInitiative

/*
 *
 * This checks a single initiative
 *
 */
const checkInitiative = async (args, context) => {
  context.checkOnly = true
  const initiative = await getInitiatives(args, context)
  if (initiative) return true
  return false
}
exports.checkInitiative = checkInitiative
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
    description: args.description,
    instance: args.instance,
    isActive: args.isActive,
    isFeatured: args.isFeatured
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
  //  Make sure we have at least a title, isFeatured or an isActive flag
  if (!args.title && !('isActive' in args) && !('isFeatured' in args)) return null

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
  if (args.description) updatedInitiative.description = args.description
  if ('isActive' in args) updatedInitiative.isActive = args.isActive
  if ('isFeatured' in args) updatedInitiative.isFeatured = args.isFeatured

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
const photos = require('../photos')