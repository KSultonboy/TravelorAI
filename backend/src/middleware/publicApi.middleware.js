const { authenticateApiKey } = require('../services/publicApiKey.service');
const { error } = require('../utils/response');

const windows = new Map();

async function publicApiAuth(req, res, next) {
  try {
    const bearer = String(req.headers.authorization || '').startsWith('Bearer ')
      ? String(req.headers.authorization).slice(7).trim()
      : '';
    const raw = bearer || String(req.headers['x-api-key'] || '').trim();
    const auth = await authenticateApiKey(raw);
    if (!auth) return error(res, 'API kalit yaroqsiz yoki bekor qilingan', 401, { code: 'INVALID_API_KEY' });
    if (auth.blocked) return error(res, 'Agentlik obunasi faol emas', 402, { code: 'SUBSCRIPTION_EXPIRED' });

    const now = Date.now(); const windowStart = Math.floor(now / 60000); const id = auth.apiKey.id;
    const current = windows.get(id);
    const count = current?.windowStart === windowStart ? current.count + 1 : 1;
    windows.set(id, { windowStart, count });
    const limit = auth.apiKey.rateLimitPerMinute;
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
    if (count > limit) return error(res, 'API so‘rov limiti tugadi', 429, { code: 'RATE_LIMITED' });

    req.publicApiKey = auth.apiKey;
    req.agency = auth.apiKey.agency;
    next();
  } catch (err) {
    return error(res, err.message, 500);
  }
}

function requireApiScope(scope) {
  return (req, res, next) => {
    if (!req.publicApiKey?.scopes?.includes(scope)) return error(res, `API scope talab qilinadi: ${scope}`, 403, { code: 'INSUFFICIENT_SCOPE', scope });
    next();
  };
}

module.exports = { publicApiAuth, requireApiScope };
