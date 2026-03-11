# ============================================================
# CASEV - Unifica Audit & Accessi nel portale principale
# ============================================================

$BASE = "C:\Users\Administrator\PROGETTI-NAAF\CASEV"
$utf8 = New-Object System.Text.UTF8Encoding $false

Write-Host "=== Audit & Accessi -> portale principale ===" -ForegroundColor Cyan

# ── 1. Aggiungo route in routes/admin.js ─────────────────────
$adminJs = Get-Content "$BASE\routes\admin.js" -Raw -Encoding UTF8

$newRoutes = @'

// ── AUDIT & ACCESSI (log unificati) ──────────────────────────
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
'@

# Aggiungo prima di module.exports
$adminJs = $adminJs -replace "module\.exports = router;", "$newRoutes`nmodule.exports = router;"
[System.IO.File]::WriteAllText("$BASE\routes\admin.js", $adminJs, $utf8)
Write-Host "  routes/admin.js aggiornato" -ForegroundColor Green

# ── 2. Sidebar - aggiungo Accessi Esami e Audit ───────────────
$sidebar = Get-Content "$BASE\views\partials\sidebar.hbs" -Raw -Encoding UTF8
$old = '      <a href="/admin/log" class="nav-item"><span class="nav-icon">&#128274;</span> Log Accessi</a>'
$new = '      <a href="/admin/log" class="nav-item"><span class="nav-icon">&#128274;</span> Log Accessi Portale</a>
      <a href="/admin/accessi" class="nav-item"><span class="nav-icon">&#128203;</span> Accessi Esami</a>
      <a href="/admin/audit" class="nav-item"><span class="nav-icon">&#128202;</span> Audit Esami</a>'
$sidebar = $sidebar.Replace($old, $new)
[System.IO.File]::WriteAllText("$BASE\views\partials\sidebar.hbs", $sidebar, $utf8)
Write-Host "  Sidebar aggiornata" -ForegroundColor Green

# ── 3. View admin/accessi.hbs ─────────────────────────────────
$accessiView = @'
<div class="page-header">
  <h1 class="page-title">Log Accessi Esami</h1>
  <p class="page-sub">Registro degli accessi al modulo esami</p>
</div>

