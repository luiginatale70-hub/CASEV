require('dotenv').config();
const { all, exec, dbPath } = require('../src/db');

(async () => {
  const cols = await all(`PRAGMA table_info(exams);`);
  const existing = new Set(cols.map(c => c.name));

  const stmts = [];

  if (!existing.has('duration_minutes')) {
    stmts.push(`ALTER TABLE exams ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 120;`);
  }
  if (!existing.has('started_at')) {
    stmts.push(`ALTER TABLE exams ADD COLUMN started_at TEXT;`);
  }
  if (!existing.has('ends_at')) {
    stmts.push(`ALTER TABLE exams ADD COLUMN ends_at TEXT;`);
  }
  if (!existing.has('timed_out')) {
    stmts.push(`ALTER TABLE exams ADD COLUMN timed_out INTEGER NOT NULL DEFAULT 0;`);
  }

  if (stmts.length === 0) {
    console.log('OK: colonne timer già presenti su', dbPath);
    return;
  }

  await exec(stmts.join('\n'));
  console.log('OK: migrazione timer completata su', dbPath);
})().catch(err => {
  console.error('Migrazione timer fallita:', err);
  process.exit(1);
});