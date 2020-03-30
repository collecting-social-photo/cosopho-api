const elasticsearch = require('elasticsearch')
const common = require('../common.js')
const utils = require('../../utils')
const request = require('request')

const pingCallback = (instance) => {
  let callbackUrl = null
  if (global && global.config && global.config.auth0 && global.config.auth0[`AUTH0_CALLBACK_URL_${instance}_FRONTEND`]) {
    callbackUrl = global.config.auth0[`AUTH0_CALLBACK_URL_${instance}_FRONTEND`].replace('callback', `update/${global.config.handshake}`)
    request(callbackUrl,
      function (error, response, body) {
        if (error) {
          console.log('There was an error')
          console.warn('error:', 'Frontend endpoint unreachable.')
          console.warn(callbackUrl)
        }
      })
  } else {
    //  If there isn't a specific callback url, then we call back any frontend urls we can find
    //  (because we've updated the main translations not an instance one, so they *all* need to know)
    if (global && global.config && global.config.auth0) {
      const urls = []
      Object.entries(global.config.auth0).forEach((keyValue) => {
        const key = keyValue[0]
        const keySplit = key.split('_')
        const frontend = keySplit.pop()
        if (frontend === 'FRONTEND') urls.push(keyValue[1])
      })
      //  Loop through them calling each one
      urls.forEach((url) => {
        callbackUrl = url.replace('callback', `update/${global.config.handshake}`)
        request(callbackUrl,
          function (error, response, body) {
            if (error) {
              console.log('There was an error')
              console.warn('error:', 'Frontend endpoint unreachable.')
            }
          })
      })
    }
  }
}

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

  if ('fill' in args && args.fill === true) perPage = 10000

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
    const sortArray = []
    sortArray.push({
      'section.keyword': {
        order: 'asc'
      }
    })
    sortArray.push({
      'stub.keyword': {
        order: 'asc'
      }
    })
    body.sort = sortArray
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

  //  If we have been asked to fill, then we are going to
  //  make sure we always have the default languages
  if ('fill' in args && args.fill === true) {
    //  If we don't have an instances array we make one now
    let instances = []
    if (args.instances) {
      if (Array.isArray(args.instances)) instances = [...instances, ...args.instances]
      if (!Array.isArray(args.instances)) instances.push(args.instances)
    }
    //  If we have something in the instance then we need to add that to the instances array
    if ('instance' in args && args.instance !== '') {
      //  If we don't already have it
      if (!instances.includes(args.instance)) instances.push(args.instance)
    }
    //  Now add the default "instance" in if it hasn't been already
    if (!instances.includes(process.env.KEY)) instances.push(process.env.KEY)
    //  Now add the instances on
    must.push({
      terms: {
        'instance.keyword': instances
      }
    })
  } else {
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
  }

  if ('section' in args && args.make !== '') {
    must.push({
      match: {
        'section.keyword': args.section
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

  let strings = results.hits.hits.map((string) => string._source)

  //  If we had a fill, then we need to map the translated strings over
  //  the top of the language strings
  //  First we make a map of all the "root/default" strings
  if ('fill' in args && args.fill === true) {
    const baseStrings = {}
    const layerStrings = {}
    strings.forEach((row) => {
      if (row.instance === process.env.KEY) {
        baseStrings[row.id] = row
      } else {
        layerStrings[row.id] = row
      }
    })
    //  Now we go through all the layerStrings, to see if we can put
    //  them over the top of the baseString
    Object.entries(layerStrings).forEach((row) => {
      const record = row[1]
      //  Turn the id into protentially the original version
      const newId = record.id.replace(record.instance, process.env.KEY)
      //  If this exists in the base layer, then we need to put the string
      //  over the top of the base one
      if (baseStrings[newId]) {
        baseStrings[newId].string = record.string
      } else {
        //  Otherwise, if it somehow doesn't exist then we need to make it
        //  a new one
        record.id = newId
        record.token = record.token.replace(record.instance, process.env.KEY)
        record.instance = process.env.KEY
        baseStrings[newId] = JSON.parse(JSON.stringify(record))
      }
    })
    //  Now turn the baseStrings object back into an array
    strings = Object.entries(baseStrings).map((row) => row[1])
    total = strings.length
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
    string: unescape(args.string),
    createdBy: context.userId
  }

  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(newString)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('process.env.ELASTICSEARCH: ', process.env.ELASTICSEARCH)
  //  Do some EXIF stuff here if we can
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `i18ns_${process.env.KEY}`
  const type = 'string'
  console.log('About to call add')
  console.log(JSON.stringify({
    index,
    type,
    id: newId,
    refresh: true,
    body: {
      doc: newString,
      doc_as_upsert: true
    }
  }, null, 4))
  const result = await esclient.update({
    index,
    type,
    id: newId,
    refresh: true,
    body: {
      doc: newString,
      doc_as_upsert: true
    }
  })
  console.log('Finished calling add')
  console.log(result)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

  //  Check to see if we have an endpoint for this instance
  //  If so then we call it
  pingCallback(instance)

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
    string: unescape(args.string),
    updated: new Date(),
    updatedBy: context.userId
  }
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(updatedString)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('process.env.ELASTICSEARCH: ', process.env.ELASTICSEARCH)
  console.log('About to call update')
  console.log(JSON.stringify({
    index,
    type,
    id: args.id,
    refresh: true,
    body: {
      doc: updatedString,
      doc_as_upsert: true
    }
  }, null, 4))
  //  Update the thing
  const result = await esclient.update({
    index,
    type,
    id: args.id,
    refresh: true,
    body: {
      doc: updatedString,
      doc_as_upsert: true
    }
  })
  console.log('Finished calling update')
  console.log(result)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')

  //  Return back the values
  const newUpdatedString = await getString({
    id: args.id
  }, context)

  //  Check to see if we have an endpoint for this instance
  //  If so then we call it
  const idSplit = args.id.split('.')
  const instance = idSplit[0]
  pingCallback(instance)

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

/*
 *
 * This deletes a single string
 *
 */
const deleteAllStrings = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Default all strings
  const body = {
    'query': {
      'match_all': {}
    }
  }

  //  Do some EXIF stuff here if we can
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `i18ns_${process.env.KEY}`
  const type = 'string'
  await esclient.deleteByQuery({
    index,
    type,
    body
  })

  return {
    status: 'ok',
    success: true
  }
}
exports.deleteAllStrings = deleteAllStrings

const instances = require('../instances')
