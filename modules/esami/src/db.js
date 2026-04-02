// esami/src/db.js — MySQL pool con timezone Italia
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  database:           process.env.DB_NAME     || 'casev_db',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  timezone:           '+01:00',
  waitForConnections: true,
  connectionLimit:    10,
});

async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return { lastID: result.insertId, changes: result.affectedRows };
}

async function get(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function exec(sql) {
  await pool.query(sql);
}

module.exports = { pool, run, get, all, exec };