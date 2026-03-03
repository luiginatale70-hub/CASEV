// routes/admin.js — Area amministrazione portale CASEV
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

// ── Dashboard ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [[{ totUtenti }]]    = await db.query('SELECT COUNT(*) as totUtenti FROM utenti');
    const [[{ totAttivi }]]    = await db.query('SELECT COUNT(*) as totAttivi FROM utenti WHERE attivo=1');
    const [[{ totPersonale }]] = await db.query('SELECT COUNT(*) as totPersonale FROM personale WHERE stato="attivo"');
    const [[{ totPub }]]       = await db.query('SELECT COUNT(*) as totPub FROM pubblicazioni');
    const [[{ totNews }]]      = await db.query('SELECT COUNT(*) as totNews FROM news');
    const [[{ totEsami }]]     = await db.query('SELECT COUNT(*) as totEsami FROM esami_exams');
    const [[{ totAssegnati }]] = await db.query("SELECT COUNT(*) as totAssegnati FROM esami_exams WHERE status='ASSEGNATO'");
    const [ultimiAccessi]      = await db.query(
      'SELECT la.*, u.nome, u.cognome, u.username FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id ORDER BY la.created_at DESC LIMIT 15'
    );
    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      stats: { totUtenti, totAttivi, totPersonale, totPub, totNews, totEsami, totAssegnati },
      ultimiAccessi
    });
  } catch (e) { next(e); }
});

// ── Gestione Utenti ──────────────────────────────────────────
router.get('/utenti', async (req, res, next) => {
  try {
    const ruolo = (req.query.ruolo || '').trim();
    const q     = (req.query.q    || '').trim();
    let where = '1=1'; const params = [];
    if (ruolo) { where += ' AND ruolo=?'; params.push(ruolo); }
    if (q) {
      where += ' AND (username LIKE ? OR nome LIKE ? OR cognome LIKE ? OR email LIKE ?)';
      const like = '%' + q + '%'; params.push(like, like, like, like);
    }
    const [utenti] = await db.query(
      'SELECT id, username, nome, cognome, email, ruolo, attivo, ultimo_accesso, created_at FROM utenti WHERE ' + where + ' ORDER BY ruolo, cognome, nome',
      params
    );
    res.render('admin/utenti', { title: 'Gestione Utenti', utenti, filtri: { ruolo, q } });
  } catch (e) { next(e); }
});

// Nuovo utente
router.post('/utenti/nuovo', async (req, res, next) => {
  try {
    const { username, password, nome, cognome, email, ruolo } = req.body;
    if (!username || !password || !ruolo) {
      req.flash('error', 'Username, password e ruolo sono obbligatori.');
      return res.redirect('/admin/utenti');
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO utenti (username, password_hash, nome, cognome, email, ruolo) VALUES (?,?,?,?,?,?)',
      [username.trim(), hash, nome||'', cognome||'', email||null, ruolo]
    );
    req.flash('success', 'Utente ' + username + ' creato con successo.');
    res.redirect('/admin/utenti');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Username o email già esistente.');
      return res.redirect('/admin/utenti');
    }
    next(e);
  }
});

// Modifica utente
router.post('/utenti/:id/modifica', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nome, cognome, email, ruolo } = req.body;
    // Non permettere di cambiare il proprio ruolo
    if (id === req.session.user.id && ruolo !== req.session.user.ruolo) {
      req.flash('error', 'Non puoi cambiare il tuo stesso ruolo.');
      return res.redirect('/admin/utenti');
    }
    await db.query(
      'UPDATE utenti SET nome=?, cognome=?, email=?, ruolo=? WHERE id=?',
      [nome||'', cognome||'', email||null, ruolo, id]
    );
    req.flash('success', 'Utente aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Toggle attivo/disattivo
router.post('/utenti/:id/toggle', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) {
      req.flash('error', 'Non puoi disattivare te stesso.');
      return res.redirect('/admin/utenti');
    }
    await db.query('UPDATE utenti SET attivo = NOT attivo WHERE id=?', [id]);
    req.flash('success', 'Stato utente aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Reset password
router.post('/utenti/:id/password', async (req, res, next) => {
  try {
    const nuova = req.body.nuova_password;
    if (!nuova || nuova.length < 8) {
      req.flash('error', 'La password deve essere di almeno 8 caratteri.');
      return res.redirect('/admin/utenti');
    }
    const hash = await bcrypt.hash(nuova, 10);
    await db.query('UPDATE utenti SET password_hash=? WHERE id=?', [hash, req.params.id]);
    req.flash('success', 'Password aggiornata.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Elimina utente
router.post('/utenti/:id/elimina', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) {
      req.flash('error', 'Non puoi eliminare te stesso.');
      return res.redirect('/admin/utenti');
    }
    const [[u]] = await db.query('SELECT username FROM utenti WHERE id=?', [id]);
    await db.query('DELETE FROM utenti WHERE id=?', [id]);
    req.flash('success', 'Utente ' + (u ? u.username : id) + ' eliminato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// ── Log accessi ───────────────────────────────────────────────
router.get('/log', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 50;
    const q       = (req.query.q || '').trim();
    const esito   = (req.query.esito || '').trim();
    let where = '1=1'; const params = [];
    if (q) {
      where += ' AND (la.username_tentato LIKE ? OR la.ip_address LIKE ?)';
      const like = '%' + q + '%'; params.push(like, like);
    }
    if (esito) { where += ' AND la.esito=?'; params.push(esito); }
    const [[{ cnt }]] = await db.query('SELECT COUNT(*) as cnt FROM log_accessi la WHERE ' + where, params);
    const pages = Math.max(1, Math.ceil(cnt / perPage));
    const [righe] = await db.query(
      'SELECT la.*, u.nome, u.cognome FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id WHERE ' + where + ' ORDER BY la.created_at DESC LIMIT ? OFFSET ?',
      [...params, perPage, (page - 1) * perPage]
    );
    res.render('admin/log', { title: 'Log Accessi', righe, page, pages, filtri: { q, esito }, totale: cnt });
  } catch (e) { next(e); }
});

module.exports = router;
