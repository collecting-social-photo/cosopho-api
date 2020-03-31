const elasticsearch = require('elasticsearch')
const common = require('../common.js')
const utils = require('../../../modules/utils')

// const utils = require('../../../modules/utils')
const crypto = require('crypto')

/*
 *
 * Make sure the actual index exists
 *
 */
const creatIndex = async () => {
  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photos_${process.env.KEY}`
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
  await creatIndex()

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photos_${process.env.KEY}`

  let page = common.getPage(args)
  let perPage = common.getPerPage(args)

  //  This is the base query
  const body = {
    from: page * perPage,
    size: perPage
  }

  // Do the sorting
  const validSorts = ['asc', 'desc']
  const keywordFields = ['title']
  const validFields = ['title', 'date', 'uploaded']

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
      'uploaded': {
        order: 'desc'
      }
    }
  }

  //  If we have been passed a slug, and we have a signed api call
  //  and it's signed by a user not an admin, then we're going to need
  //  to fetch the id of the user
  let uniquePersonSlug = null
  if (context.signed && process.env.SIGNEDID && context.signed !== utils.getSessionId(process.env.SIGNEDID)) {
    //  We are a logged in user
    //  Check to see if we have been passed a slug
    if (args.peopleSlugs) {
      if (Array.isArray(args.peopleSlugs) && args.peopleSlugs.length === 1) uniquePersonSlug = args.peopleSlugs[0]
      if (!Array.isArray(args.peopleSlugs)) uniquePersonSlug = args.peopleSlugs
      if (uniquePersonSlug.trim() === '') uniquePersonSlug = null
    }
  }
  //  If we have uniquePersonSlug see if we can get the ids
  let uniquePersonId = null
  if (uniquePersonSlug) {
    const contextCopy = JSON.parse(JSON.stringify(context))
    contextCopy.signed = utils.getSessionId(process.env.SIGNEDID) // Sign the next call with the admin API token
    const checkUser = await people.getPersonId({
      slug: uniquePersonSlug
    }, contextCopy)
    if (checkUser && checkUser.id) uniquePersonId = checkUser.id
  }

  //  These are things we must find
  let must = []
  let mustNot = []

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
        'tags.keyword': args.tags
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
        'socialMedias.keyword': args.socialMedias
      }
    })
  }

  if ('otherSM' in args && args.otherSM !== '') {
    must.push({
      match: {
        'otherSM.keyword': args.otherSM
      }
    })
  }

  if ('initiatives' in args && Array.isArray(args.initiatives)) {
    must.push({
      terms: {
        'initiative.keyword': args.initiatives
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

  if ('make' in args && args.make !== '') {
    must.push({
      match: {
        'make.keyword': args.make
      }
    })
  }

  if ('model' in args && args.model !== '') {
    must.push({
      match: {
        'model.keyword': args.model
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

  if ('ISO' in args) {
    must.push({
      match: {
        'ISO': args.ISO
      }
    })
  }

  if ('focalLength' in args) {
    must.push({
      match: {
        'focalLength': args.focalLength
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
        'personSlug.keyword': args.peopleSlugs
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

  //  For approved to be true if we are not any of the "admin/staff" roles.
  if (!context.userRoles.isStaff && !context.userRoles.isVendor && !context.userRoles.isAdmin) {
    args.approved = true
    args.ownerDeleted = false
    args.deleted = false
    args.archived = false
  }

  if ('approved' in args) {
    must.push({
      match: {
        'approved': args.approved
      }
    })
  }

  if ('suspended' in args) {
    if (args.suspended === true) {
      must.push({
        match: {
          'suspended': true
        }
      })
    } else {
      mustNot.push({
        match: {
          'suspended': true
        }
      })
    }
  }

  if ('ownerDeleted' in args) {
    if (args.ownerDeleted === true) {
      must.push({
        match: {
          'ownerDeleted': true
        }
      })
    } else {
      mustNot.push({
        match: {
          'ownerDeleted': true
        }
      })
    }
  }

  if ('archived' in args) {
    if (args.archived === true) {
      must.push({
        match: {
          'archived': true
        }
      })
    } else {
      mustNot.push({
        match: {
          'archived': true
        }
      })
    }
  }

  /*
    Are we allowed to see deleted and suspended user?
    We are allowed to see them if...

    1.  The call is signed and is signed with an id
        that matches the signedId
  */
  if (context.signed && process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID)) {
    //  We have a signature from the calling user
    //  We have signedId in the ENV
    //  The signature version of the signedId matches the calling user
    //  So everything is fine
  } else {
    //  Otherwise, we are NOT allowed to see this user
    //  Step 1. Remove any approved, ownerDeleted, deleted, suspended calls we already have in the must and mustnot
    //  query
    must = must.filter((q) => {
      if (q.match && q.match.approved) return false
      if (q.match && q.match.ownerDeleted) return false
      if (q.match && q.match.deleted) return false
      if (q.match && q.match.archived) return false
      return true
    })
    mustNot = mustNot.filter((q) => {
      if (q.match && q.match.approved) return false
      if (q.match && q.match.ownerDeleted) return false
      if (q.match && q.match.deleted) return false
      if (q.match && q.match.archived) return false
      return true
    })

    //  Now we need to work out if we are getting photos for a single
    //  user, if we are, then see if that user is the logged in user
    //  if so then we can allow archived photos

    //  Now add that filter back in
    must.push({
      match: {
        'approved': true
      }
    })
    mustNot.push({
      match: {
        'ownerDeleted': true
      }
    })
    mustNot.push({
      match: {
        'deleted': true
      }
    })
    mustNot.push({
      match: {
        'archived': true
      }
    })
  }

  //  If we are signed in, and either the admin user, or the owner
  //  and we are making a single user call, then we can respect the
  //  archived flag if we have one
  if (context.signed) {
    if ((process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID)) || (uniquePersonId && context.signed === utils.getSessionId(uniquePersonId))) {
      //  Remove any archived filter already have
      must = must.filter((q) => !(q.match && q.match.archived))
      mustNot = mustNot.filter((q) => !(q.match && q.match.archived))

      if ('archived' in args) {
        if (args.archived === true) {
          must.push({
            match: {
              'archived': true
            }
          })
        } else {
          mustNot.push({
            match: {
              'archived': true
            }
          })
        }
      }
    }
  }

  if ('homepage' in args) {
    if (args.homepage === true) {
      must.push({
        match: {
          'homepage': true
        }
      })
    } else {
      mustNot.push({
        match: {
          'homepage': true
        }
      })
    }
  }

  //  If we have something with *must* do, then we add that
  //  to the search
  if (must.length > 0 || mustNot.length > 0) {
    body.query = {
      bool: {}
    }
    if (must.length) body.query.bool.must = must
    if (mustNot.length) body.query.bool.must_not = mustNot
  }

  let results = null
  try {
    results = await esclient.search({
      index,
      body
    })
  } catch (er) {}

  let total = null
  if (!results || !results.hits || !results.hits.hits) {
    return []
  }
  if (results.hits.total) total = results.hits.total
  if (results.hits.total.value) total = results.hits.total.value

  const photos = results.hits.hits.map((photo) => photo._source)
  //  Now we need to go and get all the people for these photos
  if (levelDown < 2) {
    const peopleSlugs = [...new Set(photos.map((photo) => photo.personSlug))] // unique array
    const peopleQuery = {
      slugs: peopleSlugs
    }
    if (args.instance) peopleQuery.instance = args.instance
    if (args.instances && Array.isArray(args.instances)) peopleQuery.instances = args.instances
    const photosPeople = await people.getPeople(peopleQuery, context)

    if (photosPeople) {
      photosPeople.forEach((person) => {
        photos.forEach((photo) => {
          if (photo.personSlug === person.slug) {
            photo.person = person
          }
        })
      })
    }
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
  if (photos.length > 0) {
    photos[0]._sys = sys
  }

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

  //  We can only create a photo if we are signed in with the main site session
  if (context.signed === null) return null

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

  //  Grab the id of the user we are about to try and get
  let uniquePersonId = null
  const contextCopy = JSON.parse(JSON.stringify(context))
  contextCopy.signed = utils.getSessionId(process.env.SIGNEDID) // Sign the next call with the admin API token
  //  Grab the user of this slug
  const checkId = await people.getPersonId({
    slug: args.personSlug
  }, contextCopy)
  //  record the id of the user we are about to create a photo for
  if (checkId && checkId.id) uniquePersonId = checkId.id

  //  If the uniquePersonId is different from the signed in
  //  user's then we can't create this photo
  let canCreate = false
  //  If the signature is the same as the user we are attempting to create a photo for
  if (context.signed === utils.getSessionId(uniquePersonId)) canCreate = true
  //  If we are signed in as the main site...
  if (context.signed && process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID)) canCreate = true
  //  If either of the above isn't true, then we can't create a photo as this user
  if (!canCreate) return null

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
    homepage: false,
    archived: false,
    uploaded: new Date()
  }
  //  Extra things
  if (args.tags) newPhoto.tags = args.tags
  if (args.location) newPhoto.location = args.location
  if (args.story) newPhoto.story = args.story
  if (args.date) newPhoto.date = new Date(args.date)
  if (args.socialMedias) newPhoto.socialMedias = args.socialMedias
  if (args.otherSM) newPhoto.otherSM = args.otherSM
  if (args.license) newPhoto.license = args.license
  if (args.archived) newPhoto.archived = args.archived
  if (args.make) newPhoto.make = args.make
  if (args.model) newPhoto.model = args.model
  if (args.aperture) newPhoto.aperture = args.aperture
  if (args.shutterSpeed) newPhoto.shutterSpeed = args.shutterSpeed
  if (args.ISO) newPhoto.ISO = args.ISO
  if (args.focalLength) newPhoto.focalLength = args.focalLength
  if (args.data) newPhoto.data = JSON.parse(args.data)
  if (args.approved) newPhoto.approved = args.approved
  if (args.homepage) newPhoto.homepage = args.homepage
  if (args.notes) newPhoto.notes = args.notes

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

  //  We can only create a photo if we are signed in with the main site session
  if (context.signed === null) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  const checkPhoto = await getPhoto({
    id: args.id,
    instance: args.instance
  }, context)
  if (!checkPhoto || !checkPhoto.personSlug) return null

  //  Make sure the index exists
  creatIndex()

  //  Grab the id of the user we are about to try and get
  let uniquePersonId = null
  const contextCopy = JSON.parse(JSON.stringify(context))
  contextCopy.signed = utils.getSessionId(process.env.SIGNEDID) // Sign the next call with the admin API token
  //  Grab the user of this slug
  const checkId = await people.getPersonId({
    slug: checkPhoto.personSlug
  }, contextCopy)
  //  record the id of the user we are about to create a photo for
  if (checkId && checkId.id) uniquePersonId = checkId.id

  //  If the uniquePersonId is different from the signed in
  //  user's then we can't create this photo
  let canCreate = false
  //  If the signature is the same as the user we are attempting to create a photo for
  if (context.signed === utils.getSessionId(uniquePersonId)) canCreate = true
  //  If we are signed in as the main site...
  if (context.signed && process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID)) canCreate = true
  //  If either of the above isn't true, then we can't create a photo as this user
  if (!canCreate) return null

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
    'otherSM',
    'make',
    'model',
    'aperture',
    'shutterSpeed',
    'ISO',
    'focalLength',
    'license',
    'reviewed',
    'approved',
    'homepage',
    'notes',
    'archived'
  ]

  //  Check to see if we have a new value, if so add it to the update record obj
  keys.forEach((key) => {
    if (key in args) {
      updatedPhoto[key] = args[key]
      if (key === 'date') updatedPhoto[key] = new Date(args[key])
    }
  })

  //  Update the thing
  await esclient.update({
    index,
    type,
    id: args.id,
    refresh: true,
    body: {
      doc: updatedPhoto,
      doc_as_upsert: true
    }
  })

  //  Return back the values
  const newUpdatedPhoto = await getPhoto({
    id: args.id,
    instance: args.instance
  }, context)
  return newUpdatedPhoto
}
exports.updatePhoto = updatePhoto

/*
 *
 * This deletes a single photo
 *
 */
const deletePhoto = async (args, context, levelDown = 2, initialCall = false) => {
  //  Make sure we are an admin user, as only admin users are allowed to create them
  if (!context.userRoles || !context.userRoles.isAdmin || context.userRoles.isAdmin === false) return []

  //  We must have an id
  if (!args.id) return null
  if (!args.instance) return null

  //  We can only delete a photo if we are signed in with the main site session
  if (context.signed === null) return null

  //  Check the instance exists
  const checkInstance = await instances.checkInstance({
    id: args.instance
  }, context)
  if (!checkInstance) return null

  //  Make sure the index exists
  creatIndex()

  const checkPhoto = await getPhoto({
    id: args.id,
    instance: args.instance
  }, context)
  if (!checkPhoto || !checkPhoto.personSlug) return null

  //  Grab the id of the user we are about to try and get
  let uniquePersonId = null
  const contextCopy = JSON.parse(JSON.stringify(context))
  contextCopy.signed = utils.getSessionId(process.env.SIGNEDID) // Sign the next call with the admin API token
  //  Grab the user of this slug
  const checkId = await people.getPersonId({
    slug: checkPhoto.personSlug
  }, contextCopy)
  //  record the id of the user we are about to delete a photo of
  if (checkId && checkId.id) uniquePersonId = checkId.id

  //  If the uniquePersonId is different from the signed in
  //  user's then we can't delete this photo
  let canDelete = false
  //  If the signature is the same as the user we are attempting to delete photo of
  if (context.signed === utils.getSessionId(uniquePersonId)) canDelete = true
  //  If we are signed in as the main site...
  if (context.signed && process.env.SIGNEDID && context.signed === utils.getSessionId(process.env.SIGNEDID)) canDelete = true
  //  If either of the above isn't true, then we can't delete this photo as this user
  if (!canDelete) return null

  const esclient = new elasticsearch.Client({
    host: process.env.ELASTICSEARCH
  })
  const index = `photos_${process.env.KEY}`
  const type = 'photo'

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
exports.deletePhoto = deletePhoto

const initiatives = require('../initiatives')
const instances = require('../instances')
const people = require('../people')
