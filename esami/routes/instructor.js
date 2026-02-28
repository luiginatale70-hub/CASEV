const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../src/db');
const { requireRole } = require('../src/auth');
const { sendMail } = require('../src/mailer');
const PDFDocument = require('pdfkit');
const { formatDateIT } = require('../src/utils');

const upload = multer({ dest: 'uploads/' });
const { writeAudit } = require('../src/audit');
const router = express.Router();
router.use(requireRole('instructor','admin'));

router.get('/', (req, res) => res.render('instructor/index', { title: 'Area Istruttore' }));

router.get('/questions', async (req, res) => {
  const banks = await all(`
    SELECT qb.id, qb.exam_type, qb.created_at,
           (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) as qcount
    FROM question_banks qb
    ORDER BY qb.created_at DESC
  `);
  res.render('instructor/questions_list', { title: 'Domande caricate', banks });
});

router.get('/questions/:bankId(\\d+)', async (req, res) => {
  const bankId = Number(req.params.bankId);
  const bank = await get('SELECT * FROM question_banks WHERE id=?', [bankId]);
  if (!bank) return res.status(404).render('error', { title: 'Errore', message: 'Questionario non trovato.' });
  const questions = await all('SELECT * FROM questions WHERE bank_id=? ORDER BY id DESC LIMIT 500', [bankId]);
  res.render('instructor/questions_bank', { title: `Domande - ${bank.exam_type}`, bank, questions });
});

router.post('/questions/:bankId(\\d+)/delete', requireRole('admin'), async (req, res) => {
  const bankId = Number(req.params.bankId);
  await run('DELETE FROM question_banks WHERE id=?', [bankId]); // cascata su questions
  req.flash('success', 'Questionario eliminato.');
  res.redirect('/instructor/questions');
});

router.get('/questions/import', requireRole('admin'), (req, res) => res.render('instructor/questions_import', { title: 'Importa domande' }));

router.post('/questions/import', requireRole('admin'), upload.single('file'),
  body('exam_type').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Tipologia esame obbligatoria.');
      return res.redirect('/instructor/questions/import');
    }
    if (!req.file) {
      req.flash('error', 'Seleziona un file Excel.');
      return res.redirect('/instructor/questions/import');
    }

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    function pick(row, key) {
      const k = Object.keys(row).find(h => String(h).trim().toLowerCase() === key);
      return k ? String(row[k]).trim() : '';
    }

    const examType = req.body.exam_type.trim();
    const bank = await run('INSERT INTO question_banks(exam_type, created_by_user_id) VALUES (?,?)', [examType, req.session.user.id]);

    let count = 0;
    for (const r of rows) {
      const question = pick(r, 'domanda') || pick(r, 'question');
      const a = pick(r, 'a'); const b = pick(r, 'b'); const c = pick(r, 'c'); const d = pick(r, 'd');
      const topic = pick(r, 'argomento');
      let corr = pick(r, 'corretta');

      if (!question || !a || !b || !c || !d) continue;

      corr = String(corr || '').trim();
      let correct_key = null;
      const corrUp = corr.toUpperCase();
      if (['A','B','C','D'].includes(corrUp)) correct_key = corrUp;
      else {
        const opts = { A: a, B: b, C: c, D: d };
        for (const k of Object.keys(opts)) {
          if (String(opts[k]).trim().toLowerCase() === corr.trim().toLowerCase()) correct_key = k;
        }
        if (!correct_key) correct_key = 'A';
      }

      await run(`
        INSERT INTO questions(bank_id, topic, question, opt_a, opt_b, opt_c, opt_d, correct_key)
        VALUES (?,?,?,?,?,?,?,?)
      `, [bank.lastID, topic || null, question, a, b, c, d, correct_key]);
      count++;
    }

    req.flash('success', `Import completato: ${count} domande inserite per tipologia "${examType}".`);

    writeAudit(req, {
      action: 'questions.import',
      entityType: 'question_bank',
      entityId: bank.lastID,
      details: { exam_type: examType, inserted: count }
    }).catch(()=>{});
    res.redirect('/instructor');
  }
);

