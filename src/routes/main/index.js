const utils = require('../../modules/utils')

exports.index = (req, res) => {
  req.templateValues.signedId = utils.getSessionId(process.env.SIGNEDID)
  return res.render('main/index', req.templateValues)
}

exports.wait = (req, res) => {
  return res.render('config/wait', req.templateValues)
}
