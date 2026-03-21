module.exports = function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/esami/login');
  }
  next();
};
