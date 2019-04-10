exports.index = (req, res) => {
  //  Check to see if we have an instance set up, if not then
  //  we need to force the admin staff to pick one

  return res.render('admin/index', req.templateValues)
}

exports.wait = (req, res) => {
  return res.render('config/wait', req.templateValues)
}
