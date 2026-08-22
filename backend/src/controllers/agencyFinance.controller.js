const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ACCOUNT_TYPES, DIRECTIONS, STATUSES, cleanCurrency, optionalDate, positiveAmount, summarizeTransactions } = require('../services/finance.service');
const { syncManagerCommission, supplierBalances, commissionSummary, paymentCalendar } = require('../services/financeWorkflow.service');
const { getExchangeRates } = require('../services/exchangeRate.service');

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}

async function listFinance(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const currency = cleanCurrency(req.query.currency);
    const from = optionalDate(req.query.from); const to = optionalDate(req.query.to);
    if (from === undefined || to === undefined) return error(res, 'Sana filtri noto‘g‘ri', 400);
    const dateWhere = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
    const [accounts, transactions, suppliers, team, branches] = await Promise.all([
      prisma.financeAccount.findMany({ where: { agencyId: agency.id, active: true }, orderBy: [{ currency: 'asc' }, { name: 'asc' }] }),
      prisma.financeTransaction.findMany({
        where: { agencyId: agency.id, currency, ...dateWhere },
        include: {
          account: { select: { id: true, name: true, type: true } },
          booking: { select: { id: true, customerName: true, leadTour: true } },
          businessDocument: { select: { id: true, number: true, type: true } },
          supplier: { select: { id: true, name: true, type: true } },
          managerMember: { select: { id: true, name: true } },
        },
        orderBy: [{ paidAt: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 5000,
      }),
      prisma.agencySupplier.findMany({ where: { agencyId: agency.id, active: true }, orderBy: { name: 'asc' } }),
      prisma.agencyMember.findMany({ where: { agencyId: agency.id, status: 'active' }, include: { commissionRule: true }, orderBy: { name: 'asc' } }),
      prisma.agencyBranch.findMany({ where: { agencyId: agency.id, active: true }, orderBy: { name: 'asc' } }),
    ]);
    return success(res, {
      accounts, transactions, suppliers, team, branches,
      supplierBalances: supplierBalances(suppliers, transactions, currency),
      commissions: commissionSummary(team, transactions, currency),
      calendar: paymentCalendar(transactions),
      summary: summarizeTransactions(transactions, accounts, currency),
    });
  } catch (err) { return error(res, err.message, 500); }
}

async function createAccount(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return error(res, 'Hisob nomini kiriting', 400);
    const type = ACCOUNT_TYPES.has(req.body?.type) ? req.body.type : 'cash';
    const openingBalance = Math.max(0, Number.parseInt(req.body?.openingBalance, 10) || 0);
    const branchId = req.body?.branchId ? String(req.body.branchId) : null;
    if (branchId && !(await prisma.agencyBranch.findFirst({ where: { id: branchId, agencyId: agency.id, active: true } }))) return error(res, 'Filial topilmadi', 404);
    const account = await prisma.financeAccount.create({ data: { agencyId: agency.id, branchId, name, type, currency: cleanCurrency(req.body?.currency), openingBalance } });
    return success(res, { account }, 201);
  } catch (err) { return error(res, err.code === 'P2002' ? 'Bu nom va valyutadagi hisob mavjud' : err.message, 400); }
}

async function assertRelations(agencyId, body) {
  const accountId = body.accountId ? String(body.accountId) : null;
  const bookingId = body.bookingId ? String(body.bookingId) : null;
  const businessDocumentId = body.businessDocumentId ? String(body.businessDocumentId) : null;
  const supplierId = body.supplierId ? String(body.supplierId) : null;
  const managerMemberId = body.managerMemberId ? String(body.managerMemberId) : null;
  const requestedBranchId = body.branchId ? String(body.branchId) : null;
  const [account, booking, document, supplier, manager, branch] = await Promise.all([
    accountId ? prisma.financeAccount.findFirst({ where: { id: accountId, agencyId, active: true } }) : null,
    bookingId ? prisma.tourBooking.findFirst({ where: { id: bookingId, agencyId }, include: { assignedMember: { select: { branchId: true } } } }) : null,
    businessDocumentId ? prisma.businessDocument.findFirst({ where: { id: businessDocumentId, agencyId } }) : null,
    supplierId ? prisma.agencySupplier.findFirst({ where: { id: supplierId, agencyId, active: true } }) : null,
    managerMemberId ? prisma.agencyMember.findFirst({ where: { id: managerMemberId, agencyId, status: 'active' } }) : null,
    requestedBranchId ? prisma.agencyBranch.findFirst({ where: { id: requestedBranchId, agencyId, active: true } }) : null,
  ]);
  if (accountId && !account) throw new Error('Hisob topilmadi');
  if (bookingId && !booking) throw new Error('Lid topilmadi');
  if (businessDocumentId && !document) throw new Error('Hujjat topilmadi');
  if (supplierId && !supplier) throw new Error('Hamkor topilmadi');
  if (managerMemberId && !manager) throw new Error('Menejer topilmadi');
  if (requestedBranchId && !branch) throw new Error('Filial topilmadi');
  const branchId = requestedBranchId || booking?.branchId || booking?.assignedMember?.branchId || manager?.branchId || account?.branchId || null;
  return { accountId, bookingId, businessDocumentId, supplierId, managerMemberId, branchId };
}

