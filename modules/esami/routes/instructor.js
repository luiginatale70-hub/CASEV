const fs = require('fs');
const path = require('path');
const os = require('os');
const pdf = require('html-pdf');


function getBrowserPath() {
  const platform = os.platform();

  if (platform === 'linux') {
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log("Browser trovato:", p);
        return p;
      }
    }

    console.error("Nessun browser trovato su Linux");
    return null;
  }

  if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }

  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  return null;
}




const express      = require('express');
const multer       = require('multer');
const XLSX         = require('xlsx');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../src/db');
const { requireRole } = require('../src/auth');
const { sendMail }     = require('../src/mailer');
const PDFDocument      = require('pdfkit');
const { formatDateIT } = require('../src/utils');
const { writeAudit }   = require('../src/audit');
const upload = multer({ dest: 'uploads/' });
const requireLogin = require('../../../middleware/requireLogin');

const router = express.Router();
router.use(requireRole('instructor', 'admin'));

const BT = '`';

router.get('/', (req, res) => res.render('instructor/index', { title: 'Area Istruttore' }));

// ── Domande ──────────────────────────────────────────────────
router.get('/questions', async (req, res) => {
  const banks = await all('SELECT qb.id,qb.exam_type,qb.created_at,(SELECT COUNT(*) FROM esami_questions q WHERE q.bank_id=qb.id) as qcount FROM esami_question_banks qb ORDER BY qb.created_at DESC');
  res.render('instructor/questions_list', { title: 'Domande caricate', banks });
});

router.get('/questions/:bankId(\\d+)', async (req, res) => {
  const bankId = Number(req.params.bankId);
  const bank = await get('SELECT * FROM esami_question_banks WHERE id=?', [bankId]);
  if (!bank) return res.status(404).render('error', { title: 'Errore', message: 'Questionario non trovato.' });
  const topicFilter = (req.query.topic || '').trim();
  let questions;
  if (topicFilter) {
    questions = await all('SELECT * FROM esami_questions WHERE bank_id=? AND topic LIKE ? ORDER BY topic, id LIMIT 500', [bankId, '%' + topicFilter + '%']);
  } else {
    questions = await all('SELECT * FROM esami_questions WHERE bank_id=? ORDER BY topic, id LIMIT 500', [bankId]);
  }
  res.render('instructor/questions_bank', { title: 'Domande - ' + bank.exam_type, bank, questions, topicFilter });
});

router.post('/questions/:bankId(\\d+)/delete', requireRole('admin'), async (req, res) => {
  await run('DELETE FROM esami_question_banks WHERE id=?', [Number(req.params.bankId)]);
  req.flash('success', 'Questionario eliminato.');
  res.redirect('/esami/instructor/questions');
});

router.get('/questions/import', requireRole('admin'), (req, res) =>
  res.render('instructor/questions_import', { title: 'Importa domande' }));

// ── Aggiungi domanda a questionario esistente ─────────────────
router.get('/questions/:bankId(\\d+)/add', requireRole('admin'), async (req, res) => {
  const bankId = Number(req.params.bankId);
  const bank = await get('SELECT * FROM esami_question_banks WHERE id=?', [bankId]);
  if (!bank) return res.status(404).render('error', { title: 'Errore', message: 'Questionario non trovato.' });
  const topicsRows = await all("SELECT DISTINCT topic FROM esami_questions WHERE bank_id=? AND topic IS NOT NULL AND TRIM(topic)<>'' ORDER BY topic", [bankId]);
  res.render('instructor/question_edit', {
    title: 'Nuova domanda',
    bank,
    q: { topic: '', question: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '', correct_key: 'A' },
    mode: 'add',
    topics: topicsRows.map(r => r.topic)
  });
});

