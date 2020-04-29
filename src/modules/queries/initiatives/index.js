const elasticsearch = require('elasticsearch')
const common = require('../common.js')
const utils = require('../../utils')
const crypto = require('crypto')

/*
 *
 * This gets all the initiative
 *
 */
const getInitiatives = async (args, context, levelDown = 2, initialCall = false) => {
  //  If we haven't been passed an instance then reject it
  if (!args.instance) return null

  //  Make sure the index exists
  await common.createIndex('initiatives')

  const index = `initiatives_${process.env.KEY}`

  let page = common.getPage(args)
  let perPage = common.getPerPage(args)

  //  This is the base query
  const body = {
    from: page * perPage,
    size: perPage
  }

  //  These are things we must find
  let must = []
  let mustNot = []

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
    if (args.isActive === true) {
      must.push({
        match: {
          'isActive': true
        }
      })
    } else {
      mustNot.push({
        match: {
          'isActive': true
        }
      })
    }
  }

  //  If we filtering by featured
  if ('isFeatured' in args) {
    if (args.isFeatured === true) {
      must.push({
        match: {
          'isFeatured': true
        }
      })
    } else {
      mustNot.push({
        match: {
          'isFeatured': true
        }
      })
    }
  }

  /*
    Are we allowed to active initiatives?
    We are allowed to see them if...

    1.  The call is signed and is signed with an id
        that matches the signedId
  */
  if (context.signed && process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID)) {
    //  We have a signature from the calling user
    //  We have signedId in the ENV
    //  The signature version of the signedId matches the calling user
    //  So everything is fine
  } else {
    //  Otherwise, we are NOT allowed to see this user
    //  Step 1. Remove any approved, ownerDeleted, deleted, suspended calls we already have in the must and mustnot
    //  query
    must = must.filter((q) => {
      if (q.match && q.match.isActive) return false
      return true
    })
    mustNot = mustNot.filter((q) => {
      if (q.match && q.match.isActive) return false
      return true
    })

    //  Now we need to work out if we are getting photos for a single
    //  user, if we are, then see if that user is the logged in user
    //  if so then we can allow archived photos

    //  Now add that filter back in
    must.push({
      match: {
        'isActive': true
      }
    })
  }

  //  If we are signed in, and either the admin user, or the owner
  //  and we are making a single user call, then we can respect the
  //  isActive flag if we have one
  if (context.signed) {
    if ((process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID))) {
      //  Remove any active filter already have
      must = must.filter((q) => !(q.match && q.match.isActive))
      mustNot = mustNot.filter((q) => !(q.match && q.match.isActive))

      if ('isActive' in args) {
        if (args.isActive === true) {
          must.push({
            match: {
              'isActive': true
            }
          })
        } else {
          mustNot.push({
            match: {
              'isActive': true
            }
          })
        }
      }
    }
  }

  //  If we have something with *must* do, then we add that
  //  to the search
  if (must.length > 0 || mustNot.length > 0) {
    body.query = {
      bool: {}
    }
    if (must.length) body.query.bool.must = must
    if (mustNot.length) body.query.bool.must_not = mustNot
  }

  let results = await common.runSearch(index, body)

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
  if (!initiative) return false
  if (Array.isArray(initiative) && initiative.length === 0) return false
  return true
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
  let slug = utils.slugify(args.title)
  const slugTail = crypto
    .createHash('md5')
    .update(`${Math.random()}`)
    .digest('hex')
    .substring(0, 16)
  const id = `${slug.substring(0, 12)}-${slugTail}`

  //  Check to see if an initiative already exists with this slug
  const newArgs = {
    instance: args.instance,
    slug
  }
  const alreadyExists = await checkInitiative(newArgs, context)
  if (alreadyExists === true) slug = id

  //  Make sure the index exists
  await common.createIndex('initiatives')

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

  await common.runUpdate(index, type, id, newInitiative)

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
  await common.createIndex('initiatives')

  const index = `initiatives_${process.env.KEY}`
  const type = 'initiative'
  const updatedInitiative = {
    id: args.id
  }
  if (args.title) updatedInitiative.title = args.title
  if (args.description) updatedInitiative.description = args.description
  if ('isActive' in args) updatedInitiative.isActive = args.isActive
  if ('isFeatured' in args) updatedInitiative.isFeatured = args.isFeatured

  await common.runUpdate(index, type, args.id, updatedInitiative)

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
  await common.createIndex('initiatives')

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
