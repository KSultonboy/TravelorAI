const { prisma } = require('../config/database');

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'currentPassword', 'newPassword', 'token',
  'telegramBotToken', 'appSecret', 'secret', 'authorization', 'code',
]);

function sanitizeForAudit(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeForAudit(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key) || /password|secret|token/i.test(key)
      ? '[redacted]'
      : sanitizeForAudit(item, depth + 1);
  }
  return out;
}

function inferEntity(path = '') {
  const clean = String(path).split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  const known = ['bookings', 'leads', 'tasks', 'documents', 'business-documents', 'finance', 'automation', 'requisites', 'team', 'tours', 'reviews', 'presentations', 'telegram', 'profile', 'application', 'payments'];
  const index = parts.findIndex((part) => known.includes(part));
  if (index < 0) return { entityType: parts[0] || 'agency', entityId: null };
  return {
    entityType: parts[index],
    entityId: parts[index + 1] && !['import', 'csv', 'local', 'bootstrap'].includes(parts[index + 1]) ? parts[index + 1] : null,
  };
}

async function recordAudit({ agencyId, actorAccountId, actorEmail, action, entityType, entityId, requestPath, requestMethod, changes, ipAddress, userAgent, dedupeKey }) {
  if (!agencyId || !action) return null;
  return prisma.auditLog.create({
    data: {
      agencyId,
      actorAccountId: actorAccountId || null,
      actorEmail: actorEmail || null,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      requestPath: requestPath || null,
      requestMethod: requestMethod || null,
      changes: changes === undefined ? undefined : sanitizeForAudit(changes),
      ipAddress: ipAddress ? String(ipAddress).slice(0, 100) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      dedupeKey: dedupeKey || null,
    },
  });
}

module.exports = { inferEntity, recordAudit, sanitizeForAudit };
