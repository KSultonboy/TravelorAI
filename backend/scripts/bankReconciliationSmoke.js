/* eslint-disable no-console */
const { prisma } = require('../src/config/database');
const { signAgencyToken } = require('../src/utils/agencyJwt');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let agencyId;
const accountIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(token, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(`${path}: ${body.message || response.status}`);
  return body.data;
}

async function cleanup() {
  if (agencyId) await prisma.tourAgency.deleteMany({ where: { id: agencyId } });
  if (accountIds.length) await prisma.agencyAccount.deleteMany({ where: { id: { in: accountIds } } });
}

async function main() {
  try {
    const owner = await prisma.agencyAccount.create({ data: {
      email: `reconciliation-${suffix}@smoke.invalid`, passwordHash: 'smoke', status: 'approved',
      emailVerified: true, emailVerifiedAt: new Date(),
    } });
    accountIds.push(owner.id);
    const agency = await prisma.tourAgency.create({ data: {
      slug: `reconciliation-${suffix}`, ownerAccountId: owner.id, name: 'Bank Reconciliation Smoke',
      city: 'Toshkent', specialty: 'Smoke', approvalStatus: 'approved', approvedAt: new Date(),
    } });
    agencyId = agency.id;
    const token = signAgencyToken({ id: owner.id, email: owner.email });

    const bank = await api(token, '/agency/crm/finance/accounts', {
      method: 'POST', body: JSON.stringify({ name: 'Smoke Bank', type: 'bank', currency: 'UZS' }),
    });
    const planned = await api(token, '/agency/crm/finance/transactions', {
      method: 'POST', body: JSON.stringify({
        direction: 'income', status: 'planned', amount: 1250000, currency: 'UZS',
        category: 'Tur to‘lovi', counterparty: 'Ali Travel', dueAt: '2026-08-22',
      }),
    });

    const csv = [
      'Sana;Kirim;Chiqim;Valyuta;Kontragent;Izoh;Hujjat raqami',
      '22.08.2026;1 250 000;;UZS;Ali Travel;Tur uchun tolov;PAY-001',
      '22.08.2026;;175 000;UZS;Ofis Servis;Internet xarajati;PAY-002',
    ].join('\n');
    const inspected = await api(token, '/agency/crm/finance/reconciliation/inspect', {
      method: 'POST', body: JSON.stringify({ csv }),
    });
    assert(inspected.headers.length === 7, 'CSV ustunlari aniqlanmadi');
    assert(inspected.suggestedMapping.date === 'Sana', 'Sana ustuni avtomatik topilmadi');

    const imported = await api(token, '/agency/crm/finance/reconciliation/import', {
      method: 'POST', body: JSON.stringify({
        csv, fileName: 'smoke-bank.csv', currency: 'UZS', accountId: bank.account.id,
        mapping: inspected.suggestedMapping,
      }),
    });
    assert(imported.import.totalRows === 2, 'CSV qatorlari to‘liq import qilinmadi');
    assert(imported.import.suggestedRows === 1, 'Rejalashtirilgan tranzaksiya tavsiya qilinmadi');

    let state = await api(token, `/agency/crm/finance/reconciliation?importId=${imported.import.id}`);
    const suggested = state.rows.find((row) => row.status === 'suggested');
    const unmatched = state.rows.find((row) => row.status === 'unmatched');
    assert(suggested?.suggestedTransactionId === planned.transaction.id, 'To‘g‘ri tranzaksiya topilmadi');
    assert(unmatched, 'Yangi xarajat qatori topilmadi');

    await api(token, `/agency/crm/finance/reconciliation/rows/${suggested.id}/match`, {
      method: 'POST', body: JSON.stringify({ transactionId: planned.transaction.id }),
    });
    await api(token, `/agency/crm/finance/reconciliation/rows/${unmatched.id}/create`, {
      method: 'POST', body: JSON.stringify({ category: 'Internet' }),
    });

    state = await api(token, `/agency/crm/finance/reconciliation?importId=${imported.import.id}`);
    assert(state.activeImport.status === 'reconciled', 'Import to‘liq yopilmadi');
    assert(state.activeImport.matchedRows === 2, 'Ikki bank qatori moslashtirilmadi');
    assert(state.rows.every((row) => row.status === 'matched'), 'Yopilmagan bank qatori qoldi');

    const paid = await prisma.financeTransaction.findUnique({ where: { id: planned.transaction.id } });
    assert(paid.status === 'paid' && paid.accountId === bank.account.id, 'CRM tranzaksiyasi to‘langan deb belgilanmadi');
    const generated = await prisma.financeTransaction.findFirst({
      where: { agencyId, direction: 'expense', amount: 175000, category: 'Internet' },
    });
    assert(generated?.status === 'paid', 'Bank qatoridan yangi xarajat yaratilmadi');

    const duplicate = await api(token, '/agency/crm/finance/reconciliation/import', {
      method: 'POST', body: JSON.stringify({
        csv, fileName: 'smoke-bank-copy.csv', currency: 'UZS', accountId: bank.account.id,
        mapping: inspected.suggestedMapping,
      }),
    });
    assert(duplicate.duplicateRows === 2, 'Takroriy bank qatorlari bloklanmadi');

    console.log(JSON.stringify({ ok: true, uonParity: 84, checks: [
      'csv_inspection', 'column_mapping', 'statement_import', 'automatic_match',
      'manual_confirmation', 'transaction_from_row', 'duplicate_detection', 'reconciliation_close',
    ] }));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
