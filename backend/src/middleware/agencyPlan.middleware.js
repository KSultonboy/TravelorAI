// Agency obuna/tarif enforcement middleware'lari.
// agencyAuthMiddleware'dan KEYIN ishlaydi (req.agencyAccount mavjud).
const { prisma } = require('../config/database');
const { error } = require('../utils/response');
const { resolveAccess } = require('../config/agencyPlans');

// req.agency (TourAgency + tariff) va req.access ni bir marta yuklaydi.
async function agencyPlan(req, res, next) {
  try {
    // 1) Egasi sifatida (ownerAccountId)
    let agency = await prisma.tourAgency.findFirst({
      where: { ownerAccountId: req.agencyAccount.id },
      include: { tariff: true, _count: { select: { tours: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    let role = agency ? 'owner' : null;

    // 2) Aks holda — xodim (AgencyMember) sifatida
    if (!agency) {
      const member = await prisma.agencyMember.findFirst({
        where: { accountId: req.agencyAccount.id, status: 'active' },
        include: { agency: { include: { tariff: true, _count: { select: { tours: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
      if (member) { agency = member.agency; role = member.role; }
    }

    req.agency = agency;
    req.memberRole = role || 'owner';
    req.access = resolveAccess(agency, req.memberRole);
    next();
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// To'lov muddati o'tган bo'lsa — yozuv operatsiyalarini bloklaydi (faqat o'qish).
function blockWhenReadOnly(req, res, next) {
  if (req.access && req.access.readOnly) {
    return error(
      res,
      "Obuna muddati tugagan — faqat o'qish rejimi. Davom etish uchun to'lovni yangilang.",
      402,
      { code: 'SUBSCRIPTION_EXPIRED' }
    );
  }
  next();
}

// Tarif darajasi imkoniyatni bermasa — bloklaydi (masalan Starter'да Telegram).
function requireCapability(cap) {
  return (req, res, next) => {
    if (!req.access || !req.access.caps || !req.access.caps[cap]) {
      return error(
        res,
        "Bu imkoniyat sizning tarifingizda mavjud emas. Yuqoriroq tarifga o'ting.",
        403,
        { code: 'UPGRADE_REQUIRED', capability: cap }
      );
    }
    next();
  };
}

module.exports = { agencyPlan, blockWhenReadOnly, requireCapability };
