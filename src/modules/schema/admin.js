const base = require('./base.js')

exports.schema = `

type Instance {
  id: String!
  title: String
}

type Query {
  ${base.query.hello}
  instances: [Instance]
  instance(
    id: String!
  ): Instance
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
}

`
