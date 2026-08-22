/* eslint-disable no-console */
const { prisma } = require('../src/config/database');
const { signAgencyToken } = require('../src/utils/agencyJwt');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const email = `finance-docs-${suffix}@smoke.invalid`;
let agencyId = null; let accountId = null;

function assert(condition, message) { if (!condition) throw new Error(message); }
async function api(token, path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(`${path}: ${body.message || response.status}`);
  return body.data;
}
async function cleanup() {
  if (agencyId) await prisma.tourAgency.deleteMany({ where: { id: agencyId } });
  if (accountId) await prisma.agencyAccount.deleteMany({ where: { id: accountId } });
}

async function main() {
  try {
    const owner = await prisma.agencyAccount.create({ data: { email, passwordHash: 'smoke-only', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    accountId = owner.id;
    const agency = await prisma.tourAgency.create({ data: { slug: `finance-docs-${suffix}`, ownerAccountId: owner.id, name: 'Finance Docs Smoke', city: 'Toshkent', specialty: 'Smoke', approvalStatus: 'approved', approvedAt: new Date() } });
    agencyId = agency.id;
    const booking = await prisma.tourBooking.create({ data: { agencyId, customerName: 'Smoke Mijoz', customerPhone: '+998900000000', leadTour: 'Dubay', totalEstimate: 500, currency: 'USD', source: 'smoke' } });
    const token = signAgencyToken({ id: owner.id, email: owner.email });

    const cash = await api(token, '/agency/crm/finance/accounts', { method: 'POST', body: JSON.stringify({ name: 'Asosiy kassa', type: 'cash', currency: 'USD', openingBalance: 100 }) });
    await api(token, '/agency/crm/finance/transactions', { method: 'POST', body: JSON.stringify({ direction: 'income', status: 'paid', amount: 1000, currency: 'USD', category: 'Mijoz to‘lovi', accountId: cash.account.id, bookingId: booking.id }) });
    await api(token, '/agency/crm/finance/transactions', { method: 'POST', body: JSON.stringify({ direction: 'expense', status: 'planned', amount: 300, currency: 'USD', category: 'Turoperator', dueAt: '2026-01-01' }) });

    const created = await api(token, '/agency/crm/business-documents', { method: 'POST', body: JSON.stringify({ type: 'invoice', bookingId: booking.id, title: 'Smoke invoice', amount: 500, currency: 'USD', dueAt: '2026-12-31', content: { body: 'v1' } }) });
    await api(token, `/agency/crm/business-documents/${created.document.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'sent' }) });
    await api(token, `/agency/crm/business-documents/${created.document.id}`, { method: 'PATCH', body: JSON.stringify({ content: { body: 'v2' }, status: 'paid' }) });

    const detail = await api(token, `/agency/crm/business-documents/${created.document.id}`);
    assert(detail.document.currentVersion === 2 && detail.document.versions.length === 2, 'Hujjat versiyasi saqlanmadi');
    assert(detail.document.transactions.length === 1 && detail.document.transactions[0].status === 'paid', 'Invoice to‘lovi moliyaga sinxronlanmadi');
    const finance = await api(token, '/agency/crm/finance?currency=USD');
    assert(finance.summary.received === 1500, 'Jami kirim noto‘g‘ri');
    assert(finance.summary.payable === 300 && finance.summary.overdue === 300, 'Kreditor yoki overdue noto‘g‘ri');
    assert(finance.summary.accountBalances[0].balance === 1100, 'Kassa qoldig‘i noto‘g‘ri');
    const registry = await api(token, '/agency/crm/business-documents');
    assert(registry.documents.length === 1 && registry.totals.paid === 1, 'Hujjat reyestri noto‘g‘ri');
    console.log(JSON.stringify({ ok: true, checks: ['account', 'income', 'expense', 'receivable', 'invoice_sync', 'versions', 'overdue', 'balance', 'registry'] }));
  } finally {
    await cleanup(); await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
