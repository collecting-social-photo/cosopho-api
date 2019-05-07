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
    photos: [Photo]
  `,

  photoInner: `
    id: String!
    instance: String!
    initiative: String
    title: String
    story: String
    tags: [String]
    location: String
    date: String
    socialMedias: [String]
    make: String
    model: String
    aperture: Float
    shutterSpeed: Float
    license: String
    uploaded: String
    person: Person
  `
}

exports.query = {
  hello: `hello: String`,
  initiatives: `initiatives(
    ids: [String]
    isActive: Boolean
    isFeatured: Boolean
    instance: String!
  ): [Initiative]`,
  initiative: `initiative(
    id: String
    slug: String
    instance: String!
  ): Initiative`,

  photosInner: `
    tags: [String]
    location: String
    fromDate: String
    endDate: String
    socialMedias: [String]
    initiative: String
    make: String
    model: String
    aperture: Float
    shutterSpeed: Float
    license: String
    peopleSlugs: [String]
  `,
  photoInner: `
    id: String!
  `
}
