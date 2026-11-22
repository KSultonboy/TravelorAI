const crypto = require('crypto');
const { error } = require('../utils/response');
const { getSecret } = require('../config/env');

// Uzunlikdan qat'i nazar doimiy vaqtli taqqoslash: ikkala qiymat avval SHA-256
// orqali bir xil (32 bayt) uzunlikka keltiriladi, keyin timingSafeEqual.
function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function adminAuthMiddleware(req, res, next) {
  const key = req.headers['x-admin-key'];
  let expectedKey = '';
  try {
    expectedKey = getSecret('ADMIN_SECRET_KEY');
  } catch {
    expectedKey = ''; // production'da noto'g'ri sozlangan — hech kimni kiritmaymiz
  }

  if (typeof key !== 'string' || !key || !expectedKey || !safeEqual(key, expectedKey)) {
    return error(res, 'Forbidden', 403);
  }
  return next();
}

module.exports = { adminAuthMiddleware, safeEqual };
