/**
 * To'lov endpointlari uchun kuchaytirilgan user tekshiruvi.
 *
 * Oddiy authMiddleware faqat JWT imzosini tekshiradi (DB lookup YO'Q) — bu
 * pul harakati uchun yetarli emas:
 *   • bloklangan/o'chirilgan user 7 kungacha amaldagi token bilan yurishi mumkin;
 *   • AGENCY_JWT_SECRET o'rnatilmagan bo'lsa agentlik tokeni user secret bilan
 *     verify bo'lib ketadi (fallback zanjiri) — role claim orqali rad etamiz.
 *
 * authMiddleware'dan KEYIN ulanadi; req.dbUser (to'liq DB yozuvi) qo'yadi.
 */

const { prisma } = require('../config/database');
const { error } = require('../utils/response');

function requireDbUser({ requireVerifiedEmail = false } = {}) {
  return async function (req, res, next) {
    try {
      if (!req.user || !req.user.id) return error(res, 'Token talab qilinadi', 401);

      // Agentlik/boshqa tizim tokenlari user to'lovlariga o'tmasin
      if (req.user.role && req.user.role !== 'traveler') {
        return error(res, 'Bu amal faqat foydalanuvchi akkaunti uchun', 403);
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return error(res, 'Akkaunt topilmadi', 401);
      if (user.blocked) return error(res, 'Akkaunt bloklangan', 403);
      if (requireVerifiedEmail && !user.emailVerified) {
        return error(res, "To'lovdan oldin email manzilingizni tasdiqlang", 403);
      }

      req.dbUser = user;
      return next();
    } catch (e) {
      console.error('[paymentUser]', e.message);
      return error(res, 'Xatolik', 500);
    }
  };
}

module.exports = { requireDbUser };
