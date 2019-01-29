/**
 * This module allows us to grab an API token from auth0
 * @module modules/auth0
 */
const fs = require('fs')
const path = require('path')
const request = require('request-promise')
const Config = require('../../classes/config')

const rootDir = path.join(__dirname, '../../..')

/**
 * Gets us the token we need to call further API methods on the Auth0 endpoint
 * @returns {string|Array} The bearer token used in future API calls, or an Array
 * an error was generated.
 */
const getAuth0Token = async () => {
  //  First we check to see if we already have a token and if
  //  it's still valid. The expires was a time set into the
  //  future based on what Auth0 API gave us back. As long as
  //  the current time is less than that we are good.
  if ('auth0' in global && 'token' in global.auth0) {
    if (new Date().getTime() < global.auth0.expires) {
      return global.auth0.token
    }
  }

  const config = new Config()
  const auth0 = config.get('auth0')
  if (auth0 === null) {
    return [
      'No auth0 set in config'
    ]
  }

  var options = {
    method: 'POST',
    url: `https://${auth0.AUTH0_DOMAIN}/oauth/token`,
    headers: {
      'content-type': 'application/json'
    },
    body: {
      grant_type: 'client_credentials',
      client_id: auth0.AUTH0_CLIENT_ID,
      client_secret: auth0.AUTH0_SECRET,
      audience: `https://${auth0.AUTH0_DOMAIN}/api/v2/`
    },
    json: true
  }

  const auth0Token = await request(options)
    .then(response => {
      return response
    })
    .catch(error => {
      return [error]
    })

  //  Set the token and the time it expires (to be some point in the future)
  //  We are given back a time in seconds that the token is good for, normally
  //  86,400 which is 24 hours (24 * 60 * 60). As getTime() gives us ms, we
  //  *1000 to get the time at which the token will expire and we'll need a
  //  new one.
  const expires = new Date().getTime() + (auth0Token.expires_in * 1000)
  global.auth0 = {
    token: auth0Token.access_token,
    expires: expires
  }
  return global.auth0.token
}
exports.getAuth0Token = getAuth0Token

const getAllUserTokens = async (page) => {
  const config = new Config()
  const auth0info = config.get('auth0')
  if (auth0info === null) {
    return
  }

  const auth0Token = await getAuth0Token()
  const qs = {
    fields: 'user_id,user_metadata',
    per_page: 100,
    page: page,
    search_engine: 'v2'
  }
  const headers = {
    'content-type': 'application/json',
    Authorization: `bearer ${auth0Token}`
  }
  const users = await request({
    url: `https://${auth0info.AUTH0_DOMAIN}/api/v2/users`,
    method: 'GET',
    headers,
    qs: qs
  })
    .then(response => {
      const users = JSON.parse(response)
      return users.map((user) => {
        let id = null
        if ('user_id' in user) id = user.user_id
        let token = null
        let isVendor = false
        let isStaff = false
        let isAdmin = false
        if (user && user.user_metadata && user.user_metadata.apitoken) token = user.user_metadata.apitoken
        if (user && user.user_metadata && user.user_metadata.roles && user.user_metadata.roles.isVendor) isVendor = user.user_metadata.roles.isVendor
        if (user && user.user_metadata && user.user_metadata.roles && user.user_metadata.roles.isStaff) isStaff = user.user_metadata.roles.isStaff
        if (user && user.user_metadata && user.user_metadata.roles && user.user_metadata.roles.isAdmin) isAdmin = user.user_metadata.roles.isAdmin
        const rtnObj = {
            id,
            token,
            isVendor,
            isStaff,
            isAdmin
          }
        return rtnObj
      })
        .filter((user) => {
          return (user.token !== '' && user.token !== null && user.token !== undefined)
        })
    })

  //  Read in the tokens file, or create a new object if we don't have one
  const filename = path.join(rootDir, 'data', 'tokens.json')
  let tokensJSON = {
    valid: {},
    rejected: {}
  }
  if (fs.existsSync(filename)) {
    const tokensRaw = fs.readFileSync(filename, 'utf-8')
    tokensJSON = JSON.parse(tokensRaw)
  }

  //  Go through the tokensJSON adding or updating the tokens
  users.forEach((user) => {
    if (!(user.token in tokensJSON.valid)) {
      tokensJSON.valid[user.token] = {
        id: user.id,
        created: new Date().getTime()
      }
    }
    tokensJSON.valid[user.token].updated = new Date().getTime()
    tokensJSON.valid[user.token].isVendor = user.isVendor
    tokensJSON.valid[user.token].isStaff = user.isStaff
    tokensJSON.valid[user.token].isAdmin = user.isAdmin
  })

  const tokensJSONPretty = JSON.stringify(tokensJSON, null, 4)
  fs.writeFileSync(filename, tokensJSONPretty, 'utf-8')

  if (users.length > 0) {
    getAllUserTokens(page + 1)
  }
}

//  This kicks off fetching the tokens from auth0
exports.startGettingAllUserTokens = () => {
  //  Remove the old interval timer
  clearInterval(global.getUserTokensTmr)
  global.getUserTokensTmr = setInterval(() => {
    getAllUserTokens(0)
  }, 1000 * 60 * 5)
  getAllUserTokens(0)
}
