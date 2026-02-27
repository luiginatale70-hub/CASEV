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

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'casev_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
  });

  console.log('✅ Connesso al database MySQL\n');

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

  console.log('\n══════════════════════════════════════');
  console.log('🚀 Setup completato! Ora esegui:');
  console.log('   npm install');
  console.log('   npm run dev');
  console.log(`\n   Portale: http://10.142.3.123:${process.env.PORT || 3000}`);
  console.log('══════════════════════════════════════\n');
}

main().catch(console.error);
