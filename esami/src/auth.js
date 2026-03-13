const bcrypt = require('bcryptjs');
const { get } = require('./db');

// Mappa ruoli italiani → inglesi per compatibilità modulo esami
const ROLE_MAP = {
  admin:       'admin',
  admin_esami: 'admin',
  istruttore:  'instructor',
  instructor:  'instructor',
  gestore:     'instructor',
  allievo:     'student',
  student:     'student'
};

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/esami/login');
  next();
}

// requireRole e requireAnyRole unificate — accettano uno o più ruoli
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/esami/login');
    const role = req.session.user.role || ROLE_MAP[req.session.user.ruolo] || 'student';
    if (!req.session.user.role) req.session.user.role = role;
    if (!roles.includes(role)) {
      return res.status(403).render('error', {
        title: 'Accesso negato',
        message: 'Permessi insufficienti.'
      });
    }
    next();
  };
}

// Alias mantenuto per compatibilità — punta alla stessa funzione
const requireAnyRole = requireRole;

async function getUserByEmail(email) {
  const u = await get(
    'SELECT *, ruolo as role FROM utenti WHERE (email=? OR username=?) AND attivo=1',
    [email, email]
  );
  return u;
}

async function getUserById(id) {
  return get('SELECT *, ruolo as role FROM utenti WHERE id=?', [id]);
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
  verifyPassword,
  ROLE_MAP
};
