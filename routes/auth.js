// routes/auth.js — CASEV
// Autenticazione ibrida:
//   - utenti con auth_type='ldap'  → verifica su Active Directory
//   - utenti con auth_type='local' → verifica su password_hash DB (comportamento originale)

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const ldap     = require('ldapjs');
const db       = require('../config/db');

// ── LDAP ─────────────────────────────────────────────────────
const LDAP_SERVERS = [
  'ldaps://10.142.80.40:636',
  'ldaps://10.142.80.62:636',
  'ldaps://10.142.80.44:636',
];

function ldapAuthenticate(username, password) {
  const upn = username.includes('@') ? username : `${username}@guardiacostiera.local`;

  const tryServer = (index) => new Promise((resolve, reject) => {
    if (index >= LDAP_SERVERS.length) {
      return reject(new Error('Nessun server LDAP raggiungibile'));
    }
    const client = ldap.createClient({
      url: LDAP_SERVERS[index],
      timeout: 5000,
      connectTimeout: 5000,
      tlsOptions: { rejectUnauthorized: false },
    });
    client.on('error', () => {
      tryServer(index + 1).then(resolve).catch(reject);
    });
    client.bind(upn, password, (err) => {
      client.unbind(() => {});
      if (!err) return resolve(true);
      if (err.code === 49) {
        const e = new Error('CREDENZIALI_NON_VALIDE');
        e.code = 49;
        return reject(e);
      }
      tryServer(index + 1).then(resolve).catch(reject);
    });
  });

  return tryServer(0);
}

// ── GET /auth/login ───────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.query.timeout) req.flash('error', 'Sessione scaduta per inattività. Accedi di nuovo.');
  res.render('auth/login', { layout: 'auth', title: 'Accesso — CASEV' });
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const ua = req.get('user-agent') || '';

  if (!username || !password) {
    req.flash('error', 'Inserisci username e password.');
    return res.redirect('/auth/login');
  }

  try {
    // STEP 1: Cerca utente nel DB
    const [[utente]] = await db.query(
      'SELECT * FROM utenti WHERE username=? AND attivo=1', [username]
    );

    if (!utente) {
      await db.query(
        'INSERT INTO log_accessi (utente_id, username_tentato, ip_address, user_agent, esito) VALUES (?,?,?,?,"fallito")',
        [null, username, ip, ua]
      );
      req.flash('error', 'Credenziali non valide.');
      return res.redirect('/auth/login');
    }

    // STEP 2: Verifica password in base al tipo di autenticazione
    const authType = utente.auth_type || 'local'; // default 'local' per retrocompatibilità
    let autenticato = false;

    if (authType === 'ldap') {
      // ── Utente di dominio → verifica su Active Directory ──
      try {
        await ldapAuthenticate(username, password);
        autenticato = true;
      } catch (ldapErr) {
        if (ldapErr.message === 'CREDENZIALI_NON_VALIDE') {
          // Password AD sbagliata
          await db.query(
            'INSERT INTO log_accessi (utente_id, username_tentato, ip_address, user_agent, esito) VALUES (?,?,?,?,"fallito")',
            [utente.id, username, ip, ua]
          );
          req.flash('error', 'Credenziali non valide.');
          return res.redirect('/auth/login');
        }
        // DC non raggiungibili → fallback su password locale se presente
        console.warn(`[AUTH] LDAP non raggiungibile per "${username}", fallback locale`);
        autenticato = utente.password_hash
          ? await bcrypt.compare(password, utente.password_hash)
          : false;
      }
    } else {
      // ── Utente locale → verifica su password_hash DB (comportamento originale) ──
      autenticato = utente.password_hash
        ? await bcrypt.compare(password, utente.password_hash)
        : false;
    }

    if (!autenticato) {
      await db.query(
        'INSERT INTO log_accessi (utente_id, username_tentato, ip_address, user_agent, esito) VALUES (?,?,?,?,"fallito")',
        [utente.id, username, ip, ua]
      );
      req.flash('error', 'Credenziali non valide.');
      return res.redirect('/auth/login');
    }

    // STEP 3: Login riuscito
    await db.query('UPDATE utenti SET ultimo_accesso=NOW() WHERE id=?', [utente.id]);
    await db.query(
      'INSERT INTO log_accessi (utente_id, username_tentato, ip_address, user_agent, esito) VALUES (?,?,?,?,"successo")',
      [utente.id, username, ip, ua]
    );

    // Sincronizzazione automatica esami_students al login
    if (['efv', 'istruttore', 'admin', 'gestore'].includes(utente.ruolo)) {
      try {
        const roleEsami = ['istruttore', 'admin', 'gestore'].includes(utente.ruolo) ? 'instructor' : 'efv';
        await db.query(
          'INSERT INTO esami_students (user_id, `rank`, name, surname, email, role_at_assignment) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), surname=VALUES(surname), email=VALUES(email), `rank`=VALUES(`rank`), role_at_assignment=VALUES(role_at_assignment)',
          [
          utente.id,
          utente.grado   || '',
          utente.nome    || '',
          utente.cognome || '',
          utente.email   || '',
          roleEsami
        ]);
      } catch (syncErr) {
        console.warn('[AUTH] Sync esami_students fallita per utente', utente.id, syncErr && syncErr.message);
      }
    }

    const ROLE_MAP = {
      admin: 'admin', admin_esami: 'admin',
      gestore: 'instructor', istruttore: 'instructor',
      efv: 'student'
    };

    const userData = {
      id:       utente.id,
      username: utente.username,
      nome:     utente.nome,
      cognome:  utente.cognome,
      email:    utente.email || null,
      ruolo:    utente.ruolo,
      role:     ROLE_MAP[utente.ruolo] || 'student'
    };

    req.session.regenerate((err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Errore sessione. Riprovare.');
        return res.redirect('/auth/login');
      }
      req.session.user = userData;
      req.flash('success', `Benvenuto, ${utente.nome}!`);
      res.redirect('/');
    });

  } catch (err) {
    console.error('[AUTH] Errore interno:', err);
    req.flash('error', 'Errore interno. Riprovare.');
    res.redirect('/auth/login');
  }
});

