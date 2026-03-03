const express = require('express');
const { requireRole } = require('../src/auth');
const { get, all, run } = require('../src/db');
const { writeAudit }   = require('../src/audit');

const router = express.Router();
router.use(requireRole('student'));

async function ensureNotTimedOut(examId) {
  const row = await get('SELECT id,status,ends_at,timed_out FROM esami_exams WHERE id=?',[examId]);
  if(!row) return {timedOut:false};
  if(row.status==='SVOLTO'||row.timed_out===1) return {timedOut:row.timed_out===1};
  if(!row.ends_at) return {timedOut:false};
  const expired=await get('SELECT 1 AS expired FROM esami_exams WHERE id=? AND ends_at IS NOT NULL AND NOW()>=ends_at LIMIT 1',[examId]);
  if(!expired) return {timedOut:false};
  await run('UPDATE esami_exam_questions SET is_correct=0 WHERE exam_id=? AND chosen_key IS NULL AND is_correct IS NULL',[examId]);
  const totals=await get('SELECT COUNT(*) AS total,SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct FROM esami_exam_questions WHERE exam_id=?',[examId]);
  const total=Number(totals&&totals.total||0),correct=Number(totals&&totals.correct||0);
  const score=total>0?(correct/total)*100:0,passed=score>=80?1:0;
  await run("UPDATE esami_exams SET status='SVOLTO',taken_at=NOW(),score_percent=?,passed=?,timed_out=1 WHERE id=? AND status!='SVOLTO'",[score,passed,examId]);
  return {timedOut:true};
}

async function buildExamTimer(examId) {
  const row=await get('SELECT id,status,timed_out,ends_at,TIMESTAMPDIFF(SECOND,NOW(),ends_at) AS remaining_seconds FROM esami_exams WHERE id=?',[examId]);
  if(!row||!row.ends_at||row.status==='SVOLTO'||row.timed_out===1) return null;
  return {examId:row.id,endsAt:row.ends_at,remainingSeconds:Math.max(0,Number(row.remaining_seconds||0))};
}

router.get('/',async(req,res)=>{
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  if(!student) return res.render('student/index',{title:'Area Allievo',student:null,exams:[]});
  const exams=await all("SELECT * FROM esami_exams WHERE student_id=? ORDER BY assigned_at DESC LIMIT 10",[student.id]);
  res.render('student/index',{title:'Area Allievo',student,exams});
});

router.post('/exams/:id/start',async(req,res)=>{
  const examId=Number(req.params.id);
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  const exam=await get('SELECT * FROM esami_exams WHERE id=? AND student_id=?',[examId,student.id]);
  if(!exam) return res.status(404).render('error',{title:'Errore',message:'Esame non trovato.'});
  if(exam.status==='SVOLTO') return res.redirect('/student/exams/'+examId+'/result');
  if(!exam.started_at){
    const endsAt=new Date(Date.now()+exam.duration_minutes*60000);
    await run('UPDATE esami_exams SET started_at=NOW(),ends_at=? WHERE id=?',[endsAt,examId]);
    writeAudit(req,{action:'exam.start',entityType:'exam',entityId:examId,details:{student_id:student.id}}).catch(()=>{});
  }
  res.redirect('/student/exams/'+examId+'/q/1');
});

router.get('/exams/:id/q/:n',async(req,res)=>{
  const examId=Number(req.params.id),n=Number(req.params.n);
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  const exam=await get('SELECT * FROM esami_exams WHERE id=? AND student_id=?',[examId,student.id]);
  if(!exam) return res.status(404).render('error',{title:'Errore',message:'Esame non trovato.'});
  const t=await ensureNotTimedOut(examId);
  if(t.timedOut) return res.redirect('/student/exams/'+examId+'/timeout');
  if(exam.status==='SVOLTO') return res.redirect('/student/exams/'+examId+'/result');
  if(!exam.started_at) return res.redirect('/student/exams/'+examId+'/start');
  const items=await all('SELECT eq.id as eq_id,eq.chosen_key,eq.is_correct,q.question,q.opt_a,q.opt_b,q.opt_c,q.opt_d,q.topic FROM esami_exam_questions eq JOIN esami_questions q ON q.id=eq.question_id WHERE eq.exam_id=? ORDER BY eq.id',[examId]);
  if(n<1||n>items.length) return res.redirect('/student/exams/'+examId+'/q/1');
  const examTimer=await buildExamTimer(examId);
  const unanswered=items.filter(i=>!i.chosen_key).length;
  const qNav=items.map((it,idx)=>({n:idx+1,answered:!!it.chosen_key}));
  const last5=items.slice(Math.max(0,n-3),n+2).map((it,i)=>({n:Math.max(1,n-2)+i,answered:!!it.chosen_key}));
  res.render('student/exam_question',{title:'Esame '+examId,examId,n,total:items.length,item:items[n-1],examTimer,unanswered,qNav,last5});
});

