exports.index = (req, res) => {
  //  If we are an admin user, then we go to the admin page, otherwise
  //  we go to the developer portal
  if (req.user.roles.isAdmin) {
    return res.redirect('/admin')
  }
  return res.redirect('/developer')
}

exports.wait = (req, res) => {
  return res.render('config/wait', req.templateValues)
}
