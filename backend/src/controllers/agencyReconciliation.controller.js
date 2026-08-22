const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { cleanCurrency } = require('../services/finance.service');
const { syncManagerCommission } = require('../services/financeWorkflow.service');
const { findBestMatch, inspectBankStatement, mapBankStatement } = require('../services/bankStatement.service');

function agencyOr404(req, res) {
  if (!req.agency?.id) { error(res, 'Agentlik topilmadi', 404); return null; }
  return req.agency;
}

function csvBody(req) {
  const csv = String(req.body?.csv || '');
  if (!csv.trim()) throw new Error('CSV faylni tanlang');
  if (Buffer.byteLength(csv, 'utf8') > 8 * 1024 * 1024) throw new Error('CSV hajmi 8 MB dan oshmasligi kerak');
  return csv;
}

async function recountImport(tx, importId) {
  const groups = await tx.bankStatementRow.groupBy({ by: ['status'], where: { importId }, _count: { _all: true } });
  const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  const current = await tx.bankStatementImport.findUnique({ where: { id: importId }, select: { totalRows: true } });
  const resolved = (counts.matched || 0) + (counts.ignored || 0) + (counts.duplicate || 0);
  return tx.bankStatementImport.update({
    where: { id: importId },
    data: {
      status: current && resolved >= current.totalRows ? 'reconciled' : 'processed',
      suggestedRows: counts.suggested || 0,
      matchedRows: counts.matched || 0,
      ignoredRows: counts.ignored || 0,
    },
  });
}

async function inspect(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    return success(res, inspectBankStatement(csvBody(req)));
  } catch (err) { return error(res, err.message, 400); }
}

async function importStatement(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const csv = csvBody(req); const currency = cleanCurrency(req.body?.currency || 'UZS');
    const fileName = String(req.body?.fileName || 'bank-statement.csv').trim().slice(0, 240);
    const mapping = req.body?.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : {};
    const parsed = mapBankStatement(csv, mapping, currency);
    if (!parsed.rows.length) return error(res, parsed.errors[0] || 'Import uchun yaroqli qator topilmadi', 400, { errors: parsed.errors });
    const accountId = req.body?.accountId ? String(req.body.accountId) : null;
    if (accountId) {
      const account = await prisma.financeAccount.findFirst({ where: { id: accountId, agencyId: agency.id, active: true } });
      if (!account) return error(res, 'Bank hisobi topilmadi', 404);
    }

    const fingerprints = [...new Set(parsed.rows.map((row) => row.fingerprint))];
    const existingRows = await prisma.bankStatementRow.findMany({ where: { agencyId: agency.id, fingerprint: { in: fingerprints } }, select: { fingerprint: true } });
    const duplicateFingerprints = new Set(existingRows.map((row) => row.fingerprint));
    const currencies = [...new Set(parsed.rows.map((row) => row.currency))]; const amounts = [...new Set(parsed.rows.map((row) => row.amount))];
    const candidates = await prisma.financeTransaction.findMany({
      where: { agencyId: agency.id, status: { not: 'cancelled' }, currency: { in: currencies }, amount: { in: amounts } },
      orderBy: { createdAt: 'desc' }, take: 5000,
    });
    const alreadyMatched = await prisma.bankStatementRow.findMany({ where: { agencyId: agency.id, matchedTransactionId: { not: null } }, select: { matchedTransactionId: true } });
    const reserved = new Set(alreadyMatched.map((row) => row.matchedTransactionId).filter(Boolean));
    let suggestedRows = 0;
    const rows = parsed.rows.map((row) => {
      if (duplicateFingerprints.has(row.fingerprint)) return { ...row, agencyId: agency.id, status: 'duplicate' };
      const best = findBestMatch(row, candidates.filter((candidate) => !reserved.has(candidate.id)));
      if (!best) return { ...row, agencyId: agency.id, status: 'unmatched' };
      reserved.add(best.transaction.id); suggestedRows += 1;
      return { ...row, agencyId: agency.id, status: 'suggested', suggestedTransactionId: best.transaction.id, matchScore: best.score };
    });

    const imported = await prisma.$transaction(async (tx) => {
      const batch = await tx.bankStatementImport.create({ data: {
        agencyId: agency.id, accountId, fileName, currency, headers: parsed.headers, mapping,
        totalRows: rows.length, suggestedRows, createdByAccountId: req.agencyAccount.id,
      } });
      await tx.bankStatementRow.createMany({ data: rows.map((row) => ({ ...row, importId: batch.id })) });
      return batch;
    });
    return success(res, { import: imported, errors: parsed.errors, duplicateRows: rows.filter((row) => row.status === 'duplicate').length }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function list(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const imports = await prisma.bankStatementImport.findMany({
      where: { agencyId: agency.id }, include: { account: { select: { id: true, name: true, currency: true } } }, orderBy: { createdAt: 'desc' }, take: 30,
    });
    const importId = req.query.importId ? String(req.query.importId) : imports[0]?.id;
    const activeImport = importId ? imports.find((item) => item.id === importId) : null;
    if (importId && !activeImport) return error(res, 'Import topilmadi', 404);
    const rows = importId ? await prisma.bankStatementRow.findMany({
      where: { agencyId: agency.id, importId },
      include: {
        suggestedTransaction: { select: { id: true, direction: true, amount: true, currency: true, category: true, counterparty: true, status: true, dueAt: true, paidAt: true } },
        matchedTransaction: { select: { id: true, direction: true, amount: true, currency: true, category: true, counterparty: true, status: true, dueAt: true, paidAt: true } },
      },
      orderBy: { rowNumber: 'asc' }, take: 5000,
    }) : [];
    return success(res, { imports, activeImport, rows });
  } catch (err) { return error(res, err.message, 500); }
}

async function match(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const row = await prisma.bankStatementRow.findFirst({ where: { id: req.params.id, agencyId: agency.id }, include: { import: true } });
    if (!row) return error(res, 'Bank qatori topilmadi', 404);
    if (['matched', 'ignored', 'duplicate'].includes(row.status)) return error(res, 'Bu qator allaqachon yopilgan', 400);
    const transactionId = String(req.body?.transactionId || row.suggestedTransactionId || '');
    const transaction = transactionId ? await prisma.financeTransaction.findFirst({ where: { id: transactionId, agencyId: agency.id } }) : null;
    if (!transaction) return error(res, 'Mos tranzaksiya topilmadi', 404);
    if (transaction.amount !== row.amount || transaction.currency !== row.currency || transaction.direction !== row.direction) return error(res, 'Summa, valyuta yoki yo‘nalish mos emas', 400);
    const used = await prisma.bankStatementRow.findFirst({ where: { agencyId: agency.id, matchedTransactionId: transaction.id, id: { not: row.id } } });
    if (used) return error(res, 'Bu CRM tranzaksiyasi boshqa bank qatoriga biriktirilgan', 409);
    const result = await prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.financeTransaction.update({ where: { id: transaction.id }, data: { status: 'paid', paidAt: row.transactionDate, ...(row.import.accountId ? { accountId: row.import.accountId } : {}) } });
      await syncManagerCommission(tx, updatedTransaction);
      const updatedRow = await tx.bankStatementRow.update({ where: { id: row.id }, data: { status: 'matched', matchedTransactionId: transaction.id, suggestedTransactionId: transaction.id, matchScore: 100 } });
      await recountImport(tx, row.importId);
      return updatedRow;
    });
    return success(res, { row: result });
  } catch (err) { return error(res, err.message, 400); }
}

