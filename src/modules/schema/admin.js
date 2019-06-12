'use strict'

const base = require('./base.js')

exports.schema = `

type Status {
  status: String
  success: Boolean
}

type Roles {
  isAdmin: Boolean
  isDeveloper: Boolean
}

${base.type.initiative}
${base.type.photoData}
${base.type.sys}
${base.type.pagination}

type Instance {
  id: String!
  title: String
  initiatives: [Initiative]
}

type User {
  apitoken: String
  created: String
  displayName: String
  icon: String
  id: String
  instances: [Instance]
  lastLoggedIn: String
  lastUpdated: String
  roles: Roles
}

type Person {
  ${base.type.personInner}
  email: String
  dateOfBirth: String
  placeOfBirth: String
}

type Photo {
  ${base.type.photoInner}
  approved: Boolean
  reviewed: Boolean
  suspended: Boolean
}

type Query {
  ${base.query.hello}
  instances(
    ids: [String]
    page: Int
    per_page: Int
  ): [Instance]
  instance(
    id: String
  ): Instance

  initiatives(
    ${base.query.initiativesInner}
    photos_page: Int
    photos_per_page: Int
    photos_approved: Boolean
  ): [Initiative]
  initiative(
    ${base.query.initiativeInner}
    photos_page: Int
    photos_per_page: Int
    photos_approved: Boolean
  ): Initiative

  users(
    ids: [String]
    page: Int
    per_page: Int
  ): [User]
  user(
    id: String!
  ): User

  people(
    ids: [String]
    page: Int
    per_page: Int
    slugs: [String]
    usernames: [String]
    emails: [String]
    instance: String!
    photos_approved: Boolean
    photos_page: Int
    photos_per_page: Int
  ): [Person]

  person(
    id: String
    slug: String
    username: String
    email: String
    instance: String
    photos_approved: Boolean
    photos_page: Int
    photos_per_page: Int
  ): Person
  checkPerson(
    id: String!
    instance: String!
  ): Status
  loginPerson(
    username: String!
    hashedPassword: String!
    instance: String
  ): Status

  photos(
    ${base.query.photosInner}
    ids: [String]
    instance: String
    reviewed: Boolean
    approved: Boolean
    suspended: Boolean
  ): [Photo]
  photo(
    id: String!
    instance: String
  ): Photo
}


type Mutation {
  createInstance(
    title: String!
  ): Instance
  updateInstance(
    id: String!
    title: String!
  ): Instance
  deleteInstance(
    id: String!
  ): Status

  createInitiative(
    title: String!
    instance: String!
    description: String
    isActive: Boolean = true
    isFeatured: Boolean = false
  ): Initiative
  updateInitiative(
    id: String!
    instance: String!
    title: String
    description: String
    isActive: Boolean
    isFeatured: Boolean
  ): Initiative
  deleteInitiative(
    id: String!
    instance: String!
  ): Status

  updateUser(
    id: String!
    instances: [String]
    isAdmin: Boolean
    isDeveloper: Boolean
  ): User

  createPerson(
    id: String!
    instance: String!
    username: String!
    avatar: String
    raw: String!
  ): Person
  updatePerson(
    id: String!
    instance: String!
    username: String
    hashedPassword: String
    email: String
  ): Person
  deletePerson(
    id: String!
    instance: String!
  ): Status

  createPhoto(
    instance: String!
    personSlug: String!
    title: String!
    story: String
    initiative: String!
    tags: [String]
    location: String
    date: String
    socialMedias: [String]
    make: String
    model: String
    aperture: Float
    shutterSpeed: Float
    license: String
    approved: Boolean
    data: String
  ): Photo
  updatePhoto(
    id: String!
    instance: String!
    title: String
    story: String
    tags: [String]
    location: String
    date: String
    socialMedias: [String]
    make: String
    model: String
    aperture: Float
    shutterSpeed: Float
    license: String
    reviewed: Boolean
    approved: Boolean
    data: String
  ): Photo
  deletePhoto(
    id: String!
    instance: String!
  ): Status
}
`