router.post('/questions/:bankId(\\d+)/add', requireRole('admin'),
  body('question').trim().notEmpty(),
  body('opt_a').trim().notEmpty(),
  body('opt_b').trim().notEmpty(),
  body('opt_c').trim().notEmpty(),
  body('correct_key').isIn(['A', 'B', 'C', 'D']),
  async (req, res) => {
    const bankId = Number(req.params.bankId);
    const bank = await get('SELECT * FROM esami_question_banks WHERE id=?', [bankId]);
    if (!bank) return res.status(404).render('error', { title: 'Errore', message: 'Questionario non trovato.' });
    if (!validationResult(req).isEmpty()) {
      req.flash('error', 'Compila tutti i campi obbligatori.');
      return res.redirect('/esami/instructor/questions/' + bankId + '/add');
    }
    const { question, opt_a, opt_b, opt_c, correct_key } = req.body;
    const opt_d = (req.body.opt_d || '').trim() || null;
    const topic = (req.body.topic || '').trim() || null;
    await run('INSERT INTO esami_questions(bank_id,topic,question,opt_a,opt_b,opt_c,opt_d,correct_key) VALUES (?,?,?,?,?,?,?,?)',
      [bankId, topic, question.trim(), opt_a.trim(), opt_b.trim(), opt_c.trim(), opt_d, correct_key]);
    writeAudit(req, { action: 'question.add', entityType: 'question_bank', entityId: bankId, details: { topic } }).catch(() => {});
    req.flash('success', 'Domanda aggiunta.');
    res.redirect('/esami/instructor/questions/' + bankId);
  }
);

// ── Modifica domanda ─────────────────────────────────────────
router.get('/questions/:bankId(\\d+)/q/:qId(\\d+)/edit', requireRole('admin'), async (req, res) => {
  const bankId = Number(req.params.bankId), qId = Number(req.params.qId);
  const bank = await get('SELECT * FROM esami_question_banks WHERE id=?', [bankId]);
  const q = await get('SELECT * FROM esami_questions WHERE id=? AND bank_id=?', [qId, bankId]);
  if (!bank || !q) return res.status(404).render('error', { title: 'Errore', message: 'Domanda non trovata.' });
  const topicsRows = await all("SELECT DISTINCT topic FROM esami_questions WHERE bank_id=? AND topic IS NOT NULL AND TRIM(topic)<>'' ORDER BY topic", [bankId]);
  res.render('instructor/question_edit', {
    title: 'Modifica domanda',
    bank,
    q,
    mode: 'edit',
    topics: topicsRows.map(r => r.topic)
  });
});

router.post('/questions/:bankId(\\d+)/q/:qId(\\d+)/edit', requireRole('admin'),
  body('question').trim().notEmpty(),
  body('opt_a').trim().notEmpty(),
  body('opt_b').trim().notEmpty(),
  body('opt_c').trim().notEmpty(),
  body('correct_key').isIn(['A', 'B', 'C', 'D']),
  async (req, res) => {
    const bankId = Number(req.params.bankId), qId = Number(req.params.qId);
    const bank = await get('SELECT * FROM esami_question_banks WHERE id=?', [bankId]);
    const q = await get('SELECT * FROM esami_questions WHERE id=? AND bank_id=?', [qId, bankId]);
    if (!bank || !q) return res.status(404).render('error', { title: 'Errore', message: 'Domanda non trovata.' });
    if (!validationResult(req).isEmpty()) {
      req.flash('error', 'Compila tutti i campi obbligatori.');
      return res.redirect('/esami/instructor/questions/' + bankId + '/q/' + qId + '/edit');
    }
    const { question, opt_a, opt_b, opt_c, correct_key } = req.body;
    const opt_d = (req.body.opt_d || '').trim() || null;
    const topic = (req.body.topic || '').trim() || null;
    await run('UPDATE esami_questions SET topic=?,question=?,opt_a=?,opt_b=?,opt_c=?,opt_d=?,correct_key=? WHERE id=? AND bank_id=?',
      [topic, question.trim(), opt_a.trim(), opt_b.trim(), opt_c.trim(), opt_d, correct_key, qId, bankId]);
    writeAudit(req, { action: 'question.edit', entityType: 'question', entityId: qId, details: { bank_id: bankId } }).catch(() => {});
    req.flash('success', 'Domanda aggiornata.');
    res.redirect('/esami/instructor/questions/' + bankId);
  }
);