router.get('/exams/assign', async (req, res) => {
  const students = await all(`
    SELECT s.id, s.rank, s.name, s.surname, s.email, c.name as class_name, c.command, c.category
    FROM students s LEFT JOIN classes c ON c.id=s.class_id
    ORDER BY s.surname, s.name
  `);
  const typesRows = await all('SELECT DISTINCT exam_type FROM question_banks ORDER BY exam_type');
  const types = typesRows.map(r=>r.exam_type);
  res.render('instructor/exam_assign', { title: 'Assegna esame', students, types });
});

router.get('/exams/topics', async (req, res) => {
  const examType = String(req.query.exam_type || '').trim();
  if (!examType) return res.json({ topics: [] });

  const bankIds = (await all('SELECT id FROM question_banks WHERE exam_type=?', [examType])).map(r => r.id);
  if (!bankIds.length) return res.json({ topics: [] });

  const placeholders = bankIds.map(() => '?').join(',');
  const rows = await all(
    'SELECT topic, COUNT(*) as available ' +
    'FROM questions ' +
    'WHERE bank_id IN (' + placeholders + ') ' +
    "AND topic IS NOT NULL AND TRIM(topic) <> '' " +
    'GROUP BY topic ' +
    'ORDER BY topic',
    bankIds
  );

  res.json({ topics: rows.map(r => ({ topic: r.topic, available: r.available })) });
});

