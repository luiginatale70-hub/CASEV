// routes/admin.js
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

function randomPassword(len = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let p = '';
  for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

function buildUsername(cognome, nome) {
  return (nome.trim() + '.' + cognome.trim())
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'').replace(/[^a-z0-9._-]/g,'');
}

// ── Dashboard ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [[{ totPiloti }]]    = await db.query("SELECT COUNT(*) as totPiloti FROM utenti WHERE categoria='Piloti' AND attivo=1");
    const [[{ totOperatori }]] = await db.query("SELECT COUNT(*) as totOperatori FROM utenti WHERE categoria='Operatori di volo' AND attivo=1");
    const [[{ totTecnici }]]   = await db.query("SELECT COUNT(*) as totTecnici FROM utenti WHERE categoria='Tecnici di volo' AND attivo=1");
    const [[{ totAssegnati }]] = await db.query("SELECT COUNT(*) as totAssegnati FROM esami_exams WHERE status='ASSEGNATO'");
    const [[{ totSvolti }]]    = await db.query("SELECT COUNT(*) as totSvolti FROM esami_exams WHERE status='SVOLTO'");
    const [[{ totNews }]]      = await db.query('SELECT COUNT(*) as totNews FROM news');
    const [[{ totPub }]]       = await db.query('SELECT COUNT(*) as totPub FROM pubblicazioni');
    const [ultimiAccessi]      = await db.query(
      'SELECT la.*, u.nome, u.cognome FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id ORDER BY la.created_at DESC LIMIT 15'
    );
    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      stats: { totPiloti, totOperatori, totTecnici, totAssegnati, totSvolti, totNews, totPub },
      ultimiAccessi
    });
  } catch (e) { next(e); }
});

// ── Lista utenti ─────────────────────────────────────────────
router.get('/utenti', async (req, res, next) => {
  try {
    const ruolo     = (req.query.ruolo     || '').trim();
    const categoria = (req.query.categoria || '').trim();
    const q         = (req.query.q         || '').trim();
    let where = '1=1'; const params = [];
    if (ruolo)     { where += ' AND ruolo=?';     params.push(ruolo); }
    if (categoria) { where += ' AND categoria=?'; params.push(categoria); }
    if (q) {
      where += ' AND (username LIKE ? OR nome LIKE ? OR cognome LIKE ? OR email LIKE ? OR grado LIKE ? OR matricola LIKE ?)';
      const like = '%' + q + '%';
      params.push(like, like, like, like, like, like);
    }
    const [utenti] = await db.query(
      'SELECT * FROM utenti WHERE ' + where + ' ORDER BY categoria, cognome, nome', params
    );
    const [gradi] = await db.query('SELECT * FROM gradi WHERE attivo=1 ORDER BY ordine, descrizione');
    res.render('admin/utenti', { title: 'Personale EFV', utenti, filtri: { ruolo, categoria, q }, gradi });
  } catch (e) { next(e); }
});

