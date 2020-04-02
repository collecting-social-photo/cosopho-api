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
  colour: String
  logo: String
  slug: String
  languages: [String]
  defaultLanguage: String
  userFields: String
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
  suspended: Boolean
  deleted: Boolean
  sessionId: String
}

type Photo {
  ${base.type.photoInner}
  notes: String
  approved: Boolean
  homepage: Boolean
  reviewed: Boolean
  suspended: Boolean
  ownerDeleted: Boolean
  archived: Boolean
}

type I18n {
  id: String
  instance: String
  section: String
  stub: String
  token: String
  language: String
  string: String
  createdBy: String
  created: String
  updatedBy: String
  updated: String
  _sys: Sys
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
    photos_homepage: Boolean
    photos_suspended: Boolean
    photos_ownerDeleted: Boolean
    photos_archived: Boolean
  ): [Initiative]
  initiative(
    ${base.query.initiativeInner}
    photos_page: Int
    photos_per_page: Int
    photos_approved: Boolean
    photos_homepage: Boolean
    photos_suspended: Boolean
    photos_ownerDeleted: Boolean
    photos_archived: Boolean
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
    photos_homepage: Boolean
    photos_suspended: Boolean
    photos_ownerDeleted: Boolean
    photos_archived: Boolean
    photos_page: Int
    photos_per_page: Int
    suspended: Boolean
    deleted: Boolean
  ): [Person]

  person(
    id: String
    slug: String
    username: String
    email: String
    instance: String
    photos_approved: Boolean
    photos_homepage: Boolean
    photos_suspended: Boolean
    photos_ownerDeleted: Boolean
    photos_archived: Boolean
    photos_page: Int
    photos_per_page: Int
    suspended: Boolean
    deleted: Boolean
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
    instances: [String]
    reviewed: Boolean
    approved: Boolean
    homepage: Boolean
    suspended: Boolean
    ownerDeleted: Boolean
    archived: Boolean
  ): [Photo]
  photo(
    id: String!
    instance: String
  ): Photo

  strings(
    ids: [String]
    page: Int
    per_page: Int
    instance: String
    instances: [String]
    section: String
    language: [String]
    token: String
    stub: String
    createdBy: String
    updateBy: String
    fill: Boolean
  ): [I18n]
  string(
    id: String!
    fill: Boolean
  ): I18n

}


type Mutation {
  createInstance(
    title: String!
    colour: String
    logo: String
    languages: [String]
    defaultLanguage: String
    userFields: String
  ): Instance
  updateInstance(
    id: String!
    title: String
    colour: String
    logo: String
    languages: [String]
    defaultLanguage: String
    userFields: String
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
    email: String
    dateOfBirth: String
    placeOfBirth: String
    avatar: String
    name: String
    gender: String
    facebook: String
    instagram: String
    twitter: String
    personalSite: String
    bio: String
    suspended: Boolean
    deleted: Boolean
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
    otherSM: String
    make: String
    model: String
    aperture: Float
    shutterSpeed: Float
    ISO: Int
    focalLength: Int
    license: String
    approved: Boolean
    homepage: Boolean
    archived: Boolean
    data: String
    notes: String
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
    otherSM: String
    make: String
    model: String
    aperture: Float
    shutterSpeed: Float
    ISO: Int
    focalLength: Int
    license: String
    reviewed: Boolean
    approved: Boolean
    homepage: Boolean
    archived: Boolean
    data: String
    notes: String
  ): Photo
  deletePhoto(
    id: String!
    instance: String!
  ): Status

  createString(
    instance: String
    language: String!
    section: String!
    stub: String!
    string: String!
  ): I18n
  updateString(
    id: String!
    string: String!
  ): I18n
  deleteString(
    id: String!
    instance: String!
  ): Status  
  deleteAllStrings: Status  
}
`
