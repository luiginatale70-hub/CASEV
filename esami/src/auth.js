const bcrypt = require('bcryptjs');
const { get } = require('./db');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Accesso negato',
        message: 'Permessi insufficienti.'
      });
    }
    next();
  };
}

/**
 * Admin OR Instructor
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Accesso negato',
        message: 'Permessi insufficienti.'
      });
    }
    next();
  };
}

async function getUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ?', [email]);
}

async function getUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

module.exports = {
  requireAuth,
  requireRole,
  requireAnyRole,
  getUserByEmail,
  getUserById,
  verifyPassword
};