<div class="card mb-3">
  <div class="card-body">
    <form method="GET" action="/admin/accessi" class="row g-2 align-items-end">
      <div class="col-md-7">
        <input type="text" name="q" class="form-control" value="{{q}}" placeholder="Cerca per email, IP, evento...">
      </div>
      <div class="col-md-2">
        <button type="submit" class="btn btn-primary w-100">Filtra</button>
      </div>
      <div class="col-md-1">
        <a href="/admin/accessi" class="btn btn-outline-secondary w-100">Reset</a>
      </div>
      <div class="col-md-2">
        <a href="/admin/accessi/csv" class="btn btn-outline-success w-100">CSV</a>
      </div>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-header">Totale: <strong>{{totale}}</strong> accessi</div>
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead>
          <tr>
            <th>Data/Ora</th>
            <th>Email</th>
            <th>Evento</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {{#each rows}}
          <tr>
            <td style="font-size:13px;white-space:nowrap;">{{formatDateTime created_at}}</td>
            <td style="font-size:13px;">{{email}}</td>
            <td><span class="badge bg-secondary">{{event}}</span></td>
            <td><code style="font-size:12px;">{{ip}}</code></td>
          </tr>
          {{/each}}
          {{#unless rows.length}}
          <tr><td colspan="4" class="text-center text-muted py-4">Nessun accesso registrato</td></tr>
          {{/unless}}
        </tbody>
      </table>
    </div>
  </div>
  {{#if pages}}
  <div class="card-footer d-flex justify-content-center gap-2">
    {{#if_gt page 1}}
    <a href="/admin/accessi?page={{prev_page}}&q={{q}}" class="btn btn-sm btn-outline-primary">Prec</a>
    {{/if_gt}}
    <span class="btn btn-sm btn-light disabled">Pag {{page}} / {{pages}}</span>
    {{#if_lt page pages}}
    <a href="/admin/accessi?page={{next_page}}&q={{q}}" class="btn btn-sm btn-outline-primary">Succ</a>
    {{/if_lt}}
  </div>
  {{/if}}
</div>
'@
[System.IO.File]::WriteAllText("$BASE\views\admin\accessi.hbs", $accessiView, $utf8)
Write-Host "  views/admin/accessi.hbs creata" -ForegroundColor Green

# ── 4. View admin/audit.hbs ───────────────────────────────────
$auditView = @'
<div class="page-header">
  <h1 class="page-title">Audit Log Esami</h1>
  <p class="page-sub">Registro delle operazioni nel modulo esami</p>
</div>

<div class="card mb-3">
  <div class="card-body">
    <form method="GET" action="/admin/audit" class="row g-2 align-items-end">
      <div class="col-md-7">
        <input type="text" name="q" class="form-control" value="{{q}}" placeholder="Cerca per azione, ruolo, entita...">
      </div>
      <div class="col-md-2">
        <button type="submit" class="btn btn-primary w-100">Filtra</button>
      </div>
      <div class="col-md-1">
        <a href="/admin/audit" class="btn btn-outline-secondary w-100">Reset</a>
      </div>
      <div class="col-md-2">
        <a href="/admin/audit/csv" class="btn btn-outline-success w-100">CSV</a>
      </div>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-header">Totale: <strong>{{totale}}</strong> operazioni</div>
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead>
          <tr>
            <th>Data/Ora</th>
            <th>Ruolo</th>
            <th>Azione</th>
            <th>Entita</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {{#each rows}}
          <tr>
            <td style="font-size:13px;white-space:nowrap;">{{formatDateTime created_at}}</td>
            <td><span class="badge bg-info text-dark">{{actor_role}}</span></td>
            <td><span class="badge bg-primary">{{action}}</span></td>
            <td style="font-size:13px;">{{entity_type}} {{#if entity_id}}#{{entity_id}}{{/if}}</td>
            <td><code style="font-size:12px;">{{ip}}</code></td>
          </tr>
          {{/each}}
          {{#unless rows.length}}
          <tr><td colspan="5" class="text-center text-muted py-4">Nessuna operazione registrata</td></tr>
          {{/unless}}
        </tbody>
      </table>
    </div>
  </div>
  {{#if pages}}
  <div class="card-footer d-flex justify-content-center gap-2">
    {{#if_gt page 1}}
    <a href="/admin/audit?page={{prev_page}}&q={{q}}" class="btn btn-sm btn-outline-primary">Prec</a>
    {{/if_gt}}
    <span class="btn btn-sm btn-light disabled">Pag {{page}} / {{pages}}</span>
    {{#if_lt page pages}}
    <a href="/admin/audit?page={{next_page}}&q={{q}}" class="btn btn-sm btn-outline-primary">Succ</a>
    {{/if_lt}}
  </div>
  {{/if}}
</div>
'@
[System.IO.File]::WriteAllText("$BASE\views\admin\audit.hbs", $auditView, $utf8)
Write-Host "  views/admin/audit.hbs creata" -ForegroundColor Green

# ── 5. Aggiungo prev_page/next_page nelle route ───────────────
# (gia gestito con {{page}} +/- 1 nel template, ma serve helper)
# Aggiungo helpers prev/next in server.js
$serverJs = Get-Content "$BASE\server.js" -Raw -Encoding UTF8
if ($serverJs -notmatch "prev_page") {
    $serverJs = $serverJs -replace "(if_lt: function\(a, b, opts\)[^\n]+)", '$1
    prev_page: function() { return (this.page||1) - 1; },
    next_page: function() { return (this.page||1) + 1; },'
    [System.IO.File]::WriteAllText("$BASE\server.js", $serverJs, $utf8)
    Write-Host "  Helper prev/next_page aggiunti" -ForegroundColor Green
}

Write-Host "`n=== COMPLETATO - riavvia con npm start ===" -ForegroundColor Cyan
