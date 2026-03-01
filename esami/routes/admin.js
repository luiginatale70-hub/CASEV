const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../src/db');
const { requireRole, requireAnyRole } = require('../src/auth');

const { randomPassword } = require('../src/utils');
const { sendMail, isConfigured } = require('../src/mailer');

const router = express.Router();
router.use(requireAnyRole('admin','instructor'));



router.get('/', async (req, res) => {
  // Dashboard admin (overview)
  const [
    classesTotal,
    studentsTotal,
    examsTotal,
    assignmentsTotal,
    takenTotal,
    inProgressTotal,
    timedOutTotal,
    accessRows,
    auditRows
  ] = await Promise.all([
    get('SELECT COUNT(*) AS c FROM classes'),
    get('SELECT COUNT(*) AS c FROM students'),
    get('SELECT COUNT(*) AS c FROM exams'),
    get("SELECT COUNT(*) AS c FROM exams WHERE status='ASSEGNATO'"),
    get("SELECT COUNT(*) AS c FROM exams WHERE status='SVOLTO'"),
    get("SELECT COUNT(*) AS c FROM exams WHERE started_at IS NOT NULL AND taken_at IS NULL AND timed_out=0"),
    get('SELECT COUNT(*) AS c FROM exams WHERE timed_out=1'),
    all('SELECT * FROM access_log ORDER BY rowid DESC LIMIT 20'),
    all('SELECT * FROM audit_log ORDER BY rowid DESC LIMIT 20')
  ]);

  res.render('admin/dashboard', {
    title: 'Dashboard Admin',
    stats: {
      classesTotal: classesTotal.c,
      studentsTotal: studentsTotal.c,
      examsTotal: examsTotal.c,
      assignmentsTotal: assignmentsTotal.c,
      takenTotal: takenTotal.c,
      inProgressTotal: inProgressTotal.c,
      timedOutTotal: timedOutTotal.c
    },
    accessRows,
    auditRows
  });
});



