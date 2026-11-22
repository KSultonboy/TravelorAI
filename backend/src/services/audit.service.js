const { prisma } = require('../config/database');

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'currentPassword', 'newPassword', 'token',
  'telegramBotToken', 'appSecret', 'secret', 'authorization', 'code',
]);

// Fayl tanalari (pasport skani, rasm, PDF) audit jurnali va outbound webhook
// payload'iga HECH QACHON tushmasligi kerak — faqat hajmi haqida belgi qoladi.
const FILE_BODY_KEYS = /^(dataurl|data_url|filedata|file_data|base64|content(base64)?|data|buffer|file|csv)$/i;
const DATA_URL_RE = /^data:[^;,]{0,100};base64,/i;

function omittedFile(value) {
  const size = typeof value === 'string' ? value.length : (value && value.length) || 0;
  return `[fayl olib tashlandi: ${size} belgi]`;
}

function sanitizeForAudit(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return omittedFile(value);
  if (typeof value === 'string') {
    if (DATA_URL_RE.test(value)) return omittedFile(value);
    return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeForAudit(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key) || /password|secret|token/i.test(key)) out[key] = '[redacted]';
    else if (FILE_BODY_KEYS.test(key) && (typeof item === 'string' ? item.length > 200 : Buffer.isBuffer(item))) out[key] = omittedFile(item);
    else out[key] = sanitizeForAudit(item, depth + 1);
  }
  return out;
}

function inferEntity(path = '') {
  const clean = String(path).split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  const known = ['bookings', 'leads', 'tasks', 'documents', 'business-documents', 'finance', 'automation', 'integrations', 'requisites', 'team', 'tours', 'reviews', 'presentations', 'telegram', 'profile', 'application', 'payments'];
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
