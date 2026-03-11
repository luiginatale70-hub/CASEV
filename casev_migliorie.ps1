# ============================================================
# CASEV - Script migliorie (5 punti)
# Eseguire da PowerShell come Administrator
# ============================================================

$BASE = "C:\Users\Administrator\PROGETTI-NAAF\CASEV"
$ESAMI = "$BASE\esami"

Write-Host "=== CASEV Migliorie ===" -ForegroundColor Cyan

# ============================================================
# PUNTO 3 - CSS sidebar: testo piu visibile
# ============================================================
Write-Host "`n[3] Aggiorno CSS sidebar..." -ForegroundColor Yellow

$css = Get-Content "$BASE\public\css\style.css" -Raw -Encoding UTF8

# nav-section-label piu visibile
$css = $css -replace '\.nav-section-label \{[^}]+\}', '.nav-section-label {
    font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.55);
    text-transform: uppercase; letter-spacing: 1.5px;
    padding: 8px 20px 4px;
}'

# nav-item piu visibile
$css = $css -replace '(\.nav-item \{[^}]*color: )rgba\(255,255,255,0\.62\)', '$1rgba(255,255,255,0.85)'

Set-Content "$BASE\public\css\style.css" $css -Encoding UTF8
Write-Host "  CSS sidebar portale aggiornato" -ForegroundColor Green

# Stesso fix per nav.ejs esami (CSS inline nel file)
$navEjs = Get-Content "$ESAMI\views\partials\nav.ejs" -Raw -Encoding UTF8
$navEjs = $navEjs -replace 'color:rgba\(255,255,255,\.4\)', 'color:rgba(255,255,255,0.85)'
Set-Content "$ESAMI\views\partials\nav.ejs" $navEjs -Encoding UTF8
Write-Host "  CSS sidebar esami aggiornato" -ForegroundColor Green

# ============================================================
# PUNTO 1+2 - Audit & Accessi nel portale principale
# ============================================================
Write-Host "`n[1+2] Aggiungo Audit Log al portale principale..." -ForegroundColor Yellow

# Aggiungo link Log Accessi nella sidebar admin
$sidebar = Get-Content "$BASE\views\partials\sidebar.hbs" -Raw -Encoding UTF8
$oldAdmin = '      <a href="/admin/utenti" class="nav-item"><span class="nav-icon">⚙️</span> Gestione Utenti</a>'
$newAdmin = '      <a href="/admin/utenti" class="nav-item"><span class="nav-icon">⚙️</span> Gestione Utenti</a>
      <a href="/admin/log" class="nav-item"><span class="nav-icon">🔐</span> Log Accessi</a>
      <a href="/admin/gradi" class="nav-item"><span class="nav-icon">🎖️</span> Gestione Gradi</a>'
$sidebar = $sidebar.Replace($oldAdmin, $newAdmin)
Set-Content "$BASE\views\partials\sidebar.hbs" $sidebar -Encoding UTF8
Write-Host "  Sidebar aggiornata con Log Accessi e Gradi" -ForegroundColor Green

# La route /admin/log esiste gia in admin.js - creo/aggiorno la view
$logView = @'
<div class="page-header">
  <h1 class="page-title">🔐 Log Accessi</h1>
  <p class="page-sub">Registro completo degli accessi al portale</p>
</div>

