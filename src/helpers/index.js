const moment = require('moment')
const querystring = require('querystring')
const Prism = require('prismjs')
const marked = require('marked')

var loadLanguages = require('prismjs/components/index.js')
loadLanguages(['bash', 'graphql', 'json'])

exports.ifIndexDivisibleBy = (index, divisor, options) => {
  if ((index + 1) % divisor === 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifIndexNotDivisibleBy = (index, divisor, options) => {
  if ((index + 1) % divisor !== 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifStartRow = (index, divisor, options) => {
  index = index + divisor - 1
  if ((index + 1) % divisor === 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEndRow = (index, divisor, options) => {
  if ((index + 1) % divisor === 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.indexOf = (context, ndx, options) => options.fn(context[ndx])

exports.ifEven = (n, options) => {
  if (n % 2 === 0 || n === 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifOdd = (n, options) => {
  if (n % 2 !== 0 && n > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEqual = (v1, v2, options) => {
  if (v1 === v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifNotEqual = (v1, v2, options) => {
  if (v1 !== v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifgt = (v1, v2, options) => {
  if (v1 > v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifgte = (v1, v2, options) => {
  if (v1 >= v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.iflt = (v1, v2, options) => {
  if (v1 < v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.iflte = (v1, v2, options) => {
  if (v1 <= v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEqualNumbers = (v1, v2, options) => {
  if (parseInt(v1, 10) === parseInt(v2, 10)) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifIsNotNull = (v1, options) => {
  if (v1 !== null) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.and = (v1, v2) => {
  return v1 && v2
}

exports.or = (v1, v2) => {
  return v1 || v2
}

exports.toLowerCase = text => {
  return text.toLowerCase()
}

const truncate = (text, targetLength) => {
  if (!text) return null
  if (text.length <= targetLength) return text
  return `${text.substr(0, targetLength)}...`
}
exports.truncate = truncate

const markdown = (text) => {
  return marked(text)
}
exports.markdown = markdown

exports.convertShortCode = (text) => {
  let formattedText = ''
  if (text) {
    const firstChunks = text.split('[[')
    firstChunks.forEach((chunk) => {
      const subChunk = chunk.split(']]')
      //  If there's only one thing, that means it's just a simple text
      if (subChunk.length === 1) {
        formattedText += subChunk[0]
      } else {
        const thingSplit = subChunk[0].split('|')
        //  Check we have exactually three parts
        if (thingSplit.length === 3) {
          formattedText += `<a href="/explore-o-matic/${thingSplit[0]}/${thingSplit[2]}" class="button cardButton">${truncate(thingSplit[1], 24)}</a>`
        }
        formattedText += subChunk[1]
      }
    })
  }
  return markdown(formattedText)
}

exports.prettyMonth = month => {
  if (month === '01') {
    return 'January'
  }
  if (month === '02') {
    return 'February'
  }
  if (month === '03') {
    return 'March'
  }
  if (month === '04') {
    return 'April'
  }
  if (month === '05') {
    return 'May'
  }
  if (month === '06') {
    return 'June'
  }
  if (month === '07') {
    return 'July'
  }
  if (month === '08') {
    return 'August'
  }
  if (month === '09') {
    return 'September'
  }
  if (month === '10') {
    return 'October'
  }
  if (month === '11') {
    return 'November'
  }
  if (month === '12') {
    return 'December'
  }
  return month
}

exports.prettyDay = d => {
  const day = parseInt(d, 10)
  if (day === 1) {
    return '1<sup>st</sup>'
  }
  if (day === 2) {
    return '2<sup>nd</sup>'
  }
  if (day === 3) {
    return '3<sup>rd</sup>'
  }
  if (day === 21) {
    return '21<sup>st</sup>'
  }
  if (day === 22) {
    return '22<sup>nd</sup>'
  }
  if (day === 23) {
    return '23<sup>rd</sup>'
  }
  if (day === 31) {
    return '31<sup>st</sup>'
  }
  return `${day}<sup>th</sup>`
}

exports.prettyishDay = d => {
  const day = parseInt(d, 10)
  if (day === 1) {
    return '1st'
  }
  if (day === 2) {
    return '2nd'
  }
  if (day === 3) {
    return '3rd'
  }
  if (day === 21) {
    return '21st'
  }
  if (day === 22) {
    return '22nd'
  }
  if (day === 23) {
    return '23rd'
  }
  if (day === 31) {
    return '31st'
  }
  return `${day}th`
}

exports.dumpThis = object => {
  console.log(object)
  return ''
}

exports.dumpJSON = object => {
  let pre = "<pre class='admin_view'>"
  pre += JSON.stringify(object, null, 4)
  pre += '</pre>'
  return pre
}

exports.graphQLStatus = () => {
  if (!('graphqlping' in global)) {
    return '<span class="warn">Not connected</span>'
  }
  //  Find out when the last successful connection was
  const valid = global.graphqlping.filter((ping) => {
    return ping.valid
  })
  if (valid.length === 0) {
    return '<span class="alert">Disconnected</span>'
  }

  const mostRecentValid = valid[0]
  const diff = new Date().getTime() - mostRecentValid.timestamp
  //  If the last valid connection was more than 5 minutes ago
  //  then say we are disconnected
  if (diff > 5 * 60 * 1000) {
    return '<span class="alert">Disconnected</span>'
  }
  const pings = valid.map((ping) => {
    return ping.ms
  })
  const averagePing = Math.floor(pings.reduce((p, c) => p + c, 0) / pings.length)
  return `<span class="good">Ave ping: ${averagePing}ms</span>`
}

exports.elasticsearchStatus = () => {
  if (!('elasticsearchping' in global)) {
    return '<span class="warn">Not connected</span>'
  }
  //  Find out when the last successful connection was
  const valid = global.elasticsearchping.filter((ping) => {
    return ping.valid
  })
  if (valid.length === 0) {
    return '<span class="alert">Disconnected</span>'
  }

  const mostRecentValid = valid[0]
  const diff = new Date().getTime() - mostRecentValid.timestamp
  //  If the last valid connection was more than 5 minutes ago
  //  then say we are disconnected
  if (diff > 5 * 60 * 1000) {
    return '<span class="alert">Disconnected</span>'
  }
  const pings = valid.map((ping) => {
    return ping.ms
  })
  const averagePing = Math.floor(pings.reduce((p, c) => p + c, 0) / pings.length)
  return `<span class="good">Ave ping: ${averagePing}ms</span>`
}

exports.prettyNumber = x => {
  if (x === null || x === undefined) return ''
  if (x === '0' || x === 0) return '0'
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

exports.timePretty = t => {
  if (t === null || t === undefined) return ''
  return moment(t).format('dddd, MMMM Do YYYY, h:mm:ss a')
}

exports.prettyDate = t => {
  if (t === null || t === undefined) return ''
  return moment(t).format('dddd, MMMM Do YYYY, h:mm:ss a')
}

exports.prettyDateShort = t => {
  if (t === null || t === undefined) return ''
  return moment(t).format('MMMM Do YYYY')
}

exports.timeDiff = diff => {
  if (diff === null || diff === undefined) return ''
  return moment.duration(diff).humanize()
}

exports.timeAgo = diff => {
  if (diff === null || diff === undefined) return ''
  return moment(diff).fromNow()
}

//  Here we are going to be constucting a whole bunch of HTML
//  which is also going to be horrible nested, you have been warned
//  please feel free to recurse this up
exports.displayFields = (fields, index) => {
  let html = '<ul class="fields level1">'
  Object.entries(fields).forEach(level1Node => {
    html += `<li><a href="/developer/field/${index}/${level1Node[0]}">${level1Node[0]}</a>`
    const level1Root = fields[level1Node[0]]
    const level1Entries = Object.entries(level1Root)
    if (level1Entries.length > 0) {
      html += '<ul class="fields level2">'
      level1Entries.forEach(level2Node => {
        html += `<li><a href="/developer/field/${index}/${level1Node[0]}.${level2Node[0]}">${level2Node[0]}</a>`
        const level2Root = level1Root[level2Node[0]]
        const level2Entries = Object.entries(level2Root)
        if (level2Entries.length > 0) {
          html += '<ul class="fields level3">'
          level2Entries.forEach(level3Node => {
            html += `<li><a href="/developer/field/${index}/${level1Node[0]}.${level2Node[0]}.${level3Node[0]}">${level3Node[0]}</a>`
            const level3Root = level2Root[level3Node[0]]
            const level3Entries = Object.entries(level3Root)
            if (level3Entries.length > 0) {
              html += '<ul class="fields level4">'
              level3Entries.forEach(level4Node => {
                html += `<li><a href="/developer/field/${index}/${level1Node[0]}.${level2Node[0]}.${level3Node[0]}.${level4Node[0]}">${level4Node[0]}</a></li>`
              })
              html += '</ul>'
            }
            html += '</li>'
          })
          html += '</ul>'
        }
        html += '</li>'
      })
      html += '</ul>'
    }
    html += '</li>'
  })
  html += '</ul>'
  return html
}

exports.deSlashRSlashN = (text) => {
  if (!text) return ''
  const newText = text.replace(/\r\r\n/g, '<br />')
  return newText
}

const showQuery = (query, filter) => {
  if (filter === null || filter === undefined || filter === '') {
    return query.replace('[[]]', '')
  }
  return query.replace('[[]]', filter)
}
exports.showQuery = showQuery

exports.exploreQuery = (query, filter, graphQL, token) => {
  if (!graphQL) return '#'
  const newQuery = showQuery(query, filter)
  const newUrl = `${graphQL}/${token}/playground?query=${querystring.escape(newQuery)}`
  return newUrl
}

exports.graphQLQuery = (query, filter) => {
  const rtn = showQuery(query, filter)
  return Prism.highlight(rtn, Prism.languages.graphql, 'graphql')
}

const curlCode = (code) => {
  return Prism.highlight(code, Prism.languages.bash, 'bash')
}
exports.curlCode = curlCode

exports.curlQuery = (query, filter, graphQL, token) => {
  let newQuery = showQuery(query, filter)
  //  We are going to do an ugly thing here to remove the
  //  first and last line of our query, as we want to
  //  replace them without horrid regex, we are making an
  //  assumption that the first and last line are generally
  //  'query {' and '}'
  let querySplit = newQuery.split('\n')
  querySplit.pop() //  remove first line
  querySplit.shift() // remove last line
  newQuery = querySplit.map(line => `${line} \\`).join('\n')
  const rtn = `curl -H "Authorization: bearer ${token}" \\
-H "Content-Type: application/json" \\
-X POST -d \\
"{\\"query\\": \\
\\"{ \\
${newQuery}
}\\"}" \\
${graphQL}/graphql`
  return Prism.highlight(rtn, Prism.languages.bash, 'bash')
}

const nodeCode = (code) => {
  return Prism.highlight(code, Prism.languages.javascript, 'javascript')
}
exports.nodeCode = nodeCode

exports.jsonCode = object => {
  let jsonFormat = null
  try {
    jsonFormat = JSON.stringify(object, null, 4)
  } catch (er) {
    return object
  }
  return Prism.highlight(jsonFormat, Prism.languages.json, 'json')
}

exports.xmlCode = object => {
  return Prism.highlight(object, Prism.languages.xml, 'xml')
}

exports.getDefaultTemplateData = () => {
  return {
    NODE_ENV: process.env.NODE_ENV
  }
}

exports.nodeQuery = (query, filter, graphQL, token) => {
  let newQuery = showQuery(query, filter)
  let querySplit = newQuery.split('\n')
  querySplit.pop() //  remove first line
  querySplit.shift() // remove last line
  newQuery = querySplit.map(line => `  ${line}`).join('\n')
  const rtn = `const request = require('request')

const payload = {
  query: \`{
${newQuery}
  }\`
}

request(
  {
    url: '${graphQL}/graphql',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: 'bearer ${token}'
    },
    json: payload
  },
  (error, resp, body) => {
    if (error) {
      console.log(error)
      // do something
    }
    if ('errors' in body) {
      console.log(body.errors)
      // do something else
    }
    console.log(body.data)
  }
)
`

  return Prism.highlight(rtn, Prism.languages.javascript, 'javascript')
}
