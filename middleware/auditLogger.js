const { logAction } = require('../services/auditService');

module.exports = function auditLogger(req, res, next) {
  if (req.session && req.session.user) {
    logAction({
      userId: req.session.user.id,
      action: req.method + ' ' + req.originalUrl,
      req
    });
  }
  next();
};
