// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'casev_db',
  user: process.env.DB_USER || 'casev_user',
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+01:00',
  charset: 'utf8mb4'
});

// Test connessione all'avvio
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database MySQL connesso');
    conn.release();
  } catch (err) {
    console.error('❌ Errore connessione DB:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;
