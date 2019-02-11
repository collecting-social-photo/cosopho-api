exports.index = (req, res) => {
  console.log(req.templateValues)
  return res.render('main/index', req.templateValues)
}

exports.wait = (req, res) => {
  return res.render('config/wait', req.templateValues)
}
