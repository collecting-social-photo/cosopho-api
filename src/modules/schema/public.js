const base = require('./base.js')

exports.schema = `
type Query {
  ${base.query.hello}
}
`
