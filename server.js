/*
 * Welcome to the server.js file, this file. This file is written in
 * ES6 and is expected to run in node.
 *
 * There is a lot of scripting at the top of this file, most of which
 * is to make sure the user has completed all the steps needed to
 * actually run the dashboard properly. This will be checking for
 * things like `yarn install` and the usual stuff having been run.
 *
 * You'll see!
 */
const fs = require('fs')
const path = require('path')

const rootDir = __dirname

//  Before we do anything else we need to check that the checking checks
console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
console.log('Making sure we are up to date, please wait...')
const spawnSync = require('child_process').spawnSync
const yarn = spawnSync('yarn', ['install'])
console.log(yarn.stdout.toString())

const colours = require('colors')

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta'
})

//  Let us know where the app is being run from
console.log(`server.js is being run from this directory: ${process.cwd()}`.help)
console.log(`server.js exists in this directory: ${rootDir}`.help)

/*
 * Check to see if we have been passed in command line parameters to define
 * the port, host, environment and if we want to skip any build steps
 */
const argOptionDefinitions = [{
  name: 'key',
  alias: 'k',
  default: true,
  type: String
},
{
  name: 'port',
  alias: 'p',
  type: Number
},
{
  name: 'host',
  alias: 't',
  type: String
},
{
  name: 'env',
  alias: 'e',
  type: String
},
{
  name: 'elastic',
  alias: 'l',
  type: String
},
{
  name: 'skipBuild',
  alias: 's',
  type: Boolean
},
{
  name: 'buildOnly',
  alias: 'b',
  type: Boolean
},
{
  name: 'skipOpen',
  alias: 'o',
  type: Boolean
},
{
  name: 'redirecthttps',
  alias: 'r',
  type: Boolean
},
{
  name: 'help',
  alias: 'h',
  type: String
}
]

/*
 * This bit makes sure we have the minimum needed to move onto the next stage
 * and if we should show the help text or not
 */
const commandLineArgs = require('command-line-args')
let showHelp = false
let argOptions = null
try {
  argOptions = commandLineArgs(argOptionDefinitions)
} catch (er) {
  showHelp = true
}

if (!argOptions) {
  showHelp = true
} else {
  if (argOptions.help) showHelp = true
}

/*
 * We need to make sure we have been passed a stub, this is the whole key on which we
 * base everything else
 */
if (argOptions && !argOptions.key) {
  console.log(
    `\n\nYou must pass the 'key' parameter 'yarn start --key xxxxx' see the README.md for more details\n\n`
    .error
  )
  showHelp = true
}

/*
 * How the help if we need to
 */
if (showHelp) {
  console.log(`
Usage: yarn start [options]
       yarn start --key xxxxx --port 4000 --host localhost --env development --elastic http://localhost:9200

Options:
 -k, --key              The 'key' used to reference tables in the database, must be unique per app
 -p, --port [4000]      The port to run on (default 4000)
 -t, --host [localhost] The host to run on (default localhost)
 -e, --env [development|staging|production]
                        The environment (default development)
 -l, --elastic [http://localhost:9200]
                        Where we can find the elasticSearch host, (default localhost:9200)
 -r, --redirecthttps    Tells us to redirect to https (default false for development)

 -s, --skipBuild        Skips the build process
 -b, --buildOnly        Runs the build process then exits
 -o, --skipOpen         Stops the browser from opening on start, when running locally

 -h, --help             Displays this help text
  `)
  process.exit()
}

process.env.PORT = 4000
process.env.HOST = 'localhost'
process.env.NODE_ENV = 'development'
process.env.ELASTICSEARCH = 'http://localhost:9200'
process.env.REDIRECT_HTTPS = false

if (argOptions.port) process.env.PORT = argOptions.port
if (argOptions.host) process.env.HOST = argOptions.host
if (argOptions.env) process.env.NODE_ENV = argOptions.env
if (argOptions.elastic) process.env.ELASTICSEARCH = argOptions.elastic
if (argOptions.redirecthttps) {
  process.env.REDIRECT_HTTPS = argOptions.redirecthttps
}
process.env.KEY = argOptions.key

//  Here we are managing if we are going to skip the build step
//  we'll want to do that if we are forcing a restart of the app.
//  We force a restart if we detect files changing, but only on
//  dev. We will need to set a flag to tell the difference between
//  a forced exit we want and a crash
let skipBuild = false
global.doRestart = false
if ('skipBuild' in argOptions && argOptions.skipBuild === true) {
  skipBuild = true
}

let buildOnly = false
if ('buildOnly' in argOptions && argOptions.buildOnly === true) {
  buildOnly = true
  skipBuild = false
}

let skipOpen = false
if ('skipOpen' in argOptions && argOptions.skipOpen === true) {
  skipOpen = true
}

