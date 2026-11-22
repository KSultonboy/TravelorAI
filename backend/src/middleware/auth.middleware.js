const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');

function bearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

// Token imzosi to'g'ri bo'lsa ham u bekor qilingan bo'lishi mumkin: parol
// almashtirilganda tokenVersion oshiriladi, bloklangan foydalanuvchi esa kira olmaydi.
// Qaytaradi: { status: 'ok' | 'invalid' | 'blocked' }
async function checkUserSession(decoded) {
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, blocked: true, tokenVersion: true },
  });
  if (!user) return { status: 'invalid' };
  if (user.blocked) return { status: 'blocked' };
  if (Number(decoded.tv || 0) !== Number(user.tokenVersion || 0)) return { status: 'invalid' };
  return { status: 'ok' };
}

async function authMiddleware(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return error(res, 'Token talab qilinadi', 401);
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return error(res, 'Token yaroqsiz yoki muddati tugagan', 401);
  }

  let session;
  try {
    session = await checkUserSession(decoded);
  } catch (err) {
    logger.error('Auth middleware: session check failed', { message: err.message });
    return error(res, 'Xizmat vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.', 503);
  }

  if (session.status === 'blocked') {
    return error(res, 'Hisobingiz bloklangan. Qo\'llab-quvvatlashga murojaat qiling.', 403, { blocked: true });
  }
  if (session.status !== 'ok') {
    return error(res, 'Token yaroqsiz yoki muddati tugagan', 401);
  }

  req.user = decoded;
  return next();
}

async function optionalAuth(req, res, next) {
  const token = bearerToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      try {
        const session = await checkUserSession(decoded);
        if (session.status === 'ok') req.user = decoded;
      } catch (err) {
        // Ixtiyoriy autentifikatsiya: tekshirib bo'lmasa — mehmon sifatida davom etamiz.
        logger.warn('optionalAuth: session check failed', { message: err.message });
      }
    }
  }
  return next();
}

module.exports = { authMiddleware, optionalAuth, checkUserSession };
