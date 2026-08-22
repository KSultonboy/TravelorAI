const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ACCOUNT_TYPES, DIRECTIONS, STATUSES, cleanCurrency, optionalDate, positiveAmount, summarizeTransactions } = require('../services/finance.service');

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
    const [accounts, transactions] = await Promise.all([
      prisma.financeAccount.findMany({ where: { agencyId: agency.id, active: true }, orderBy: [{ currency: 'asc' }, { name: 'asc' }] }),
      prisma.financeTransaction.findMany({
        where: { agencyId: agency.id, currency, ...dateWhere },
        include: {
          account: { select: { id: true, name: true, type: true } },
          booking: { select: { id: true, customerName: true, leadTour: true } },
          businessDocument: { select: { id: true, number: true, type: true } },
        },
        orderBy: [{ paidAt: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }], take: 5000,
      }),
    ]);
    return success(res, { accounts, transactions, summary: summarizeTransactions(transactions, accounts, currency) });
  } catch (err) { return error(res, err.message, 500); }
}

async function createAccount(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return error(res, 'Hisob nomini kiriting', 400);
    const type = ACCOUNT_TYPES.has(req.body?.type) ? req.body.type : 'cash';
    const openingBalance = Math.max(0, Number.parseInt(req.body?.openingBalance, 10) || 0);
    const account = await prisma.financeAccount.create({ data: { agencyId: agency.id, name, type, currency: cleanCurrency(req.body?.currency), openingBalance } });
    return success(res, { account }, 201);
  } catch (err) { return error(res, err.code === 'P2002' ? 'Bu nom va valyutadagi hisob mavjud' : err.message, 400); }
}

async function assertRelations(agencyId, body) {
  const accountId = body.accountId ? String(body.accountId) : null;
  const bookingId = body.bookingId ? String(body.bookingId) : null;
  const businessDocumentId = body.businessDocumentId ? String(body.businessDocumentId) : null;
  const [account, booking, document] = await Promise.all([
    accountId ? prisma.financeAccount.findFirst({ where: { id: accountId, agencyId, active: true } }) : null,
    bookingId ? prisma.tourBooking.findFirst({ where: { id: bookingId, agencyId } }) : null,
    businessDocumentId ? prisma.businessDocument.findFirst({ where: { id: businessDocumentId, agencyId } }) : null,
  ]);
  if (accountId && !account) throw new Error('Hisob topilmadi');
  if (bookingId && !booking) throw new Error('Lid topilmadi');
  if (businessDocumentId && !document) throw new Error('Hujjat topilmadi');
  return { accountId, bookingId, businessDocumentId };
}

async function createTransaction(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    if (!DIRECTIONS.has(req.body?.direction)) return error(res, 'Tranzaksiya turi noto‘g‘ri', 400);
    const amount = positiveAmount(req.body?.amount); if (!amount) return error(res, 'Musbat summa kiriting', 400);
    const status = STATUSES.has(req.body?.status) ? req.body.status : 'planned';
    const dueAt = optionalDate(req.body?.dueAt); if (dueAt === undefined) return error(res, 'To‘lov muddati noto‘g‘ri', 400);
    const refs = await assertRelations(agency.id, req.body || {});
    const transaction = await prisma.financeTransaction.create({ data: {
      agencyId: agency.id, ...refs, direction: req.body.direction, status,
      category: String(req.body?.category || (req.body.direction === 'income' ? 'Mijoz to‘lovi' : 'Operatsion xarajat')).trim().slice(0, 120),
      amount, currency: cleanCurrency(req.body?.currency), counterparty: String(req.body?.counterparty || '').trim().slice(0, 200) || null,
      paymentMethod: String(req.body?.paymentMethod || '').trim().slice(0, 80) || null,
      note: String(req.body?.note || '').trim().slice(0, 1000) || null, dueAt,
      paidAt: status === 'paid' ? optionalDate(req.body?.paidAt) || new Date() : null,
      createdByAccountId: req.agencyAccount.id,
    } });
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
    const transaction = await prisma.financeTransaction.update({ where: { id: existing.id }, data });
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

module.exports = { createAccount, createTransaction, deleteTransaction, listFinance, updateTransaction };
