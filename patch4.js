const fs = require('fs');

// Cerca il file auth.js nei percorsi più comuni
const candidates = [
  './routes/auth.js',
  './esami/routes/auth.js'
];

let file = null;
for (const c of candidates) {
  try { fs.accessSync(c); file = c; break; } catch(e) {}
}

if (!file) {
  console.error('❌ File auth.js non trovato. Cercato in: ' + candidates.join(', '));
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');

if (src.includes('/ping')) {
  console.log('⚠️  Route /ping già presente in ' + file + ', skip.');
  process.exit(0);
}

const pingRoute = [
  '',
  '// ── Keepalive sessione (chiamato dal client per evitare timeout) ──',
  "router.get('/ping', (req, res) => res.json({ ok: true }));",
  '',
].join('\n');

src = src.replace('module.exports', pingRoute + 'module.exports');
fs.writeFileSync(file, src, 'utf8');
console.log('✅ PATCH 4 applicata: route /ping aggiunta in ' + file);
