'use strict'

const base = require('./base.js')

exports.schema = `

${base.type.initiative}
${base.type.photoData}
${base.type.sys}
${base.type.pagination}

type Person {
  ${base.type.personInner}
}

type Photo {
  ${base.type.photoInner}
}

type Query {
  ${base.query.hello}

  initiatives(
    ${base.query.initiativesInner}
  ): [Initiative]
  initiative(
    ${base.query.initiativeInner}
  ): Initiative

  people(
    ids: [String]
    slugs: [String]
    usernames: [String]
    instance: String!
    _sys: Sys
  ): [Person]
  person(
    id: String
    slug: String
    username: String
    instance: String!
  ): Person

  photos(
    ids: [String]!
    instance: String!
    ${base.query.photosInner}
  )
  photo(
    id: String!
    instance: String!
  ): Photo

}
`