async function createFromRow(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const row = await prisma.bankStatementRow.findFirst({ where: { id: req.params.id, agencyId: agency.id }, include: { import: true } });
    if (!row) return error(res, 'Bank qatori topilmadi', 404);
    if (['matched', 'ignored', 'duplicate'].includes(row.status)) return error(res, 'Bu qator allaqachon yopilgan', 400);
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.financeTransaction.create({ data: {
        agencyId: agency.id, accountId: row.import.accountId, direction: row.direction, status: 'paid',
        category: String(req.body?.category || (row.direction === 'income' ? 'Bank kirimi' : 'Bank chiqimi')).trim().slice(0, 120),
        amount: row.amount, currency: row.currency, counterparty: row.counterparty,
        paymentMethod: 'bank', note: [row.description, row.externalId ? `Bank ID: ${row.externalId}` : null].filter(Boolean).join(' · ').slice(0, 1000) || null,
        paidAt: row.transactionDate, createdByAccountId: req.agencyAccount.id,
      } });
      await tx.bankStatementRow.update({ where: { id: row.id }, data: { status: 'matched', matchedTransactionId: transaction.id, suggestedTransactionId: null, matchScore: 100 } });
      await recountImport(tx, row.importId);
      return transaction;
    });
    return success(res, { transaction: result }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function ignore(req, res) {
  try {
    const agency = agencyOr404(req, res); if (!agency) return;
    const row = await prisma.bankStatementRow.findFirst({ where: { id: req.params.id, agencyId: agency.id } });
    if (!row) return error(res, 'Bank qatori topilmadi', 404);
    if (row.status === 'matched') return error(res, 'Moslashtirilgan qatorni eʼtiborsiz qoldirib bo‘lmaydi', 400);
    await prisma.$transaction(async (tx) => {
      await tx.bankStatementRow.update({ where: { id: row.id }, data: { status: 'ignored', suggestedTransactionId: null, matchScore: null } });
      await recountImport(tx, row.importId);
    });
    return success(res, { id: row.id, status: 'ignored' });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { createFromRow, ignore, importStatement, inspect, list, match };