// ── Elimina singola domanda ──────────────────────────────────
router.post('/questions/:bankId(\\d+)/q/:qId(\\d+)/delete', requireRole('admin'), async (req, res) => {
  const bankId = Number(req.params.bankId), qId = Number(req.params.qId);
  await run('DELETE FROM esami_questions WHERE id=? AND bank_id=?', [qId, bankId]);
  writeAudit(req, { action: 'question.delete', entityType: 'question', entityId: qId, details: { bank_id: bankId } }).catch(() => {});
  req.flash('success', 'Domanda eliminata.');
  res.redirect('/esami/instructor/questions/' + bankId);
});

// ── Mappa sinonimi per le colonne del file Excel ─────────────
const COLUMN_ALIASES = {
  question: ['domanda', 'question', 'testo', 'quesito', 'testo domanda'],
  a:        ['a', 'opzione a', 'risposta a', 'opt_a', 'opta'],
  b:        ['b', 'opzione b', 'risposta b', 'opt_b', 'optb'],
  c:        ['c', 'opzione c', 'risposta c', 'opt_c', 'optc'],
  d:        ['d', 'opzione d', 'risposta d', 'opt_d', 'optd'],
  correct:  ['corretta', 'correct', 'risposta corretta', 'risposta esatta', 'soluzione', 'key'],
  topic:    ['argomento', 'topic', 'categoria', 'materia', 'area', 'soggetto'],
};

// Costruisce la funzione pick per una singola riga,
// normalizzando gli header una sola volta per efficienza
function buildPicker(row) {
  const headers = Object.keys(row).map(h => ({ raw: h, norm: h.trim().toLowerCase() }));
  return function pick(aliasKey) {
    const aliases = COLUMN_ALIASES[aliasKey] || [aliasKey];
    for (const alias of aliases) {
      const found = headers.find(h => h.norm === alias);
      if (found) return String(row[found.raw] ?? '').trim();
    }
    return '';
  };
}

router.post('/questions/import', requireRole('admin'), upload.single('file'),
  body('exam_type').trim().notEmpty(),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'Tipologia esame obbligatoria.'); return res.redirect('/esami/instructor/questions/import'); }
    if (!req.file) { req.flash('error', 'Seleziona un file Excel.'); return res.redirect('/esami/instructor/questions/import'); }

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const examType = req.body.exam_type.trim();
    const bank = await run('INSERT INTO esami_question_banks(exam_type,created_by_user_id) VALUES (?,?)', [examType, req.session.user.id]);

    let count = 0;
    let skipped = 0;
    const warnings = [];

    for (const [i, r] of rows.entries()) {
      const pick = buildPicker(r);

      const question = pick('question');
      const a = pick('a'), b = pick('b'), c = pick('c'), d = pick('d');
      const topic = pick('topic');
      let corr = pick('correct');

      // Riga incompleta → skip con warning (d è opzionale: si accettano domande a 3 opzioni)
      if (!question || !a || !b || !c) {
        warnings.push('Riga ' + (i + 2) + ': dati mancanti (domanda/a/b/c obbligatori), saltata.');
        skipped++;
        continue;
      }

      corr = corr.trim();
      let correct_key = null;
      const cu = corr.toUpperCase();
      // Per domande a 3 opzioni (d vuota) 'D' non è valida
      const validKeys = d ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C'];
      if (validKeys.includes(cu)) {
        correct_key = cu;
      } else {
        const opts = d ? { A: a, B: b, C: c, D: d } : { A: a, B: b, C: c };
        for (const k of Object.keys(opts)) {
          if (String(opts[k]).trim().toLowerCase() === corr.toLowerCase()) { correct_key = k; break; }
        }
        if (!correct_key) {
          warnings.push('Riga ' + (i + 2) + ': risposta corretta "' + corr + '" non riconosciuta, impostata A.');
          correct_key = 'A';
        }
      }

      await run('INSERT INTO esami_questions(bank_id,topic,question,opt_a,opt_b,opt_c,opt_d,correct_key) VALUES (?,?,?,?,?,?,?,?)', [bank.lastID, topic || null, question, a, b, c, d || null, correct_key]);
      count++;
    }

    req.flash('success', 'Import completato: ' + count + ' domande inserite per "' + examType + '"' + (skipped ? ', ' + skipped + ' righe saltate.' : '.'));
    if (warnings.length) req.flash('warning', warnings.slice(0, 10).join(' | '));

    writeAudit(req, { action: 'questions.import', entityType: 'question_bank', entityId: bank.lastID, details: { exam_type: examType, inserted: count, skipped: skipped } }).catch(() => {});
    res.redirect('/esami/instructor');
  }
);

