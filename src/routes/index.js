const fs = require('fs')
const path = require('path')
const langDir = path.join(__dirname, '../../lang/own')
const express = require('express')
const passport = require('passport')
const router = express.Router()
const User = require('../classes/user')
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()
const Config = require('../classes/config')
const expressGraphql = require('express-graphql')
const bodyParser = require('body-parser')
const cors = require('cors')
const {
  buildSchema
} = require('graphql')
const schemaPublic = require('../modules/schema/public.js')
const schemaAdmin = require('../modules/schema/admin.js')
const queries = require('../modules/queries')

const getDefaultTemplateData = require('../helpers').getDefaultTemplateData

const elasticsearch = require('elasticsearch')

// Note: '*' will whitelist all domains.
// If we remove the auth, we may want to lock this down.
const coorsAllowedOrigin = '*'

// bypass auth for preflight requests
// we need this because the apolloClient uses fetch which triggers a preflight request
router.options('/*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', coorsAllowedOrigin)
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
  res.sendStatus(200)
})

// enable cors. "credentials: true" is needed to pass auth through cors.
router.use(cors({
  origin: coorsAllowedOrigin
}))

//  Redirect to https, make sure...
//  app.enable('trust proxy')
//  is set in server.js
router.use(function (req, res, next) {
  let remoteAccess = true

  //  Because of the way we are hosting we need to do an extra weird check
  //  about coming in from outside or via a ip:port before we tie up the whole
  //  lot in a knot.
  const hostSplit = req.headers['host'].split(':')
  if (hostSplit.length > 1) {
    if (hostSplit[1] === process.env.PORT) {
      remoteAccess = false
    }
  }
  if (!(req.secure) && process.env.REDIRECT_HTTPS === 'true' && remoteAccess === true) {
    var secureUrl = 'https://' + req.headers['host'] + req.url
    res.writeHead(301, {
      Location: secureUrl
    })
    res.end()
  } else {
    next()
  }
})

// ############################################################################
//
/*
 * Always create a templateValues object that gets passed to the
 * templates. The config object from global (this allows use to
 * manipulate it here if we need to) and the user if one exists
 */
