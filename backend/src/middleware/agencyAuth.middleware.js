const { prisma } = require('../config/database');
const { error } = require('../utils/response');
const { verifyAgencyToken } = require('../utils/agencyJwt');

async function agencyAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Agency token talab qilinadi', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAgencyToken(token);
  if (!decoded?.id) {
    return error(res, 'Agency token yaroqsiz yoki muddati tugagan', 401);
  }

  const account = await prisma.agencyAccount.findUnique({ where: { id: decoded.id } });
  if (!account) return error(res, 'Agency akkaunt topilmadi', 401);
  if (account.status === 'blocked') return error(res, 'Agency akkaunt bloklangan', 403);

  req.agencyAccount = account;
  const isPasswordRoute = req.path === '/auth/change-password' && req.method === 'POST';
  const isMeRoute = req.path === '/auth/me' && req.method === 'GET';
  if (account.mustChangePassword && !isPasswordRoute && !isMeRoute) {
    return error(res, "Avval yangi parol qo'ying", 403, { code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}

module.exports = { agencyAuthMiddleware };
