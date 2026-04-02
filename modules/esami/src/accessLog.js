const { run } = require('./db');
function safeJson(v) { try { return JSON.stringify(v ?? null); } catch { return null; } }
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf && typeof xf === 'string') return xf.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : null;
}
async function logAccess(req, { userId=null, email=null, event, details=null }) {
  if (!event) throw new Error('logAccess: event is required');
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] ? String(req.headers['user-agent']) : null;
  await run('INSERT INTO esami_access_log (user_id, email, event, ip, user_agent, details_json) VALUES (?,?,?,?,?,?)',
    [userId, email, event, ip, ua, safeJson(details)]);
}
module.exports = { logAccess };