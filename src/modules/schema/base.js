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
    photos: [Photo]
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

  photoData: `
    type photoData {
      height: Int
      width: Int
      public_id: String
      version: String
    }
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
    data: photoData
  `

}

exports.query = {
  hello: `hello: String`,
  initiativesInner: `
    ids: [String]
    isActive: Boolean
    isFeatured: Boolean
    instance: String!
  `,
  initiativeInner: `
    id: String
    slug: String
    instance: String!
  `,

  photosInner: `
    tags: [String]
    location: String
    fromDate: String
    endDate: String
    socialMedias: [String]
    initiatives: [String]
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
