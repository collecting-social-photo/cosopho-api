/* eslint no-useless-escape: 0 */
const crypto = require('crypto')

exports.slugify = (string) => {
  const a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœṕŕßśșțùúüûǘẃẍÿź·/_,:;'
  const b = 'aaaaaaaaceeeeghiiiimnnnoooooprssstuuuuuwxyz------'
  const p = new RegExp(a.split('').join('|'), 'g')

  return string.toString().toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, '') // Trim - from end of text
}

exports.getSessionId = (id) => {
  return crypto
    .createHash('sha512')
    .update(`${id}-${process.env.KEY}`)
    .digest('base16')
    .toString('hex')
    .slice(0, 32)
}

const throwError = (msg) => {
  throw new Error(msg)
}
exports.throwError = throwError

// Attempt to stringify some JSON
exports.stringify = (json) => {
  try {
    return JSON.stringify(json)
  } catch (er) {
    console.log('------------------------------------------------------------------------')
    console.log('Failed to JSON.stringify with')
    console.log(json)
    console.log('------------------------------------------------------------------------')
    return null
  }
}

exports.JSONcheck = (thingToJSON) => {
  try {
    const newThing = JSON.parse(JSON.stringify(thingToJSON))
    return newThing
  } catch (er) {
    console.log('-----------------------------------------')
    console.log('Failed in JSONcheck, cannot stringify')
    console.log(er)
    return throwError('503 Service Unavailable')
  }
}