// ── Assegna esame ────────────────────────────────────────────
router.get('/exams/assign', async (req, res) => {
const students = await all(`
  SELECT s.id, s.\`rank\`,
         u.name as name,
        u.surname as surname,
         u.email as email,
         c.name as class_name, c.command, c.category,
         COALESCE(s.role_at_assignment, "allievo") as role_at_assignment
  FROM esami_students s
  LEFT JOIN utenti u ON u.id = s.user_id
  LEFT JOIN esami_classes c ON c.id = s.class_id
  ORDER BY s.role_at_assignment, surname, name
`);
const tr = await all('SELECT DISTINCT exam_type FROM esami_question_banks ORDER BY exam_type');

res.render('instructor/exam_assign', {
  title: 'Assegna esame',
  students,
  types: tr.map(r => r.exam_type)
});
});



router.get('/exams/topics', async (req, res) => {
  const examType = String(req.query.exam_type || '').trim();
  if (!examType) return res.json({ topics: [] });
  const bankIds = (await all('SELECT id FROM esami_question_banks WHERE exam_type=?', [examType])).map(r => r.id);
  if (!bankIds.length) return res.json({ topics: [] });
  const ph = bankIds.map(() => '?').join(',');
  const rows = await all("SELECT topic,COUNT(*) as available FROM esami_questions WHERE bank_id IN (" + ph + ") AND topic IS NOT NULL AND TRIM(topic)<>'' GROUP BY topic ORDER BY topic", bankIds);
  res.json({ topics: rows.map(r => ({ topic: r.topic, available: r.available })) });
});

