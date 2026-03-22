// config/dbTest.js
const pool = require('./db');

async function testDB() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database MySQL connesso');
    conn.release();
  } catch (err) {
    console.error('❌ Errore connessione DB:', err.message);
    process.exit(1);
  }
}

module.exports = testDB;