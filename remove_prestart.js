// remove_prestart.js — Rimuove prestart da package.json
const fs   = require('fs');
const path = require('path');

const file = path.join(__dirname, 'package.json');
const pkg  = JSON.parse(fs.readFileSync(file, 'utf8'));

if (pkg.scripts && pkg.scripts.prestart) {
  delete pkg.scripts.prestart;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log('✅ prestart rimosso da package.json');
  console.log('   Da ora "npm start" avvia direttamente il server.');
  console.log('   Per il setup iniziale usa: node setup.js');
} else {
  console.log('⚠️  prestart non presente in package.json, nulla da fare.');
}