router.post('/exams/assign',
  body('student_id').isInt(), body('exam_type').trim().notEmpty(),
  body('num_questions').isInt({ min: 1, max: 200 }), body('duration_minutes').isInt({ min: 1, max: 120 }),
  async (req, res) => {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'Dati non validi.'); return res.redirect('/esami/instructor/exams/assign'); }
  const student = await get(`
  SELECT s.*, 
         u.name, 
         u.surname, 
         u.email
  FROM esami_students s
  LEFT JOIN utenti u ON u.id = s.user_id
  WHERE s.id=?
`, [req.body.student_id]);
    if (!student) { req.flash('error', 'Partecipante non trovato.'); return res.redirect('/esami/instructor/exams/assign'); }
    const examType = req.body.exam_type.trim(), num = Number(req.body.num_questions);
    const duration = Math.max(1, Math.min(120, Number(req.body.duration_minutes) || 120));
    let topicsCounts = [];
    try { const p = req.body.topics_counts ? JSON.parse(req.body.topics_counts) : []; if (Array.isArray(p)) topicsCounts = p.map(x => ({ topic: String(x.topic || '').trim(), count: Number(x.count || 0) })).filter(x => x.topic && x.count > 0); } catch (e) {}
    const topicList = (req.body.topics_filter || '').trim() ? (req.body.topics_filter || '').trim().split(',').map(s => s.trim()).filter(Boolean) : [];
    const bankIds = (await all('SELECT id FROM esami_question_banks WHERE exam_type=?', [examType])).map(r => r.id);
    if (!bankIds.length) { req.flash('error', 'Nessun questionario per questa tipologia.'); return res.redirect('/esami/instructor/exams/assign'); }
    const ph = bankIds.map(() => '?').join(',');
    let picked = [];
    if (topicsCounts.length) {
      const req_tot = topicsCounts.reduce((a, x) => a + x.count, 0);
      if (req_tot !== num) { req.flash('error', 'Distribuzione non valida: somma=' + req_tot + ', richieste=' + num); return res.redirect('/esami/instructor/exams/assign'); }
      for (const t of topicsCounts) { const row = await get('SELECT COUNT(*) as cnt FROM esami_questions WHERE bank_id IN (' + ph + ') AND topic=?', [...bankIds, t.topic]); if ((row ? row.cnt : 0) < t.count) { req.flash('error', 'Domande insufficienti per "' + t.topic + '"'); return res.redirect('/esami/instructor/exams/assign'); } }
      for (const t of topicsCounts) { const rows = await all('SELECT * FROM esami_questions WHERE bank_id IN (' + ph + ') AND topic=? ORDER BY RAND() LIMIT ?', [...bankIds, t.topic, t.count]); picked.push(...rows); }
      picked = picked.sort(() => Math.random() - 0.5);
    } else {
      let qSql = 'SELECT * FROM esami_questions WHERE bank_id IN (' + ph + ')'; const qP = [...bankIds];
      if (topicList.length) { qSql += ' AND topic IN (' + topicList.map(() => '?').join(',') + ')'; qP.push(...topicList); }
      qSql += ' ORDER BY RAND() LIMIT ?'; qP.push(num);
      picked = await all(qSql, qP);
    }
    if (picked.length < num) { req.flash('error', 'Domande insufficienti: trovate ' + picked.length + ', richieste ' + num); return res.redirect('/esami/instructor/exams/assign'); }
    const tLabel = topicsCounts.length ? topicsCounts.map(t => t.topic + ':' + t.count).join(',') : (topicList.join(',') || null);
    const ex = await run("INSERT INTO esami_exams(student_id,instructor_user_id,exam_type,num_questions,topics_filter,duration_minutes,status,deferred) VALUES (?,?,?,?,?,?,'ASSEGNATO',0)", [student.id, req.session.user.id, examType, num, tLabel, duration]);
    for (const q of picked) await run('INSERT INTO esami_exam_questions(exam_id,question_id) VALUES (?,?)', [ex.lastID, q.id]);

    // Recupera username e dati istruttore dal DB principale
    let studentUsername = student.email;
    let instructorEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    let instructorName  = 'Istruttore CASEV';
    try {
      const db2 = require('../../config/db');
      const [[uRow]] = await db2.query('SELECT username FROM utenti WHERE email=? LIMIT 1', [student.email]);
      if (uRow) studentUsername = uRow.username;
      const [[iRow]] = await db2.query('SELECT email, nome, cognome FROM utenti WHERE id=? LIMIT 1', [req.session.user.id]);
      if (iRow && iRow.email) {
        instructorEmail = iRow.email;
        instructorName  = (iRow.nome || '') + ' ' + (iRow.cognome || '');
      }
    } catch(e) {}

