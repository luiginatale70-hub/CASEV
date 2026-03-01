/**
 * NAAF Logger – log su file rotante giornaliero
 * File: src/logger.js
 *
 * Scrive in:  logs/naaf-YYYY-MM-DD.log
 * Livelli:    INFO | WARN | ERROR | DB | HTTP | AUTH
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getLogFile() {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return path.join(LOG_DIR, `naaf-${date}.log`);
}

function write(level, category, message, extra) {
  const now = new Date().toISOString();
  let line = `[${now}] [${level.padEnd(5)}] [${category.padEnd(6)}] ${message}`;
  if (extra && typeof extra === 'object') {
    try { line += ' | ' + JSON.stringify(extra); } catch(_) {}
  }
  line += '\n';

  // Scrive su file
  fs.appendFile(getLogFile(), line, () => {});

  // Stampa anche su console con colori
  const colors = { INFO:'', WARN:'\x1b[33m', ERROR:'\x1b[31m', DB:'\x1b[36m', HTTP:'\x1b[32m', AUTH:'\x1b[35m' };
  const reset = '\x1b[0m';
  process.stdout.write((colors[level] || '') + line + reset);
}

const logger = {
  info:  (cat, msg, extra) => write('INFO',  cat, msg, extra),
  warn:  (cat, msg, extra) => write('WARN',  cat, msg, extra),
  error: (cat, msg, extra) => write('ERROR', cat, msg, extra),
  db:    (msg, extra)      => write('DB',    'DB',    msg, extra),
  http:  (msg, extra)      => write('HTTP',  'HTTP',  msg, extra),
  auth:  (msg, extra)      => write('AUTH',  'AUTH',  msg, extra),
};

module.exports = logger;
