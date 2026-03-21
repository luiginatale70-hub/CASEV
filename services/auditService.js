const db = require('../config/db');

async function logAction({ userId, action, entityType, entityId, esito, req, details }) {
  try {
    await db.query(
      `INSERT INTO audit_log 
      (user_id, action, entity_type, entity_id, ip, user_agent, details_json, esito)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action || null,
        entityType || null,
        entityId || null,
        req?.ip || null,
        req?.headers['user-agent'] || null,
        details ? JSON.stringify(details) : null,
        esito || null
      ]
    );
  } catch (err) {
    console.error('AUDIT ERROR:', err.message);
  }
}

module.exports = { logAction };
