const { run } = require('./db');
function safeJson(v) { try { return JSON.stringify(v ?? null); } catch { return null; } }
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf && typeof xf === 'string') return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : null;
}
async function writeAudit(req, { action, entityType=null, entityId=null, details=null }) {
  if (!action) throw new Error('writeAudit: action is required');
  const user = (req.session && req.session.user) ? req.session.user : null;
  const ip   = getClientIp(req);
  const ua   = req.headers['user-agent'] ? String(req.headers['user-agent']) : null;
  await run(
    'INSERT INTO esami_audit_log (actor_user_id, actor_role, action, entity_type, entity_id, ip, user_agent, details_json) VALUES (?,?,?,?,?,?,?,?)',
    [user&&user.id?user.id:null, user&&user.role?user.role:null, action, entityType, entityId, ip, ua, safeJson(details)]
  );
}
module.exports = { writeAudit };