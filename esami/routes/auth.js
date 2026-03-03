/**
 * esami/routes/auth.js
 * Login unificato: reindirizza al portale CASEV
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { run }         = require('../src/db');
const { requireAuth } = require('../src/auth');

const router = express.Router();

// GET /esami/login → redirect al login CASEV se non loggato
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'student')    return res.redirect('/esami/student');
    if (role === 'instructor') return res.redirect('/esami/instructor');
    if (role === 'admin')      return res.redirect('/esami/admin');
  }
  res.redirect('/auth/login');
});

// POST /esami/login → non usato, redirect al portale
router.post('/login', (req, res) => {
  res.redirect('/auth/login');
});

// GET /esami/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

// POST /esami/logout (session timeout client)
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

// GET /esami/change-password
router.get('/change-password', requireAuth, (req, res) => {
  res.render('auth/change_password', { title: 'Cambio password' });
});

// POST /esami/change-password
router.post('/change-password', requireAuth,
  body('password').isLength({ min: 8 }),
  body('password2').custom((v, { req }) => v === req.body.password),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Password non valida (min 8 caratteri) o non corrispondente.');
      return res.redirect('/esami/change-password');
    }
    const hash = bcrypt.hashSync(req.body.password, 12);
    await run('UPDATE utenti SET password_hash=? WHERE id=?', [hash, req.session.user.id]);
    req.session.user.must_change_password = false;
    req.flash('success', 'Password aggiornata.');
    const role = req.session.user.role;
    if (role === 'student')    return res.redirect('/esami/student');
    if (role === 'instructor') return res.redirect('/esami/instructor');
    if (role === 'admin')      return res.redirect('/esami/admin');
    res.redirect('/esami');
  }
);

// GET /ping keepalive
router.get('/ping', (req, res) => res.json({ ok: true }));

module.exports = router;