/**
 * esami/routes/auth.js
 * Login / Logout / Cambio password per il modulo esami
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const { run }                                         = require('../src/db');
const { getUserByEmail, verifyPassword, requireAuth } = require('../src/auth');
const { logAccess }                                   = require('../src/accessLog');

const router = express.Router();

/* GET /esami/login */
router.get('/login', (req, res) => {
  if (req.session.user) {
    const role = req.session.user.role;
    if (role === 'student')    return res.redirect('/esami/student');
    if (role === 'instructor') return res.redirect('/esami/instructor');
    if (role === 'admin')      return res.redirect('/esami/admin');
  }
  res.render('auth/login', { title: 'Accesso Esami' });
});

/* POST /esami/login */
router.post('/login', async (req, res) => {
  const email    = (req.body.email    || '').trim();
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    req.flash('error', 'Inserisci username e password.');
    return res.redirect('/esami/login');
  }

  try {
    const user = await getUserByEmail(email);

    if (!user || !verifyPassword(user, password)) {
      logAccess(req, { email, event: 'login_failed', details: { reason: 'bad_credentials' } }).catch(() => {});
      req.flash('error', 'Credenziali non valide.');
      return res.redirect('/esami/login');
    }

    req.session.user = {
      id:                   user.id,
      role:                 user.role,
      email:                user.email,
      must_change_password: !!user.must_change_password
    };

    logAccess(req, { userId: user.id, email: user.email, event: 'login_success' }).catch(() => {});

    if (user.must_change_password) return res.redirect('/esami/change-password');
    if (user.role === 'student')    return res.redirect('/esami/student');
    if (user.role === 'instructor') return res.redirect('/esami/instructor');
    if (user.role === 'admin')      return res.redirect('/esami/admin');

    res.redirect('/esami');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Errore interno. Riprova.');
    res.redirect('/esami/login');
  }
});

/* GET /esami/logout */
router.get('/logout', (req, res) => {
  logAccess(req, {
    userId: req.session?.user?.id    ?? null,
    email:  req.session?.user?.email ?? null,
    event:  'logout'
  }).catch(() => {});
  req.session.destroy(() => res.redirect('/esami/login'));
});

/* GET /esami/change-password */
router.get('/change-password', requireAuth, (req, res) => {
  res.render('auth/change_password', { title: 'Cambio password' });
});

/* POST /esami/change-password */
router.post('/change-password', requireAuth,
  body('password').isLength({ min: 8 }),
  body('password2').custom((v, { req }) => v === req.body.password),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Password non valida o non corrispondente (min 8 caratteri).');
      return res.redirect('/esami/change-password');
    }
    const hash = bcrypt.hashSync(req.body.password, 12);
    await run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [hash, req.session.user.id]);
    req.session.user.must_change_password = false;
    req.flash('success', 'Password aggiornata.');
    const role = req.session.user.role;
    if (role === 'student')    return res.redirect('/esami/student');
    if (role === 'instructor') return res.redirect('/esami/instructor');
    if (role === 'admin')      return res.redirect('/esami/admin');
    res.redirect('/esami');
  }
);

module.exports = router;
