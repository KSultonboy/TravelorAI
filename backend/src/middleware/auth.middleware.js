const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token talab qilinadi', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return error(res, 'Token yaroqsiz yoki muddati tugagan', 401);
  }

  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
  next();
}

module.exports = { authMiddleware, optionalAuth };
