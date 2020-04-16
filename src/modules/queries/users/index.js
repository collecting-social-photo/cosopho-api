const elasticsearch = require('elasticsearch')
const common = require('../common.js')
/*
 *
 * Make sure the actual index exists
 *
 */
const creatIndex = async () => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `users_${process.env.KEY}`
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
 * This gets all the instances
 *
 */
const getUsers = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `users_${process.env.KEY}`

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
    return null
  }

  let users = results.hits.hits.map((user) => user._source)
  users = users.map((user) => {
    const newRoles = {
      isAdmin: false,
      isDeveloper: false
    }
    if (user.roles && user.roles.isAdmin) newRoles.isAdmin = user.roles.isAdmin
    if (user.roles && user.roles.isDeveloper) newRoles.isDeveloper = user.roles.isDeveloper
    user.roles = newRoles
    return user
  })

  // Only get the instances if we are on the first level
  if (levelDown <= 1) {
    //  Now we need to grab the instances so we can fill them in
    let instancesId = []
    users.forEach((user) => {
      if (user.instances) {
        user.instances.forEach((instance) => {
          if (!instancesId.includes(instance)) instancesId.push(instance)
        })
      }
    })

    //  Now if we have some instances we need to go and get them
    if (instancesId.length > 0) {
      //  Grab all the instances we need
      const instances = await queryInstances.getInstances({
        ids: instancesId
      }, context, levelDown + 1, initialCall)
      //  Build up a map so we can quickly look them up
      const instancesMap = {}
      instances.forEach((instance) => {
        instancesMap[instance.id] = instance
      })
      //  Now loop through the instances putting the data back in
      users = users.map((user) => {
        if (user.instances) {
          user.instances = user.instances.map((instance) => {
            if (instancesMap[instance]) return instancesMap[instance]
            return false
          }).filter(Boolean)
        }
        return user
      })
    }
  } else {
    //  Clear out the instances
    users = users.map((user) => {
      delete user.instances
      return user
    })
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
  if (users.length > 0) {
    users[0]._sys = sys
  }

  return users
}
exports.getUsers = getUsers

/*
 *
 * This gets a single instance
 *
 */
const getUser = async (args, context, levelDown = 2, initialCall = false) => {
  const user = await getUsers({
    ids: [args.id]
  }, context, levelDown, initialCall)
  if (user && user.length === 1) return user[0]
  return []
}
exports.getUser = getUser

/*
 *
 * This updates a single user
 *
 */
const updateUser = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  if (!args.id) return null
  if (!args.instances && !('isAdmin' in args) && !('isDeveloper' in args)) return null

  //  Make sure the index exists
  creatIndex()
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `users_${process.env.KEY}`
  const type = 'user'

  //  Sanity check the instances are valid
  const instances = await queryInstances.getInstances({
    ids: args.instances
  }, context)

  //  Create a new array of valid instances
  let newInstanceIds = instances.map((instance) => instance.id)

  //  Update the user
  const newRoles = {}
  if ('isAdmin' in args) newRoles.isAdmin = args.isAdmin
  if ('isDeveloper' in args) newRoles.isDeveloper = args.isDeveloper

  const updatedUser = {
    id: args.id,
    instances: newInstanceIds,
    roles: newRoles
  }

  await esclient.update({
    index,
    type,
    id: args.id,
    refresh: true,
    body: {
      doc: updatedUser,
      doc_as_upsert: true
    }
  })

  //  Return back the values
  const newUpdatedUser = await getUser({
    id: args.id
  }, context)
  return newUpdatedUser
}
exports.updateUser = updateUser

const queryInstances = require('../instances')