sendMail({
  to: student.email,
  from: instructorEmail,
  subject: 'CASEV - NAAF - Assegnazione Test Teorico',
  html:
    '<div style="font-family:sans-serif;max-width:600px">' +
      '<div style="background:#0b1727;padding:20px 30px">' +
        '<h2 style="color:#fff;margin:0">CASEV</h2>' +
        '<p style="color:#27bcfd;margin:4px 0 0;font-size:12px">Centro Addestramento Equipaggi di Volo</p>' +
      '</div>' +
      '<div style="padding:24px;border:1px solid #e5e7eb">' +
        '<p>Gentile <strong>' + student.name + ' ' + student.surname + '</strong>,</p>' +
        '<p>Ti e stato assegnato un test teorico:</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
          '<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Tipo</td>' +
          '<td style="padding:8px;border:1px solid #e5e7eb">' + examType + '</td></tr>' +
          '<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Domande</td>' +
          '<td style="padding:8px;border:1px solid #e5e7eb">' + num + '</td></tr>' +
          '<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Durata</td>' +
          '<td style="padding:8px;border:1px solid #e5e7eb">' + duration + ' minuti</td></tr>' +
        '</table>' +
        '<hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb">' +
        '<p><strong>Credenziali di accesso:</strong></p>' +
        '<table style="width:100%;border-collapse:collapse;margin:8px 0 16px">' +
          '<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Username</td>' +
                    '<td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace">' + (student.name.toLowerCase() + '.' + student.surname.toLowerCase()) +
 '</td></tr>' +
        '</table>' +
        '<p style="margin:24px 0 8px">Accedi al portale per svolgere il test - Inserisci la tua password di accesso al dominio guardiacostiera. </p>' +
        '<a href="http://10.142.3.123/esami/login" style="display:inline-block;background:#2c7be5;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Accedi al Test</a>' +
        '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">' +
        '<p style="color:#748194;font-size:12px">CASEV - Portale Intranet GC<br>Messaggio inviato da: ' + instructorName.trim() + ' &lt;' + instructorEmail + '&gt;</p>' +
      '</div>' +
    '</div>'
}).catch(() => {});




    
    req.flash('success', 'Esame assegnato a ' + student.name + ' ' + student.surname + ' (ID ' + ex.lastID + ').');
    writeAudit(req, { action: 'exam.assign', entityType: 'exam', entityId: ex.lastID, details: { student_id: student.id, exam_type: examType, num_questions: num } }).catch(() => {});
    res.redirect('/esami/instructor/exams');
  }
);

// ── Lista esami ───────────────────────────────────────────────
router.get('/exams', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10)), perPage = 10;
  const show = (req.query.show || 'active').trim(), q = (req.query.q || '').trim();
  const sort = (req.query.sort || (show === 'done' ? 'taken_at' : 'assigned_at')).trim();
  const dir = ((req.query.dir || 'desc').toLowerCase() === 'asc') ? 'ASC' : 'DESC';
  let where = '1=1'; const params = [];

  if (show === 'active') where += " AND e.status='ASSEGNATO'";
  else if (show === 'done') where += " AND e.status='SVOLTO'";

  if (q) {
    where += ' AND (u2.email LIKE ? OR u2.surname LIKE ?)';
    params.push('%' + q + '%', '%' + q + '%');
  }

  const sf = sort === 'taken_at' ? 'e.taken_at' : 'e.assigned_at';

const tr = await get(
  'SELECT COUNT(*) as cnt FROM esami_exams e ' +
  'JOIN esami_students s ON s.id=e.student_id ' +
  'LEFT JOIN utenti u2 ON u2.id = s.user_id ' +
  'WHERE ' + where,
  params
);
  const total = tr ? tr.cnt : 0;

  const rows = await all(
    'SELECT e.*,s.' + BT + 'rank' + BT + ',' +
    'u2.name as name,u2.surname as surname,u2.email as email,' +
    'u.email as instructor_email ' +
    'FROM esami_exams e ' +
    'JOIN esami_students s ON s.id=e.student_id ' +
    'LEFT JOIN utenti u ON u.id=e.instructor_user_id ' +
    'LEFT JOIN utenti u2 ON u2.id = s.user_id ' +
    'WHERE ' + where + ' ' +
    'ORDER BY ' + sf + ' ' + dir + ',e.id DESC LIMIT ? OFFSET ?',
    [...params, perPage, (page - 1) * perPage]
  );

  const lastAssigned = await all(
    "SELECT e.*,s." + BT + "rank" + BT + "," +
    "u2.name as name,u2.surname as surname " +
    "FROM esami_exams e " +
    "JOIN esami_students s ON s.id=e.student_id " +
    "LEFT JOIN utenti u2 ON u2.id = s.user_id " +
    "WHERE e.status='ASSEGNATO' " +
    "ORDER BY e.assigned_at DESC,e.id DESC LIMIT 3"
  );

  res.render('instructor/exams', {
    title: 'Esami',
    rows,
    page,
    pages: Math.ceil(total / perPage),
    q,
    show,
    sort,
    dir: dir.toLowerCase(),
    formatDateIT,
    lastAssigned
  });
});

