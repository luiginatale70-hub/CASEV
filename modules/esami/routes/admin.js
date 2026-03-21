const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../src/db');
const { requireRole } = require('../src/auth');
const { randomPassword }     = require('../src/utils');
const { sendMail, isConfigured } = require('../src/mailer');

const router = express.Router();
router.use(requireRole('admin', 'instructor'));

const BT = '`';

// ── Dashboard ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const [ct,st,et,at,tt,it,ot,ar,au] = await Promise.all([
    get('SELECT COUNT(*) AS c FROM esami_classes'),
    get('SELECT COUNT(*) AS c FROM esami_students'),
    get('SELECT COUNT(*) AS c FROM esami_exams'),
    get("SELECT COUNT(*) AS c FROM esami_exams WHERE status='ASSEGNATO'"),
    get("SELECT COUNT(*) AS c FROM esami_exams WHERE status='SVOLTO'"),
    get('SELECT COUNT(*) AS c FROM esami_exams WHERE started_at IS NOT NULL AND taken_at IS NULL AND timed_out=0'),
    get('SELECT COUNT(*) AS c FROM esami_exams WHERE timed_out=1'),
    all('SELECT * FROM esami_access_log ORDER BY id DESC LIMIT 20'),
    all('SELECT * FROM esami_audit_log ORDER BY id DESC LIMIT 20')
  ]);
  res.render('admin/dashboard', {
    title: 'Dashboard Admin',
    stats: { classesTotal:ct.c, studentsTotal:st.c, examsTotal:et.c,
             assignmentsTotal:at.c, takenTotal:tt.c, inProgressTotal:it.c, timedOutTotal:ot.c },
    accessRows: ar, auditRows: au
  });
});

// ── Classi ───────────────────────────────────────────────────
router.get('/classes', async (req, res) => {
  const page=Math.max(1,parseInt(req.query.page||'1',10)), perPage=20, q=(req.query.q||'').trim();
  let where='1=1'; const params=[];
  if (q) { where+=' AND (name LIKE ? OR command LIKE ? OR category LIKE ?)'; const l='%'+q+'%'; params.push(l,l,l); }
  const tr = await get('SELECT COUNT(*) AS cnt FROM esami_classes WHERE '+where, params);
  const total=tr?tr.cnt:0, pages=Math.max(1,Math.ceil(total/perPage)), sp=Math.min(page,pages);
  const classes = await all('SELECT * FROM esami_classes WHERE '+where+' ORDER BY id DESC LIMIT ? OFFSET ?',[...params,perPage,(sp-1)*perPage]);
  res.render('admin/classes',{title:'Gestione classi',classes,q,page:sp,pages,total});
});

router.get('/classes/new',(req,res)=>res.render('admin/class_new',{title:'Nuova classe'}));

router.post('/classes/new',
  body('command').trim().notEmpty(),
  body('category').isIn(['Piloti','Operatori di volo','Tecnici di volo']),
  body('name').trim().notEmpty(),
  async(req,res)=>{
    if (!validationResult(req).isEmpty()){req.flash('error','Dati non validi.');return res.redirect('/esami/admin/classes/new');}
    await run('INSERT INTO esami_classes(command,category,name,created_by_user_id) VALUES (?,?,?,?)',
      [req.body.command,req.body.category,req.body.name,req.session.user.id]);
    req.flash('success','Classe creata.');
    res.redirect('/esami/admin/classes');
  }
);

router.get('/classes/:id/edit',async(req,res)=>{
  const cls=await get('SELECT * FROM esami_classes WHERE id=?',[req.params.id]);
  if(!cls){req.flash('error','Classe non trovata.');return res.redirect('/esami/admin/classes');}
  res.render('admin/class_edit',{title:'Modifica classe',cls});
});

