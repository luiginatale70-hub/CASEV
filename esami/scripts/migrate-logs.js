require('dotenv').config();
const { exec, dbPath } = require('../src/db');

(async () => {
  await exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor_user_id INTEGER,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      ip TEXT,
      user_agent TEXT,
      details_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);

    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER,
      email TEXT,
      event TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      details_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_access_created_at ON access_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_access_user ON access_log(user_id);
  `);

  console.log('OK: tabelle log create/aggiornate su', dbPath);
})().catch(err => {
  console.error('Migrazione log fallita:', err);
  process.exit(1);
});
