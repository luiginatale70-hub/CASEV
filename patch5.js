const fs = require('fs');
const path = require('path');

// ── 1. server.js: imposta timeout a 5 minuti ──────────────────
(function patchServer() {
  const file = './server.js';
  let src = fs.readFileSync(file, 'utf8');

  // Aggiorna maxAge a 5 minuti (300000ms)
  src = src.replace(
    /maxAge: parseInt\(process\.env\.SESSION_MAX_AGE\) \|\| \d+/,
    'maxAge: parseInt(process.env.SESSION_MAX_AGE) || 300000'
  );

  // Aggiorna SESSION_TIMEOUT_MS a 5 minuti
  src = src.replace(
    /parseInt\(process\.env\.SESSION_TIMEOUT_MS\) \|\| \d+/,
    'parseInt(process.env.SESSION_TIMEOUT_MS) || 300000'
  );

  fs.writeFileSync(file, src, 'utf8');
  console.log('✅ server.js: timeout sessione impostato a 5 minuti.');
})();

// ── 2. Crea il partial EJS session-timeout.ejs ────────────────
(function createPartial() {
  // Cerca la cartella partials del modulo esami
  const candidates = [
    './esami/views/partials',
    './esami/views/shared',
    './views/partials',
  ];

  let partialsDir = null;
  for (const c of candidates) {
    try { fs.accessSync(c); partialsDir = c; break; } catch(e) {}
  }

  if (!partialsDir) {
    console.error('❌ Cartella partials non trovata. Cerca in: ' + candidates.join(', '));
    process.exit(1);
  }

  const partial = [
    '<%# Partial: session-timeout.ejs - includi nel layout o nel footer %>',
    '<script>',
    '(function() {',
    '  var TIMEOUT_MS = 300000; // 5 minuti',
    "  var LOGIN_URL  = '/esami/auth/login?timeout=1';",
    '',
    '  // BroadcastChannel: sincronizza logout su tutte le schede',
    "  var bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('casev_session') : null;",
    '  if (bc) {',
    "    bc.onmessage = function(e) {",
    "      if (e.data === 'logout') {",
    '        window.location.href = LOGIN_URL;',
    '      }',
    '    };',
    '  }',
    '',
    '  var timer;',
    '',
    '  function doLogout() {',
    '    if (bc) bc.postMessage(\'logout\');',
    "    fetch('/esami/auth/logout', { method: 'POST', credentials: 'same-origin' })",
    '      .catch(function() {})',
    '      .finally(function() {',
    '        window.location.href = LOGIN_URL;',
    '      });',
    '  }',
    '',
    '  function resetTimer() {',
    '    clearTimeout(timer);',
    '    timer = setTimeout(doLogout, TIMEOUT_MS);',
    '  }',
    '',
    "  ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(function(evt) {",
    '    document.addEventListener(evt, resetTimer, { passive: true });',
    '  });',
    '',
    '  resetTimer();',
    '})();',
    '</script>',
  ].join('\n');

  const outFile = path.join(partialsDir, 'session-timeout.ejs');
  fs.writeFileSync(outFile, partial, 'utf8');
  console.log('✅ Partial creato: ' + outFile);
  console.log('');
  console.log('⚠️  AZIONE MANUALE RICHIESTA:');
  console.log('   Includi il partial nel tuo layout (es. views/layouts/main.ejs o head.ejs),');
  console.log('   SOLO per utenti loggati, aggiungendo questa riga prima di </body>:');
  console.log('');
  console.log("   <% if (locals.user) { %>");
  console.log("     <%- include('../partials/session-timeout') %>");
  console.log("   <% } %>");
  console.log('');
})();

// ── 3. Verifica che /esami/auth/logout accetti POST ───────────
(function checkLogoutRoute() {
  const candidates = [
    './esami/routes/auth.js',
    './routes/auth.js',
  ];
  let file = null;
  for (const c of candidates) {
    try { fs.accessSync(c); file = c; break; } catch(e) {}
  }
  if (!file) {
    console.log('⚠️  File auth.js non trovato per verifica logout POST.');
    return;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes("router.post('/logout'") || src.includes('router.post("/logout"')) {
    console.log('✅ Route POST /logout già presente in ' + file);
  } else {
    console.log('⚠️  Attenzione: POST /logout non trovata in ' + file);
    console.log('   Il client chiama POST /esami/auth/logout — verifica che la route esista.');
  }
})();

console.log('\n✅ PATCH 5 completata.');
