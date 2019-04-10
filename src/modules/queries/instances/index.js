// const elasticsearch = require('elasticsearch')

const getInstances = async (args, context, levelDown = 2, initialCall = false) => {
  console.log('In getInstances')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(args)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(context)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  return []
}
exports.getInstances = getInstances

const createInstance = async (args, context) => {
  console.log('In setInstances')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(args)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log(context)
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  return {
    id: '123',
    title: 'fnord'
  }
}
exports.createInstance = createInstance
