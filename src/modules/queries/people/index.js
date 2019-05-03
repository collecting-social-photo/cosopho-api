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

  const person = await getPeople(newArgs, context, levelDown, initialCall)
  if (person && person.length === 1) return person[0]

  return []
}
exports.getPerson = getPerson

/*
 *
 * This writes a single person
 *
 */
const createPerson = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have a username and password
  if (!args.username || !args.email || !args.hashedPassword) return null

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
