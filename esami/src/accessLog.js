// src/accessLog.js
const { run } = require('./db');

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf && typeof xf === 'string') return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : null;
}

/**
 * Log eventi di accesso: login_success, login_failed, logout
 * @param {import('express').Request} req
 * @param {{ userId?: number|null, email?: string|null, event: string, details?: any }} data
 */
async function logAccess(req, { userId = null, email = null, event, details = null }) {
  if (!event) throw new Error('logAccess: event is required');

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : null;

  await run(
    `INSERT INTO access_log (user_id, email, event, ip, user_agent, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, email, event, ip, userAgent, safeJson(details)]
  );
}

module.exports = { logAccess };
