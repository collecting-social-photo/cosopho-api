exports.index = (req, res) => {
  return res.render('main/index', req.templateValues)
}

exports.wait = (req, res) => {
  return res.render('config/wait', req.templateValues)
}
