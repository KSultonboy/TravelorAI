const { error } = require('../utils/response');

function adminAuthMiddleware(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV !== 'production' ? 'change_me' : '');
  if (!key || !expectedKey || key !== expectedKey) {
    return error(res, 'Forbidden', 403);
  }
  next();
}

module.exports = { adminAuthMiddleware };
