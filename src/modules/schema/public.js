'use strict'

const base = require('./base.js')

exports.schema = `

${base.type.initiative}

type Query {
  ${base.query.hello}

  ${base.query.initiative}
  ${base.query.initiatives}
}
`
