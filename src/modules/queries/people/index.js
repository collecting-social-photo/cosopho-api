const elasticsearch = require('elasticsearch')
const common = require('../common.js')
const utils = require('../../../modules/utils')
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
  const index = `people_${process.env.KEY}`
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
 * This gets all the people
 *
 */
const getPeople = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `people_${process.env.KEY}`

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

  if ('slugs' in args && Array.isArray(args.slugs)) {
    must.push({
      terms: {
        'slug.keyword': args.slugs
      }
    })
  }

  if ('usernames' in args && Array.isArray(args.usernames)) {
    must.push({
      terms: {
        'username.keyword': args.usernames
      }
    })
  }

  if ('emails' in args && Array.isArray(args.emails)) {
    must.push({
      terms: {
        'email.keyword': args.emails
      }
    })
  }

  if ('instance' in args && args.instance !== '') {
    must.push({
      match: {
        'instance.keyword': args.instance
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

  const people = results.hits.hits.map((person) => person._source)

  //  Now we need to go and get all the photos for each person
  if (levelDown < 2) {
    const peopleSlugs = people.map((person) => person.slug)
    const newArgs = {
      peopleSlugs: peopleSlugs
    }

    //  Grab any 'photo' filters we want to pass through
    Object.entries(args).forEach((keyValue) => {
      const key = keyValue[0]
      const value = keyValue[1]
      const keySplit = key.split('_')
      if (keySplit.length > 1 && keySplit[0] === 'photos') newArgs[key.replace('photos_', '')] = value
    })

    const peoplePhotos = await photos.getPhotos(newArgs, context)

    if (peoplePhotos) {
      peoplePhotos.forEach((photo) => {
        people.forEach((person) => {
          if (person.slug === photo.personSlug) {
            if (!person.photos) person.photos = []
            person.photos.push(photo)
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
  if (people.length > 0) {
    people[0]._sys = sys
  }

  return people
}
exports.getPeople = getPeople

/*
 *
 * This gets a single person
 *
 */
const getPerson = async (args, context, levelDown = 2, initialCall = false) => {
  const newArgs = {}
  if (args.id) newArgs.ids = [args.id]
  if (args.instance) newArgs.instance = args.instance
  if (args.slug) newArgs.slugs = [args.slug]
  if (args.username) newArgs.usernames = [args.username]
  if (args.email) newArgs.emails = [args.email]
  if (!args.id && !args.slug && !args.username && !args.email) return []

  //  Grab any 'photo' filters we want to pass through
  Object.entries(args).forEach((keyValue) => {
    const key = keyValue[0]
    const value = keyValue[1]
    const keySplit = key.split('_')
    if (keySplit.length > 1 && keySplit[0] === 'photos') newArgs[key] = value
  })
  const person = await getPeople(newArgs, context, levelDown, initialCall)
  if (person && person.length > 0) return person[0]

  return null
}
exports.getPerson = getPerson

/*
 *
 * This checks a single person
 *
 */
const checkPerson = async (args, context) => {
  context.checkOnly = true
  const person = await getPerson(args, context)
  if (person) return true
  return false
}
exports.checkPerson = checkPerson

const checkPersonAPI = async (args, context) => {
  context.checkOnly = true
  const person = await getPerson(args, context)
  if (person) {
    return {
      status: 'ok',
      success: true
    }
  }
  return {
    status: 'error',
    success: false
  }
}
exports.checkPersonAPI = checkPersonAPI

const updatePerson = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id
  if (!args.id) return null
  if (!args.instance) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `people_${process.env.KEY}`
  const type = 'person'

  //  Grab the user before we update them
  const preUpdatedPerson = await getPerson({
    id: args.id,
    instance: args.instance
  }, context)

  const updatedPerson = {
    id: args.id
  }

  //  These are the fields that can be updated
  const keys = [
    'email',
    'dateOfBirth',
    'placeOfBirth',
    'avatar',
    'name',
    'username',
    'gender',
    'facebook',
    'instagram',
    'twitter',
    'personalSite',
    'bio',
    'suspended',
    'deleted'
  ]

  //  Check to see if we have a new value, if so add it to the update record obj
  keys.forEach((key) => {
    if (key in args) {
      updatedPerson[key] = args[key]
    }
  })

  //  Update the thing
  await esclient.update({
    index,
    type,
    id: args.id,
    body: {
      doc: updatedPerson,
      doc_as_upsert: true
    }
  })

  //  If we are suspending a user then we need to also suspend all the photos
  //  connected to that user
  let updateBody = null
  if ('suspended' in args) {
    updateBody = {
      'query': {
        'bool': {
          'must': [{
            'match': {
              'personSlug': preUpdatedPerson.slug
            }
          }, {
            'match': {
              'instance': args.instance
            }
          }]
        }
      },
      'script': {
        'inline': `ctx._source.suspended = ${args.suspended}`
      }
    }
  }

  //  If we are deleting a user then we need to also delete all the photos
  //  connected to that user
  if ('deleted' in args) {
    updateBody = {
      'query': {
        'bool': {
          'must': [{
            'match': {
              'personSlug': preUpdatedPerson.slug
            }
          }, {
            'match': {
              'instance': args.instance
            }
          }]
        }
      },
      'script': {
        'inline': `ctx._source.ownerDeleted = ${args.deleted}`
      }
    }
  }

  if (updateBody !== null) {
    await esclient.updateByQuery({
      index: `photos_${process.env.KEY}`,
      type: 'photo',
      body: updateBody
    })
  }

  await delay(2000)

  //  Return back the values
  const newUpdatedPerson = await getPerson({
    id: args.id,
    instance: args.instance
  }, context)
  return newUpdatedPerson
}
exports.updatePerson = updatePerson

/*
 *
 * This writes a single person
 *
 */
const createPerson = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have a username and password
  if (!args.username || !args.instance || !args.id) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  //  Check to see if the id already exists, if so then we reject the creation
  if (await checkPerson({
    id: args.id,
    instance: args.instance
  }, context) === true) return null

  //  Check to see if the username already exists
  const usernameUser = await getPerson({
    username: args.username,
    instance: args.instance
  }, context)
  //  If we already have the username then we will need to make the stub unique
  let extraSlug = ''
  if (usernameUser) {
    extraSlug = crypto
      .createHash('sha512')
      .update(`${args.hashedPassword}-${process.env.KEY}`)
      .digest('base64')
      .slice(0, 6)
  }

  const slug = `${utils.slugify(args.username).substring(0, 36)}${extraSlug}`

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `people_${process.env.KEY}`
  const type = 'person'
  const d = new Date()
  const newPerson = {
    id: args.id,
    slug,
    username: args.username,
    instance: args.instance,
    avatar: args.avatar,
    raw: JSON.parse(args.raw),
    created: d
  }

  await esclient.update({
    index,
    type,
    id: args.id,
    body: {
      doc: newPerson,
      doc_as_upsert: true
    }
  })

  await delay(2000)

  //  Return back the values
  const newUpdatedPerson = await getPerson({
    id: args.id,
    instance: args.instance
  }, context)
  return newUpdatedPerson
}
exports.createPerson = createPerson

/*
 * This checks to see if we can log the person in
 */
const loginPerson = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have a username and password
  if (!args.username || !args.hashedPassword) return null

  //  Hash the password (again)
  const hashedPassword = crypto
    .createHash('sha512')
    .update(`${args.hashedPassword}-${process.env.KEY}`)
    .digest('base64')

  //  Make sure the index exists
  creatIndex()

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
      'username.keyword': args.username
    }
  })
  must.push({
    match: {
      'hashedPassword.keyword': hashedPassword
    }
  })
  must.push({
    match: {
      'instance.keyword': args.instance
    }
  })

  body.query = {
    bool: {
      must
    }
  }
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `people_${process.env.KEY}`
  let results = await esclient.search({
    index,
    body
  })
  if (results.hits && results.hits.hits && results.hits.hits.length === 1) {
    return {
      status: 'ok',
      success: true
    }
  }
  return {
    status: 'fail',
    success: false
  }
}
exports.loginPerson = loginPerson

const instances = require('../instances')
const photos = require('../photos')
