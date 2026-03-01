const fs = require('fs');
const file = './server.js';
let src = fs.readFileSync(file, 'utf8');

// ── 1. Aggiunge rolling:true e riduce maxAge a 1 ora ──────────
const oldCookie = 'cookie: { maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 }';
const newCookie  = 'rolling: true,\n  cookie: { maxAge: parseInt(process.env.SESSION_MAX_AGE) || 3600000 }';

if (!src.includes(oldCookie)) {
  console.error('❌ Stringa cookie non trovata in server.js. Controlla la configurazione sessione.');
  process.exit(1);
}
src = src.replace(oldCookie, newCookie);
console.log('✅ Session rolling:true e maxAge 1h impostati.');

// ── 2. Aggiunge middleware auto-logout dopo app.use(flash()) ───
const anchor = 'app.use(flash());';

if (!src.includes(anchor)) {
  console.error('❌ Ancora app.use(flash()) non trovata in server.js.');
  process.exit(1);
}

if (src.includes('SESSION_TIMEOUT_MS')) {
  console.log('⚠️  Middleware timeout già presente, skip.');
} else {
  const timeoutMiddleware = [
    '',
    '// ── Auto-logout per inattività ────────────────────────────────',
    'const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS) || 3600000;',
    'app.use((req, res, next) => {',
    '  if (req.session && req.session.user) {',
    '    const now = Date.now();',
    '    const last = req.session.lastActivity || now;',
    '    if (now - last > SESSION_TIMEOUT_MS) {',
    '      return req.session.destroy(() => {',
    "        res.redirect('/auth/login?timeout=1');",
    '      });',
    '    }',
    '    req.session.lastActivity = now;',
    '  }',
    '  next();',
    '});',
    '',
  ].join('\n');

  src = src.replace(anchor, anchor + timeoutMiddleware);
  console.log('✅ Middleware auto-logout aggiunto.');
}

fs.writeFileSync(file, src, 'utf8');
console.log('✅ PATCH 3 completata.');
