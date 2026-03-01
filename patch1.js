const fs = require('fs');
const file = './esami/routes/admin.js';
let src = fs.readFileSync(file, 'utf8');

const newRoutes = [
"",
"// ── GET /esami/admin/classes/:id/edit ────────────────────────",
"router.get('/classes/:id/edit', async (req, res) => {",
"  const id = Number(req.params.id);",
"  const cls = await get('SELECT * FROM classes WHERE id=?', [id]);",
"  if (!cls) {",
"    req.flash('error', 'Classe non trovata.');",
"    return res.redirect('/esami/admin/classes');",
"  }",
"  res.render('admin/class_edit', { title: 'Modifica classe', cls });",
"});",
"",
"// ── POST /esami/admin/classes/:id/edit ───────────────────────",
"router.post('/classes/:id/edit',",
"  body('name').trim().notEmpty(),",
"  body('command').trim().notEmpty(),",
"  body('category').isIn(['Piloti','Operatori di volo','Tecnici di volo']),",
"  async (req, res) => {",
"    const id = Number(req.params.id);",
"    const errors = validationResult(req);",
"    if (!errors.isEmpty()) {",
"      req.flash('error', 'Dati non validi. Tutti i campi sono obbligatori.');",
"      return res.redirect('/esami/admin/classes/' + id + '/edit');",
"    }",
"    const cls = await get('SELECT * FROM classes WHERE id=?', [id]);",
"    if (!cls) {",
"      req.flash('error', 'Classe non trovata.');",
"      return res.redirect('/esami/admin/classes');",
"    }",
"    await run(",
"      'UPDATE classes SET name=?, command=?, category=? WHERE id=?',",
"      [req.body.name.trim(), req.body.command.trim(), req.body.category.trim(), id]",
"    );",
"    req.flash('success', 'Classe aggiornata con successo.');",
"    res.redirect('/esami/admin/classes');",
"  }",
");",
"",
"// ── POST /esami/admin/classes/:id/delete ─────────────────────",
"router.post('/classes/:id/delete', async (req, res) => {",
"  const id = Number(req.params.id);",
"  const cls = await get('SELECT * FROM classes WHERE id=?', [id]);",
"  if (!cls) {",
"    req.flash('error', 'Classe non trovata.');",
"    return res.redirect('/esami/admin/classes');",
"  }",
"  await run('UPDATE students SET class_id=NULL WHERE class_id=?', [id]);",
"  await run('DELETE FROM classes WHERE id=?', [id]);",
"  req.flash('success', 'Classe \"' + cls.name + '\" eliminata. Gli allievi sono stati sganciati.');",
"  res.redirect('/esami/admin/classes');",
"});",
"",
].join('\n');

const anchor = '// Alias: gestione esami (route instructor)';

if (!src.includes(anchor)) {
  console.error('❌ Ancora non trovata nel file. Controlla che admin.js contenga: ' + anchor);
  process.exit(1);
}

if (src.includes("router.get('/classes/:id/edit'")) {
  console.log('⚠️  Route già presenti, skip.');
  process.exit(0);
}

src = src.replace(anchor, newRoutes + anchor);
fs.writeFileSync(file, src, 'utf8');
console.log('✅ PATCH 1 applicata: route edit/delete classi aggiunte.');
