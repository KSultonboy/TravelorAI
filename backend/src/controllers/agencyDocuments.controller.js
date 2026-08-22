const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { cleanCurrency, optionalDate, positiveAmount } = require('../services/finance.service');
const { syncManagerCommission } = require('../services/financeWorkflow.service');
const { makePdf } = require('../services/documentPdf.service');
const { sendDocumentSignatureCodeEmail } = require('../services/email.service');
const crypto = require('crypto');

const TYPES = new Set(['contract', 'invoice', 'voucher', 'act', 'other']);
const STATUSES = new Set(['draft', 'sent', 'partially_paid', 'signed', 'paid', 'cancelled']);
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
      include: {
        booking: { select: { id: true, customerName: true, customerEmail: true, leadTour: true } },
        payments: { select: { amount: true, paidAt: true }, orderBy: { paidAt: 'desc' } },
        approvals: { select: { id: true, status: true, comment: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        signatures: { select: { id: true, status: true, signerName: true, signerEmail: true, verifiedAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        archives: { select: { id: true, version: true, filename: true, size: true, sha256: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { versions: true, transactions: true, payments: true, archives: true } },
      },
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
      include: {
        booking: true, versions: { orderBy: { version: 'desc' } }, transactions: { orderBy: { createdAt: 'desc' } },
        payments: { include: { transaction: { select: { id: true, accountId: true, paymentMethod: true } } }, orderBy: { paidAt: 'desc' } },
        archives: { select: { id: true, version: true, filename: true, size: true, sha256: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        approvals: { orderBy: { createdAt: 'desc' } }, signatures: { select: { id: true, signerName: true, signerEmail: true, status: true, expiresAt: true, verifiedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      },
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

async function addPayment(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const document = await prisma.businessDocument.findFirst({ where: { id: req.params.id, agencyId: agency.id }, include: { payments: true, booking: { select: { assignedMemberId: true } } } });
    if (!document || document.type !== 'invoice') return error(res, 'Hisob-faktura topilmadi', 404);
    const amount = positiveAmount(req.body?.amount); if (!amount) return error(res, 'Musbat summa kiriting', 400);
    const paidBefore = document.payments.reduce((sum, row) => sum + row.amount, 0);
    const total = Number(document.amount || 0);
    if (total && paidBefore + amount > total) return error(res, `Qoldiqdan ko‘p to‘lov: ${Math.max(0, total - paidBefore)} ${document.currency}`, 400);
    const accountId = req.body?.accountId ? String(req.body.accountId) : null;
    if (accountId) {
      const account = await prisma.financeAccount.findFirst({ where: { id: accountId, agencyId: agency.id, active: true, currency: document.currency } });
      if (!account) return error(res, 'Kassa yoki hisob topilmadi', 404);
    }
    const paidAt = optionalDate(req.body?.paidAt); if (paidAt === undefined) return error(res, 'To‘lov sanasi noto‘g‘ri', 400);
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.financeTransaction.create({ data: {
        agencyId: agency.id, accountId, bookingId: document.bookingId, businessDocumentId: document.id,
        managerMemberId: document.booking?.assignedMemberId || null, direction: 'income', status: 'paid',
        category: 'Invoice bo‘yicha to‘lov', amount, currency: document.currency, counterparty: document.customerName,
        paymentMethod: String(req.body?.paymentMethod || '').trim().slice(0, 80) || null,
        note: String(req.body?.note || '').trim().slice(0, 1000) || `${document.number} qisman to‘lov`,
        paidAt: paidAt || new Date(), createdByAccountId: req.agencyAccount.id,
      } });
      const payment = await tx.businessDocumentPayment.create({ data: {
        agencyId: agency.id, businessDocumentId: document.id, transactionId: transaction.id,
        amount, currency: document.currency, paidAt: transaction.paidAt,
        note: transaction.note, createdByAccountId: req.agencyAccount.id,
      } });
      const paidTotal = paidBefore + amount;
      const remaining = Math.max(0, total - paidTotal);
      await tx.financeTransaction.updateMany({
        where: { agencyId: agency.id, businessDocumentId: document.id, status: 'planned' },
        data: remaining ? { amount: remaining } : { status: 'cancelled', paidAt: null },
      });
      await tx.businessDocument.update({ where: { id: document.id }, data: {
        status: total && paidTotal >= total ? 'paid' : 'partially_paid',
        paidAt: total && paidTotal >= total ? transaction.paidAt : null,
      } });
      await syncManagerCommission(tx, transaction);
      return { payment, paidTotal, remaining };
    });
    return success(res, result, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function generatePdf(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const document = await prisma.businessDocument.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
      include: { booking: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!document) return error(res, 'Hujjat topilmadi', 404);
    const requisite = await prisma.agencyRequisite.findUnique({ where: { agencyId: agency.id } });
    const { data, sha256 } = makePdf(document, document.versions[0]?.content || {}, requisite);
    const filename = `${document.number}-v${document.currentVersion}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const archive = await prisma.businessDocumentArchive.create({ data: {
      agencyId: agency.id, businessDocumentId: document.id, version: document.currentVersion,
      filename, size: data.length, sha256, data, createdByAccountId: req.agencyAccount.id,
    }, select: { id: true, version: true, filename: true, size: true, sha256: true, createdAt: true } });
    return success(res, { archive, dataUrl: `data:application/pdf;base64,${data.toString('base64')}` }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function downloadPdf(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const archive = await prisma.businessDocumentArchive.findFirst({ where: { id: req.params.archiveId, agencyId: agency.id } });
    if (!archive) return error(res, 'PDF arxiv topilmadi', 404);
    return success(res, { archive: { id: archive.id, filename: archive.filename, size: archive.size, sha256: archive.sha256, dataUrl: `data:${archive.mimeType};base64,${Buffer.from(archive.data).toString('base64')}` } });
  } catch (err) { return error(res, err.message, 500); }
}

async function requestApproval(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const document = await prisma.businessDocument.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!document) return error(res, 'Hujjat topilmadi', 404);
    await prisma.documentApproval.updateMany({ where: { businessDocumentId: document.id, status: 'pending' }, data: { status: 'superseded', decidedAt: new Date() } });
    const approval = await prisma.documentApproval.create({ data: { agencyId: agency.id, businessDocumentId: document.id, requestedById: req.agencyAccount.id, comment: String(req.body?.comment || '').trim().slice(0, 1000) || null } });
    return success(res, { approval }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function decideApproval(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const status = req.body?.status;
    if (!['approved', 'rejected'].includes(status)) return error(res, 'Qaror noto‘g‘ri', 400);
    const approval = await prisma.documentApproval.findFirst({ where: { id: req.params.approvalId, agencyId: agency.id, status: 'pending' } });
    if (!approval) return error(res, 'Kutilayotgan tasdiq topilmadi', 404);
    const updated = await prisma.documentApproval.update({ where: { id: approval.id }, data: { status, decidedById: req.agencyAccount.id, decidedAt: new Date(), comment: String(req.body?.comment || approval.comment || '').trim().slice(0, 1000) || null } });
    return success(res, { approval: updated });
  } catch (err) { return error(res, err.message, 400); }
}

async function requestSignature(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const document = await prisma.businessDocument.findFirst({ where: { id: req.params.id, agencyId: agency.id }, include: { booking: true } });
    if (!document) return error(res, 'Hujjat topilmadi', 404);
    const signerEmail = String(req.body?.signerEmail || document.booking?.customerEmail || '').trim().toLowerCase().slice(0, 160);
    const signerName = String(req.body?.signerName || document.customerName || document.booking?.customerName || '').trim().slice(0, 160);
    if (!/^\S+@\S+\.\S+$/.test(signerEmail)) return error(res, 'Imzolovchi emailini kiriting', 400);
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const signature = await prisma.documentSignature.create({ data: {
      agencyId: agency.id, businessDocumentId: document.id, signerName: signerName || 'Mijoz', signerEmail,
      codeHash: crypto.createHash('sha256').update(code).digest('hex'), expiresAt,
      requestedById: req.agencyAccount.id, ipAddress: req.ip || null, userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    }, select: { id: true, signerName: true, signerEmail: true, status: true, expiresAt: true, createdAt: true } });
    const delivery = await sendDocumentSignatureCodeEmail({ email: signerEmail, signerName, documentNumber: document.number, code, expiresInMinutes: 15 });
    return success(res, { signature, delivery: delivery.delivery }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function verifySignature(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const signature = await prisma.documentSignature.findFirst({ where: { id: req.params.signatureId, agencyId: agency.id } });
    if (!signature || signature.status !== 'pending') return error(res, 'Faol imzo so‘rovi topilmadi', 404);
    if (signature.expiresAt < new Date()) { await prisma.documentSignature.update({ where: { id: signature.id }, data: { status: 'expired' } }); return error(res, 'Kod muddati tugagan', 400); }
    if (signature.attempts >= 5) return error(res, 'Urinishlar limiti tugagan', 429);
    const codeHash = crypto.createHash('sha256').update(String(req.body?.code || '')).digest('hex');
    if (codeHash !== signature.codeHash) { await prisma.documentSignature.update({ where: { id: signature.id }, data: { attempts: { increment: 1 } } }); return error(res, 'Kod noto‘g‘ri', 400); }
    const result = await prisma.$transaction(async (tx) => {
      const verified = await tx.documentSignature.update({ where: { id: signature.id }, data: { status: 'verified', verifiedAt: new Date(), ipAddress: req.ip || signature.ipAddress } });
      await tx.businessDocument.update({ where: { id: signature.businessDocumentId }, data: { status: 'signed', signedAt: verified.verifiedAt, sentAt: new Date() } });
      return verified;
    });
    return success(res, { signature: { id: result.id, status: result.status, verifiedAt: result.verifiedAt } });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { addPayment, createDocument, decideApproval, downloadPdf, generatePdf, getDocument, listDocuments, requestApproval, requestSignature, updateDocument, verifySignature };
