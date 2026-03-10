// ── RESET PASSWORD ────────────────────────────────────────────
const crypto = require('crypto');
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
    req.flash('success', "Se l'email e registrata riceverai le istruzioni a breve.");
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
  const token = (req.body.token || '').trim();
  const password = (req.body.password || '').trim();
  const confirm = (req.body.confirm || '').trim();
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
