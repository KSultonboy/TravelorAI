const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { cleanCurrency } = require('../services/finance.service');
const { branchDashboard, cashflowForecast, managerPayroll, profitAndLoss } = require('../services/executiveReports.service');

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}

function parsePeriod(query = {}) {
  const now = new Date();
  const from = query.from ? new Date(String(query.from)) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = query.to ? new Date(String(query.to)) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  if (to.getTime() - from.getTime() > 3 * 366 * 86400000) return null;
  return { from, to };
}

async function executiveReport(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const period = parsePeriod(req.query);
    if (!period) return error(res, 'Hisobot davri noto‘g‘ri yoki 3 yildan uzun', 400);
    const currency = cleanCurrency(req.query.currency);
    const weeks = Math.max(4, Math.min(26, parseInt(req.query.weeks, 10) || 12));
    const bookingPeriod = { gte: period.from, lte: period.to };
    const [branches, members, bookings, accounts, transactions] = await Promise.all([
      prisma.agencyBranch.findMany({ where: { agencyId: agency.id }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      prisma.agencyMember.findMany({
        where: { agencyId: agency.id },
        include: { branch: true, payrollProfile: true, commissionRule: true },
        orderBy: { name: 'asc' },
      }),
      prisma.tourBooking.findMany({
        where: { agencyId: agency.id, OR: [{ createdAt: bookingPeriod }, { confirmedAt: bookingPeriod }, { completedAt: bookingPeriod }] },
        include: { assignedMember: { select: { id: true, branchId: true } } },
        take: 100000,
      }),
      prisma.financeAccount.findMany({ where: { agencyId: agency.id }, orderBy: { name: 'asc' } }),
      prisma.financeTransaction.findMany({
        where: { agencyId: agency.id, currency, status: { not: 'cancelled' } },
        include: {
          account: { select: { id: true, branchId: true } },
          booking: { select: { id: true, branchId: true, assignedMember: { select: { branchId: true } } } },
          managerMember: { select: { id: true, branchId: true } },
        },
        orderBy: { createdAt: 'asc' }, take: 100000,
      }),
    ]);
    const options = { currency, ...period };
    return success(res, {
      period: { ...period, currency, weeks },
      pnl: profitAndLoss(transactions, options),
      cashflow: cashflowForecast(accounts, transactions, { currency, weeks }),
      payroll: managerPayroll(members, bookings, transactions, options),
      branches: branchDashboard(branches, members, bookings, transactions, options),
      directory: { branches, members },
    });
  } catch (err) { return error(res, err.message, 500); }
}

async function createBranch(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (name.length < 2) return error(res, 'Filial nomini kiriting', 400);
    const branch = await prisma.agencyBranch.create({ data: {
      agencyId: agency.id, name,
      city: String(req.body?.city || '').trim().slice(0, 120) || null,
      address: String(req.body?.address || '').trim().slice(0, 240) || null,
    } });
    return success(res, { branch }, 201);
  } catch (err) { return error(res, err.code === 'P2002' ? 'Bu nomdagi filial mavjud' : err.message, 400); }
}

async function updateBranch(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const found = await prisma.agencyBranch.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!found) return error(res, 'Filial topilmadi', 404);
    const data = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim().slice(0, 120);
      if (name.length < 2) return error(res, 'Filial nomini kiriting', 400);
      data.name = name;
    }
    for (const key of ['city', 'address']) if (req.body?.[key] !== undefined) data[key] = String(req.body[key] || '').trim().slice(0, key === 'city' ? 120 : 240) || null;
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    const branch = await prisma.agencyBranch.update({ where: { id: found.id }, data });
    return success(res, { branch });
  } catch (err) { return error(res, err.code === 'P2002' ? 'Bu nomdagi filial mavjud' : err.message, 400); }
}

async function assignMemberBranch(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const member = await prisma.agencyMember.findFirst({ where: { id: req.params.memberId, agencyId: agency.id, status: 'active' } });
    if (!member) return error(res, 'Xodim topilmadi', 404);
    const branchId = req.body?.branchId ? String(req.body.branchId) : null;
    if (branchId && !(await prisma.agencyBranch.findFirst({ where: { id: branchId, agencyId: agency.id, active: true } }))) return error(res, 'Filial topilmadi', 404);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.agencyMember.update({ where: { id: member.id }, data: { branchId } });
      await tx.tourBooking.updateMany({ where: { agencyId: agency.id, assignedMemberId: member.id, branchId: null }, data: { branchId } });
      return row;
    });
    return success(res, { member: updated });
  } catch (err) { return error(res, err.message, 400); }
}

async function savePayrollProfile(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const member = await prisma.agencyMember.findFirst({ where: { id: req.params.memberId, agencyId: agency.id, status: 'active' } });
    if (!member) return error(res, 'Xodim topilmadi', 404);
    const baseSalary = Math.max(0, parseInt(req.body?.baseSalary, 10) || 0);
    const bonusPerWon = Math.max(0, parseInt(req.body?.bonusPerWon, 10) || 0);
    const payoutDay = Math.max(1, Math.min(28, parseInt(req.body?.payoutDay, 10) || 5));
    const data = { agencyId: agency.id, memberId: member.id, baseSalary, bonusPerWon, payoutDay, currency: cleanCurrency(req.body?.currency), active: req.body?.active !== false };
    const profile = await prisma.managerPayrollProfile.upsert({ where: { memberId: member.id }, create: data, update: data });
    return success(res, { profile });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { assignMemberBranch, createBranch, executiveReport, savePayrollProfile, updateBranch };

