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
    isFeatured: Boolean
  }`,

  personInner: `
    id: String!
    instance: String!
    slug: String
    username: String
    avatar: String
    name: String
    gender: String
    facebook: String
    instagram: String
    twitter: String
    personalSite: String
    bio: String
  `
}
exports.query = {
  hello: `hello: String`,
  initiatives: `initiatives(
    ids: [String]
    instance: String!
    isActive: Boolean
    isFeatured: Boolean
  ): [Initiative]`,
  initiative: `initiative(
    id: String
    slug: String
    instance: String!
  ): Initiative`
}
