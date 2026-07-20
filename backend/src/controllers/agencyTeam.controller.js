// Agentlik jamoasi — xodimlar + rollar (Business tarif imkoniyati).
// Egasi = TourAgency.ownerAccountId (AgencyMember'da saqlanmaydi).
// Xodimlar (manager/agent/accountant) = AgencyMember + o'z AgencyAccount'i.
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

const ROLES = ['manager', 'agent', 'accountant'];

// GET /agency/team — egasi + xodimlar ro'yxati
async function listTeam(req, res) {
  try {
    if (!req.agency) return success(res, { items: [], role: req.memberRole, canManage: false });
    const [owner, members] = await Promise.all([
      req.agency.ownerAccountId
        ? prisma.agencyAccount.findUnique({ where: { id: req.agency.ownerAccountId }, select: { email: true } })
        : null,
      prisma.agencyMember.findMany({
        where: { agencyId: req.agency.id },
        include: { account: { select: { email: true, lastLoginAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const items = [
      { id: 'owner', name: req.agency.name, email: owner ? owner.email : null, role: 'owner', isOwner: true },
      ...members.map((m) => ({
        id: m.id, name: m.name, email: m.account.email, role: m.role, status: m.status, lastLoginAt: m.account.lastLoginAt,
      })),
    ];
    return success(res, { items, role: req.memberRole, canManage: req.memberRole === 'owner' });
  } catch (err) { return error(res, err.message, 500); }
}

// POST /agency/team — xodim qo'shish (faqat egasi)
async function addMember(req, res) {
  try {
    if (req.memberRole !== 'owner') return error(res, "Faqat egasi xodim qo'sha oladi", 403);
    if (!req.agency) return error(res, 'Agentlik topilmadi', 404);
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const role = ROLES.includes(b.role) ? b.role : 'agent';
    if (name.length < 2) return error(res, 'Ism kiriting', 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error(res, "Email noto'g'ri", 400);
    if (password.length < 6) return error(res, 'Parol kamida 6 belgi bo\'lsin', 400);

    const existing = await prisma.agencyAccount.findUnique({ where: { email } });
    if (existing) return error(res, "Bu email allaqachon ro'yxatdan o'tgan", 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await prisma.agencyAccount.create({
      data: { email, passwordHash, emailVerified: true, status: 'approved' },
    });
    const member = await prisma.agencyMember.create({
      data: { agencyId: req.agency.id, accountId: account.id, name, role, status: 'active' },
    });
    return success(res, { id: member.id, name, email, role: member.role }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

// PUT /agency/team/:id — rolni o'zgartirish (faqat egasi)
async function updateMember(req, res) {
  try {
    if (req.memberRole !== 'owner') return error(res, "Faqat egasi o'zgartira oladi", 403);
    const role = ROLES.includes(req.body && req.body.role) ? req.body.role : null;
    if (!role) return error(res, "Rol noto'g'ri", 400);
    const member = await prisma.agencyMember.findFirst({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!member) return error(res, 'Xodim topilmadi', 404);
    const updated = await prisma.agencyMember.update({ where: { id: member.id }, data: { role } });
    return success(res, { id: updated.id, role: updated.role });
  } catch (err) { return error(res, err.message, 400); }
}

// DELETE /agency/team/:id — xodimni o'chirish (faqat egasi)
async function removeMember(req, res) {
  try {
    if (req.memberRole !== 'owner') return error(res, "Faqat egasi o'chira oladi", 403);
    const member = await prisma.agencyMember.findFirst({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!member) return error(res, 'Xodim topilmadi', 404);
    await prisma.agencyMember.delete({ where: { id: member.id } });
    // Xodim akkaunti faqat shu agentlik uchun yaratilган — uni ham o'chiramiz.
    await prisma.agencyAccount.delete({ where: { id: member.accountId } }).catch(() => {});
    return success(res, { id: member.id });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { listTeam, addMember, updateMember, removeMember };