router.post('/classes/:id/edit',
  body('name').trim().notEmpty(),body('command').trim().notEmpty(),
  body('category').isIn(['Piloti','Operatori di volo','Tecnici di volo']),
  async(req,res)=>{
    const id=Number(req.params.id);
    if(!validationResult(req).isEmpty()){req.flash('error','Dati non validi.');return res.redirect('/esami/admin/classes/'+id+'/edit');}
    await run('UPDATE esami_classes SET name=?,command=?,category=? WHERE id=?',
      [req.body.name.trim(),req.body.command.trim(),req.body.category.trim(),id]);
    req.flash('success','Classe aggiornata.');
    res.redirect('/esami/admin/classes');
  }
);

router.post('/classes/:id/delete',async(req,res)=>{
  const id=Number(req.params.id);
  const cls=await get('SELECT * FROM esami_classes WHERE id=?',[id]);
  if(!cls){req.flash('error','Classe non trovata.');return res.redirect('/esami/admin/classes');}
  await run('UPDATE esami_students SET class_id=NULL WHERE class_id=?',[id]);
  await run('DELETE FROM esami_classes WHERE id=?',[id]);
  req.flash('success','Classe "'+cls.name+'" eliminata.');
  res.redirect('/esami/admin/classes');
});

// ── Istruttori ───────────────────────────────────────────────
router.get('/instructors/new',(req,res)=>res.render('admin/instructor_new',{title:'Nuovo istruttore'}));

router.post('/instructors/new',
  body('email').isEmail(),body('name').trim().notEmpty(),body('surname').trim().notEmpty(),
  async(req,res)=>{
    if(!validationResult(req).isEmpty()){req.flash('error','Dati non validi.');return res.redirect('/esami/admin/instructors/new');}
    const email=req.body.email.toLowerCase();
    const exists=await get('SELECT id FROM utenti WHERE email=?',[email]);
    if(exists){req.flash('error','Email già presente.');return res.redirect('/esami/admin/instructors/new');}
    const temp=randomPassword(10);
    const hash=bcrypt.hashSync(temp,12);
    const username=email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g,'_');

    // Crea utente con ruolo istruttore
    const u=await run('INSERT INTO utenti(username,password_hash,nome,cognome,email,ruolo) VALUES (?,?,?,?,?,?)',
      [username,hash,req.body.name,req.body.surname,email,'istruttore']);

    // Crea record in esami_instructors
    await run('INSERT INTO esami_instructors(user_id,name,surname) VALUES (?,?,?)',
      [u.lastID,req.body.name,req.body.surname]);

    // ── NUOVO: aggiunge istruttore anche in esami_students ──
    // così può ricevere esami come qualsiasi allievo
    const alreadyStudent=await get('SELECT id FROM esami_students WHERE user_id=?',[u.lastID]);
    if(!alreadyStudent){
      await run(
        `INSERT INTO esami_students(user_id,${BT}rank${BT},name,surname,email,role_at_assignment) VALUES (?,?,?,?,?,?)`,
        [u.lastID,'ISTR',req.body.name,req.body.surname,email,'instructor']
      );
    }

    await sendMail({to:email,subject:'Portale NAAF - Credenziali',
      html:'<p>Sei stato registrato come <strong>ISTRUTTORE</strong>.</p><p>Login: '+email+'<br/>Password temporanea: <strong>'+temp+'</strong></p><p>Cambia la password al primo accesso.</p>'});
    if(!isConfigured()) req.flash('info','SMTP non attivo — password temporanea: '+temp);
    req.flash('success','Istruttore creato e aggiunto alla lista partecipanti esami.');
    res.redirect('/esami/admin');
  }
);
//allievi
router.get('/students',async(req,res)=>{
  const page=Math.max(1,parseInt(req.query.page||'1',10)),perPage=20;
  const command=(req.query.command||'').trim(),category=(req.query.category||'').trim(),q=(req.query.q||'').trim();

  let where='1=1'; 
  const params=[];

  if(command){
    where+=' AND c.command=?';
    params.push(command);
  }

  if(category){
    where+=' AND c.category=?';
    params.push(category);
  }

  if(q){
    where+=` AND (s.${BT}rank${BT} LIKE ? OR u2.name LIKE ? OR u2.surname LIKE ? OR u2.email LIKE ? OR c.name LIKE ?)`;
    const l='%'+q+'%';
    params.push(l,l,l,l,l);
  }

  const tr=await get(
    'SELECT COUNT(*) as cnt FROM esami_students s ' +
    'LEFT JOIN esami_classes c ON c.id=s.class_id ' +
    'LEFT JOIN utenti u2 ON u2.id = s.user_id ' +
    'WHERE '+where,
    params
  );

  const total=tr?tr.cnt:0,
        pages=Math.max(1,Math.ceil(total/perPage)),
        sp=Math.min(page,pages);

  const rows=await all(
    `SELECT s.*, 
            u2.name as name,
            u2.surname as surname,
            u2.email as email,
            c.name as class_name,c.command,c.category,
            COALESCE(s.role_at_assignment,'allievo') as role_label
     FROM esami_students s
     LEFT JOIN esami_classes c ON c.id=s.class_id
     LEFT JOIN utenti u2 ON u2.id = s.user_id
     WHERE ${where}
     ORDER BY s.role_at_assignment, u2.surname, u2.name
     LIMIT ? OFFSET ?`,
    [...params,perPage,(sp-1)*perPage]
  );

  const cr=await all('SELECT DISTINCT command FROM esami_classes ORDER BY command');

  res.render('admin/students',{
    title:'Gestione partecipanti',
    rows,
    page:sp,
    pages,
    total,
    filters:{command,category,q},
    commands:cr.map(r=>r.command)
  });
});
router.get('/students/new',async(req,res)=>{
  const classes=await all('SELECT * FROM esami_classes ORDER BY command,category,name');
  res.render('admin/student_new',{title:'Nuovo partecipante',classes});
});

