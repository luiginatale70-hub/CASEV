// src/audit.js
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
 * Audit azioni applicative: chi ha fatto cosa, quando, su quale entità.
 * @param {import('express').Request} req
 * @param {{ action: string, entityType?: string|null, entityId?: number|null, details?: any }} data
 */
async function writeAudit(req, { action, entityType = null, entityId = null, details = null }) {
  if (!action) throw new Error('writeAudit: action is required');

  // nel tuo progetto l’utente è in sessione
  const user = (req.session && req.session.user) ? req.session.user : null;

  const actorUserId = user && user.id ? user.id : null;
  const actorRole = user && user.role ? user.role : null;

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : null;

  await run(
    `INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, ip, user_agent, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [actorUserId, actorRole, action, entityType, entityId, ip, userAgent, safeJson(details)]
  );
}

module.exports = { writeAudit };
