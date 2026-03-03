// patch12.js — Fix admin.naaf + area admin portale completa
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const BASE = __dirname;
function write(relPath, lines) {
  const full = path.join(BASE, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Array.isArray(lines) ? lines.join('\n') : lines, 'utf8');
  console.log('OK ' + relPath);
}

async function main() {
  console.log('\n🔧 PATCH 12 — Admin portale completo\n');

  // ── 1. DB: fix admin.naaf, disattiva admin ─────────────────
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME     || 'casev_db',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  // Aggiorna admin.naaf con email e nome
  await db.query(
    "UPDATE utenti SET email='luigi.natale@mit.gov.it', nome='Luigi', cognome='Natale' WHERE username='admin.naaf'"
  );
  console.log('OK admin.naaf → email e nome impostati');

  // Disattiva account admin generico
  await db.query("UPDATE utenti SET attivo=0 WHERE username='admin'");
  console.log('OK account "admin" disattivato');

  await db.end();

  // ── 2. routes/admin.js — gestione completa ─────────────────
  write('routes/admin.js', `// routes/admin.js — Area amministrazione portale CASEV
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

// ── Dashboard ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [[{ totUtenti }]]    = await db.query('SELECT COUNT(*) as totUtenti FROM utenti');
    const [[{ totAttivi }]]    = await db.query('SELECT COUNT(*) as totAttivi FROM utenti WHERE attivo=1');
    const [[{ totPersonale }]] = await db.query('SELECT COUNT(*) as totPersonale FROM personale WHERE stato="attivo"');
    const [[{ totPub }]]       = await db.query('SELECT COUNT(*) as totPub FROM pubblicazioni');
    const [[{ totNews }]]      = await db.query('SELECT COUNT(*) as totNews FROM news');
    const [[{ totEsami }]]     = await db.query('SELECT COUNT(*) as totEsami FROM esami_exams');
    const [[{ totAssegnati }]] = await db.query("SELECT COUNT(*) as totAssegnati FROM esami_exams WHERE status='ASSEGNATO'");
    const [ultimiAccessi]      = await db.query(
      'SELECT la.*, u.nome, u.cognome, u.username FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id ORDER BY la.created_at DESC LIMIT 15'
    );
    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      stats: { totUtenti, totAttivi, totPersonale, totPub, totNews, totEsami, totAssegnati },
      ultimiAccessi
    });
  } catch (e) { next(e); }
});

// ── Gestione Utenti ──────────────────────────────────────────
router.get('/utenti', async (req, res, next) => {
  try {
    const ruolo = (req.query.ruolo || '').trim();
    const q     = (req.query.q    || '').trim();
    let where = '1=1'; const params = [];
    if (ruolo) { where += ' AND ruolo=?'; params.push(ruolo); }
    if (q) {
      where += ' AND (username LIKE ? OR nome LIKE ? OR cognome LIKE ? OR email LIKE ?)';
      const like = '%' + q + '%'; params.push(like, like, like, like);
    }
    const [utenti] = await db.query(
      'SELECT id, username, nome, cognome, email, ruolo, attivo, ultimo_accesso, created_at FROM utenti WHERE ' + where + ' ORDER BY ruolo, cognome, nome',
      params
    );
    res.render('admin/utenti', { title: 'Gestione Utenti', utenti, filtri: { ruolo, q } });
  } catch (e) { next(e); }
});

// Nuovo utente
router.post('/utenti/nuovo', async (req, res, next) => {
  try {
    const { username, password, nome, cognome, email, ruolo } = req.body;
    if (!username || !password || !ruolo) {
      req.flash('error', 'Username, password e ruolo sono obbligatori.');
      return res.redirect('/admin/utenti');
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO utenti (username, password_hash, nome, cognome, email, ruolo) VALUES (?,?,?,?,?,?)',
      [username.trim(), hash, nome||'', cognome||'', email||null, ruolo]
    );
    req.flash('success', 'Utente ' + username + ' creato con successo.');
    res.redirect('/admin/utenti');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Username o email già esistente.');
      return res.redirect('/admin/utenti');
    }
    next(e);
  }
});

// Modifica utente
router.post('/utenti/:id/modifica', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nome, cognome, email, ruolo } = req.body;
    // Non permettere di cambiare il proprio ruolo
    if (id === req.session.user.id && ruolo !== req.session.user.ruolo) {
      req.flash('error', 'Non puoi cambiare il tuo stesso ruolo.');
      return res.redirect('/admin/utenti');
    }
    await db.query(
      'UPDATE utenti SET nome=?, cognome=?, email=?, ruolo=? WHERE id=?',
      [nome||'', cognome||'', email||null, ruolo, id]
    );
    req.flash('success', 'Utente aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Toggle attivo/disattivo
router.post('/utenti/:id/toggle', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) {
      req.flash('error', 'Non puoi disattivare te stesso.');
      return res.redirect('/admin/utenti');
    }
    await db.query('UPDATE utenti SET attivo = NOT attivo WHERE id=?', [id]);
    req.flash('success', 'Stato utente aggiornato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Reset password
router.post('/utenti/:id/password', async (req, res, next) => {
  try {
    const nuova = req.body.nuova_password;
    if (!nuova || nuova.length < 8) {
      req.flash('error', 'La password deve essere di almeno 8 caratteri.');
      return res.redirect('/admin/utenti');
    }
    const hash = await bcrypt.hash(nuova, 10);
    await db.query('UPDATE utenti SET password_hash=? WHERE id=?', [hash, req.params.id]);
    req.flash('success', 'Password aggiornata.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// Elimina utente
router.post('/utenti/:id/elimina', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.session.user.id) {
      req.flash('error', 'Non puoi eliminare te stesso.');
      return res.redirect('/admin/utenti');
    }
    const [[u]] = await db.query('SELECT username FROM utenti WHERE id=?', [id]);
    await db.query('DELETE FROM utenti WHERE id=?', [id]);
    req.flash('success', 'Utente ' + (u ? u.username : id) + ' eliminato.');
    res.redirect('/admin/utenti');
  } catch (e) { next(e); }
});

// ── Log accessi ───────────────────────────────────────────────
router.get('/log', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 50;
    const q       = (req.query.q || '').trim();
    const esito   = (req.query.esito || '').trim();
    let where = '1=1'; const params = [];
    if (q) {
      where += ' AND (la.username_tentato LIKE ? OR la.ip_address LIKE ?)';
      const like = '%' + q + '%'; params.push(like, like);
    }
    if (esito) { where += ' AND la.esito=?'; params.push(esito); }
    const [[{ cnt }]] = await db.query('SELECT COUNT(*) as cnt FROM log_accessi la WHERE ' + where, params);
    const pages = Math.max(1, Math.ceil(cnt / perPage));
    const [righe] = await db.query(
      'SELECT la.*, u.nome, u.cognome FROM log_accessi la LEFT JOIN utenti u ON la.utente_id=u.id WHERE ' + where + ' ORDER BY la.created_at DESC LIMIT ? OFFSET ?',
      [...params, perPage, (page - 1) * perPage]
    );
    res.render('admin/log', { title: 'Log Accessi', righe, page, pages, filtri: { q, esito }, totale: cnt });
  } catch (e) { next(e); }
});

module.exports = router;
`);

  // ── 3. views/admin/dashboard.hbs ─────────────────────────────
  write('views/admin/dashboard.hbs', `<div class="page-header">
  <h1 class="page-title">📊 Dashboard Amministrazione</h1>
  <p class="page-sub">Panoramica del sistema CASEV</p>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon">👥</div>
    <div class="stat-value">{{stats.totAttivi}}</div>
    <div class="stat-label">Utenti attivi</div>
    <div class="stat-sub">su {{stats.totUtenti}} totali</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon">📝</div>
    <div class="stat-value">{{stats.totEsami}}</div>
    <div class="stat-label">Esami totali</div>
    <div class="stat-sub">{{stats.totAssegnati}} in attesa</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon">👤</div>
    <div class="stat-value">{{stats.totPersonale}}</div>
    <div class="stat-label">Personale attivo</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon">📚</div>
    <div class="stat-value">{{stats.totPub}}</div>
    <div class="stat-label">Pubblicazioni</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon">📰</div>
    <div class="stat-value">{{stats.totNews}}</div>
    <div class="stat-label">News pubblicate</div>
  </div>
</div>

<div class="section-card mt-4">
  <div class="section-header">
    <h2 class="section-title">⚡ Azioni rapide</h2>
  </div>
  <div class="quick-actions">
    <a href="/admin/utenti" class="quick-btn">⚙️ Gestione Utenti</a>
    <a href="/admin/log" class="quick-btn">📋 Log Accessi</a>
    <a href="/esami/admin" class="quick-btn">📝 Admin Esami</a>
    <a href="/esami/instructor/exams" class="quick-btn">📊 Lista Esami</a>
    <a href="/news" class="quick-btn">📰 Gestione News</a>
    <a href="/pubblicazioni" class="quick-btn">📚 Pubblicazioni</a>
  </div>
</div>

<div class="section-card mt-4">
  <div class="section-header">
    <h2 class="section-title">🕐 Ultimi accessi</h2>
  </div>
  <div class="table-responsive">
    <table class="admin-table">
      <thead>
        <tr>
          <th>Quando</th>
          <th>Utente</th>
          <th>IP</th>
          <th>Esito</th>
        </tr>
      </thead>
      <tbody>
        {{#each ultimiAccessi}}
        <tr>
          <td class="text-muted small">{{created_at}}</td>
          <td>
            {{#if nome}}{{cognome}} {{nome}}{{else}}{{username_tentato}}{{/if}}
          </td>
          <td class="text-muted small">{{ip_address}}</td>
          <td>
            {{#if (eq esito "successo")}}
              <span class="badge badge-ok">✅ OK</span>
            {{else}}
              <span class="badge badge-err">❌ Fallito</span>
            {{/if}}
          </td>
        </tr>
        {{else}}
        <tr><td colspan="4" class="text-center text-muted">Nessun accesso registrato</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  <div class="mt-2">
    <a href="/admin/log" class="btn-link">Vedi tutti i log →</a>
  </div>
</div>
`);

  // ── 4. views/admin/utenti.hbs ─────────────────────────────────
  write('views/admin/utenti.hbs', `<div class="page-header">
  <h1 class="page-title">⚙️ Gestione Utenti</h1>
  <button class="btn btn-primary" onclick="document.getElementById('modal-nuovo').style.display='flex'">+ Nuovo Utente</button>
</div>

{{!-- Filtri --}}
<div class="section-card mb-3">
  <form method="get" class="filter-form">
    <input type="text" name="q" value="{{filtri.q}}" placeholder="Cerca nome, username, email..." class="form-input">
    <select name="ruolo" class="form-select">
      <option value="">Tutti i ruoli</option>
      <option value="admin" {{#if (eq filtri.ruolo "admin")}}selected{{/if}}>Admin</option>
      <option value="admin_esami" {{#if (eq filtri.ruolo "admin_esami")}}selected{{/if}}>Admin Esami</option>
      <option value="gestore" {{#if (eq filtri.ruolo "gestore")}}selected{{/if}}>Gestore</option>
      <option value="istruttore" {{#if (eq filtri.ruolo "istruttore")}}selected{{/if}}>Istruttore</option>
      <option value="allievo" {{#if (eq filtri.ruolo "allievo")}}selected{{/if}}>Allievo</option>
    </select>
    <button type="submit" class="btn btn-secondary">Filtra</button>
    <a href="/admin/utenti" class="btn btn-outline">Reset</a>
  </form>
</div>

<div class="section-card">
  <div class="table-responsive">
    <table class="admin-table">
      <thead>
        <tr>
          <th>Utente</th>
          <th>Email</th>
          <th>Ruolo</th>
          <th>Stato</th>
          <th>Ultimo accesso</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        {{#each utenti}}
        <tr class="{{#unless attivo}}row-inactive{{/unless}}">
          <td>
            <div class="user-cell">
              <div class="user-avatar-sm">{{#if cognome}}{{cognome.[0]}}{{else}}{{username.[0]}}{{/if}}</div>
              <div>
                <div class="fw-600">{{#if cognome}}{{cognome}} {{nome}}{{else}}{{username}}{{/if}}</div>
                <div class="text-muted small">@{{username}}</div>
              </div>
            </div>
          </td>
          <td class="text-muted small">{{#if email}}{{email}}{{else}}—{{/if}}</td>
          <td><span class="badge role-{{ruolo}}">{{ruolo}}</span></td>
          <td>
            {{#if attivo}}
              <span class="badge badge-ok">Attivo</span>
            {{else}}
              <span class="badge badge-err">Inattivo</span>
            {{/if}}
          </td>
          <td class="text-muted small">{{#if ultimo_accesso}}{{ultimo_accesso}}{{else}}Mai{{/if}}</td>
          <td>
            <div class="action-btns">
              <button class="btn-icon" title="Modifica" onclick="openModifica({{id}}, '{{username}}', '{{nome}}', '{{cognome}}', '{{email}}', '{{ruolo}}')">✏️</button>
              <form method="post" action="/admin/utenti/{{id}}/toggle" style="display:inline">
                <button class="btn-icon" title="{{#if attivo}}Disattiva{{else}}Attiva{{/if}}">{{#if attivo}}🔴{{else}}🟢{{/if}}</button>
              </form>
              <button class="btn-icon" title="Reset password" onclick="openReset({{id}}, '{{username}}')">🔑</button>
              <form method="post" action="/admin/utenti/{{id}}/elimina" style="display:inline" onsubmit="return confirm('Eliminare utente {{username}}?')">
                <button class="btn-icon btn-danger" title="Elimina">🗑️</button>
              </form>
            </div>
          </td>
        </tr>
        {{else}}
        <tr><td colspan="6" class="text-center text-muted">Nessun utente trovato</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</div>

{{!-- Modal Nuovo Utente --}}
<div id="modal-nuovo" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <div class="modal-header">
      <h3>Nuovo Utente</h3>
      <button onclick="document.getElementById('modal-nuovo').style.display='none'" class="modal-close">✕</button>
    </div>
    <form method="post" action="/admin/utenti/nuovo">
      <div class="form-grid">
        <div class="form-group">
          <label>Username *</label>
          <input type="text" name="username" class="form-input" required>
        </div>
        <div class="form-group">
          <label>Password * (min 8 car.)</label>
          <input type="password" name="password" class="form-input" required minlength="8">
        </div>
        <div class="form-group">
          <label>Nome</label>
          <input type="text" name="nome" class="form-input">
        </div>
        <div class="form-group">
          <label>Cognome</label>
          <input type="text" name="cognome" class="form-input">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-input">
        </div>
        <div class="form-group">
          <label>Ruolo *</label>
          <select name="ruolo" class="form-select" required>
            <option value="allievo">Allievo</option>
            <option value="istruttore">Istruttore</option>
            <option value="gestore">Gestore</option>
            <option value="admin_esami">Admin Esami</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" onclick="document.getElementById('modal-nuovo').style.display='none'" class="btn btn-outline">Annulla</button>
        <button type="submit" class="btn btn-primary">Crea Utente</button>
      </div>
    </form>
  </div>
</div>

{{!-- Modal Modifica --}}
<div id="modal-modifica" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <div class="modal-header">
      <h3>Modifica Utente — <span id="mod-username"></span></h3>
      <button onclick="document.getElementById('modal-modifica').style.display='none'" class="modal-close">✕</button>
    </div>
    <form id="form-modifica" method="post">
      <div class="form-grid">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" name="nome" id="mod-nome" class="form-input">
        </div>
        <div class="form-group">
          <label>Cognome</label>
          <input type="text" name="cognome" id="mod-cognome" class="form-input">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" id="mod-email" class="form-input">
        </div>
        <div class="form-group">
          <label>Ruolo</label>
          <select name="ruolo" id="mod-ruolo" class="form-select">
            <option value="allievo">Allievo</option>
            <option value="istruttore">Istruttore</option>
            <option value="gestore">Gestore</option>
            <option value="admin_esami">Admin Esami</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" onclick="document.getElementById('modal-modifica').style.display='none'" class="btn btn-outline">Annulla</button>
        <button type="submit" class="btn btn-primary">Salva</button>
      </div>
    </form>
  </div>
</div>

{{!-- Modal Reset Password --}}
<div id="modal-reset" class="modal-overlay" style="display:none">
  <div class="modal-box" style="max-width:400px">
    <div class="modal-header">
      <h3>Reset Password — <span id="reset-username"></span></h3>
      <button onclick="document.getElementById('modal-reset').style.display='none'" class="modal-close">✕</button>
    </div>
    <form id="form-reset" method="post">
      <div class="form-group">
        <label>Nuova Password (min 8 caratteri)</label>
        <input type="password" name="nuova_password" class="form-input" required minlength="8">
      </div>
      <div class="modal-footer">
        <button type="button" onclick="document.getElementById('modal-reset').style.display='none'" class="btn btn-outline">Annulla</button>
        <button type="submit" class="btn btn-primary">Aggiorna</button>
      </div>
    </form>
  </div>
</div>

<script>
function openModifica(id, username, nome, cognome, email, ruolo) {
  document.getElementById('mod-username').textContent = username;
  document.getElementById('mod-nome').value    = nome    || '';
  document.getElementById('mod-cognome').value = cognome || '';
  document.getElementById('mod-email').value   = email   || '';
  document.getElementById('mod-ruolo').value   = ruolo   || 'allievo';
  document.getElementById('form-modifica').action = '/admin/utenti/' + id + '/modifica';
  document.getElementById('modal-modifica').style.display = 'flex';
}
function openReset(id, username) {
  document.getElementById('reset-username').textContent = username;
  document.getElementById('form-reset').action = '/admin/utenti/' + id + '/password';
  document.getElementById('modal-reset').style.display = 'flex';
}
// Chiudi modal cliccando fuori
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
});
</script>
`);

  // ── 5. views/admin/log.hbs ────────────────────────────────────
  write('views/admin/log.hbs', `<div class="page-header">
  <h1 class="page-title">📋 Log Accessi</h1>
  <span class="text-muted">{{totale}} record trovati</span>
</div>

<div class="section-card mb-3">
  <form method="get" class="filter-form">
    <input type="text" name="q" value="{{filtri.q}}" placeholder="Cerca username o IP..." class="form-input">
    <select name="esito" class="form-select">
      <option value="">Tutti</option>
      <option value="successo" {{#if (eq filtri.esito "successo")}}selected{{/if}}>✅ Successo</option>
      <option value="fallito"  {{#if (eq filtri.esito "fallito")}}selected{{/if}}>❌ Fallito</option>
    </select>
    <button type="submit" class="btn btn-secondary">Filtra</button>
    <a href="/admin/log" class="btn btn-outline">Reset</a>
  </form>
</div>

<div class="section-card">
  <div class="table-responsive">
    <table class="admin-table">
      <thead>
        <tr><th>Data/Ora</th><th>Utente</th><th>IP</th><th>Esito</th></tr>
      </thead>
      <tbody>
        {{#each righe}}
        <tr>
          <td class="text-muted small">{{created_at}}</td>
          <td>
            {{#if nome}}{{cognome}} {{nome}}<br><span class="text-muted small">@{{username_tentato}}</span>
            {{else}}{{username_tentato}}{{/if}}
          </td>
          <td class="text-muted small">{{ip_address}}</td>
          <td>
            {{#if (eq esito "successo")}}
              <span class="badge badge-ok">✅ Successo</span>
            {{else}}
              <span class="badge badge-err">❌ Fallito</span>
            {{/if}}
          </td>
        </tr>
        {{else}}
        <tr><td colspan="4" class="text-center text-muted">Nessun log trovato</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  {{!-- Paginazione --}}
  {{#if (gt pages 1)}}
  <div class="pagination mt-3">
    {{#if (gt page 1)}}
      <a href="?page={{subtract page 1}}&q={{filtri.q}}&esito={{filtri.esito}}" class="page-btn">← Prec</a>
    {{/if}}
    <span class="page-info">Pagina {{page}} di {{pages}}</span>
    {{#if (lt page pages)}}
      <a href="?page={{add page 1}}&q={{filtri.q}}&esito={{filtri.esito}}" class="page-btn">Succ →</a>
    {{/if}}
  </div>
  {{/if}}
</div>
`);

  // ── 6. CSS aggiuntivo per le nuove pagine admin ───────────────
  const cssFile = path.join(BASE, 'public/css/style.css');
  let css = fs.readFileSync(cssFile, 'utf8');
  const adminCss = `

/* ── ADMIN PATCH 12 ─────────────────────────────────── */
.stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:1rem; margin-bottom:1.5rem; }
.stat-card { background:var(--bg-card,#fff); border-radius:12px; padding:1.25rem; text-align:center; border:1px solid var(--border,#e5e7eb); box-shadow:0 1px 4px rgba(0,0,0,.06); }
.stat-icon { font-size:1.8rem; margin-bottom:.4rem; }
.stat-value { font-size:2rem; font-weight:700; color:var(--navy,#1a2744); }
.stat-label { font-size:.78rem; font-weight:600; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted,#6b7280); }
.stat-sub { font-size:.72rem; color:var(--text-muted,#9ca3af); margin-top:.2rem; }

.quick-actions { display:flex; flex-wrap:wrap; gap:.75rem; padding:1rem 0; }
.quick-btn { background:var(--navy,#1a2744); color:#fff; padding:.5rem 1rem; border-radius:8px; text-decoration:none; font-size:.85rem; font-weight:500; transition:opacity .2s; }
.quick-btn:hover { opacity:.85; }

.filter-form { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
.form-input  { padding:.45rem .75rem; border:1px solid var(--border,#d1d5db); border-radius:8px; font-size:.88rem; min-width:200px; }
.form-select { padding:.45rem .75rem; border:1px solid var(--border,#d1d5db); border-radius:8px; font-size:.88rem; }

.admin-table { width:100%; border-collapse:collapse; font-size:.88rem; }
.admin-table th { background:var(--bg-muted,#f9fafb); font-weight:600; font-size:.75rem; text-transform:uppercase; letter-spacing:.5px; padding:.6rem 1rem; text-align:left; border-bottom:2px solid var(--border,#e5e7eb); }
.admin-table td { padding:.7rem 1rem; border-bottom:1px solid var(--border,#f3f4f6); vertical-align:middle; }
.admin-table tr:hover td { background:var(--bg-hover,#f9fafb); }
.row-inactive td { opacity:.5; }

.user-cell { display:flex; align-items:center; gap:.6rem; }
.user-avatar-sm { width:32px; height:32px; border-radius:50%; background:var(--navy,#1a2744); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.8rem; font-weight:700; flex-shrink:0; }

.badge { display:inline-block; padding:.2rem .55rem; border-radius:20px; font-size:.72rem; font-weight:600; }
.badge-ok  { background:#d1fae5; color:#065f46; }
.badge-err { background:#fee2e2; color:#991b1b; }
.role-admin       { background:#fef3c7; color:#92400e; }
.role-admin_esami { background:#ede9fe; color:#4c1d95; }
.role-gestore     { background:#dbeafe; color:#1e40af; }
.role-istruttore  { background:#d1fae5; color:#065f46; }
.role-allievo     { background:#f3f4f6; color:#374151; }

.action-btns { display:flex; gap:.3rem; align-items:center; }
.btn-icon { background:none; border:1px solid var(--border,#e5e7eb); border-radius:6px; padding:.25rem .4rem; cursor:pointer; font-size:.9rem; transition:background .15s; }
.btn-icon:hover { background:var(--bg-muted,#f3f4f6); }
.btn-danger:hover { background:#fee2e2; border-color:#fca5a5; }

.section-card { background:var(--bg-card,#fff); border-radius:12px; padding:1.25rem 1.5rem; border:1px solid var(--border,#e5e7eb); box-shadow:0 1px 4px rgba(0,0,0,.06); }
.section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; padding-bottom:.75rem; border-bottom:1px solid var(--border,#e5e7eb); }
.section-title { font-size:1rem; font-weight:700; margin:0; }

.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000; display:flex; align-items:center; justify-content:center; }
.modal-box { background:#fff; border-radius:14px; padding:1.5rem; width:90%; max-width:560px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); }
.modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; }
.modal-header h3 { margin:0; font-size:1.05rem; font-weight:700; }
.modal-close { background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted,#6b7280); }
.modal-footer { display:flex; gap:.75rem; justify-content:flex-end; margin-top:1.25rem; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
.form-group { display:flex; flex-direction:column; gap:.3rem; }
.form-group label { font-size:.8rem; font-weight:600; text-transform:uppercase; letter-spacing:.3px; color:var(--text-muted,#6b7280); }

.pagination { display:flex; align-items:center; gap:1rem; justify-content:center; }
.page-btn { padding:.4rem .9rem; border:1px solid var(--border,#d1d5db); border-radius:8px; text-decoration:none; font-size:.85rem; color:var(--navy,#1a2744); }
.page-btn:hover { background:var(--bg-muted,#f3f4f6); }
.page-info { font-size:.85rem; color:var(--text-muted,#6b7280); }

.btn-link { color:var(--navy,#1a2744); text-decoration:none; font-size:.85rem; font-weight:500; }
.btn-link:hover { text-decoration:underline; }
.fw-600 { font-weight:600; }
.mt-2 { margin-top:.5rem; }
.mt-4 { margin-top:1.5rem; }
.mb-3 { margin-bottom:.75rem; }
.text-center { text-align:center; }
.table-responsive { overflow-x:auto; }
/* ────────────────────────────────────────────────────── */
`;

  if (!css.includes('ADMIN PATCH 12')) {
    fs.writeFileSync(cssFile, css + adminCss, 'utf8');
    console.log('OK public/css/style.css aggiornato');
  } else {
    console.log('SKIP CSS già aggiornato');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ PATCH 12 completata!');
  console.log('   admin.naaf → email: luigi.natale@mit.gov.it');
  console.log('   account "admin" → disattivato');
  console.log('   /admin/utenti → gestione completa');
  console.log('   /admin/log    → log accessi paginati');
  console.log('');
  console.log('   Riavvia con: npm start');
  console.log('='.repeat(50) + '\n');
}

main().catch(e => { console.error('❌ Errore:', e.message); process.exit(1); });
