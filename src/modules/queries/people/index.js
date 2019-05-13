const elasticsearch = require('elasticsearch')
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

  const page = 0
  const perPage = 200

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
      if (keySplit.length === 2 && keySplit[0] === 'photos') newArgs[keySplit[1]] = value
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
  if (args.slug) newArgs.slugs = [args.slug]
  if (args.username) newArgs.usernames = [args.username]
  if (args.email) newArgs.emails = [args.email]
  if (!args.id && !args.slug && !args.username && !args.email) return []

  //  Grab any 'photo' filters we want to pass through
  Object.entries(args).forEach((keyValue) => {
    const key = keyValue[0]
    const value = keyValue[1]
    const keySplit = key.split('_')
    if (keySplit.length === 2 && keySplit[0] === 'photos') newArgs[key] = value
  })

  const person = await getPeople(newArgs, context, levelDown, initialCall)
  if (person && person.length === 1) return person[0]

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

/*
 *
 * This writes a single person
 *
 */
const createPerson = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have a username and password
  if (!args.username || !args.instance || !args.email || !args.hashedPassword) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  //  Check to see if the username already exists
  const usernameUser = await getPerson({
    username: args.username,
    instance: args.instance
  }, context)
  if (usernameUser) {
    return null
  }

  //  Check to see if the username already exists
  const emailUser = await getPerson({
    email: args.email,
    instance: args.instance
  }, context)
  if (emailUser) {
    return null
  }

  const slug = utils.slugify(args.username).substring(0, 36)

  //  Hash the password
  const hashedPassword = crypto
    .createHash('sha512')
    .update(`${args.hashedPassword}-${process.env.KEY}`)
    .digest('base64')

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `people_${process.env.KEY}`
  const type = 'person'
  const d = new Date()
  const newPerson = {
    id: slug,
    slug,
    email: args.email,
    username: args.username,
    hashedPassword,
    instance: args.instance,
    created: d
  }
  await esclient.update({
    index,
    type,
    id: slug,
    body: {
      doc: newPerson,
      doc_as_upsert: true
    }
  })

  await delay(2000)

  //  Return back the values
  const newUpdatedPerson = await getPerson({
    id: slug,
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
