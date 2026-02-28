const express = require('express');
const { requireRole } = require('../src/auth');
const { get, all, run } = require('../src/db');
const { writeAudit } = require('../src/audit');

const router = express.Router();
router.use(requireRole('student'));

function toUtcMs(sqliteDatetime) {
  // sqlite datetime('now') => "YYYY-MM-DD HH:MM:SS" (UTC)
  if (!sqliteDatetime) return null;
  const iso = String(sqliteDatetime).replace(' ', 'T') + 'Z';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Timeout enforcement (server-side, idempotente)
 */
async function ensureNotTimedOut(examId) {
  const row = await get(
    `SELECT id, status, ends_at, timed_out
     FROM exams
     WHERE id=?`,
    [examId]
  );
  if (!row) return { timedOut: false };

  // già chiuso o già timeout
  if (row.status === 'SVOLTO' || row.timed_out === 1) {
    return { timedOut: row.timed_out === 1 };
  }

  // se non avviato non può essere scaduto
  if (!row.ends_at) return { timedOut: false };

  const expired = await get(
    `SELECT 1 AS expired
     FROM exams
     WHERE id=? AND ends_at IS NOT NULL AND datetime('now') >= ends_at
     LIMIT 1`,
    [examId]
  );
  if (!expired) return { timedOut: false };

  // unanswered => errate (idempotente)
  await run(
    `UPDATE exam_questions
     SET is_correct=0
     WHERE exam_id=? AND chosen_key IS NULL AND is_correct IS NULL`,
    [examId]
  );

  // calcola score
  const totals = await get(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct
     FROM exam_questions
     WHERE exam_id=?`,
    [examId]
  );

  const total = Number(totals?.total || 0);
  const correct = Number(totals?.correct || 0);
  const score = total > 0 ? (correct / total) * 100 : 0;
  const passed = score >= 80 ? 1 : 0;

  // chiudi esame per timeout (idempotente)
  await run(
    `UPDATE exams
     SET status='SVOLTO',
         taken_at=datetime('now'),
         score_percent=?,
         passed=?,
         timed_out=1
     WHERE id=? AND status!='SVOLTO'`,
    [score, passed, examId]
  );

  return { timedOut: true };
}

/**
 * Timer data per navbar (server-side)
 */
async function buildExamTimer(examId) {
  const row = await get(
    `SELECT id, status, timed_out, ends_at,
            CAST((julianday(ends_at) - julianday(datetime('now'))) * 86400 AS INTEGER) AS remaining_seconds
     FROM exams
     WHERE id=?`,
    [examId]
  );

  if (!row) return null;
  if (!row.ends_at) return null;
  if (row.status === 'SVOLTO') return null;
  if (row.timed_out === 1) return null;

  const remaining = Number(row.remaining_seconds);
  return {
    examId,
    ends_at: row.ends_at,
    remaining_seconds: Number.isFinite(remaining) ? Math.max(0, remaining) : 0
  };
}

router.get('/', async (req, res) => {
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  res.render('student/index', { title: 'Area Allievo', student });
});

router.get('/exams', async (req, res) => {
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const rows = await all('SELECT e.* FROM exams e WHERE e.student_id=? ORDER BY e.assigned_at DESC', [student.id]);
  res.render('student/exams', { title: 'I miei esami', rows });
});

router.get('/exams/:id/start', async (req, res) => {
  const examId = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const exam = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });
  if (exam.status === 'SVOLTO') return res.redirect(`/student/exams/${examId}/result`);

  // audit start: 1 volta
  const already = await get(
    `SELECT id FROM audit_log
     WHERE action='exam.start'
       AND entity_type='exam'
       AND entity_id=?
       AND actor_user_id=?
     LIMIT 1`,
    [examId, req.session.user.id]
  );

  if (!already) {
    writeAudit(req, {
      action: 'exam.start',
      entityType: 'exam',
      entityId: examId,
      details: { student_id: student.id }
    }).catch(() => {});
  }

  // TIMER: set started_at solo se NULL
  await run(
    `UPDATE exams
     SET started_at = COALESCE(started_at, datetime('now'))
     WHERE id=?`,
    [examId]
  );

  // TIMER: set ends_at solo se NULL (basato su started_at)
  await run(
    `UPDATE exams
     SET ends_at = COALESCE(ends_at, datetime(started_at, '+' || duration_minutes || ' minutes'))
     WHERE id=?`,
    [examId]
  );

  // enforcement immediato
  const t = await ensureNotTimedOut(examId);
  if (t.timedOut) return res.redirect(`/student/exams/${examId}/timeout`);

  res.redirect(`/student/exams/${examId}/q/1`);
});

router.get('/exams/:id/timeout', async (req, res) => {
  const examId = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const exam = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });

  await ensureNotTimedOut(examId);

  const fresh = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  res.render('student/exam_timeout', { title: 'Tempo scaduto', exam: fresh });
});

router.get('/exams/:id/q/:n', async (req, res) => {
  const examId = Number(req.params.id);
  const n = Number(req.params.n);
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const exam = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });

  // enforcement timeout
  const t = await ensureNotTimedOut(examId);
  if (t.timedOut) return res.redirect(`/student/exams/${examId}/timeout`);

  if (exam.status === 'SVOLTO') return res.redirect(`/student/exams/${examId}/result`);

  const items = await all(`
    SELECT eq.id as eq_id, q.* , eq.chosen_key
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id=?
    ORDER BY eq.id
  `, [examId]);

  if (items.length === 0) return res.status(404).render('error', { title: 'Errore', message: 'Nessuna domanda trovata.' });

  if (n < 1 || n > items.length) return res.redirect(`/student/exams/${examId}/q/1`);

  // STEP 6: unanswered count
  const unanswered = items.filter(x => !x.chosen_key).length;

  // Indice domande (UX) — passiamo solo info essenziali
  const qNav = items.map((x, idx) => ({
    n: idx + 1,
    answered: !!x.chosen_key
  }));

  // timer per navbar
  const examTimer = await buildExamTimer(examId);
  const last5 = !!(examTimer && Number.isFinite(examTimer.remaining_seconds) && examTimer.remaining_seconds <= 300);

  // ✅ STEP 6.1: se sei all’ultima domanda ma mancano risposte, vai alla prima non risposta
 // ✅ STEP 6.1 (FIX): evita loop redirect quando la prima non risposta è la stessa pagina
if (n === items.length && unanswered > 0) {
  const firstUnansweredIndex = items.findIndex(x => !x.chosen_key); // 0-based
  if (firstUnansweredIndex >= 0) {
    const targetN = firstUnansweredIndex + 1; // 1-based

    // Se la prima non risposta è già questa (es. sei sull’ultima e anche lei è vuota),
    // NON redirectare (altrimenti loop infinito).
    if (targetN !== n) {
      req.flash('info', `Ti ho portato alla prima domanda non risposta (Domanda ${targetN}).`);
      return res.redirect(`/student/exams/${examId}/q/${targetN}`);
    }
  }
}

  const item = items[n - 1];

  res.render('student/exam_question', {
    title: `Esame ${examId}`,
    examId,
    n,
    total: items.length,
    item,
    examTimer,
    unanswered,
    qNav,
    last5
  });
});

router.post('/exams/:id/q/:n/answer', async (req, res) => {
  const examId = Number(req.params.id);
  const n = Number(req.params.n);
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const exam = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });

  // enforcement timeout
  const t = await ensureNotTimedOut(examId);
  if (t.timedOut) return res.redirect(`/student/exams/${examId}/timeout`);

  if (exam.status === 'SVOLTO') return res.redirect(`/student/exams/${examId}/result`);

  const items = await all(`
    SELECT eq.id as eq_id, q.correct_key
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id=?
    ORDER BY eq.id
  `, [examId]);

  const idx = n - 1;
  if (idx < 0 || idx >= items.length) return res.redirect(`/student/exams/${examId}/q/1`);

  const chosen = (req.body.choice || '').toUpperCase();
  if (chosen && !['A', 'B', 'C', 'D'].includes(chosen)) {
    req.flash('error', 'Risposta non valida.');
    return res.redirect(`/student/exams/${examId}/q/${n}`);
  }

  const correct = items[idx].correct_key;
  const isCorrect = chosen ? (chosen === correct) : null;

  await run(
    'UPDATE exam_questions SET chosen_key=?, is_correct=? WHERE id=?',
    [chosen || null, (chosen ? (isCorrect ? 1 : 0) : null), items[idx].eq_id]
  );

  // avanti
  const action = req.body.action;
  const isLast = (n >= items.length);

  // Se è l'ultima domanda e non è uno skip -> vai al finish
  if (isLast && action !== 'skip') {
    return res.redirect(`/student/exams/${examId}/finish`);
  }

  const next = n < items.length ? n + 1 : n;
  if (action === 'skip') return res.redirect(`/student/exams/${examId}/q/${next}`);
  return res.redirect(`/student/exams/${examId}/q/${next}`);
});

router.post('/exams/:id/finish', finishExam);
router.get('/exams/:id/finish',  finishExam);
async function finishExam(req, res) {
  const examId = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const exam = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });

  // se scaduto -> timeout
  const t = await ensureNotTimedOut(examId);
  if (t.timedOut) return res.redirect(`/student/exams/${examId}/timeout`);

  if (exam.status === 'SVOLTO') return res.redirect(`/student/exams/${examId}/result`);

  const items = await all(`
    SELECT eq.*, q.correct_key
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id=?
  `, [examId]);

  const unanswered = items.filter(i => !i.chosen_key).length;
  if (unanswered > 0) {
    req.flash('error', `Non puoi chiudere: mancano ${unanswered} risposte.`);
    return res.redirect(`/student/exams/${examId}/q/1`);
  }

  const correct = items.filter(i => i.is_correct === 1).length;
  const total = items.length;
  const score = (correct / total) * 100;
  const passed = score >= 80 ? 1 : 0;

  await run(
    'UPDATE exams SET status="SVOLTO", taken_at=datetime("now"), score_percent=?, passed=? WHERE id=?',
    [score, passed, examId]
  );

  // audit finish
  const startRow = await get(
    `SELECT created_at FROM audit_log
     WHERE action='exam.start'
       AND entity_type='exam'
       AND entity_id=?
       AND actor_user_id=?
     ORDER BY id ASC
     LIMIT 1`,
    [examId, req.session.user.id]
  );

  const startMs = toUtcMs(startRow?.created_at);
  const nowMs = Date.now();
  const durationSeconds = (startMs != null) ? Math.max(0, Math.round((nowMs - startMs) / 1000)) : null;

  writeAudit(req, {
    action: 'exam.finish',
    entityType: 'exam',
    entityId: examId,
    details: {
      student_id: student.id,
      total_questions: total,
      correct,
      score_percent: score,
      passed: !!passed,
      duration_seconds: durationSeconds
    }
  }).catch(() => {});

  res.redirect(`/student/exams/${examId}/result`);
}

router.get('/exams/:id/result', async (req, res) => {
  const examId = Number(req.params.id);
  const student = await get('SELECT * FROM students WHERE user_id=?', [req.session.user.id]);
  const exam = await get('SELECT * FROM exams WHERE id=? AND student_id=?', [examId, student.id]);
  if (!exam) return res.status(404).render('error', { title: 'Errore', message: 'Esame non trovato.' });

  // Feedback studente: esito + percentuale + errori/totale + errori per argomento
  const { all: allDb, get: getDb } = require('../src/db');

  // Totale domande esame
  const totals = await getDb(
    `SELECT COUNT(*) AS total_questions
     FROM exam_questions
     WHERE exam_id=?`,
    [examId]
  );
  const totalQuestions = Number(totals?.total_questions || 0);

  // Riepilogo errori per argomento (topic vuoti => "Senza argomento")
  const wrongByTopic = await allDb(`
    SELECT
      COALESCE(NULLIF(TRIM(q.topic), ''), 'Senza argomento') AS topic,
      COUNT(*) AS n_sbagliate
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
      AND (eq.is_correct = 0 OR eq.is_correct IS NULL)
    GROUP BY COALESCE(NULLIF(TRIM(q.topic), ''), 'Senza argomento')
    ORDER BY n_sbagliate DESC
  `, [examId]);

  const totalWrong = wrongByTopic.reduce((s, r) => s + Number(r.n_sbagliate || r.count || r.cnt || r.total || 0), 0);

  // Percentuale: usa quella salvata su exams se presente, altrimenti calcola
  const scorePercent = (exam.score_percent != null)
    ? Number(exam.score_percent)
    : (totalQuestions > 0 ? ((totalQuestions - totalWrong) / totalQuestions) * 100 : 0);

  // Esito: usa exam.passed se presente, altrimenti soglia 80%
  const passed = (exam.passed != null)
    ? !!exam.passed
    : (scorePercent >= 80);

  return res.render('student/exam_result', {
    title: 'Risultato esame',
    exam,
    allowReport: false,
    wrongByTopic,
    totalWrong,
    totalQuestions,
    scorePercent,
    passed
  });

});

module.exports = router;