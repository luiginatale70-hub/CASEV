// routes/admin.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

// Dashboard admin
router.get('/', async (req, res, next) => {
  try {
    const [[{ totUtenti }]]   = await db.query('SELECT COUNT(*) as totUtenti FROM utenti');
    const [[{ totPersonale }]] = await db.query('SELECT COUNT(*) as totPersonale FROM personale WHERE stato="attivo"');
    const [[{ totPub }]]      = await db.query('SELECT COUNT(*) as totPub FROM pubblicazioni');
    const [[{ totNews }]]     = await db.query('SELECT COUNT(*) as totNews FROM news');
    const [ultimiAccessi]     = await db.query(
      'SELECT la.*, u.nome, u.cognome FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id ORDER BY la.created_at DESC LIMIT 20'
    );
    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      stats: { totUtenti, totPersonale, totPub, totNews },
      ultimiAccessi
    });
  } catch (e) { next(e); }
});

// Lista utenti
router.get('/utenti', async (req, res, next) => {
  try {
    const [utenti] = await db.query('SELECT id, username, nome, cognome, email, ruolo, attivo, ultimo_accesso, created_at FROM utenti ORDER BY cognome');
    res.render('admin/utenti', { title: 'Gestione Utenti', utenti });
  } catch (e) { next(e); }
});

// Nuovo utente
router.post('/utenti', async (req, res, next) => {
  try {
    const { username, password, nome, cognome, email, ruolo } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO utenti (username, password_hash, nome, cognome, email, ruolo) VALUES (?,?,?,?,?,?)',
      [username, hash, nome, cognome, email||null, ruolo||'allievo']
    );
    req.flash('success', `Utente ${username} creato.`);
    res.redirect('/admin/utenti');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Username o email già esistente.');
      return res.redirect('/admin/utenti');
    }
    next(e);
  }
});

// Toggle attivo/disattivo
router.post('/utenti/:id/toggle', async (req, res, next) => {
  try {
    await db.query('UPDATE utenti SET attivo = NOT attivo WHERE id=? AND id != ?', [req.params.id, req.session.user.id]);
    req.flash('success', 'Stato utente aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Reset password
router.post('/utenti/:id/password', async (req, res, next) => {
  try {
    const hash = await bcrypt.hash(req.body.nuova_password, 10);
    await db.query('UPDATE utenti SET password_hash=? WHERE id=?', [hash, req.params.id]);
    req.flash('success', 'Password aggiornata.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

module.exports = router;
