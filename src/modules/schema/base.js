'use strict'

exports.type = {
  initiative: `type Initiative {
    id: String!
    title: String
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
  ): [Initiative]`,
  initiative: `initiative(
    id: String!
    instance: String!
  ): Initiative`
}