router.post('/exams/assign',
  body('student_id').isInt(),
  body('exam_type').trim().notEmpty(),
  body('num_questions').isInt({ min: 1, max: 200 }),
    body('duration_minutes').isInt({ min: 1, max: 120 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'Dati non validi.');
      return res.redirect('/instructor/exams/assign');
    }
    const student = await get('SELECT * FROM students WHERE id=?', [req.body.student_id]);
    if (!student) {
      req.flash('error', 'Allievo non trovato.');
      return res.redirect('/instructor/exams/assign');
    }

    const examType = req.body.exam_type.trim();
    const num = Number(req.body.num_questions);
    const topics = (req.body.topics_filter || '').trim();
const durationMinutesRaw = Number(req.body.duration_minutes);
const durationMinutes = Number.isFinite(durationMinutesRaw)
  ? Math.max(1, Math.min(120, durationMinutesRaw))
  : 120;
    // Distribuzione domande per argomento (UI tabella)
    const topicsCountsRaw = (req.body.topics_counts || '').trim();
    let topicsCounts = [];
    try {
      const parsed = topicsCountsRaw ? JSON.parse(topicsCountsRaw) : [];
      if (Array.isArray(parsed)) {
        topicsCounts = parsed
          .map(x => ({ topic: String(x.topic || '').trim(), count: Number(x.count || 0) }))
          .filter(x => x.topic && Number.isFinite(x.count) && x.count > 0);
      }
    } catch (e) {
      topicsCounts = [];
    }


    const topicList = topics ? topics.split(',').map(s=>s.trim()).filter(Boolean) : [];

    const bankIds = (await all('SELECT id FROM question_banks WHERE exam_type=?', [examType])).map(r=>r.id);
    if (bankIds.length === 0) {
      req.flash('error', 'Nessun questionario caricato per questa tipologia.');
      return res.redirect('/instructor/exams/assign');
    }
    // Se l'istruttore ha impostato una distribuzione per argomento, la rispettiamo.
    // Altrimenti fallback: filtro per topicList (vecchio campo) oppure random su tutto.
    let picked = [];

    if (topicsCounts.length) {
      const requested = topicsCounts.reduce((a, x) => a + x.count, 0);
      if (requested !== num) {
        req.flash('error', `Distribuzione non valida: somma argomenti ${requested}, richieste ${num} domande.`);
        return res.redirect('/instructor/exams/assign');
      }

      const placeholders = bankIds.map(() => '?').join(',');
      for (const t of topicsCounts) {
        const row = await get(
          'SELECT COUNT(*) as cnt FROM questions WHERE bank_id IN (' + placeholders + ') AND topic=?',
          [...bankIds, t.topic]
        );
        const cnt = row ? row.cnt : 0;
        if (cnt < t.count) {
          req.flash('error', `Domande insufficienti per "${t.topic}": trovate ${cnt}, richieste ${t.count}.`);
          return res.redirect('/instructor/exams/assign');
        }
      }

      for (const t of topicsCounts) {
        const rows = await all(
          'SELECT * FROM questions WHERE bank_id IN (' + placeholders + ') AND topic=? ORDER BY RANDOM() LIMIT ?',
          [...bankIds, t.topic, t.count]
        );
        picked.push(...rows);
      }

      picked = picked.sort(() => Math.random() - 0.5);

    } else {
      let qSql = `SELECT * FROM questions WHERE bank_id IN (${bankIds.map(()=>'?').join(',')})`;
      const qParams = [...bankIds];
      if (topicList.length) {
        qSql += ` AND topic IN (${topicList.map(()=>'?').join(',')})`;
        qParams.push(...topicList);
      }
      qSql += ' ORDER BY RANDOM() LIMIT ?';
      qParams.push(num);

      picked = await all(qSql, qParams);
    }
    if (picked.length < num) {
      req.flash('error', `Domande insufficienti: trovate ${picked.length}, richieste ${num}.`);
      return res.redirect('/instructor/exams/assign');
    }

    const ex = await run(`
  INSERT INTO exams(student_id,instructor_user_id,exam_type,num_questions,topics_filter,duration_minutes,status,deferred)
  VALUES (?,?,?,?,?,?,'ASSEGNATO',0)
`, [student.id, req.session.user.id, examType, num, (topicsCounts.length ? topicsCounts.map(t => `${t.topic}:${t.count}`).join(',') : (topicList.join(',') || null)), durationMinutes]);
    for (const q of picked) {
      await run('INSERT INTO exam_questions(exam_id,question_id) VALUES (?,?)', [ex.lastID, q.id]);
    }

    // --- Email content (enhanced) ---
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const assignedAt = new Date().toLocaleString('it-IT');

const studentName = [student?.surname, student?.name].filter(Boolean).join(' ').trim() || `ID ${student.id}`;
const topicsLabel = (topicsCounts && topicsCounts.length)
  ? topicsCounts.map(t => `${t.topic}: ${t.count}`).join(', ')
  : (topicList && topicList.length ? topicList.join(', ') : '—');

sendMail({
  to: student.email,
  subject: 'Portale NAAF - Esame assegnato',
  html: [
    '<div style="font-family: Arial, sans-serif; font-size: 14px; color: #222; line-height: 1.4;">',
    '<p style="margin:0 0 12px 0;"><b>Ti è stato assegnato un nuovo esame.</b></p>',
    '<div style="margin:0 0 12px 0; padding: 12px; border:1px solid #eee; border-radius: 6px;">',
    `<div><b>Studente:</b> ${esc(studentName)}</div>`,
    `<div><b>Tipologia:</b> ${esc(examType)}</div>`,
    `<div><b>Numero domande:</b> ${esc(num)}</div>`,
    `<div><b>Durata:</b> ${esc(durationMinutes)} minuti</div>`,
    `<div><b>Argomenti:</b> ${esc(topicsLabel)}</div>`,
    `<div><b>Assegnato il:</b> ${esc(assignedAt)}</div>`,
    '</div>',
    `<p style="margin:0 0 12px 0;"><a href="${baseUrl}" style="display:inline-block; padding:10px 16px; background:#0b5ed7; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">Apri il Portale NAAF</a></p>`,
    `<p style="margin:0; font-size:12px; color:#666;">In alternativa copia e incolla questo link nel browser:<br/>${esc(baseUrl)}</p>`,
    '</div>',
  ].join('\n')
}).catch(()=>{});req.flash('success', `Esame assegnato (ID ${ex.lastID}).`);

    writeAudit(req, {
      action: 'exam.assign',
      entityType: 'exam',
      entityId: ex.lastID,
      details: { student_id: student.id, exam_type: examType, num_questions: num, duration_minutes: durationMinutes }
    }).catch(()=>{});
    res.redirect('/instructor/exams');
  }
);

