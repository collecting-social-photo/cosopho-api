/*
const Config = require('../../classes/config')
const cloudinary = require('../../modules/cloudinary')
const elasticsearch = require('../../modules/elasticsearch')
*/

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true) {
    return res.redirect('/')
  }

  return res.render('config/index', req.templateValues)
}