router.post('/exams/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const exam = await get('SELECT * FROM esami_exams WHERE id=?', [id]);
  if (!exam) { req.flash('error', 'Esame non trovato.'); return res.redirect('/esami/instructor/exams'); }
  if (exam.status !== 'ASSEGNATO') { req.flash('error', 'Non puoi eliminare un esame già svolto.'); return res.redirect('/esami/instructor/exams'); }
  await run('DELETE FROM esami_exams WHERE id=?', [id]);
  req.flash('success', 'Esame eliminato.');
  res.redirect('/esami/instructor/exams');
});

const QRCode = require('qrcode');
const ejs = require('ejs');

router.get('/exams/:id/report.pdf', requireLogin, async (req, res) => {

// Disabilita PDF su Linux (PhantomJS non funziona su Ubuntu 24)
if (process.platform === "linux") {
    return res.status(501).send("La generazione del PDF non è disponibile su Linux.");
}

  const id = Number(req.params.id);

const exam = await get(`
  SELECT e.*, s.rank,
         u2.name as name,
         u2.surname as surname,
         u2.email AS student_email,
         u.email AS instructor_email
  FROM esami_exams e
  JOIN esami_students s ON s.id = e.student_id
  LEFT JOIN utenti u ON u.id = e.instructor_user_id
  LEFT JOIN utenti u2 ON u2.id = s.user_id
  WHERE e.id = ?
`, [id]);

  if (!exam) {
    return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });
  }

  const items = await all(`
    SELECT eq.*, q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d,
           q.correct_key, q.topic
    FROM esami_exam_questions eq
    JOIN esami_questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.id
  `, [id]);

  // Carica logo e convertilo in base64
 const logoPath = path.join(__dirname, '../../public/img/logo_capitanerie.png');

  const logoBase64 = fs.readFileSync(logoPath).toString('base64');

  // Genera QR code con ID esame
  const qrBase64 = await QRCode.toDataURL(`https://casev.mit.gov.it/esami/${id}`);

  // Render HTML
  const html = await ejs.renderFile(
  path.join(__dirname, '../../../views/pdf/exam_report.ejs'),
  { exam, items, logoBase64, qrBase64 }
);


  // Genera PDF con html-pdf
console.log("HTML LENGTH:", html.length);

const options = {
  format: 'A4',
  border: {
    top: "20mm",
    right: "10mm",
    bottom: "20mm",
    left: "10mm"
  }
};

const forceDownload = req.query.download === '1';

// Genera PDF con html-pdf
pdf.create(html, options).toBuffer((err, buffer) => {
  if (err) {
    console.error("Errore PDF:", err);
    return res.status(500).send("Errore generazione PDF");
  }

  // Salva il PDF su disco per test
  const outputPath = path.join(__dirname, `report_${id}.pdf`);
  fs.writeFileSync(outputPath, buffer);
  console.log("PDF salvato in:", outputPath);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Accept-Ranges', 'bytes');

  if (forceDownload) {
    res.setHeader('Content-Disposition', `attachment; filename="esame_${id}.pdf"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="esame_${id}.pdf"`);
  }

  return res.send(buffer);
});   // chiude pdf.create

});   // chiude la route (IMPORTANTISSIMO)

module.exports = router;
