const { error } = require('../utils/response');

function adminAuthMiddleware(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return error(res, 'Forbidden', 403);
  }
  next();
}

module.exports = { adminAuthMiddleware };
