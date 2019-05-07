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
}

type Query {
  ${base.query.hello}
  instances(
    ids: [String]
  ): [Instance]
  instance(
    id: String
  ): Instance

  ${base.query.initiative}
  ${base.query.initiatives}

  users(
    ids: [String]
  ): [User]
  user(
    id: String!
  ): User

  people(
    ids: [String]
    slugs: [String]
    usernames: [String]
    emails: [String]
    instance: String!
  ): [Person]
  person(
    id: String
    slug: String
    username: String
    email: String
    instance: String
  ): Person
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
    instance: String!
    username: String!
    hashedPassword: String!
    email: String!
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
  ): Photo
}
`
