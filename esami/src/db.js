const path    = require('path');
const fs      = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.ESAMI_DB_PATH ||
               path.join(__dirname, '..', '..', 'data', 'esami.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);
db.exec('PRAGMA foreign_keys = ON');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { db, run, get, all, exec, dbPath };
