// const elasticsearch = require('elasticsearch')
// const utils = require('../../../modules/utils')
// const crypto = require('crypto')
// const delay = require('delay')

/*
 *
 * Make sure the actual index exists
 *
 */
/*
const creatIndex = async () => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photo_${process.env.KEY}`
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }
}
*/

/*
 *
 * This gets all the photos
 *
 */
const getPhotos = async (args, context, levelDown = 2, initialCall = false) => {
  console.log('in getPhotos')
  return []
}
exports.getPeople = getPhotos

/*
 *
 * This gets a single photo
 *
 */
const getPhoto = async (args, context, levelDown = 2, initialCall = false) => {
  console.log('In getPhoto')
  const newArgs = {}
  if (args.id) newArgs.ids = [args.id]
  if (args.instance) newArgs.instance = [args.instance]

  const photo = await getPhotos(newArgs, context, levelDown, initialCall)
  if (photo && photo.length === 1) return photo[0]

  return null
}
exports.getPhoto = getPhoto

/*
 *
 * This writes a single photo
 *
 */
const createPhoto = async (args, context, levelDown = 2, initialCall = false) => {
  console.log('In createPhoto')
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have an instance and title
  if (!args.instance || !args.personId || !args.initiative || !args.title) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  //  Check the initiative exists
  const checkInitiative = await initiatives.checkInitiative({
    id: args.initiative,
    instance: args.instance
  }, context)
  if (!checkInitiative) return null

  //  Check the user exists
  const checkPerson = await people.checkPerson({
    id: args.personId,
    instance: args.instance
  }, context)
  if (!checkPerson) return null

  console.log('Passed all the checks')
  return null
}
exports.createPhoto = createPhoto

const initiatives = require('../initiatives')
const instances = require('../instances')
const people = require('../people')
