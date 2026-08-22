const crypto = require('crypto');
const { prisma } = require('../config/database');
const { resolveAccess } = require('../config/agencyPlans');

const API_SCOPES = ['leads:read', 'leads:write', 'tours:read', 'finance:read'];

function hashApiKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function normalizeScopes(scopes) {
  return [...new Set((Array.isArray(scopes) ? scopes : []).filter((scope) => API_SCOPES.includes(scope)))];
}

async function createApiKey({ agencyId, name, scopes, rateLimitPerMinute = 120, expiresAt, createdByAccountId }) {
  const cleanScopes = normalizeScopes(scopes);
  if (!cleanScopes.length) throw new Error('Kamida bitta API scope tanlang');
  const rawKey = `tai_live_${crypto.randomBytes(32).toString('base64url')}`;
  const apiKey = await prisma.publicApiKey.create({
    data: {
      agencyId,
      name: String(name || '').trim().slice(0, 100),
      keyPrefix: rawKey.slice(0, 18),
      keyHash: hashApiKey(rawKey),
      scopes: cleanScopes,
      rateLimitPerMinute: Math.min(1000, Math.max(10, Number(rateLimitPerMinute) || 120)),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdByAccountId: createdByAccountId || null,
    },
  });
  return { apiKey, rawKey };
}

async function authenticateApiKey(raw) {
  if (!String(raw || '').startsWith('tai_live_')) return null;
  const apiKey = await prisma.publicApiKey.findUnique({
    where: { keyHash: hashApiKey(raw) },
    include: { agency: { include: { tariff: true } } },
  });
  if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt <= new Date())) return null;
  const access = resolveAccess(apiKey.agency, 'owner');
  if (!apiKey.agency?.active || access.readOnly || access.caps.integrations === false) return { blocked: true, apiKey };
  prisma.publicApiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { blocked: false, apiKey };
}

module.exports = { API_SCOPES, hashApiKey, normalizeScopes, createApiKey, authenticateApiKey };