// ── GET /auth/logout ──────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

router.get('/ping', (req, res) => res.json({ ok: true }));

// ── RESET PASSWORD (invariato) ────────────────────────────────
const crypto      = require('crypto');
const bcryptReset = require('bcryptjs');

router.get('/reset-password', (req, res) => {
  res.render('auth/reset_request', { layout: 'auth', title: 'Reimposta Password' });
});

router.post('/reset-password', async (req, res, next) => {
  const email = (req.body.email || '').trim().toLowerCase();
  try {
    const [[utente]] = await db.query('SELECT id, nome FROM utenti WHERE email=? AND attivo=1', [email]);
    if (utente) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 7200000);
      await db.query('DELETE FROM password_reset_tokens WHERE utente_id=?', [utente.id]);
      await db.query('INSERT INTO password_reset_tokens (utente_id, token, expires_at) VALUES (?,?,?)', [utente.id, token, expires]);
      const resetLink = 'http://10.142.3.123/auth/reset-password/confirm?token=' + token;
      try {
        const mailer = require('../esami/src/mailer');
        await mailer.sendMail({
          to: email,
          subject: 'CASEV - Reimposta la tua password',
          html: '<div style="font-family:sans-serif;max-width:600px"><div style="background:#0b1727;padding:20px 30px"><h2 style="color:#fff;margin:0">CASEV</h2></div><div style="padding:24px;border:1px solid #e5e7eb"><p>Gentile <strong>' + utente.nome + '</strong>,</p><p>Clicca per reimpostare la password:</p><p><a href="' + resetLink + '" style="display:inline-block;background:#2c7be5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Reimposta Password</a></p><p style="color:#748194;font-size:12px">Il link scade tra 2 ore.</p></div></div>'
        });
      } catch(e) { console.warn('[reset] mail:', e.message); }
    }
    req.flash('success', "Se l'email è registrata riceverai le istruzioni a breve.");
    res.redirect('/auth/reset-password');
  } catch(err) { next(err); }
});

router.get('/reset-password/confirm', async (req, res, next) => {
  const token = (req.query.token || '').trim();
  try {
    const [[row]] = await db.query('SELECT * FROM password_reset_tokens WHERE token=? AND used=0 AND expires_at > NOW()', [token]);
    if (!row) return res.render('auth/reset_confirm', { layout: 'auth', title: 'Link non valido', token: null, error: 'Link non valido o scaduto.' });
    res.render('auth/reset_confirm', { layout: 'auth', title: 'Nuova Password', token, error: null });
  } catch(err) { next(err); }
});

router.post('/reset-password/confirm', async (req, res, next) => {
  const token    = (req.body.token    || '').trim();
  const password = (req.body.password || '').trim();
  const confirm  = (req.body.confirm  || '').trim();
  if (!password || password.length < 8) return res.render('auth/reset_confirm', { layout: 'auth', title: 'Nuova Password', token, error: 'Password minimo 8 caratteri.' });
  if (password !== confirm) return res.render('auth/reset_confirm', { layout: 'auth', title: 'Nuova Password', token, error: 'Le password non coincidono.' });
  try {
    const [[row]] = await db.query('SELECT * FROM password_reset_tokens WHERE token=? AND used=0 AND expires_at > NOW()', [token]);
    if (!row) return res.render('auth/reset_confirm', { layout: 'auth', title: 'Link non valido', token: null, error: 'Link non valido o scaduto.' });
    const hash = await bcryptReset.hash(password, 12);
    await db.query('UPDATE utenti SET password_hash=? WHERE id=?', [hash, row.utente_id]);
    await db.query('UPDATE password_reset_tokens SET used=1 WHERE id=?', [row.id]);
    req.flash('success', 'Password aggiornata. Accedi con le nuove credenziali.');
    res.redirect('/auth/login');
  } catch(err) { next(err); }
});

module.exports = router;
