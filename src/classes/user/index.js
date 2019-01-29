/* eslint-disable no-useless-constructor */
const crypto = require('crypto')
const Config = require('../config')
const elasticsearch = require('elasticsearch')

/**
 * This will go and get the user from Auth0, this is the object
 * that we want to use everywhere else in the system
 * @param {string} id The id of the user we want to get information from Auth0 about.
 * @returns {json} A json representation of a user
 * @access private
 */
const getUserSync = async id => {
  //  Make sure we have the user table in the database
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `users_${process.env.KEY}`
  const type = 'user'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }

  //  Get the user
  let user = null
  try {
    user = await esclient.get({
      index,
      type,
      id
    })
  } catch (er) {
    user = null
  }

  //  If we have a user, return them
  if (user !== null) return user._source

  //  Otherwise we create them
  const d = new Date()
  const newUser = {
    id,
    created: d,
    lastLoggedIn: d,
    lastUpdated: d
  }
  await esclient.update({
    index,
    type,
    id,
    body: {
      doc: newUser,
      doc_as_upsert: true
    }
  })
  return newUser
}

/**
 * This will generate a new developer API token for a user and then send that value
 * to be saved in Auth0
 * @param {id} string The id of a user
 * @returns {json|Array} Returns a json representation of the user, with the new
 * token included, or an Array with error information in if it failed.
 * @access private
 */
const setApiToken = async id => {
  const apitoken = crypto
    .createHash('md5')
    .update(`${Math.random()}`)
    .digest('hex')
  await setKeyValue(id, 'apitoken', apitoken)
}

/**
 * This allows us to set roles on a user, normally the roles follow a format such as
 * {
 *    isAdmin: false,
 *    isStaff: false,
 *    isVendor: false,
 *    isDeveloper: true
 * }
 * @param {string} id The id of a user
 * @param {json} roles A json object holding the new roles for a user we want to set
 * @returns {json|Array} Returns a json representation of the user, with the new
 * token included, or an Array with error information in if it failed.
 * @access private
 */
const setRoles = async (id, roles) => {
  const user = await setKeyValue(id, 'roles', roles)
  return user
}

const setLang = async (id, lang) => {
  const user = await setKeyValue(id, 'lang', lang)
  return user
}

const setKeyValue = async (id, key, value) => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `users_${process.env.KEY}`
  const type = 'user'

  //  Get the user
  let user = null
  try {
    user = await esclient.get({
      index,
      type,
      id
    })
  } catch (er) {
    user = null
  }

  //  If we have a user, return them
  if (user === null) return user

  user = user._source
  user[key] = value
  user.lastUpdated = new Date()

  await esclient.update({
    index,
    type,
    id,
    body: {
      doc: user,
      doc_as_upsert: true
    }
  })

  return user
}
/**
 * This method gets a user, in theory this is a wrapper for fetching the user data
 * from somewhere else. But it also does a couple more useful things, such as
 * determining if this is the _Very first_ user, in which case we set their roles
 * slightly differently, in that they are automatically an Admin user. This will
 * also assign a developer token to them if they don't have one.
 * @param {string} id The id of the user we want to get information from Auth0 about.
 * @returns {json} A json representation of a user
 * @access private
 */
const getUser = async id => {
  const config = new Config()
  let user = await getUserSync(id)

  //  Check to see if we have set the admin user yet
  //  if not then we need to do that now
  if (config.get('adminSet') === null || config.get('adminSet') === false) {
    const roles = {
      isAdmin: true,
      isStaff: true,
      isVendor: true,
      isDeveloper: true
    }
    user = await setRoles(id, roles)
    config.set('adminSet', true)
  }

  //  Check to see if any roles have been set on the user, if not then
  //  apply the default roles
  if (!user.roles) {
    const roles = {
      isAdmin: false,
      isStaff: false,
      isVendor: false,
      isDeveloper: true
    }
    user = await setRoles(id, roles)
  }

  //  Make sure we have a developer API token
  if (!user.apitoken) {
    user = await setApiToken(id)
  }
  return user
}

/** Class representing a single user. */
class User {
  /**
   * Because we need to pass back a user object right away we return an
   * empty user. You then need to call the async method 'get' to fetch
   * the details we want. The User object doesn't contain any values of the user
   * (yet) only methods that return json representations of the user.
   */
  constructor () {}

  /**
   * When we use auth0 to log a user in we get a JSON object back with _some_ of the user's
   * details in, unfortunately not _all_ the details we need. We use this method to pass in
   * either a user's id, or the Auth0 JSON object we got back from logging in, and ask the
   * Auht0 API for the details we actually want.
   * @param {string|json} auth0id The id (string) of a user, or a whole auth0 json
   * representation of a user.
   * @returns {json} A better json representation of the user with the `user_metadata` field
   * that we want, that includes the user's roles and developer api token
   */
  async get (auth0id) {
    //  Grab the id from the user object or a string
    let id = null
    if (typeof auth0id === 'object') {
      id = auth0id.id
    } else {
      id = auth0id
    }

    //  Go and get the user from Auth0
    const user = await getUser(id)
    return user
  }

  /**
   *
   * @param {string} id The id of a user
   * @param {json} roles The roles we wish to set on a user as a json object
   * @returns {json} A json representation of a user
   */
  async setRoles (id, roles) {
    const user = await setRoles(id, roles)
    return user
  }

  async setLang (id, lang) {
    const user = await setLang(id, lang)
    return user
  }
}
module.exports = User
