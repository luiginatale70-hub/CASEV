// cleanup.js — rimuove file non più necessari
const fs   = require('fs');
const path = require('path');

const BASE = __dirname;

const daEliminare = [
  // Database SQLite (migrato in MySQL)
  'data/esami.db',

  // Script SQLite non più necessari
  'esami/scripts/initdb.js',
  'esami/scripts/migrate-logs.js',
  'esami/scripts/migrate-timer.js',

  // File di sviluppo/preview lasciati nella root
  'preview-casev.html',
  'style-additions.css',
  'middleware-auth.js',
];

// File patch/fix — si possono tenere in una sottocartella o eliminare
const patchFiles = [
  'patch7.js', 'patch8.js', 'patch9.js', 'patch10.js',
  'patch11.js', 'patch11b.js', 'patch12.js',
  'fix_patch9.js', 'fix_patch9b.js',
  'fix_auth_esami.js', 'fix_login.js', 'fix_esami_auth_route.js',
  'remove_prestart.js', 'verify_patch9.js', 'stato_sistema.js',
  'cleanup.js'
];

console.log('\n🧹 PULIZIA PROGETTO CASEV\n');

let eliminati = 0, nonTrovati = 0;

for (const f of daEliminare) {
  const full = path.join(BASE, f);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log('🗑️  Eliminato: ' + f);
    eliminati++;
  } else {
    console.log('⚪  Non trovato: ' + f);
    nonTrovati++;
  }
}

// Sposta i patch file in una cartella archivio invece di eliminarli
const archivioDir = path.join(BASE, '_archivio_patch');
fs.mkdirSync(archivioDir, { recursive: true });

console.log('\n📦 Sposto i file patch in _archivio_patch/...');
for (const f of patchFiles) {
  const full = path.join(BASE, f);
  if (fs.existsSync(full)) {
    fs.renameSync(full, path.join(archivioDir, f));
    console.log('📦  Archiviato: ' + f);
  }
}

// Rimuovi cartella scripts se vuota
const scriptsDir = path.join(BASE, 'esami/scripts');
if (fs.existsSync(scriptsDir)) {
  const rimasti = fs.readdirSync(scriptsDir);
  if (rimasti.length === 0) {
    fs.rmdirSync(scriptsDir);
    console.log('🗑️  Cartella esami/scripts/ rimossa (era vuota)');
  } else {
    console.log('⚪  esami/scripts/ contiene ancora: ' + rimasti.join(', '));
  }
}

console.log('\n' + '='.repeat(45));
console.log('✅ Pulizia completata!');
console.log('   Eliminati: ' + eliminati + ' file');
console.log('   Patch archiviati in: _archivio_patch/');
console.log('='.repeat(45) + '\n');
