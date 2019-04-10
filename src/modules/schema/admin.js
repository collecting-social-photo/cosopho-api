const base = require('./base.js')

exports.schema = `

type Instance {
  id: String!
  title: String
}

type Query {
  ${base.query.hello}
  instances: [Instance]
}

type Mutation {
  createInstance(
    title: String!
  ): Instance
}

`
