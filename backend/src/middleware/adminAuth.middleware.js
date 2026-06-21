const { error } = require('../utils/response');
const { verifyToken } = require('../utils/jwt');

// Admin marshrutlari ikki yo'l bilan himoyalangan:
//   1) x-admin-key (eski website admin-proxy secret) — orqaga moslik uchun.
//   2) Bearer JWT (role=admin) — yangi premium admin panel.
function adminAuthMiddleware(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY || (process.env.NODE_ENV !== 'production' ? 'change_me' : '');
  if (key && expectedKey && key === expectedKey) {
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.role === 'admin') {
      req.adminUser = { id: decoded.id, email: decoded.email, username: decoded.username, role: 'admin' };
      return next();
    }
  }

  return error(res, 'Forbidden', 403);
}

module.exports = { adminAuthMiddleware };
