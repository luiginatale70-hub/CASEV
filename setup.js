#!/usr/bin/env node
// setup.js — Script di inizializzazione CASEV
// Esegui: node setup.js

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
const readline = require('readline');
const fs = require('fs');
require('dotenv').config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   CASEV — Script di Inizializzazione ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Copia .env se non esiste
  if (!fs.existsSync('.env')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ File .env creato da .env.example');
    console.log('⚠️  MODIFICA .env con i tuoi dati DB prima di continuare!\n');
    console.log('   Premi INVIO per continuare dopo aver configurato .env...');
    await ask('');
    require('dotenv').config(); // ricarica
  }

  let db;
try {
  db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'casev_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
  });

  console.log('✅ Connesso al database MySQL\n');
} catch (err) {
  console.error('\n❌ ERRORE: impossibile connettersi al database MySQL.');
  console.error('   Messaggio:', err.message);
  console.error('   Controlla i parametri nel file .env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).');
  rl.close();
  process.exit(1);
}


  // Crea utente admin
  const adminUser = await ask('Username admin [admin]: ') || 'admin';
  const adminPass = await ask('Password admin: ');
  const adminNome = await ask('Nome admin [Amministratore]: ') || 'Amministratore';
  const adminCognome = await ask('Cognome admin [Sistema]: ') || 'Sistema';

  const hash = await bcrypt.hash(adminPass, 10);

  try {
    await db.execute(
      'INSERT INTO utenti (username, password_hash, nome, cognome, ruolo) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',
      [adminUser, hash, adminNome, adminCognome, 'admin']
    );
    console.log(`\n✅ Utente admin "${adminUser}" creato/aggiornato con successo.`);
  } catch (e) {
    console.error('❌ Errore creazione admin:', e.message);
  }

  await db.end();
  rl.close();

 const os = require('os');

// Trova il primo IP IPv4 non interno
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIP();
const port = process.env.PORT || 3000;

console.log('\n══════════════════════════════════════');
console.log('🚀 Setup completato! Ora esegui:');
console.log('   npm install');
console.log('   npm run dev');
console.log(`\n   Portale: http://${ip}:${port}`);
console.log('══════════════════════════════════════\n');

}

main().catch(console.error);
