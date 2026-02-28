require('dotenv').config();
const bcrypt = require('bcryptjs');
const { exec, get, run, dbPath } = require('../src/db');

(async () => {
  await exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('admin','instructor','student')),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    name TEXT,
    surname TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Piloti','Operatori di volo','Tecnici di volo')),
    name TEXT NOT NULL,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    rank TEXT NOT NULL,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    qualification TEXT,
    email TEXT NOT NULL UNIQUE,
    class_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS question_banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_type TEXT NOT NULL,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_id INTEGER NOT NULL,
    topic TEXT,
    question TEXT NOT NULL,
    opt_a TEXT NOT NULL,
    opt_b TEXT NOT NULL,
    opt_c TEXT NOT NULL,
    opt_d TEXT NOT NULL,
    correct_key TEXT NOT NULL CHECK(correct_key IN ('A','B','C','D')),
    FOREIGN KEY(bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    instructor_user_id INTEGER NOT NULL,
    exam_type TEXT NOT NULL,
    num_questions INTEGER NOT NULL,
    topics_filter TEXT,
    status TEXT NOT NULL CHECK(status IN ('ASSEGNATO','SVOLTO')) DEFAULT 'ASSEGNATO',
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    taken_at TEXT,
    score_percent REAL,
    passed INTEGER,
    deferred INTEGER DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 120,
started_at TEXT,
ends_at TEXT,
timed_out INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(instructor_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    chosen_key TEXT,
    is_correct INTEGER,
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
  );
  `);

  const adminEmail = process.env.ADMIN_USERNAME || 'admin.naaf';
  const adminPass = process.env.ADMIN_PASSWORD || 'Camilla';

  const existing = await get('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPass, 12);
    const info = await run('INSERT INTO users(role,email,password_hash,must_change_password) VALUES (?,?,?,0)',
      ['admin', adminEmail, hash]
    );
    console.log(`Admin creato: ${adminEmail} (id=${info.lastID})`);
  } else {
    console.log('Admin già presente.');
  }

  console.log('DB pronto:', dbPath);
})().catch(err => {
  console.error('InitDB error:', err);
  process.exit(1);
});
