// Agentlik CRM uchun server tomonidagi rol va tasdiq tekshiruvlari.
// agencyAuthMiddleware + agencyPlan'dan KEYIN ishlaydi (req.agencyAccount,
// req.agency, req.memberRole mavjud bo'ladi).
//
// UI (KvCabinet) bo'limlarni ROLE_SECTIONS bo'yicha yashiradi, lekin bu faqat
// ko'rinish — haqiqiy cheklov shu yerda, har bir yo'lda.
const { error } = require('../utils/response');
const { ROLE_SECTIONS } = require('../config/agencyPlans');

const ALL_ROLES = Object.keys(ROLE_SECTIONS); // owner, manager, agent, accountant

// Bo'lim bo'yicha ruxsat etilgan rollar (agencyPlans.ROLE_SECTIONS bilan bir xil).
function rolesForSection(section) {
  return ALL_ROLES.filter((role) => ROLE_SECTIONS[role].includes(section));
}

const ROLE_GROUPS = Object.freeze({
  owner: ['owner'],
  ownerManager: ['owner', 'manager'],
  // Lidlar va mijoz yozishmasi — leads bo'limi (buxgalterda yo'q).
  leads: rolesForSection('leads'),
  // Turlar (packages) — buxgalterda yo'q.
  packages: rolesForSection('packages'),
  // Moliya yozuvlari — payments bo'limi (agentda yo'q).
  finance: rolesForSection('payments'),
  // Pasport / viza fayllari: lid bilan ishlaydigan xodimlar. Buxgalterga kerak emas.
  leadFiles: rolesForSection('leads'),
});

function requireRole(roles) {
  const allowed = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    const role = req.memberRole;
    if (!role || !allowed.has(role)) {
      return error(res, "Sizning rolingiz bu amalni bajarishga ruxsat bermaydi", 403, {
        code: 'ROLE_FORBIDDEN',
        role: role || null,
        allowedRoles: [...allowed],
      });
    }
    return next();
  };
}

// Agentlik admin tomonidan tasdiqlangan va faol bo'lishi shart. Rad etilgan
// yoki o'chirilgan agentlik CRM'dan foydalana olmaydi; profil/holat va
// billing yo'llari bu middleware'dan OLDIN ulanadi, shuning uchun u sababni ko'ra oladi.
function requireApprovedAgency(req, res, next) {
  const account = req.agencyAccount;
  const agency = req.agency;

  if (!agency) {
    return error(res, 'Agentlik profili hali tasdiqlanmagan. Ariza holatini kuting.', 403, { code: 'AGENCY_NOT_APPROVED' });
  }
  if (agency.approvalStatus === 'rejected') {
    return error(res, 'Agentlik arizasi rad etilgan. Sababini profil sahifasida ko‘ring.', 403, {
      code: 'AGENCY_REJECTED',
      adminNote: agency.adminNote || null,
    });
  }
  if (agency.active !== true) {
    return error(res, 'Agentlik faol emas. Administrator bilan bog‘laning.', 403, { code: 'AGENCY_INACTIVE' });
  }
  if (agency.approvalStatus !== 'approved') {
    return error(res, 'Agentlik hali admin tomonidan tasdiqlanmagan.', 403, { code: 'AGENCY_NOT_APPROVED' });
  }
  if (!account || account.status !== 'approved') {
    return error(res, 'Akkaunt hali tasdiqlanmagan.', 403, { code: 'ACCOUNT_NOT_APPROVED' });
  }
  return next();
}

module.exports = { requireRole, requireApprovedAgency, ROLE_GROUPS, rolesForSection };