router.get('/classes', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = 20;
  const q = (req.query.q || '').trim();

  const whereParts = [];
  const params = [];

  if (q) {
    whereParts.push('(name LIKE ? OR command LIKE ? OR category LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const where = whereParts.length ? whereParts.join(' AND ') : '1=1';

  const totalRow = await get(`SELECT COUNT(*) AS cnt FROM classes WHERE ${where}`, params);
  const total = totalRow ? totalRow.cnt : 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);

  const classes = await all(
    `SELECT * FROM classes WHERE ${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
    [...params, perPage, (safePage - 1) * perPage]
  );

  res.render('admin/classes', {
    title: 'Gestione classi',
    classes,
    q,
    page: safePage,
    pages,
    total
  });
});

router.get('/classes/new', (req, res) => res.render('admin/class_new', { title: 'Nuova classe' }));

router.post('/classes/new',
  body('command').trim().notEmpty(),
  body('category').isIn(['Piloti','Operatori di volo','Tecnici di volo']),
  body('name').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Dati non validi.');
      return res.redirect('/esami/admin/classes/new');
    }
    await run('INSERT INTO classes(command,category,name,created_by_user_id) VALUES (?,?,?,?)',
      [req.body.command, req.body.category, req.body.name, req.session.user.id]
    );
    req.flash('success', 'Classe creata.');
    res.redirect('/esami/admin/classes');
  }
);

router.get('/instructors/new', (req, res) => res.render('admin/instructor_new', { title: 'Nuovo istruttore' }));

router.post('/instructors/new',
  body('email').isEmail(),
  body('name').trim().notEmpty(),
  body('surname').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Dati non validi.');
      return res.redirect('/esami/admin/instructors/new');
    }
    const email = req.body.email.toLowerCase();
    const exists = await get('SELECT id FROM users WHERE email=?', [email]);
    if (exists) {
      req.flash('error', 'Email già presente.');
      return res.redirect('/esami/admin/instructors/new');
    }
    const temp = randomPassword(10);
    const hash = bcrypt.hashSync(temp, 12);
    const u = await run('INSERT INTO users(role,email,password_hash,must_change_password) VALUES (?,?,?,1)', ['instructor', email, hash]);
    await run('INSERT INTO instructors(user_id,name,surname) VALUES (?,?,?)', [u.lastID, req.body.name, req.body.surname]);

    await sendMail({
      to: email,
      subject: 'Portale NAAF - Credenziali provvisorie',
      html: `<p>Sei stato registrato come <b>ISTRUTTORE</b>.</p>
             <p>Login: <b>${email}</b><br/>Password provvisoria: <b>${temp}</b></p>
             <p>Al primo accesso ti verrà richiesto di cambiare password.</p>`
    });

    if (!isConfigured()) {
      req.flash('info', `SMTP non attivo: password provvisoria per ${email} = ${temp}`);
    }

    req.flash('success', 'Istruttore creato. Se SMTP è configurato correttamente, l\'email è stata inviata.');
    res.redirect('/esami/admin');
  }
);


router.get('/students', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = 20;
  const command = (req.query.command || '').trim();
  const category = (req.query.category || '').trim();
  const q = (req.query.q || '').trim();

  let where = '1=1';
  const params = [];

  if (command) { where += ' AND c.command = ?'; params.push(command); }
  if (category) { where += ' AND c.category = ?'; params.push(category); }

  if (q) {
    where += ' AND (s.rank LIKE ? OR s.name LIKE ? OR s.surname LIKE ? OR s.email LIKE ? OR s.qualification LIKE ? OR c.name LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }

  const totalRow = await get(`
    SELECT COUNT(*) as cnt
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE ${where}
  `, params);
  const total = totalRow ? totalRow.cnt : 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);

  const rows = await all(`
    SELECT s.*, c.name as class_name, c.command, c.category
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE ${where}
    ORDER BY (s.created_at IS NULL), s.created_at DESC, s.rowid DESC
    LIMIT ? OFFSET ?
  `, [...params, perPage, (safePage-1)*perPage]);

  const commandsRows = await all('SELECT DISTINCT command FROM classes ORDER BY command');
  const commands = commandsRows.map(r => r.command);

  res.render('admin/students', {
    title: 'Gestione allievi',
    rows,
    page: safePage,
    pages,
    total,
    filters: { command, category, q },
    commands
  });
});

router.get('/students/new', async (req, res) => {
  const classes = await all('SELECT * FROM classes ORDER BY command, category, name');
  res.render('admin/student_new', { title: 'Nuovo allievo', classes });
});

router.post('/students/new',
  body('email').isEmail(),
  body('rank').trim().notEmpty(),
  body('name').trim().notEmpty(),
  body('surname').trim().notEmpty(),
  async (req, res) => {
    console.log('POST students/new - body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Dati non validi.');
      return res.redirect('/esami/admin/students/new');
    }
    const email = req.body.email.toLowerCase();
    const exists = await get('SELECT id FROM users WHERE email=?', [email]);
    if (exists) {
      req.flash('error', 'Email già presente.');
      return res.redirect('/esami/admin/students/new');
    }
    const temp = randomPassword(10);
    const hash = bcrypt.hashSync(temp, 12);
    const u = await run('INSERT INTO users(role,email,password_hash,must_change_password) VALUES (?,?,?,1)', ['student', email, hash]);

    await run('INSERT INTO students(user_id,rank,name,surname,qualification,email,class_id) VALUES (?,?,?,?,?,?,?)',
      [u.lastID, req.body.rank, req.body.name, req.body.surname, req.body.qualification || '', email, req.body.class_id || null]
    );

    await sendMail({
      to: email,
      subject: 'Portale NAAF - Password provvisoria',
      html: `<p>Sei stato registrato come <b>ALLIEVO</b>.</p>
             <p>Login: <b>${email}</b><br/>Password provvisoria: <b>${temp}</b></p>
             <p>Al primo accesso ti verrà richiesto di cambiare password.</p>`
    });

    if (!isConfigured()) {
      req.flash('info', `SMTP non attivo: password provvisoria per ${email} = ${temp}`);
    }

    req.flash('success', 'Allievo creato. Se SMTP è configurato correttamente, l\'email è stata inviata.');
    res.redirect('/esami/admin/students');
  }
);

router.get('/students/:id/edit', async (req, res) => {
  const id = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE id=?', [id]);
  if (!student) return res.status(404).render('error', { title: 'Errore', message: 'Allievo non trovato.' });
  const classes = await all('SELECT * FROM classes ORDER BY command, category, name');
  res.render('admin/student_edit', { title: 'Modifica allievo', student, classes });
});

router.post('/students/:id/edit',
  body('rank').trim().notEmpty(),
  body('name').trim().notEmpty(),
  body('surname').trim().notEmpty(),
  async (req, res) => {
    const id = Number(req.params.id);
    const student = await get('SELECT * FROM students WHERE id=?', [id]);
    if (!student) {
      req.flash('error', 'Allievo non trovato.');
      return res.redirect('/esami/admin/students');
    }
    await run('UPDATE students SET rank=?, name=?, surname=?, qualification=?, class_id=? WHERE id=?',
      [req.body.rank, req.body.name, req.body.surname, req.body.qualification || '', req.body.class_id || null, id]
    );
    req.flash('success', 'Dati aggiornati.');
    res.redirect('/esami/admin/students');
  }
);

router.post('/students/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE id=?', [id]);
  if (student) {
    await run('DELETE FROM users WHERE id=?', [student.user_id]);
  }
  req.flash('success', 'Allievo cancellato.');
  res.redirect('/esami/admin/students');
});

router.post('/students/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE id=?', [id]);
  if (!student) {
    req.flash('error', 'Allievo non trovato.');
    return res.redirect('/esami/admin/students');
  }
  const temp = randomPassword(10);
  const hash = bcrypt.hashSync(temp, 12);
  await run('UPDATE users SET password_hash=?, must_change_password=1 WHERE id=?', [hash, student.user_id]);

  await sendMail({
    to: student.email,
    subject: 'Portale NAAF - Reset password',
    html: `<p>È stata generata una nuova password provvisoria.</p>
           <p>Login: <b>${student.email}</b><br/>Password provvisoria: <b>${temp}</b></p>`
  });

  if (!isConfigured()) {
    req.flash('info', `SMTP non attivo: nuova password provvisoria per ${student.email} = ${temp}`);
  }

  req.flash('success', 'Password resettata. Se SMTP è configurato correttamente, l\'email è stata inviata.');
  res.redirect('/esami/admin/students');
});

// --- LOGS (solo admin) ---

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // RFC4180-ish: quote when needed; double internal quotes
  const needsQuotes = /[\",\n\r;]/.test(s);
  const out = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return needsQuotes ? `\"${out.replace(/\"/g, '\"\"')}\"` : out;
}

function parsePage(n) {
  const p = parseInt(n || '1', 10);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function buildAccessWhere(q) {
  const filters = {
    event: (q.event || '').trim(),
    q: (q.q || '').trim(),
    from: (q.from || '').trim(),
    to: (q.to || '').trim(),
  };

  let where = '1=1';
  const params = [];

  if (filters.event) {
    where += ' AND event = ?';
    params.push(filters.event);
  }
  if (filters.q) {
    where += ` AND (
      (email LIKE ?) OR (ip LIKE ?) OR (user_agent LIKE ?) OR (CAST(user_id AS TEXT) LIKE ?)
    )`;
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.from) {
    where += ' AND date(created_at) >= date(?)';
    params.push(filters.from);
  }
  if (filters.to) {
    where += ' AND date(created_at) <= date(?)';
    params.push(filters.to);
  }

  return { where, params, filters };
}

function buildAuditWhere(q) {
  const filters = {
    action: (q.action || '').trim(),
    actor: (q.actor || '').trim(),
    entity_type: (q.entity_type || '').trim(),
    entity_id: (q.entity_id || '').trim(),
    q: (q.q || '').trim(),
    from: (q.from || '').trim(),
    to: (q.to || '').trim(),
  };

  let where = '1=1';
  const params = [];

  if (filters.action) {
    where += ' AND action LIKE ?';
    params.push(`%${filters.action}%`);
  }
  if (filters.actor) {
    where += ' AND CAST(actor_user_id AS TEXT) = ?';
    params.push(filters.actor);
  }
  if (filters.entity_type) {
    where += ' AND entity_type LIKE ?';
    params.push(`%${filters.entity_type}%`);
  }
  if (filters.entity_id) {
    where += ' AND CAST(entity_id AS TEXT) = ?';
    params.push(filters.entity_id);
  }
  if (filters.q) {
    where += ` AND (
      (ip LIKE ?) OR (user_agent LIKE ?) OR (details_json LIKE ?)
    )`;
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  if (filters.from) {
    where += ' AND date(created_at) >= date(?)';
    params.push(filters.from);
  }
  if (filters.to) {
    where += ' AND date(created_at) <= date(?)';
    params.push(filters.to);
  }

  return { where, params, filters };
}

router.get('/access', requireRole('admin'), async (req, res) => {
  const page = parsePage(req.query.page);
  const perPage = 50;
  const { where, params, filters } = buildAccessWhere(req.query);

  const totalRow = await get(`SELECT COUNT(*) as cnt FROM access_log WHERE ${where}`, params);
  const total = totalRow ? totalRow.cnt : 0;
  const pages = Math.max(1, Math.ceil(total / perPage));

  const rows = await all(`
    SELECT *
    FROM access_log
    WHERE ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `, [...params, perPage, (page - 1) * perPage]);

  res.render('admin/access_log', { title: 'Log accessi', rows, page, pages, filters });
});

router.get('/audit', requireRole('admin'), async (req, res) => {
  const page = parsePage(req.query.page);
  const perPage = 50;
  const { where, params, filters } = buildAuditWhere(req.query);

  const totalRow = await get(`SELECT COUNT(*) as cnt FROM audit_log WHERE ${where}`, params);
  const total = totalRow ? totalRow.cnt : 0;
  const pages = Math.max(1, Math.ceil(total / perPage));

  const rows = await all(`
    SELECT *
    FROM audit_log
    WHERE ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `, [...params, perPage, (page - 1) * perPage]);

  res.render('admin/audit_log', { title: 'Storico audit', rows, page, pages, filters });
});

// --- EXPORT CSV (solo admin) ---
router.get('/access.csv', requireRole('admin'), async (req, res) => {
  const { where, params } = buildAccessWhere(req.query);
  // hard cap per evitare export enormi (sicurezza + performance)
  const rows = await all(`
    SELECT id, created_at, user_id, email, event, ip, user_agent, details_json
    FROM access_log
    WHERE ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT 5000
  `, params);

  const header = ['id','created_at','user_id','email','event','ip','user_agent','details_json'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(k => csvEscape(r[k])).join(','));
  }

  const filename = `access_log_${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
  // BOM UTF-8 per Excel
  res.send('\ufeff' + lines.join('\r\n'));
});

router.get('/audit.csv', requireRole('admin'), async (req, res) => {
  const { where, params } = buildAuditWhere(req.query);
  const rows = await all(`
    SELECT id, created_at, actor_user_id, actor_role, action, entity_type, entity_id, ip, user_agent, details_json
    FROM audit_log
    WHERE ${where}
    ORDER BY datetime(created_at) DESC
    LIMIT 5000
  `, params);

  const header = ['id','created_at','actor_user_id','actor_role','action','entity_type','entity_id','ip','user_agent','details_json'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(k => csvEscape(r[k])).join(','));
  }

  const filename = `audit_log_${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
  res.send('\ufeff' + lines.join('\r\n'));
});


// ── GET /esami/admin/classes/:id/edit ────────────────────────
router.get('/classes/:id/edit', async (req, res) => {
  const id = Number(req.params.id);
  const cls = await get('SELECT * FROM classes WHERE id=?', [id]);
  if (!cls) {
    req.flash('error', 'Classe non trovata.');
    return res.redirect('/esami/admin/classes');
  }
  res.render('admin/class_edit', { title: 'Modifica classe', cls });
});

// ── POST /esami/admin/classes/:id/edit ───────────────────────
router.post('/classes/:id/edit',
  body('name').trim().notEmpty(),
  body('command').trim().notEmpty(),
  body('category').isIn(['Piloti','Operatori di volo','Tecnici di volo']),
  async (req, res) => {
    const id = Number(req.params.id);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Dati non validi. Tutti i campi sono obbligatori.');
      return res.redirect('/esami/admin/classes/' + id + '/edit');
    }
    const cls = await get('SELECT * FROM classes WHERE id=?', [id]);
    if (!cls) {
      req.flash('error', 'Classe non trovata.');
      return res.redirect('/esami/admin/classes');
    }
    await run(
      'UPDATE classes SET name=?, command=?, category=? WHERE id=?',
      [req.body.name.trim(), req.body.command.trim(), req.body.category.trim(), id]
    );
    req.flash('success', 'Classe aggiornata con successo.');
    res.redirect('/esami/admin/classes');
  }
);

// ── POST /esami/admin/classes/:id/delete ─────────────────────
router.post('/classes/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const cls = await get('SELECT * FROM classes WHERE id=?', [id]);
  if (!cls) {
    req.flash('error', 'Classe non trovata.');
    return res.redirect('/esami/admin/classes');
  }
  await run('UPDATE students SET class_id=NULL WHERE class_id=?', [id]);
  await run('DELETE FROM classes WHERE id=?', [id]);
  req.flash('success', 'Classe "' + cls.name + '" eliminata. Gli allievi sono stati sganciati.');
  res.redirect('/esami/admin/classes');
});
// Alias: gestione esami (route instructor)
router.get('/exams', (req, res) => res.redirect('/instructor/exams'));

module.exports = router;
