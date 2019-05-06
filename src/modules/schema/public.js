'use strict'

const base = require('./base.js')

exports.schema = `

${base.type.initiative}
type Person {
  ${base.type.personInner}
}

type Query {
  ${base.query.hello}

  ${base.query.initiative}
  ${base.query.initiatives}

  people(
    ids: [String]
    slugs: [String]
    usernames: [String]
    instance: String!
  ): [Person]
  person(
    id: String
    slug: String
    username: String
    instance: String!
  ): Person

}
`