router.post('/exams/:id/q/:n/answer',async(req,res)=>{
  const examId=Number(req.params.id),n=Number(req.params.n);
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  const exam=await get('SELECT * FROM esami_exams WHERE id=? AND student_id=?',[examId,student.id]);
  if(!exam) return res.status(404).render('error',{title:'Errore',message:'Esame non trovato.'});
  const t=await ensureNotTimedOut(examId);
  if(t.timedOut) return res.redirect('/student/exams/'+examId+'/timeout');
  if(exam.status==='SVOLTO') return res.redirect('/student/exams/'+examId+'/result');
  const items=await all('SELECT eq.id as eq_id,q.correct_key FROM esami_exam_questions eq JOIN esami_questions q ON q.id=eq.question_id WHERE eq.exam_id=? ORDER BY eq.id',[examId]);
  const idx=n-1;
  if(idx<0||idx>=items.length) return res.redirect('/student/exams/'+examId+'/q/1');
  const chosen=(req.body.choice||'').toUpperCase();
  const isCorrect=chosen?(chosen===items[idx].correct_key):null;
  await run('UPDATE esami_exam_questions SET chosen_key=?,is_correct=? WHERE id=?',[chosen||null,chosen?(isCorrect?1:0):null,items[idx].eq_id]);
  const isLast=n>=items.length;
  if(isLast&&req.body.action!=='skip') return res.redirect('/student/exams/'+examId+'/finish');
  return res.redirect('/student/exams/'+examId+'/q/'+(n<items.length?n+1:n));
});

router.post('/exams/:id/finish',finishExam);
router.get('/exams/:id/finish',finishExam);
async function finishExam(req,res){
  const examId=Number(req.params.id);
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  const exam=await get('SELECT * FROM esami_exams WHERE id=? AND student_id=?',[examId,student.id]);
  if(!exam) return res.status(404).render('error',{title:'Errore',message:'Esame non trovato.'});
  const t=await ensureNotTimedOut(examId);
  if(t.timedOut) return res.redirect('/student/exams/'+examId+'/timeout');
  if(exam.status==='SVOLTO') return res.redirect('/student/exams/'+examId+'/result');
  const items=await all('SELECT eq.*,q.correct_key FROM esami_exam_questions eq JOIN esami_questions q ON q.id=eq.question_id WHERE eq.exam_id=?',[examId]);
  const unanswered=items.filter(i=>!i.chosen_key).length;
  if(unanswered>0){req.flash('error','Non puoi chiudere: mancano '+unanswered+' risposte.');return res.redirect('/student/exams/'+examId+'/q/1');}
  const correct=items.filter(i=>i.is_correct===1).length,total=items.length;
  const score=(correct/total)*100,passed=score>=80?1:0;
  await run("UPDATE esami_exams SET status='SVOLTO',taken_at=NOW(),score_percent=?,passed=? WHERE id=?",[score,passed,examId]);
  writeAudit(req,{action:'exam.finish',entityType:'exam',entityId:examId,details:{student_id:student.id,total_questions:total,correct,score_percent:score,passed:!!passed}}).catch(()=>{});
  res.redirect('/student/exams/'+examId+'/result');
}

router.get('/exams/:id/timeout',async(req,res)=>{
  const examId=Number(req.params.id);
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  const exam=await get('SELECT * FROM esami_exams WHERE id=? AND student_id=?',[examId,student.id]);
  res.render('student/exam_timeout',{title:'Tempo scaduto',exam});
});

router.get('/exams/:id/result',async(req,res)=>{
  const examId=Number(req.params.id);
  const student=await get('SELECT * FROM esami_students WHERE user_id=?',[req.session.user.id]);
  const exam=await get('SELECT * FROM esami_exams WHERE id=? AND student_id=?',[examId,student.id]);
  if(!exam) return res.status(404).render('error',{title:'Errore',message:'Esame non trovato.'});
  const totals=await get('SELECT COUNT(*) AS total_questions FROM esami_exam_questions WHERE exam_id=?',[examId]);
  const totalQuestions=Number(totals&&totals.total_questions||0);
  const wrongByTopic=await all("SELECT COALESCE(NULLIF(TRIM(q.topic),''),'Senza argomento') AS topic,COUNT(*) AS n_sbagliate FROM esami_exam_questions eq JOIN esami_questions q ON q.id=eq.question_id WHERE eq.exam_id=? AND (eq.is_correct=0 OR eq.is_correct IS NULL) GROUP BY COALESCE(NULLIF(TRIM(q.topic),''),'Senza argomento') ORDER BY n_sbagliate DESC",[examId]);
  const totalWrong=wrongByTopic.reduce((s,r)=>s+Number(r.n_sbagliate||0),0);
  const scorePercent=exam.score_percent!=null?Number(exam.score_percent):(totalQuestions>0?((totalQuestions-totalWrong)/totalQuestions)*100:0);
  const passed=exam.passed!=null?!!exam.passed:(scorePercent>=80);
  res.render('student/exam_result',{title:'Risultato esame',exam,allowReport:false,wrongByTopic,totalWrong,totalQuestions,scorePercent,passed});
});

module.exports = router;