router.post('/students/new',
  body('email').isEmail(),body('rank').trim().notEmpty(),
  body('name').trim().notEmpty(),body('surname').trim().notEmpty(),
  async(req,res)=>{
    if(!validationResult(req).isEmpty()){req.flash('error','Dati non validi.');return res.redirect('/esami/admin/students/new');}
    const email=req.body.email.toLowerCase();
    const exists=await get('SELECT id FROM utenti WHERE email=?',[email]);
    if(exists){req.flash('error','Email già presente.');return res.redirect('/esami/admin/students/new');}
    const temp=randomPassword(10),hash=bcrypt.hashSync(temp,12);
    const username=email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g,'_');
    const u=await run('INSERT INTO utenti(username,password_hash,nome,cognome,email,ruolo) VALUES (?,?,?,?,?,?)',
      [username,hash,req.body.name,req.body.surname,email,'allievo']);
    await run(
      `INSERT INTO esami_students(user_id,${BT}rank${BT},name,surname,qualification,email,class_id,role_at_assignment) VALUES (?,?,?,?,?,?,?,?)`,
      [u.lastID,req.body.rank,req.body.name,req.body.surname,req.body.qualification||null,email,req.body.class_id||null,'allievo']
    );
    await sendMail({to:email,subject:'Portale NAAF - Password provvisoria',
      html:'<p>Sei stato registrato come <strong>ALLIEVO</strong>.</p><p>Login: '+email+'<br/>Password temporanea: <strong>'+temp+'</strong></p>'});
    if(!isConfigured()) req.flash('info','SMTP non attivo — password temporanea: '+temp);
    req.flash('success','Allievo creato.');
    res.redirect('/esami/admin/students');
  }
);

router.get('/students/:id/edit',async(req,res)=>{
  const student=await get('SELECT * FROM esami_students WHERE id=?',[req.params.id]);
  if(!student) return res.status(404).render('error',{title:'Errore',message:'Partecipante non trovato.'});
  const classes=await all('SELECT * FROM esami_classes ORDER BY command,category,name');
  res.render('admin/student_edit',{title:'Modifica partecipante',student,classes});
});

