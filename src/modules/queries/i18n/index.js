const elasticsearch = require('elasticsearch')
const common = require('../common.js')
const utils = require('../../utils')
const request = require('request')

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
  const index = `i18ns_${process.env.KEY}`
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
 * This gets all the translations
 *
 */
const getStrings = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `i18ns_${process.env.KEY}`

  let page = common.getPage(args)
  let perPage = common.getPerPage(args)

  //  This is the base query
  const body = {
    from: page * perPage,
    size: perPage
  }

  // Do the sorting
  const validSorts = ['asc', 'desc']
  const keywordFields = ['section']
  const validFields = ['section', 'created', 'updated']

  if ('sort_field' in args && validFields.includes(args.sort_field.toLowerCase())) {
    let sortField = args.sort_field
    let sortOrder = 'asc'
    if ('sort' in args && (validSorts.includes(args.sort.toLowerCase()))) {
      sortOrder = args.sort.toLowerCase()
    }
    if (keywordFields.includes(sortField.toLowerCase())) sortField = `${sortField}.keyword`
    const sortObj = {}
    sortObj[sortField] = {
      order: sortOrder
    }
    body.sort = [sortObj]
  }

  //  If we don't have a sort then default to uploaded desc
  if (!body.sort) {
    body.sort = {
      'section.keyword': {
        order: 'desc'
      }
    }
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

  if ('instance' in args && args.instance !== '') {
    must.push({
      match: {
        'instance': args.instance
      }
    })
  }

  if ('instances' in args && Array.isArray(args.instances)) {
    must.push({
      terms: {
        'instance.keyword': args.instances
      }
    })
  }

  if ('section' in args && args.make !== '') {
    must.push({
      match: {
        'section.keyword': args.make
      }
    })
  }

  if ('language' in args && Array.isArray(args.language)) {
    must.push({
      terms: {
        'language.keyword': args.language
      }
    })
  }

  if ('stub' in args && args.stub !== '') {
    must.push({
      match: {
        'stub.keyword': args.stub
      }
    })
  }

  if ('token' in args && args.token !== '') {
    must.push({
      match: {
        'token.keyword': args.token
      }
    })
  }

  if ('createdBy' in args) {
    must.push({
      match: {
        'createdBy': args.createdBy
      }
    })
  }

  if ('updatedBy' in args) {
    must.push({
      match: {
        'updatedBy': args.updatedBy
      }
    })
  }

  //  If we have something with *must* do, then we add that
  //  to the search
  if (must.length > 0) {
    body.query = {
      bool: {}
    }
    if (must.length) body.query.bool.must = must
  }

  let results = await esclient.search({
    index,
    body
  })

  let total = null
  if (results.hits.total) total = results.hits.total
  if (results.hits.total.value) total = results.hits.total.value
  if (!results.hits || !results.hits.hits) {
    return []
  }

  const strings = results.hits.hits.map((string) => string._source)

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
  if (strings.length > 0) {
    strings[0]._sys = sys
  }

  return strings
}
exports.getStrings = getStrings

/*
 *
 * This gets a single string
 *
 */
const getString = async (args, context, levelDown = 2, initialCall = false) => {
  const newArgs = {}
  if (args.id) newArgs.ids = [args.id]
  if (args.instance) newArgs.instance = args.instance

  const string = await getStrings(newArgs, context, levelDown, initialCall)
  if (string && string.length === 1) return string[0]

  return null
}
exports.getPhoto = getString

/*
 *
 * This writes a single string
 *
 */
const createString = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have an language, section and stub
  if (!args.language || !args.section || !args.stub || !args.string || args.string.trim() === '') return null

  //  Set the default instance to be the key and if we have been passed
  //  an instance make sure it exists and then we use that instead
  let instance = process.env.KEY
  if (args.instance) {
    const checkInstance = await instances.checkInstance({
      id: args.instance
    }, context)
    if (!checkInstance) return null
    instance = args.instance
  }

  const token = `${instance}.${utils.slugify(args.section)}.${utils.slugify(args.stub)}`
  const newId = `${instance}.${utils.slugify(args.section)}.${utils.slugify(args.stub)}.${args.language}`

  //  Make sure the index exists
  creatIndex()

  //  Default photo
  const newString = {
    id: newId,
    instance,
    section: args.section,
    stub: args.stub,
    token,
    language: args.language,
    created: new Date(),
    string: args.string,
    createdBy: context.userId
  }

  //  Do some EXIF stuff here if we can
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `i18ns_${process.env.KEY}`
  const type = 'string'
  await esclient.update({
    index,
    type,
    id: newId,
    body: {
      doc: newString,
      doc_as_upsert: true
    }
  })
  return newString
}
exports.createString = createString

/*
 *
 * This updates a single photo
 *
 */
const updateString = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id and a string
  if (!args.id || !args.string || args.string.trim() === '') return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `i18ns_${process.env.KEY}`
  const type = 'string'
  const updatedString = {
    id: args.id,
    string: args.string,
    updated: new Date(),
    updatedBy: context.userId
  }

  //  Update the thing
  await esclient.update({
    index,
    type,
    id: args.id,
    body: {
      doc: updatedString,
      doc_as_upsert: true
    }
  })

  await delay(2000)

  //  Return back the values
  const newUpdatedString = await getString({
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

  return newUpdatedString
}
exports.updateString = updateString

/*
 *
 * This deletes a single string
 *
 */
const deleteString = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id
  if (!args.id) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `18ns_${process.env.KEY}`
  const type = 'string'

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
exports.deleteString = deleteString

const instances = require('../instances')
