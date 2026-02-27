// routes/auth.js
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const db       = require('../config/db');

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.render('auth/login', { layout: 'auth', title: 'Accesso — CASEV' });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const ua = req.get('user-agent') || '';

  try {
    const [[utente]] = await db.query(
      'SELECT * FROM utenti WHERE username=? AND attivo=1', [username]
    );

    if (!utente || !(await bcrypt.compare(password, utente.password_hash))) {
      // Log fallito
      await db.query(
        'INSERT INTO log_accessi (utente_id, username_tentato, ip_address, user_agent, esito) VALUES (?, ?, ?, ?, "fallito")',
        [utente?.id || null, username, ip, ua]
      );
      req.flash('error', 'Credenziali non valide.');
      return res.redirect('/auth/login');
    }

    // Aggiorna ultimo accesso
    await db.query('UPDATE utenti SET ultimo_accesso=NOW() WHERE id=?', [utente.id]);

    // Log successo
    await db.query(
      'INSERT INTO log_accessi (utente_id, username_tentato, ip_address, user_agent, esito) VALUES (?, ?, ?, ?, "successo")',
      [utente.id, username, ip, ua]
    );

    req.session.user = {
      id: utente.id,
      username: utente.username,
      nome: utente.nome,
      cognome: utente.cognome,
      ruolo: utente.ruolo
    };

    req.flash('success', `Benvenuto, ${utente.nome}!`);
    res.redirect('/');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Errore interno. Riprovare.');
    res.redirect('/auth/login');
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

// ── Utility: crea hash password (solo admin, da CLI) ──────────
// node -e "require('./routes/auth').hashPassword('mia_password')"
async function hashPassword(pwd) {
  const h = await bcrypt.hash(pwd, 10);
  console.log('Hash:', h);
  return h;
}
module.exports = router;
module.exports.hashPassword = hashPassword;