//
// ############################################################################
router.use(function (req, res, next) {
  req.templateValues = getDefaultTemplateData()
  const configObj = new Config()
  req.config = configObj
  req.templateValues.config = req.config

  const defaultLang = 'en'
  let selectedLang = 'en'

  if (req.session && req.session.user === undefined) {
    req.user = null
  } else {
    req.user = req.session.user
  }

  //  Read in the language files and overlay the selected langage on the
  //  default one
  //  TODO: Cache all this for about 5 minutes
  //  TODO: break the cache if we update strings
  const langs = fs.readdirSync(langDir).filter((lang) => {
    const langSplit = lang.split('.')
    if (langSplit.length !== 3) return false
    if (langSplit[0] !== 'strings' || langSplit[2] !== 'json') return false
    return true
  }).map((lang) => {
    const langSplit = lang.split('.')
    return langSplit[1]
  })
  req.templateValues.langs = langs

  //  If we are *not* on a login, logout or callback url then
  //  we need to check for langage stuff
  const nonLangUrls = ['login', 'logout', 'callback', 'images', 'api', 'playground', 'graphql']
  const urlClean = req.url.split('?')[0]
  const urlSplit = urlClean.split('/')
  if (urlSplit[0] === '') urlSplit.shift()
  if (!nonLangUrls.includes(urlSplit[0]) && urlSplit[urlSplit.length - 1] !== 'playground') {
    //  Check to see if the first entry isn't a language,
    //  if it's not pop the selectedLang into the url
    //  and try again
    if (!(langs.includes(urlSplit[0]))) {
      if (req.user && req.user.lang) {
        return res.redirect(`/${req.user.lang}${req.url}`)
      }
      return res.redirect(`/${defaultLang}${req.url}`)
    } else {
      selectedLang = urlSplit[0]
    }

    //  Now we can work out the *rest* of the URL _without_ the
    //  langage part
    urlSplit.shift()
    req.templateValues.remainingUrl = `/${urlSplit.join('/')}`
  }
  if (req.user !== null) req.user.lang = selectedLang
  req.templateValues.user = req.user

  const i18n = JSON.parse(fs.readFileSync(path.join(langDir, `strings.${defaultLang}.json`)))
  if (selectedLang !== defaultLang) {
    const selectedi18n = JSON.parse(fs.readFileSync(path.join(langDir, `strings.${selectedLang}.json`)))
    Object.entries(selectedi18n).forEach((branch) => {
      const key = branch[0]
      const values = branch[1]
      if (!(key in i18n)) i18n[key] = {}
      Object.assign(i18n[key], values)
    })
  }
  req.templateValues.selectedLang = selectedLang
  req.templateValues.dbLang = 'en'
  req.templateValues.i18n = i18n

  //  If there is no Auth0 setting in config then we _must_
  //  check to see if we are setting Auth0 settings and if
  //  not, redirect to the Auth0 form.
  let auth0 = configObj.get('auth0')
  const handshake = configObj.get('handshake')
  if (auth0 === null || !auth0.AUTH0_CALLBACK_URL_API) {
    // Check to see if values are being posted to us
    if (req.method === 'POST') {
      if (
        'action' in req.fields &&
        'AUTH0_DOMAIN' in req.fields &&
        'AUTH0_CLIENT_ID' in req.fields &&
        'AUTH0_SECRET' in req.fields &&
        'AUTH0_CALLBACK_URL' in req.fields &&
        'handshake' in req.fields &&
        req.fields.action === 'save' &&
        req.fields.handshake === handshake
      ) {
        const auth0 = {
          AUTH0_DOMAIN: req.fields.AUTH0_DOMAIN,
          AUTH0_CLIENT_ID: req.fields.AUTH0_CLIENT_ID,
          AUTH0_SECRET: req.fields.AUTH0_SECRET,
          AUTH0_CALLBACK_URL_API: req.fields.AUTH0_CALLBACK_URL
        }
        configObj.set('auth0', auth0)
        setTimeout(() => {
          global.doRestart = true
          process.exit()
        }, 500)
        return res.redirect('/wait')
      }
    }

    //  If not, check to see if we've been passed a handshake
    if ('handshake' in req.query) {
      req.templateValues.handshake = req.query.handshake
    }
    if (handshake) {
      req.templateValues.handshake = handshake
    }

    //  Hand over the auth details
    if (configObj.get('auth0')) {
      req.templateValues.auth0 = configObj.get('auth0')
    }

    //  Set up a nice handy default callback if we are developing
    if (process.env.NODE_ENV === 'development') {
      req.templateValues.callbackUrl = `http://${process.env.HOST}:${process.env.PORT}/callback`
    }
    req.templateValues.NODE_ENV = process.env.NODE_ENV
    return res.render('config/auth0', req.templateValues)
  }

  //  Send over the graphQL host
  if (auth0.AUTH0_CALLBACK_URL_API) req.templateValues.graphQLHost = auth0.AUTH0_CALLBACK_URL_API.replace('/callback', '')

  next()
})

// ############################################################################
//
//  Log in and log out tools
//
// ############################################################################

const configObj = new Config()
if (configObj.get('auth0') !== null) {
  const auth0Obj = configObj.get('auth0')
  router.get(
    '/login',
    passport.authenticate('auth0', {
      clientID: auth0Obj.AUTH0_CLIENT_ID,
      domain: auth0Obj.AUTH0_DOMAIN,
      redirectUri: auth0Obj.AUTH0_CALLBACK_URL_API,
      audience: `https://${auth0Obj.AUTH0_DOMAIN}/userinfo`,
      responseType: 'code',
      scope: 'openid profile'
    }),
    function (req, res) {
      res.redirect('/')
    }
  )

  // Perform session logout and redirect to homepage
  router.get('/logout', (req, res) => {
    req.logout()
    req.user = null
    req.session.destroy(function (err) {
      req.user = null
      req.session = null
      res.clearCookie('connect.sid')
      res.redirect(`https://${auth0Obj.AUTH0_DOMAIN}/v2/logout?returnTo=${auth0Obj.AUTH0_CALLBACK_URL_API.replace('/callback', '')}`)
      if (err) {
        res.redirect(`https://${auth0Obj.AUTH0_DOMAIN}/v2/logout?returnTo=${auth0Obj.AUTH0_CALLBACK_URL_API.replace('/callback', '')}`)
      }
    })
  })

  // Perform the final stage of authentication and redirect to '/user'
  router.get(
    '/callback',
    passport.authenticate('auth0', {
      failureRedirect: '/'
    }),
    async function (req, res) {
      // Update the user with extra information
      req.session.user = await new User().get(req.user)
      return setTimeout(() => {
        res.redirect(307, req.session.returnTo || '/')
      }, 1000)
    }
  )
}

