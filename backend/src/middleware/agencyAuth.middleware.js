const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { error } = require('../utils/response');
const { verifyAgencyToken } = require('../utils/agencyJwt');

// Express 4 async xatolarni ushlamaydi — shuning uchun hammasi try/catch ichida:
// DB ishlamasa jarayon qulamaydi, 503 qaytadi.
async function agencyAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Agency token talab qilinadi', 401);
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = verifyAgencyToken(token);
    if (!decoded?.id) {
      return error(res, 'Agency token yaroqsiz yoki muddati tugagan', 401);
    }

    let account;
    try {
      account = await prisma.agencyAccount.findUnique({ where: { id: decoded.id } });
    } catch (err) {
      logger.error('Agency auth middleware: account lookup failed', { message: err.message });
      return error(res, 'Xizmat vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.', 503);
    }

    if (!account) return error(res, 'Agency akkaunt topilmadi', 401);
    if (account.status === 'blocked') return error(res, 'Agency akkaunt bloklangan', 403);
    // Parol almashtirilgan/tiklanganda tokenVersion oshadi — eski tokenlar bekor bo'ladi.
    if (Number(decoded.tv || 0) !== Number(account.tokenVersion || 0)) {
      return error(res, 'Agency token yaroqsiz yoki muddati tugagan', 401);
    }

    req.agencyAccount = account;
    req.agencyToken = decoded; // iat — "yaqinda kirgan" tekshiruvlari uchun
    return next();
  } catch (err) {
    logger.error('Agency auth middleware failed', { message: err.message });
    return error(res, 'Agency token yaroqsiz yoki muddati tugagan', 401);
  }
}

module.exports = { agencyAuthMiddleware };
