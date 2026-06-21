const crypto = require('crypto');
const { error } = require('../utils/response');

function adminAuthMiddleware(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV !== 'production' ? 'change_me' : '');
  const keyBuffer = Buffer.from(String(key || ''));
  const expectedBuffer = Buffer.from(expectedKey);
  const valid =
    keyBuffer.length === expectedBuffer.length &&
    expectedBuffer.length > 0 &&
    crypto.timingSafeEqual(keyBuffer, expectedBuffer);
  if (!valid) {
    return error(res, 'Forbidden', 403);
  }
  next();
}

module.exports = { adminAuthMiddleware };
