const base = require('./base.js')

exports.schema = `

type Roles {
  isAdmin: Boolean
  isDeveloper: Boolean
}

type Instance {
  id: String!
  title: String
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
  ): Instance
  updateUser(
    id: String!
    instances: [String]
    isAdmin: Boolean
    isDeveloper: Boolean
  ): User
}

`