// ########################################################################
/*
 * STEP TWO
 *
 * We need to show the user a webpage, for this to work we need to make
 * sure the code is build, the CSS is compiled and the templates copied
 * over.
 *
 * We will build, compile and copy each time the service starts
 *
 */

if (skipBuild === false) {
  // Copy template files
  spawnSync('npx', [
    'babel',
    'src/templates',
    '--out-dir',
    'app/templates',
    '--copy-files'
  ])

  // Copy template files
  spawnSync('npx', [
    'babel',
    'src/public/images',
    '--out-dir',
    'app/public/images',
    '--copy-files'
  ])

  // Copy naked css files
  spawnSync('npx', [
    'babel',
    'src/public/css',
    '--out-dir',
    'app/public/css',
    '--copy-files'
  ])

  // Copy naked webfonts files
  spawnSync('npx', [
    'babel',
    'src/public/webfonts',
    '--out-dir',
    'app/public/webfonts',
    '--copy-files'
  ])

  //  Compile node files
  spawnSync('npx', ['babel', 'src', '--out-dir', 'app'])

  //  Copy over all the png, xml and ico files for the icons that sit in
  //  the public dir
  const moveFiles = fs
    .readdirSync(path.join(rootDir, '/src/public'))
    .filter(file => {
      return file.split('.').length > 1
    })
    .filter(file => {
      let extension = file.split('.')
      extension = extension.pop()
      return ['png', 'xml', 'ico', 'json'].includes(extension)
    })
  moveFiles.forEach(file => {
    const source = path.join(rootDir, '/src/public', file)
    const target = path.join(rootDir, '/app/public', file)
    fs.copyFileSync(source, target)
  })
}

//  Make sure the data directory exists
if (!fs.existsSync(path.join(rootDir, 'data'))) {
  fs.mkdirSync(path.join(rootDir, 'data'))
}

// ########################################################################
/*
 * STEP THREE
 *
 * Compile the CSS
 *
 */

if (skipBuild === false) {
  if (!fs.existsSync(path.join(rootDir, '/app/public'))) {
    fs.mkdirSync(path.join(rootDir, '/app/public'))
  }
  if (!fs.existsSync(path.join(rootDir, '/app/public/css'))) {
    fs.mkdirSync(path.join(rootDir, '/app/public/css'))
  }
  const sass = require('node-sass')
  let sassResult = ''
  if (process.env.NODE_ENV === 'development') {
    sassResult = sass.renderSync({
      file: path.join(rootDir, '/src/sass/main.scss'),
      outputStyle: 'compact',
      outFile: path.join(rootDir, '/app/public/css/main.css'),
      sourceMap: true
    })
    fs.writeFileSync(
      path.join(rootDir, '/app/public/css/main.css.map'),
      sassResult.map
    )
  } else {
    sassResult = sass.renderSync({
      file: path.join(rootDir, '/src/sass/main.scss'),
      outputStyle: 'compressed'
    })
  }
  fs.writeFileSync(
    path.join(rootDir, '/app/public/css/main.css'),
    sassResult.css
  )
}

// ########################################################################
/*
 * STEP FOUR (optional)
 *
 * If we are in developement mode we want to watch for file changes that
 * mean we need to either recompile source code which requires a restart
 * of the server. Or recompile CSS or copy over new html/public files
 * both of which don't require a server restart.
 *
 * Bonus, we want to try and _only_ recompile/copy over changed or new
 * files
 *
 */
if (process.env.NODE_ENV === 'development') {
  const devtools = require('./app/modules/devtools')
  devtools.watcher()
}

// ########################################################################
/*
 * STEP FIVE
 *
 * Now we have enough for our server to actually run on a port
 *
 * Specifically in this case the Auth0 settings as we are now running
 * the server on we assume either localhost _or_ a public website.
 * Because Auth0 should be protecting us from all the admin stuff and
 * initially that isn't in place we need to somehow project the Auth0
 * form. We'll do this by creating a local token which has to be added
 * to be able to update the form. The user installing this app will know
 * the token becasue we'll tell them. But a remote user won't have that
 * information.
 * */

const elasticsearch = require('elasticsearch')

async function getConfig () {
  //  This is putting all the config into the global config object
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `config_${process.env.KEY}`
  const type = 'config'

  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }
  let record = null
  try {
    record = await esclient.get({
      index,
      type,
      id: 0
    })
  } catch (er) {
    global.config = {}
  }

  if (record && record.found && record._source) {
    global.config = record._source
  }
}