// ── Nuovo utente ─────────────────────────────────────────────
router.post('/utenti/nuovo', async (req, res, next) => {
  try {
    const { nome, cognome, email, ruolo, categoria, grado, matricola,
            sede_assegnazione, qualifica, data_nascita, luogo_nascita, telefono, note } = req.body;

    if (!nome || !cognome || !email || !ruolo) {
      req.flash('error', 'Nome, cognome, email e ruolo sono obbligatori.');
      return res.redirect('/admin/utenti');
    }
    const emailClean = email.trim().toLowerCase();
    const [[existing]] = await db.query('SELECT id FROM utenti WHERE email=?', [emailClean]);
    if (existing) { req.flash('error', 'Email già presente.'); return res.redirect('/admin/utenti'); }

    let baseUser = buildUsername(cognome, nome);
    let username = baseUser; let suffix = 1;
    while (true) {
      const [[dup]] = await db.query('SELECT id FROM utenti WHERE username=?', [username]);
      if (!dup) break;
      username = baseUser + suffix++;
    }

    const tempPassword = randomPassword(10);
    const hash = await bcrypt.hash(tempPassword, 12);

    const [r] = await db.query(
      `INSERT INTO utenti (username, password_hash, nome, cognome, email, ruolo, categoria, grado,
        matricola, sede_assegnazione, qualifica, data_nascita, luogo_nascita, telefono, note, stato, attivo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'attivo',1)`,
      [username, hash, nome.trim(), cognome.trim(), emailClean, ruolo,
       categoria||null, grado||null, matricola||null, sede_assegnazione||null,
       qualifica||null, data_nascita||null, luogo_nascita||null, telefono||null, note||null]
    );
    const userId = r.insertId;

    // Crea record personale
    try {
      const catMap = { 'Piloti':'pilota', 'Operatori di volo':'operatore', 'Tecnici di volo':'tecnico' };
      await db.query(
        `INSERT INTO personale (matricola, cognome, nome, grado, categoria, qualifica,
         data_nascita, luogo_nascita, sede_assegnazione, stato, email_istituzionale, telefono, note, utente_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [matricola||('USR'+userId), cognome.trim(), nome.trim(), grado||null,
         catMap[categoria]||'pilota', qualifica||null, data_nascita||null,
         luogo_nascita||null, sede_assegnazione||null, 'attivo', emailClean,
         telefono||null, note||null, userId]
      );
    } catch(e) { console.warn('[admin] personale:', e.message); }

    // Crea esami_students
    if (ruolo !== 'admin') {
      const roleAt = ruolo === 'istruttore' ? 'instructor' : 'efv';
      try {
        await db.query(
          'INSERT INTO esami_students (user_id,`rank`,name,surname,email,role_at_assignment) VALUES (?,?,?,?,?,?)',
          [userId, grado||'', nome.trim(), cognome.trim(), emailClean, roleAt]
        );
      } catch(e) { console.warn('[admin] esami_students:', e.message); }
    }

    req.flash('success', `${cognome} ${nome} creato — Username: ${username} — Password: ${tempPassword}`);
    res.redirect('/admin/utenti');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') { req.flash('error', 'Username o email già esistente.'); return res.redirect('/admin/utenti'); }
    next(e);
  }
});

// ── Modifica utente ───────────────────────────────────────────
router.post('/utenti/:id/modifica', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nome, cognome, email, ruolo, categoria, grado, specializzazione, matricola, sede_assegnazione, qualifica, telefono } = req.body;
    if (id === req.session.user.id && ruolo !== req.session.user.ruolo) {
      req.flash('error', 'Non puoi cambiare il tuo stesso ruolo.');
      return res.redirect('/admin/utenti');
    }
    await db.query(
      `UPDATE utenti SET nome=?,cognome=?,email=?,ruolo=?,categoria=?,grado=?,specializzazione=?,matricola=?,sede_assegnazione=?,qualifica=?,telefono=? WHERE id=?`,
      [nome||'', cognome||'', email||null, ruolo, categoria||null, grado||null, specializzazione||null, matricola||null, sede_assegnazione||null, qualifica||null, telefono||null, id]
    );
    await db.query('UPDATE esami_students SET `rank`=?,name=?,surname=?,email=? WHERE user_id=?',
      [grado||'', nome||'', cognome||'', email||'', id]);
    await db.query(
      `UPDATE personale SET nome=?,cognome=?,grado=?,email_istituzionale=?,
       matricola=?,sede_assegnazione=?,qualifica=?,telefono=? WHERE utente_id=? OR email_istituzionale=?`,
      [nome||'', cognome||'', grado||null, email||null,
       matricola||null, sede_assegnazione||null, qualifica||null, telefono||null,
       id, email||'']
    );
    req.flash('success', 'Utente aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// ── Toggle attivo ─────────────────────────────────────────────
router.post('/utenti/:id/toggle', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) { req.flash('error', 'Non puoi disattivare te stesso.'); return res.redirect('/admin/utenti'); }
    await db.query('UPDATE utenti SET attivo = NOT attivo WHERE id=?', [id]);
    req.flash('success', 'Stato aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// ── Reset password ────────────────────────────────────────────
router.post('/utenti/:id/password', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const nuova = req.body.nuova_password;
    if (!nuova || nuova.length < 8) { req.flash('error', 'Password minimo 8 caratteri.'); return res.redirect('/admin/utenti'); }
    const hash = await bcrypt.hash(nuova, 12);
    await db.query('UPDATE utenti SET password_hash=? WHERE id=?', [hash, id]);
    req.flash('success', 'Password aggiornata: ' + nuova);
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// ── Elimina utente ────────────────────────────────────────────
router.post('/utenti/:id/elimina', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) { req.flash('error', 'Non puoi eliminare te stesso.'); return res.redirect('/admin/utenti'); }
    const [[u]] = await db.query('SELECT username FROM utenti WHERE id=?', [id]);
    await db.query('DELETE FROM esami_students WHERE user_id=?', [id]);
    await db.query('UPDATE personale SET utente_id=NULL WHERE utente_id=?', [id]);
    await db.query('DELETE FROM utenti WHERE id=?', [id]);
    req.flash('success', 'Utente ' + (u?.username || id) + ' eliminato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// ── GRADI — lista ─────────────────────────────────────────────
router.get('/gradi', async (req, res, next) => {
  try {
    const [gradi] = await db.query('SELECT * FROM gradi ORDER BY ordine, descrizione');
    res.render('admin/gradi', { title: 'Gestione Gradi', gradi });
  } catch (e) { next(e); }
});

// ── GRADI — nuovo ─────────────────────────────────────────────
router.post('/gradi/nuovo', async (req, res, next) => {
  try {
    const { codice, descrizione, categoria, ordine } = req.body;
    if (!codice || !descrizione) { req.flash('error', 'Codice e descrizione obbligatori.'); return res.redirect('/admin/gradi'); }
    await db.query(
      'INSERT INTO gradi (codice, descrizione, categoria, ordine) VALUES (?,?,?,?)',
      [codice.trim(), descrizione.trim(), categoria||'Tutti', Number(ordine)||0]
    );
    req.flash('success', 'Grado aggiunto.');
    res.redirect('/admin/gradi');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') { req.flash('error', 'Codice già esistente.'); return res.redirect('/admin/gradi'); }
    next(e);
  }
});

// ── GRADI — modifica ──────────────────────────────────────────
router.post('/gradi/:id/modifica', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { codice, specializzazione, descrizione, categoria, ordine, attivo } = req.body;
    await db.query(
      'UPDATE gradi SET codice=?,descrizione=?,categoria=?,ordine=?,attivo=? WHERE id=?',
      [codice.trim(), descrizione.trim(), categoria||'Tutti', Number(ordine)||0, attivo?1:0, id]
    );
    req.flash('success', 'Grado aggiornato.');
    res.redirect('/admin/gradi');
  } catch (e) { next(e); }
});

// ── GRADI — elimina ───────────────────────────────────────────
router.post('/gradi/:id/elimina', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.query('DELETE FROM gradi WHERE id=?', [id]);
    req.flash('success', 'Grado eliminato.');
    res.redirect('/admin/gradi');
  } catch (e) { next(e); }
});

// ── Log accessi ───────────────────────────────────────────────
router.get('/log', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page||'1',10)), perPage = 50;
    const q = (req.query.q||'').trim(), esito = (req.query.esito||'').trim();
    let where = '1=1'; const params = [];
    if (q) { where += ' AND (la.username_tentato LIKE ? OR la.ip_address LIKE ?)'; const l='%'+q+'%'; params.push(l,l); }
    if (esito) { where += ' AND la.esito=?'; params.push(esito); }
    const [[{ cnt }]] = await db.query('SELECT COUNT(*) as cnt FROM log_accessi la WHERE ' + where, params);
    const pages = Math.max(1, Math.ceil(cnt/perPage));
    const [righe] = await db.query(
      'SELECT la.*, u.nome, u.cognome FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id WHERE ' + where + ' ORDER BY la.created_at DESC LIMIT ? OFFSET ?',
      [...params, perPage, (page-1)*perPage]
    );
    res.render('admin/log', { title: 'Log Accessi', righe, page, pages, filtri: { q, esito }, totale: cnt });
  } catch (e) { next(e); }
});


// â”€â”€ AUDIT & ACCESSI (log unificati) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/accessi', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page||'1',10));
    const perPage = 50;
    const q = (req.query.q||'').trim();
    let where = '1=1'; const params = [];
    if (q) { where += ' AND (email LIKE ? OR ip LIKE ? OR event LIKE ?)'; const l='%'+q+'%'; params.push(l,l,l); }
    const [[{cnt}]] = await db.query('SELECT COUNT(*) as cnt FROM esami_access_log WHERE '+where, params);
    const pages = Math.max(1, Math.ceil(cnt/perPage));
    const [rows] = await db.query(
      'SELECT * FROM esami_access_log WHERE '+where+' ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [...params, perPage, (page-1)*perPage]
    );
    res.render('admin/accessi', { title: 'Log Accessi Esami', rows, page, pages, q, totale: cnt });
  } catch(e) { next(e); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page||'1',10));
    const perPage = 50;
    const q = (req.query.q||'').trim();
    let where = '1=1'; const params = [];
    if (q) { where += ' AND (action LIKE ? OR actor_role LIKE ? OR entity_type LIKE ?)'; const l='%'+q+'%'; params.push(l,l,l); }
    const [[{cnt}]] = await db.query('SELECT COUNT(*) as cnt FROM esami_audit_log WHERE '+where, params);
    const pages = Math.max(1, Math.ceil(cnt/perPage));
    const [rows] = await db.query(
      'SELECT * FROM esami_audit_log WHERE '+where+' ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [...params, perPage, (page-1)*perPage]
    );
    res.render('admin/audit', { title: 'Audit Log Esami', rows, page, pages, q, totale: cnt });
  } catch(e) { next(e); }
});

router.get('/accessi/csv', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM esami_access_log ORDER BY created_at DESC LIMIT 5000');
    let csv = 'ID,UserID,Email,Evento,IP,Data\n';
    rows.forEach(r => {
      csv += `${r.id},"${r.user_id||''}","${r.email||''}","${r.event||''}","${r.ip||''}","${r.created_at}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="accessi.csv"');
    res.send(csv);
  } catch(e) { next(e); }
});

router.get('/audit/csv', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM esami_audit_log ORDER BY created_at DESC LIMIT 5000');
    let csv = 'ID,AttoreID,Ruolo,Azione,Entita,EntitaID,IP,Data\n';
    rows.forEach(r => {
      csv += `${r.id},"${r.actor_user_id||''}","${r.actor_role||''}","${r.action||''}","${r.entity_type||''}","${r.entity_id||''}","${r.ip||''}","${r.created_at}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit.csv"');
    res.send(csv);
  } catch(e) { next(e); }
});

router.get('/log/csv', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT la.*, u.nome, u.cognome FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id ORDER BY la.created_at DESC LIMIT 5000');
    let csv = 'ID,Utente,Username,IP,Esito,Data\n';
    rows.forEach(r => {
      csv += `${r.id},"${r.cognome||''} ${r.nome||''}","${r.username_tentato||''}","${r.ip_address||''}","${r.esito}","${r.created_at}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="log_accessi.csv"');
    res.send(csv);
  } catch(e) { next(e); }
});
module.exports = router;



