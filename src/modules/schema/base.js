'use strict'

exports.type = {
  initiative: `type Initiative {
    id: String!
    slug: String
    title: String
    description: String
    created: String
    instance: String!
    isActive: Boolean
  }`
}
exports.query = {
  hello: `hello: String`,
  initiatives: `initiatives(
    ids: [String]
    instance: String!
    isActive: Boolean
  ): [Initiative]`,
  initiative: `initiative(
    id: String
    slug: String
    instance: String!
  ): Initiative`
}