router.get('/exams', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = 10;

  // show: active (default) | done | all
  const show = (req.query.show || 'active').trim();
  const q = (req.query.q || '').trim();

  // sort: assigned_at | taken_at
  const sort = (req.query.sort || (show === 'done' ? 'taken_at' : 'assigned_at')).trim();
  const dir = ((req.query.dir || 'desc').toLowerCase() === 'asc') ? 'asc' : 'desc';

  let where = '1=1';
  const params = [];

  // default: only pending/in progress
  if (show === 'active') {
    where += " AND e.status='ASSEGNATO'";
  } else if (show === 'done') {
    where += " AND e.status='SVOLTO'";
  }

  // search: only surname or email
  if (q) {
    where += ' AND (s.email LIKE ? OR s.surname LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const sortField = (sort === 'taken_at') ? 'e.taken_at' : 'e.assigned_at';
  const orderBy = `${sortField} ${dir.toUpperCase()}, e.id DESC`;

  const totalRow = await get(`
    SELECT COUNT(*) as cnt
    FROM exams e
    JOIN students s ON s.id = e.student_id
    WHERE ${where}
  `, params);
  const total = totalRow ? totalRow.cnt : 0;

  const rows = await all(`
    SELECT e.*, s.rank, s.name, s.surname, s.email,
           u.email as instructor_email
    FROM exams e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN users u ON u.id = e.instructor_user_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [...params, perPage, (page-1)*perPage]);

  // Ultimi 3 esami in attesa di svolgimento (sempre visibili in cima)
  const lastAssigned = await all(`
    SELECT e.*, s.rank, s.name, s.surname
    FROM exams e
    JOIN students s ON s.id = e.student_id
    WHERE e.status = 'ASSEGNATO'
    ORDER BY e.assigned_at DESC, e.id DESC
    LIMIT 3
  `, []);

  res.render('instructor/exams', {
    title: 'Esami',
    rows, page, pages: Math.ceil(total/perPage),
    q, show, sort, dir,
    formatDateIT, lastAssigned
  });
});


router.post('/exams/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const exam = await get('SELECT * FROM exams WHERE id=?', [id]);
  if (!exam) {
    req.flash('error', 'Esame non trovato.');
    return res.redirect('/instructor/exams');
  }
  if (exam.status !== 'ASSEGNATO') {
    req.flash('error', 'Non puoi eliminare un esame già svolto.');
    return res.redirect('/instructor/exams');
  }
  await run('DELETE FROM exams WHERE id=?', [id]);
  req.flash('success', 'Esame eliminato.');
  res.redirect('/instructor/exams');
});

router.get('/exams/:id/report.pdf', async (req, res) => {
  const id = Number(req.params.id);
  const exam = await get(`
    SELECT e.*, s.rank, s.name, s.surname, s.email as student_email,
           u.email as instructor_email
    FROM exams e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN users u ON u.id = e.instructor_user_id
    WHERE e.id=?
  `, [id]);

  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });

  const items = await all(`
    SELECT eq.*, q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.correct_key, q.topic
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id=?
    ORDER BY eq.id
  `, [id]);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="naaf_exam_${id}.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text('PORTALE NAAF - Report Esame', { align: 'center' });
  doc.moveDown();

  doc.fontSize(11);
  doc.text(`ID Esame: ${exam.id}`);
  doc.text(`Allievo: ${exam.rank} ${exam.surname} ${exam.name} (${exam.student_email})`);
  doc.text(`Tipologia: ${exam.exam_type}`);
  doc.text(`Stato: ${exam.status}`);
  doc.text(`Data assegnazione: ${formatDateIT(exam.assigned_at)}`);
  doc.text(`Data effettuazione: ${formatDateIT(exam.taken_at) || '-'}`);
  doc.text(`Risultato: ${exam.score_percent != null ? Number(exam.score_percent).toFixed(1) + '%' : '-'}`);
  doc.text(`Esito: ${exam.passed ? 'PROMOSSO' : (exam.status === 'SVOLTO' ? 'RESPINTO' : '-')}`);
  doc.text(`Istruttore: ${exam.instructor_email || '-'}`);
  doc.moveDown();

  doc.fontSize(13).text('Dettaglio domande', { underline: true });
  doc.moveDown(0.5);

  items.forEach((it, idx) => {
    doc.fontSize(11).text(`${idx+1}. ${it.question}`);
    doc.fontSize(10).text(`A) ${it.opt_a}`);
    doc.fontSize(10).text(`B) ${it.opt_b}`);
    doc.fontSize(10).text(`C) ${it.opt_c}`);
    doc.fontSize(10).text(`D) ${it.opt_d}`);
    doc.fontSize(10).text(`Corretta: ${it.correct_key} | Risposta: ${it.chosen_key || '-'} | Esito: ${it.is_correct ? 'OK' : 'ERR'}`);
    if (it.topic) doc.fontSize(9).text(`Argomento: ${it.topic}`);
    doc.moveDown(0.7);
  });

  doc.end();
});

module.exports = router;