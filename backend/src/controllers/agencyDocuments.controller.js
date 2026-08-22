const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { cleanCurrency, optionalDate, positiveAmount } = require('../services/finance.service');

const TYPES = new Set(['contract', 'invoice', 'voucher', 'act', 'other']);
const STATUSES = new Set(['draft', 'sent', 'signed', 'paid', 'cancelled']);
const PREFIX = { contract: 'SH', invoice: 'HF', voucher: 'VR', act: 'DL', other: 'HJ' };

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}

function statusDates(status) {
  const now = new Date();
  if (status === 'sent') return { sentAt: now };
  if (status === 'signed') return { sentAt: now, signedAt: now };
  if (status === 'paid') return { sentAt: now, signedAt: now, paidAt: now };
  return {};
}

async function nextNumber(tx, agencyId, type) {
  const year = new Date().getFullYear();
  const count = await tx.businessDocument.count({ where: { agencyId, type, issuedAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } } });
  return `${PREFIX[type] || 'HJ'}-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function listDocuments(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const where = { agencyId: agency.id };
    if (req.query.type && TYPES.has(req.query.type)) where.type = req.query.type;
    if (req.query.status && STATUSES.has(req.query.status)) where.status = req.query.status;
    const documents = await prisma.businessDocument.findMany({
      where,
      include: { booking: { select: { id: true, customerName: true, leadTour: true } }, _count: { select: { versions: true, transactions: true } } },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }], take: 2000,
    });
    const totals = documents.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    return success(res, { documents, totals });
  } catch (err) { return error(res, err.message, 500); }
}

async function getDocument(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const document = await prisma.businessDocument.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
      include: { booking: true, versions: { orderBy: { version: 'desc' } }, transactions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!document) return error(res, 'Hujjat topilmadi', 404);
    return success(res, { document });
  } catch (err) { return error(res, err.message, 500); }
}

async function createDocument(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const type = TYPES.has(req.body?.type) ? req.body.type : null;
    if (!type) return error(res, 'Hujjat turi noto‘g‘ri', 400);
    const status = STATUSES.has(req.body?.status) ? req.body.status : 'draft';
    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : null;
    const booking = bookingId ? await prisma.tourBooking.findFirst({ where: { id: bookingId, agencyId: agency.id } }) : null;
    if (bookingId && !booking) return error(res, 'Lid topilmadi', 404);
    const dueAt = optionalDate(req.body?.dueAt); if (dueAt === undefined) return error(res, 'Hujjat muddati noto‘g‘ri', 400);
    const issuedAt = optionalDate(req.body?.issuedAt); if (issuedAt === undefined) return error(res, 'Hujjat sanasi noto‘g‘ri', 400);
    const amount = req.body?.amount === null || req.body?.amount === '' || req.body?.amount === undefined ? null : positiveAmount(req.body.amount);
    if (req.body?.amount && !amount) return error(res, 'Hujjat summasi noto‘g‘ri', 400);
    const result = await prisma.$transaction(async (tx) => {
      const number = String(req.body?.number || '').trim().slice(0, 80) || await nextNumber(tx, agency.id, type);
      const title = String(req.body?.title || ({ contract: 'Sayohat xizmatlari shartnomasi', invoice: 'Hisob-faktura', voucher: 'Turistik voucher', act: 'Bajarilgan ishlar dalolatnomasi', other: 'Hujjat' }[type])).trim().slice(0, 300);
      const customerName = String(req.body?.customerName || booking?.customerName || '').trim().slice(0, 200) || null;
      const currency = cleanCurrency(req.body?.currency || booking?.currency);
      const content = req.body?.content && typeof req.body.content === 'object' ? req.body.content : {
        title, customerName, bookingId, tour: booking?.leadTour || null, amount, currency,
        notes: String(req.body?.notes || '').trim().slice(0, 5000) || null,
      };
      const document = await tx.businessDocument.create({ data: {
        agencyId: agency.id, bookingId, number, type, status, title, customerName, amount, currency,
        issuedAt: issuedAt || new Date(), dueAt, notes: String(req.body?.notes || '').trim().slice(0, 5000) || null,
        createdByAccountId: req.agencyAccount.id, ...statusDates(status),
        versions: { create: { version: 1, content, createdByAccountId: req.agencyAccount.id } },
      } });
      if (type === 'invoice' && amount && status !== 'cancelled' && req.body?.createReceivable !== false) {
        await tx.financeTransaction.create({ data: {
          agencyId: agency.id, bookingId, businessDocumentId: document.id, direction: 'income',
          status: status === 'paid' ? 'paid' : 'planned', category: 'Mijoz to‘lovi', amount, currency,
          counterparty: customerName, dueAt, paidAt: status === 'paid' ? new Date() : null,
          note: `${number} hisob-faktura`, createdByAccountId: req.agencyAccount.id,
        } });
      }
      return document;
    });
    return success(res, { document: result }, 201);
  } catch (err) { return error(res, err.code === 'P2002' ? 'Bunday hujjat raqami mavjud' : err.message, 400); }
}

async function updateDocument(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const existing = await prisma.businessDocument.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!existing) return error(res, 'Hujjat topilmadi', 404);
    const data = {};
    if (req.body?.status !== undefined) {
      if (!STATUSES.has(req.body.status)) return error(res, 'Hujjat holati noto‘g‘ri', 400);
      data.status = req.body.status;
      Object.assign(data, statusDates(req.body.status));
    }
    if (req.body?.title !== undefined) data.title = String(req.body.title || '').trim().slice(0, 300) || existing.title;
    if (req.body?.notes !== undefined) data.notes = String(req.body.notes || '').trim().slice(0, 5000) || null;
    if (req.body?.dueAt !== undefined) { const dueAt = optionalDate(req.body.dueAt); if (dueAt === undefined) return error(res, 'Hujjat muddati noto‘g‘ri', 400); data.dueAt = dueAt; }
    if (req.body?.amount !== undefined) { const amount = req.body.amount === null || req.body.amount === '' ? null : positiveAmount(req.body.amount); if (req.body.amount && !amount) return error(res, 'Hujjat summasi noto‘g‘ri', 400); data.amount = amount; }
    const hasVersion = req.body?.content && typeof req.body.content === 'object';
    const document = await prisma.$transaction(async (tx) => {
      if (hasVersion) {
        data.currentVersion = existing.currentVersion + 1;
        await tx.businessDocumentVersion.create({ data: { businessDocumentId: existing.id, version: data.currentVersion, content: req.body.content, createdByAccountId: req.agencyAccount.id } });
      }
      const updated = await tx.businessDocument.update({ where: { id: existing.id }, data });
      if (req.body?.status === 'paid') await tx.financeTransaction.updateMany({ where: { agencyId: agency.id, businessDocumentId: existing.id, status: 'planned' }, data: { status: 'paid', paidAt: new Date() } });
      if (req.body?.status === 'cancelled') await tx.financeTransaction.updateMany({ where: { agencyId: agency.id, businessDocumentId: existing.id, status: 'planned' }, data: { status: 'cancelled', paidAt: null } });
      return updated;
    });
    return success(res, { document });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { createDocument, getDocument, listDocuments, updateDocument };