async function createTransaction(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    if (!DIRECTIONS.has(req.body?.direction)) return error(res, 'Tranzaksiya turi noto‘g‘ri', 400);
    const amount = positiveAmount(req.body?.amount); if (!amount) return error(res, 'Musbat summa kiriting', 400);
    const status = STATUSES.has(req.body?.status) ? req.body.status : 'planned';
    const dueAt = optionalDate(req.body?.dueAt); if (dueAt === undefined) return error(res, 'To‘lov muddati noto‘g‘ri', 400);
    const refs = await assertRelations(agency.id, req.body || {});
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.financeTransaction.create({ data: {
      agencyId: agency.id, ...refs, direction: req.body.direction, status,
      category: String(req.body?.category || (req.body.direction === 'income' ? 'Mijoz to‘lovi' : 'Operatsion xarajat')).trim().slice(0, 120),
      amount, currency: cleanCurrency(req.body?.currency), counterparty: String(req.body?.counterparty || '').trim().slice(0, 200) || null,
      paymentMethod: String(req.body?.paymentMethod || '').trim().slice(0, 80) || null,
      note: String(req.body?.note || '').trim().slice(0, 1000) || null, dueAt,
      paidAt: status === 'paid' ? optionalDate(req.body?.paidAt) || new Date() : null,
      createdByAccountId: req.agencyAccount.id,
      } });
      await syncManagerCommission(tx, created);
      return created;
    });
    return success(res, { transaction }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function updateTransaction(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.financeTransaction.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Tranzaksiya topilmadi', 404);
    const data = {};
    if (req.body?.status !== undefined) {
      if (!STATUSES.has(req.body.status)) return error(res, 'Holat noto‘g‘ri', 400);
      data.status = req.body.status; data.paidAt = req.body.status === 'paid' ? (optionalDate(req.body?.paidAt) || new Date()) : null;
    }
    if (req.body?.amount !== undefined) { const amount = positiveAmount(req.body.amount); if (!amount) return error(res, 'Musbat summa kiriting', 400); data.amount = amount; }
    if (req.body?.dueAt !== undefined) { const dueAt = optionalDate(req.body.dueAt); if (dueAt === undefined) return error(res, 'To‘lov muddati noto‘g‘ri', 400); data.dueAt = dueAt; }
    for (const key of ['category', 'counterparty', 'paymentMethod', 'note']) if (req.body?.[key] !== undefined) data[key] = String(req.body[key] || '').trim().slice(0, key === 'note' ? 1000 : 200) || null;
    const transaction = await prisma.$transaction(async (tx) => {
      const updated = await tx.financeTransaction.update({ where: { id: existing.id }, data });
      await syncManagerCommission(tx, updated);
      return updated;
    });
    return success(res, { transaction });
  } catch (err) { return error(res, err.message, 400); }
}

async function deleteTransaction(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.financeTransaction.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Tranzaksiya topilmadi', 404);
    await prisma.financeTransaction.delete({ where: { id: existing.id } });
    return success(res, { id: existing.id, deleted: true });
  } catch (err) { return error(res, err.message, 400); }
}

async function listExchangeRates(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const rates = await getExchangeRates({ date: req.query.date, force: req.query.refresh === '1' });
    return success(res, rates);
  } catch (err) { return error(res, err.message, 502); }
}

async function createSupplier(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const name = String(req.body?.name || '').trim().slice(0, 160);
    if (!name) return error(res, 'Hamkor nomini kiriting', 400);
    const supplier = await prisma.agencySupplier.create({ data: {
      agencyId: agency.id, name, type: String(req.body?.type || 'tour_operator').trim().slice(0, 40),
      taxId: String(req.body?.taxId || '').trim().slice(0, 40) || null,
      phone: String(req.body?.phone || '').trim().slice(0, 50) || null,
      email: String(req.body?.email || '').trim().toLowerCase().slice(0, 160) || null,
      currency: cleanCurrency(req.body?.currency), notes: String(req.body?.notes || '').trim().slice(0, 1000) || null,
    } });
    return success(res, { supplier }, 201);
  } catch (err) { return error(res, err.code === 'P2002' ? 'Bu hamkor mavjud' : err.message, 400); }
}

async function updateSupplier(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.agencySupplier.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Hamkor topilmadi', 404);
    const data = {};
    for (const key of ['name', 'type', 'taxId', 'phone', 'email', 'notes']) if (req.body?.[key] !== undefined) data[key] = String(req.body[key] || '').trim().slice(0, key === 'notes' ? 1000 : 160) || null;
    if (req.body?.active !== undefined) data.active = Boolean(req.body.active);
    const supplier = await prisma.agencySupplier.update({ where: { id: existing.id }, data });
    return success(res, { supplier });
  } catch (err) { return error(res, err.message, 400); }
}

async function saveCommissionRule(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const member = await prisma.agencyMember.findFirst({ where: { id: req.params.memberId, agencyId: agency.id, status: 'active' } });
    if (!member) return error(res, 'Menejer topilmadi', 404);
    const percent = Math.max(0, Math.min(100, Number(req.body?.percent || 0)));
    const fixedAmount = Math.max(0, Number.parseInt(req.body?.fixedAmount, 10) || 0);
    const rule = await prisma.managerCommissionRule.upsert({
      where: { memberId: member.id },
      create: { agencyId: agency.id, memberId: member.id, percent, fixedAmount, currency: cleanCurrency(req.body?.currency), active: req.body?.active !== false },
      update: { percent, fixedAmount, currency: cleanCurrency(req.body?.currency), active: req.body?.active !== false },
    });
    return success(res, { rule });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { createAccount, createTransaction, createSupplier, deleteTransaction, listExchangeRates, listFinance, saveCommissionRule, updateSupplier, updateTransaction };