<div class="card mb-3">
  <div class="card-body">
    <form method="GET" action="/admin/log" class="row g-2 align-items-end">
      <div class="col-md-5">
        <label class="form-label small">Cerca utente / IP</label>
        <input type="text" name="q" class="form-control" value="{{filtri.q}}" placeholder="username o indirizzo IP">
      </div>
      <div class="col-md-3">
        <label class="form-label small">Esito</label>
        <select name="esito" class="form-select">
          <option value="">Tutti</option>
          <option value="ok" {{#if_eq filtri.esito "ok"}}selected{{/if_eq}}>✅ Successo</option>
          <option value="fail" {{#if_eq filtri.esito "fail"}}selected{{/if_eq}}>❌ Fallito</option>
        </select>
      </div>
      <div class="col-md-2">
        <button type="submit" class="btn btn-primary w-100">🔍 Filtra</button>
      </div>
      <div class="col-md-2">
        <a href="/admin/log" class="btn btn-outline-secondary w-100">↺ Reset</a>
      </div>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <span>Totale: <strong>{{totale}}</strong> accessi</span>
    <a href="/admin/log?csv=1" class="btn btn-sm btn-outline-success">⬇ CSV</a>
  </div>
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead>
          <tr>
            <th>Data/Ora</th>
            <th>Utente</th>
            <th>Username tentato</th>
            <th>IP</th>
            <th>Esito</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {{#each righe}}
          <tr>
            <td style="white-space:nowrap;font-size:13px;">{{formatDate created_at}}</td>
            <td>{{#if nome}}{{cognome}} {{nome}}{{else}}<span class="text-muted">—</span>{{/if}}</td>
            <td><code style="font-size:12px;">{{username_tentato}}</code></td>
            <td><code style="font-size:12px;">{{ip_address}}</code></td>
            <td>
              {{#if_eq esito "ok"}}
                <span class="badge bg-success">✅ OK</span>
              {{else}}
                <span class="badge bg-danger">❌ Fallito</span>
              {{/if_eq}}
            </td>
            <td style="font-size:12px;color:#888;">{{note}}</td>
          </tr>
          {{/each}}
          {{#unless righe}}
          <tr><td colspan="6" class="text-center text-muted py-4">Nessun accesso registrato</td></tr>
          {{/unless}}
        </tbody>
      </table>
    </div>
  </div>
  {{#if pages}}
  <div class="card-footer d-flex justify-content-center gap-2">
    {{#if_gt page 1}}
    <a href="/admin/log?page={{prev_page}}&q={{filtri.q}}&esito={{filtri.esito}}" class="btn btn-sm btn-outline-primary">← Prec</a>
    {{/if_gt}}
    <span class="btn btn-sm btn-light disabled">Pag {{page}} / {{pages}}</span>
    {{#if_lt page pages}}
    <a href="/admin/log?page={{next_page}}&q={{filtri.q}}&esito={{filtri.esito}}" class="btn btn-sm btn-outline-primary">Succ →</a>
    {{/if_lt}}
  </div>
  {{/if}}
</div>
'@
Set-Content "$BASE\views\admin\log.hbs" $logView -Encoding UTF8
Write-Host "  View admin/log.hbs creata" -ForegroundColor Green

# Aggiungo helper HBS se mancanti in server.js
$serverJs = Get-Content "$BASE\server.js" -Raw -Encoding UTF8
if ($serverJs -notmatch "if_eq") {
    $helperBlock = @'

// ── HBS Helpers ────────────────────────────────────────────
hbs.registerHelper('if_eq', function(a, b, options) {
  return (a == b) ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper('if_gt', function(a, b, options) {
  return (a > b) ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper('if_lt', function(a, b, options) {
  return (a < b) ? options.fn(this) : options.inverse(this);
});
hbs.registerHelper('formatDate', function(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'});
});
'@
    # Inserisco prima di app.use('/auth'
    $serverJs = $serverJs -replace "(app\.use\('/auth')", "$helperBlock`n`$1"
    Set-Content "$BASE\server.js" $serverJs -Encoding UTF8
    Write-Host "  HBS helpers aggiunti in server.js" -ForegroundColor Green
}

# ============================================================
# PUNTO 4 - Pubblicazioni: serve cartella + route aggiornata
# ============================================================
Write-Host "`n[4] Inizializzo Pubblicazioni..." -ForegroundColor Yellow

# Creo cartella Pubblicazioni
if (!(Test-Path "$BASE\Pubblicazioni")) {
    New-Item -ItemType Directory -Path "$BASE\Pubblicazioni" | Out-Null
    Write-Host "  Cartella Pubblicazioni creata" -ForegroundColor Green
}

# Aggiorno route pubblicazioni.js per leggere da filesystem invece che DB
$pubRoute = @'
// routes/pubblicazioni.js
const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const PUB_DIR = path.join(__dirname, '..', 'Pubblicazioni');

// Assicuro che la cartella esista
if (!fs.existsSync(PUB_DIR)) fs.mkdirSync(PUB_DIR, { recursive: true });

// Lista pubblicazioni dalla cartella
router.get('/', (req, res, next) => {
  try {
    const files = fs.readdirSync(PUB_DIR)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(PUB_DIR, f));
        const nameParts = f.replace('.pdf','').split('_');
        return {
          nome_file: f,
          titolo: nameParts.join(' ').replace(/-/g,' '),
          size_kb: Math.round(stat.size / 1024),
          data: stat.mtime
        };
      })
      .sort((a,b) => b.data - a.data);
    res.render('pubblicazioni/index', { title: 'Pubblicazioni in Vigore', pubs: files });
  } catch (e) { next(e); }
});

// Download PDF
router.get('/download/:file', (req, res, next) => {
  try {
    const file = path.basename(req.params.file);
    const filePath = path.join(PUB_DIR, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('File non trovato');
    res.download(filePath, file);
  } catch (e) { next(e); }
});

module.exports = router;
'@
Set-Content "$BASE\routes\pubblicazioni.js" $pubRoute -Encoding UTF8
Write-Host "  routes/pubblicazioni.js aggiornato (filesystem)" -ForegroundColor Green

# View pubblicazioni
$pubView = @'
<div class="page-header">
  <h1 class="page-title">📚 Pubblicazioni in Vigore</h1>
  <p class="page-sub">Documenti ufficiali e normative operative</p>
</div>

{{#unless pubs.length}}
<div class="card text-center py-5">
  <div style="font-size:3rem;">📂</div>
  <h3 class="mt-3 text-muted">Nessuna pubblicazione disponibile</h3>
  <p class="text-muted">Inserire i file PDF nella cartella <code>Pubblicazioni/</code> del progetto.</p>
</div>
{{/unless}}

{{#if pubs.length}}
<div class="card">
  <div class="card-header">
    <span>{{pubs.length}} documento{{#if_gt pubs.length 1}}i{{/if_gt}} disponibil{{#if_gt pubs.length 1}}e{{/if_gt}}</span>
    <input type="text" id="searchPub" class="form-control form-control-sm d-inline-block ms-3" style="width:220px;" placeholder="🔍 Cerca...">
  </div>
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover mb-0" id="pubTable">
        <thead>
          <tr>
            <th style="width:50px;"></th>
            <th>Documento</th>
            <th>Dimensione</th>
            <th>Data</th>
            <th style="width:120px;"></th>
          </tr>
        </thead>
        <tbody>
          {{#each pubs}}
          <tr class="pub-row">
            <td class="text-center" style="font-size:1.5rem;">📄</td>
            <td>
              <div style="font-weight:500;">{{titolo}}</div>
              <div style="font-size:11px;color:#888;">{{nome_file}}</div>
            </td>
            <td style="color:#888;font-size:13px;">{{size_kb}} KB</td>
            <td style="color:#888;font-size:13px;">{{formatDate data}}</td>
            <td>
              <a href="/pubblicazioni/download/{{nome_file}}" class="btn btn-sm btn-primary">
                ⬇ Scarica
              </a>
            </td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
  </div>
</div>
{{/if}}

<script>
document.getElementById('searchPub')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('.pub-row').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});
</script>
'@

# Assicuro che esista la cartella views/pubblicazioni
if (!(Test-Path "$BASE\views\pubblicazioni")) {
    New-Item -ItemType Directory -Path "$BASE\views\pubblicazioni" | Out-Null
}
Set-Content "$BASE\views\pubblicazioni\index.hbs" $pubView -Encoding UTF8
Write-Host "  views/pubblicazioni/index.hbs creata" -ForegroundColor Green

# ============================================================
# PUNTO 5 - News & Comunicati con scorrimento
# ============================================================
Write-Host "`n[5] Inizializzo News & Comunicati..." -ForegroundColor Yellow

# Creo tabella news se non esiste (aggiunta in server.js init o diretta)
$newsInitSql = @"
CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titolo VARCHAR(255) NOT NULL,
  contenuto TEXT,
  excerpt VARCHAR(300),
  categoria VARCHAR(50) DEFAULT 'Generale',
  pubblica TINYINT(1) DEFAULT 1,
  in_evidenza TINYINT(1) DEFAULT 0,
  autore_id INT,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"@
Write-Host "  SQL tabella news (esegui se non esiste):" -ForegroundColor Cyan
Write-Host $newsInitSql -ForegroundColor Gray

# View news index con scorrimento ticker
$newsView = @'
<style>
.news-ticker-wrap {
  background: linear-gradient(90deg, var(--navy-dark) 0%, #1a3a5c 100%);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 28px;
  display: flex;
  align-items: center;
}
.news-ticker-label {
  background: var(--gold, #00d27a);
  color: #000;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 10px 16px;
  white-space: nowrap;
  flex-shrink: 0;
}
.news-ticker-scroll {
  overflow: hidden;
  flex: 1;
  padding: 10px 0;
}
.news-ticker-inner {
  display: flex;
  gap: 60px;
  animation: ticker-scroll 30s linear infinite;
  white-space: nowrap;
}
.news-ticker-inner:hover { animation-play-state: paused; }
.news-ticker-item {
  color: rgba(255,255,255,0.85);
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
}
.news-ticker-item:hover { color: #fff; text-decoration: underline; }
.news-ticker-dot { color: var(--gold, #00d27a); margin-right: 8px; }
@keyframes ticker-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.news-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8ecf0;
  overflow: hidden;
  transition: transform .2s, box-shadow .2s;
}
.news-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.news-card-header {
  background: linear-gradient(135deg, #0b1727 0%, #1a3a5c 100%);
  padding: 16px 20px 12px;
  display: flex; justify-content: space-between; align-items: flex-start;
}
.news-badge {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; padding: 3px 8px; border-radius: 20px;
  background: rgba(0,210,122,0.2); color: #00d27a;
}
.news-badge.evidenza {
  background: rgba(255,193,7,0.2); color: #ffc107;
}
.news-date { color: rgba(255,255,255,0.4); font-size: 11px; }
.news-card-body { padding: 16px 20px; }
.news-card-title {
  font-weight: 600; font-size: 15px; color: #1a1a2e;
  margin-bottom: 8px; line-height: 1.4;
}
.news-card-excerpt { color: #666; font-size: 13px; line-height: 1.5; }
.news-card-footer {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex; justify-content: space-between; align-items: center;
}
.news-author { font-size: 12px; color: #888; }
</style>

<div class="page-header">
  <h1 class="page-title">📰 News & Comunicati</h1>
  <p class="page-sub">Aggiornamenti e comunicazioni ufficiali</p>
</div>

{{#if news.length}}
<!-- Ticker scorrevole -->
<div class="news-ticker-wrap">
  <div class="news-ticker-label">⚡ ULTIME NEWS</div>
  <div class="news-ticker-scroll">
    <div class="news-ticker-inner" id="tickerInner">
      {{#each news}}
      <a href="/news/{{id}}" class="news-ticker-item">
        <span class="news-ticker-dot">●</span>{{titolo}}
      </a>
      {{/each}}
      {{#each news}}
      <a href="/news/{{id}}" class="news-ticker-item">
        <span class="news-ticker-dot">●</span>{{titolo}}
      </a>
      {{/each}}
    </div>
  </div>
</div>

<!-- Griglia news -->
<div class="news-grid">
  {{#each news}}
  <div class="news-card">
    <div class="news-card-header">
      <span class="news-badge {{#if in_evidenza}}evidenza{{/if}}">
        {{#if in_evidenza}}⭐ In evidenza{{else}}{{categoria}}{{/if}}
      </span>
      <span class="news-date">{{formatDate published_at}}</span>
    </div>
    <div class="news-card-body">
      <div class="news-card-title">{{titolo}}</div>
      <div class="news-card-excerpt">{{excerpt}}</div>
    </div>
    <div class="news-card-footer">
      <span class="news-author">✍ {{cognome}} {{nome}}</span>
      <a href="/news/{{id}}" class="btn btn-sm btn-outline-primary">Leggi →</a>
    </div>
  </div>
  {{/each}}
</div>

{{else}}
<div class="card text-center py-5">
  <div style="font-size:3rem;">📭</div>
  <h3 class="mt-3 text-muted">Nessuna news pubblicata</h3>
  <p class="text-muted">Le comunicazioni appariranno qui non appena pubblicate.</p>
</div>
{{/if}}
'@

if (!(Test-Path "$BASE\views\news")) {
    New-Item -ItemType Directory -Path "$BASE\views\news" | Out-Null
}
Set-Content "$BASE\views\news\index.hbs" $newsView -Encoding UTF8
Write-Host "  views/news/index.hbs creata" -ForegroundColor Green

# View singola news
$newsShow = @'
<div style="max-width:800px;margin:0 auto;">
  <a href="/news" class="btn btn-sm btn-outline-secondary mb-4">← Torna alle News</a>

  <div class="card">
    <div class="card-header" style="background:linear-gradient(135deg,#0b1727,#1a3a5c);padding:24px 28px;">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00d27a;">
        {{news.categoria}}
      </span>
      <h1 style="color:#fff;font-size:1.5rem;margin:10px 0 6px;font-weight:700;">{{news.titolo}}</h1>
      <div style="color:rgba(255,255,255,0.5);font-size:13px;">
        ✍ {{news.cognome}} {{news.nome}} &middot; {{formatDate news.published_at}}
      </div>
    </div>
    <div class="card-body" style="padding:28px;line-height:1.8;color:#333;font-size:15px;">
      {{{news.contenuto}}}
    </div>
  </div>
</div>
'@
Set-Content "$BASE\views\news\show.hbs" $newsShow -Encoding UTF8
Write-Host "  views/news/show.hbs creata" -ForegroundColor Green

Write-Host "`n=== COMPLETATO ===" -ForegroundColor Cyan
Write-Host "Riavvia il server con: npm start" -ForegroundColor Green
Write-Host ""
Write-Host "NOTA: Per le pubblicazioni, copia i tuoi PDF in:" -ForegroundColor Yellow
Write-Host "  C:\Users\Administrator\PROGETTI-NAAF\CASEV\Pubblicazioni\" -ForegroundColor White
Write-Host ""
Write-Host "NOTA: Esegui questo SQL per la tabella news (se non esiste):" -ForegroundColor Yellow
Write-Host "  echo `"CREATE TABLE IF NOT EXISTS news (id INT AUTO_INCREMENT PRIMARY KEY, titolo VARCHAR(255) NOT NULL, contenuto TEXT, excerpt VARCHAR(300), categoria VARCHAR(50) DEFAULT 'Generale', pubblica TINYINT(1) DEFAULT 1, in_evidenza TINYINT(1) DEFAULT 0, autore_id INT, published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`" | mysql -u root -pcamilla casev_db" -ForegroundColor White
