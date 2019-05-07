const elasticsearch = require('elasticsearch')
// const utils = require('../../../modules/utils')
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

/*
 *
 * This gets all the photos
 *
 */
const getPhotos = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photos_${process.env.KEY}`

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
        'id': args.ids
      }
    })
  }

  if ('tags' in args && Array.isArray(args.tags)) {
    must.push({
      terms: {
        'tags': args.tags
      }
    })
  }

  if ('location' in args && args.location !== '') {
    must.push({
      match: {
        'location': args.location
      }
    })
  }

  if ('socialMedias' in args && Array.isArray(args.socialMedias)) {
    must.push({
      terms: {
        'socialMedias': args.socialMedias
      }
    })
  }

  if ('initiative' in args && args.initiative !== '') {
    must.push({
      match: {
        'initiative': args.initiative
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

  if ('make' in args && args.make !== '') {
    must.push({
      match: {
        'make': args.make
      }
    })
  }

  if ('model' in args && args.model !== '') {
    must.push({
      match: {
        'model': args.model
      }
    })
  }

  if ('aperture' in args) {
    must.push({
      match: {
        'aperture': args.aperture
      }
    })
  }

  if ('shutterSpeed' in args) {
    must.push({
      match: {
        'shutterSpeed': args.shutterSpeed
      }
    })
  }

  if ('license' in args) {
    must.push({
      match: {
        'license': args.license
      }
    })
  }

  if ('peopleSlugs' in args && Array.isArray(args.peopleSlugs)) {
    must.push({
      terms: {
        'personSlug': args.peopleSlugs
      }
    })
  }

  if ('reviewed' in args) {
    must.push({
      match: {
        'reviewed': args.reviewed
      }
    })
  }

  if ('approved' in args) {
    must.push({
      match: {
        'approved': args.approved
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

  const photos = results.hits.hits.map((photo) => photo._source)
  return photos
}
exports.getPhotos = getPhotos

/*
 *
 * This gets a single photo
 *
 */
const getPhoto = async (args, context, levelDown = 2, initialCall = false) => {
  const newArgs = {}
  if (args.id) newArgs.ids = [args.id]
  if (args.instance) newArgs.instance = args.instance

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
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  Make sure we have an instance and title
  if (!args.instance || !args.personSlug || !args.initiative || !args.title) return null

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
    slug: args.personSlug,
    instance: args.instance
  }, context)
  if (!checkPerson) return null

  const newId = crypto
    .createHash('sha512')
    .update(`${Math.random()}-${process.env.KEY}-${args.instance}`)
    .digest('hex')
    .slice(0, 36)

  //  Make sure the index exists
  creatIndex()

  //  Default photo
  const newPhoto = {
    id: newId,
    instance: args.instance,
    initiative: args.initiative,
    title: args.title,
    personSlug: args.personSlug,
    reviewed: false,
    approved: false,
    uploaded: new Date()
  }
  //  Extra things
  if (args.tags) newPhoto.tags = args.tags
  if (args.location) newPhoto.location = args.location
  if (args.story) newPhoto.story = args.story
  if (args.date) newPhoto.date = new Date(args.date)
  if (args.socialMedias) newPhoto.socialMedias = args.socialMedias
  if (args.license) newPhoto.license = args.license
  if (args.make) newPhoto.make = args.make
  if (args.model) newPhoto.model = args.model
  if (args.aperture) newPhoto.aperture = args.aperture
  if (args.shutterSpeed) newPhoto.shutterSpeed = args.shutterSpeed

  //  Do some EXIF stuff here if we can
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photos_${process.env.KEY}`
  const type = 'photo'
  await esclient.update({
    index,
    type,
    id: newId,
    body: {
      doc: newPhoto,
      doc_as_upsert: true
    }
  })

  return newPhoto
}
exports.createPhoto = createPhoto

/*
 *
 * This updates a single photo
 *
 */
const updatePhoto = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id
  if (!args.id) return null
  if (!args.instance) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  //  Make sure the index exists
  creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photos_${process.env.KEY}`
  const type = 'photo'
  const updatedPhoto = {
    id: args.id
  }

  //  These are the fields that can be updated
  const keys = ['title',
    'story',
    'tags',
    'location',
    'date',
    'socialMedias',
    'make',
    'model',
    'aperture',
    'shutterSpeed',
    'license',
    'reviewed',
    'approved'
  ]

  //  Check to see if we have a new value, if so add it to the update record obj
  keys.forEach((key) => {
    if (key in args) {
      updatedPhoto[key] = args[key]
    }
  })

  //  Update the thing
  await esclient.update({
    index,
    type,
    id: args.id,
    body: {
      doc: updatedPhoto,
      doc_as_upsert: true
    }
  })

  await delay(2000)

  //  Return back the values
  const newUpdatedPhoto = await getPhoto({
    id: args.id,
    instance: args.instance
  }, context)
  return newUpdatedPhoto
}
exports.updatePhoto = updatePhoto

const initiatives = require('../initiatives')
const instances = require('../instances')
const people = require('../people')