router.post('/students/:id/edit',
  body('rank').trim().notEmpty(),body('name').trim().notEmpty(),body('surname').trim().notEmpty(),
  async(req,res)=>{
    const id=Number(req.params.id);
    const student=await get('SELECT * FROM esami_students WHERE id=?',[id]);
    if(!student){req.flash('error','Partecipante non trovato.');return res.redirect('/esami/admin/students');}
    await run(
      `UPDATE esami_students SET ${BT}rank${BT}=?,name=?,surname=?,qualification=?,class_id=? WHERE id=?`,
      [req.body.rank,req.body.name,req.body.surname,req.body.qualification||null,req.body.class_id||null,id]
    );
    req.flash('success','Dati aggiornati.');
    res.redirect('/esami/admin/students');
  }
);

router.post('/students/:id/delete',async(req,res)=>{
  const id=Number(req.params.id);
  const student=await get('SELECT * FROM esami_students WHERE id=?',[id]);
  if(student) await run('DELETE FROM utenti WHERE id=?',[student.user_id]);
  req.flash('success','Partecipante cancellato.');
  res.redirect('/esami/admin/students');
});

router.post('/students/:id/reset-password',async(req,res)=>{
  const id=Number(req.params.id);
  const student=await get('SELECT * FROM esami_students WHERE id=?',[id]);
  if(!student){req.flash('error','Partecipante non trovato.');return res.redirect('/esami/admin/students');}
  const temp=randomPassword(10),hash=bcrypt.hashSync(temp,12);
  await run('UPDATE utenti SET password_hash=? WHERE id=?',[hash,student.user_id]);
  await sendMail({to:student.email,subject:'Portale NAAF - Reset password',
    html:'<p>Nuova password provvisoria: <strong>'+temp+'</strong></p>'});
  if(!isConfigured()) req.flash('info','SMTP non attivo — password: '+temp);
  req.flash('success','Password resettata.');
  res.redirect('/esami/admin/students');
});

// ── Log (solo admin) ─────────────────────────────────────────
router.get('/access',requireRole('admin'),async(req,res)=>{
  const page=Math.max(1,parseInt(req.query.page||'1',10)),perPage=50;
  const filters={event:(req.query.event||'').trim(),q:(req.query.q||'').trim()};
  let where='1=1'; const params=[];
  if(filters.event){where+=' AND event=?';params.push(filters.event);}
  if(filters.q){where+=' AND (email LIKE ? OR ip LIKE ?)';const l='%'+filters.q+'%';params.push(l,l);}
  const tr=await get('SELECT COUNT(*) as cnt FROM esami_access_log WHERE '+where,params);
  const total=tr?tr.cnt:0,pages=Math.max(1,Math.ceil(total/perPage));
  const rows=await all('SELECT * FROM esami_access_log WHERE '+where+' ORDER BY id DESC LIMIT ? OFFSET ?',[...params,perPage,(page-1)*perPage]);
  res.render('admin/access_log',{title:'Log accessi',rows,page,pages,filters});
});

router.get('/audit',requireRole('admin'),async(req,res)=>{
  const page=Math.max(1,parseInt(req.query.page||'1',10)),perPage=50;
  const filters={action:(req.query.action||'').trim(),q:(req.query.q||'').trim()};
  let where='1=1'; const params=[];
  if(filters.action){where+=' AND action LIKE ?';params.push('%'+filters.action+'%');}
  if(filters.q){where+=' AND (ip LIKE ? OR details_json LIKE ?)';const l='%'+filters.q+'%';params.push(l,l);}
  const tr=await get('SELECT COUNT(*) as cnt FROM esami_audit_log WHERE '+where,params);
  const total=tr?tr.cnt:0,pages=Math.max(1,Math.ceil(total/perPage));
  const rows=await all('SELECT * FROM esami_audit_log WHERE '+where+' ORDER BY id DESC LIMIT ? OFFSET ?',[...params,perPage,(page-1)*perPage]);
  res.render('admin/audit_log',{title:'Storico audit',rows,page,pages,filters});
});

router.get('/exams',(req,res)=>res.redirect('/esami/instructor/exams'));

module.exports = router;