const p = new Promise(function (resolve, reject) {
  resolve(getConfig())
})
p.then(res => {
  const express = require('express')
  const exphbs = require('express-handlebars')
  const bodyParser = require('body-parser')
  const cookieParser = require('cookie-parser')
  const session = require('express-session')
  const http = require('http')
  const helpers = require('./app/helpers')
  const Auth0Strategy = require('passport-auth0')
  const Config = require('./app/classes/config')
  const sessionstore = require('sessionstore')
  const passport = require('passport')

  const config = new Config()

  const app = express()
  const hbs = exphbs.create({
    extname: '.html',
    helpers,
    partialsDir: `${__dirname}/app/templates/includes/`
  })

  app.engine('html', hbs.engine)
  app.set('view engine', 'html')
  app.set('views', `${__dirname}/app/templates`)
  app.use(
    express.static(`${__dirname}/app/public`, {
      'no-cache': true
    })
  )
  app.use(bodyParser.json())
  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  )
  app.use(cookieParser())

  app.use(
    session({
      secret: process.env.KEY,
      resave: false,
      saveUninitialized: false,
      store: sessionstore.createSessionStore({
        type: 'elasticsearch',
        index: `session_${process.env.KEY}`,
        host: process.env.ELASTICSEARCH,
        pingInterval: 11000,
        timeout: 10000
      })
    })
  )

  const auth0 = config.get('auth0')
  if (auth0 !== null && auth0.AUTH0_CALLBACK_URL_API) {
    // Configure Passport to use Auth0
    const strategy = new Auth0Strategy({
      domain: auth0.AUTH0_DOMAIN,
      clientID: auth0.AUTH0_CLIENT_ID,
      clientSecret: auth0.AUTH0_SECRET,
      callbackURL: auth0.AUTH0_CALLBACK_URL_API
    },
      (accessToken, refreshToken, extraParams, profile, done) => {
        return done(null, profile)
      }
    )

    passport.use(strategy)

    // This can be used to keep a smaller payload
    passport.serializeUser(function (user, done) {
      done(null, user)
    })

    passport.deserializeUser(function (user, done) {
      done(null, user)
    })

    app.use(passport.initialize())
    app.use(passport.session())
  }

  app.enable('trust proxy')
  const routes = require('./app/routes')
  app.use('/', routes)

  app.use((request, response) => {
    response.status(404).render('static/404')
  })

  if (process.env.NODE_ENV !== 'development') {
    app.use((err, req, res) => {
      console.error(err.stack)
      res.status(500).send('Something broke!')
    })
  }

  //  Check to see if the old pid is active, if so we kill it
  const pidFile = path.join(rootDir, '.pid')
  if (fs.existsSync(pidFile)) {
    const pid = fs.readFileSync(pidFile, 'utf-8')
    const isRunning = require('is-running')(pid)
    if (isRunning) {
      process.kill(pid)
    }
  }

  process.on('uncaughtException', err => {
    if (err.errno === 'EADDRINUSE') {
      console.log('')
      console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
      console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
      console.log('')
      console.log("                 DON'T PANIC".bold)
      console.log('')
      console.log('The server did not shut down properly last time'.warn)
      console.log('  please try starting it up again, everything'.warn)
      console.log('      sould be cleaned up now, thank you.'.warn)
      console.log('')
      console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
      console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
      console.log('')
    }
    process.exit()
  })

  if (buildOnly === false) {
    http.createServer(app).listen(process.env.PORT)
  }

  //  If we are on the dev server and we aren't restarting with a
  //  build skip, then start up a browser to get the user going.
  //  If we don't have any Auth0 stuff in place yet we also need
  //  to pass over the handshake value so we can do a quick
  //  basic authentication.
  if (process.env.NODE_ENV === 'development') {
    if (skipBuild === false && skipOpen === false) {
      const opn = require('opn')
      // If there is no auth0 entry in the config file then we need
      // to pass over the handshake value
      if (!global.config.auth0) {
        opn(
          `http://${process.env.HOST}:${
            process.env.PORT
          }?handshake=${config.get('handshake')}`
        )
      } else {
        opn(`http://${process.env.HOST}:${process.env.PORT}`)
      }
    }
    console.log(`>> Connect to: ${process.env.HOST}:${process.env.PORT}`.alert)
  } else {
    console.log(
      `
  >> Welcome to the API server, please visit the site however you have your host and ports setup to see it from the outside world`
      .info
    )
    if (!global.config.auth0) {
      console.log(
        `>> You will be asked for a 'handshake' code while setting up the next step, please use the following value
        `.info
      )
      console.log(config.get('handshake').bold.warn)
      console.log('')
      console.log(
        '>> You can also find the value in the '.info +
        'config.json'.bold.data +
        ' file'.info
      )
      console.log('')
    }
  }

  if (buildOnly === false) {
    console.log('')
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
    console.log('')
    console.log('                 SERVER STARTED'.bold)
    console.log('')
    console.log('           Everything is up and running'.info)
    console.log('')
    console.log(`    The process id for the server is ${process.pid}, use`.info)
    console.log(`                 'kill -9 ${process.pid}'`.bold)
    console.log('         should you wish to force stop it'.info)
    console.log('')
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.rainbow)
    console.log('')

    fs.writeFileSync(pidFile, process.pid, 'utf-8')
  } else {
    console.log('All built')
    process.exit()
  }
})
