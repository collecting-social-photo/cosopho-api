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

type Query {
  ${base.query.hello}
  instances(
    ids: [String]
  ): [Instance]
  instance(
    id: String!
  ): Instance

  ${base.query.initiative}
  ${base.query.initiatives}

  users(
    ids: [String]
  ): [User]
  user(
    id: String!
  ): User
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
    isActive: Boolean = true
  ): Initiative
  updateInitiative(
    id: String!
    instance: String!
    title: String
    isActive: Boolean
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
}
`