// ############################################################################
//
//  All the graphQL stuff
//
// ############################################################################

//  This is the resolver
const root = {
  hello: () => {
    return `world`
  },
  instance: (args, context) => {
    /* eslint-disable import/no-unresolved */
    return queries.instances.getInstance(args, context, undefined, true)
  },
  instances: (args, context) => {
    /* eslint-disable import/no-unresolved */
    return queries.instances.getInstances(args, context, undefined, true)
  },
  createInstance: (args, context) => {
    /* eslint-disable import/no-unresolved */
    return queries.instances.createInstance(args, context)
  },
  updateInstance: (args, context) => {
    /* eslint-disable import/no-unresolved */
    return queries.instances.updateInstance(args, context)
  },
  deleteInstance: (args, context) => {
    /* eslint-disable import/no-unresolved */
    return queries.instances.deleteInstance(args, context)
  }
}

//  This figures out a bunch of stuff around which queries we can run
//  and the user context
const getGrpObj = (isPlayground, userRoles, token) => {
  const grpObj = {
    rootValue: root,
    context: {
      userRoles,
      token
    },
    userRoles,
    graphiql: isPlayground
  }

  //  We load up a different schema for the end user based on their role
  //  If they are an admin user, then they get the admin scheme, if they
  //  are a normal user then they get the public schema. This way we
  //  don't leak private/admin data
  if (userRoles && userRoles.isAdmin && userRoles.isAdmin === true) {
    grpObj.schema = buildSchema(schemaAdmin.schema)
  } else {
    grpObj.schema = buildSchema(schemaPublic.schema)
  }

  return grpObj
}

//  This gets the user with the current token from either global cache
//  or from the database.
const getUser = async (token) => {
  //  Now check in the globals to see if we have it
  if (global.tokens && token in global.tokens) {
    //  If the check is still in the expires limit the just use it
    if (new Date().getTime() < global.tokens[token].expires) {
      return global.tokens[token]
    }
  }

  //  If we didn't have it, then we need to look up the user in the database
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `users_${process.env.KEY}`
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) return {}
  let records = null
  try {
    records = await esclient.search({
      index,
      body: {
        query: {
          term: {
            apitoken: token
          }
        }
      }
    })
  } catch (er) {
    console.log(er)
  }

  //  If we got a record then grab the user, set the expiry times
  //  and pop it into the global cache
  if (records && records.hits && records.hits.hits && records.hits.hits.length === 1) {
    const user = records.hits.hits[0]._source
    user.expires = new Date().getTime() + (1000 * 60 * 60)
    if (!global.tokens) global.tokens = {}
    global.tokens[user.apitoken] = user
    return user
  }

  //  If we got here then we didn't find anyone return null
  return {}
}

//  If we are doing a direct query we need to grab the token from
//  the headers, then call the function
router.use('/graphql', bodyParser.json(), expressGraphql(async (req) => {
  let token = null
  if (req && req.headers && req.headers.authorization) {
    const tokenSplit = req.headers.authorization.split(' ')
    if (tokenSplit[1]) token = tokenSplit[1]
  }
  //  grab the user from the token
  const user = await getUser(token)
  //  call the query method passing in the playground toggle, user roles and
  //  token for tracking
  return (getGrpObj(false, user.roles, token))
}))

//  If we are coming from the playground, then we pull the token from the URL
//  then call the function
router.use('/:token/playground', bodyParser.json(), expressGraphql(async (req) => {
  //  grab the user from the token
  const user = await getUser(req.params.token)
  //  call the query method passing in the playground toggle, user roles and
  //  token for tracking
  return (getGrpObj(true, user.roles, req.params.token))
}))

// ############################################################################
//
//  Finally the routes
//
// ############################################################################
const admin = require('./admin')
const config = require('./config')
const main = require('./main')

router.get('/:lang', main.index)
router.post('/:lang', main.index)
router.get('/:lang/wait', main.wait)

router.get('/:lang/admin', admin.index)
router.post('/:lang/admin', admin.index)

router.get('/:lang/config', ensureLoggedIn, config.index)
router.post('/:lang/config', ensureLoggedIn, config.index)

module.exports = router
