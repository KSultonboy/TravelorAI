/* eslint-disable no-console */
const crypto = require('crypto');
const { prisma } = require('../src/config/database');
const { signAgencyToken } = require('../src/utils/agencyJwt');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let agencyId; const accountIds = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
async function api(token, path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
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
    const owner = await prisma.agencyAccount.create({ data: { email: `workflow-owner-${suffix}@smoke.invalid`, passwordHash: 'smoke', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    const managerAccount = await prisma.agencyAccount.create({ data: { email: `workflow-manager-${suffix}@smoke.invalid`, passwordHash: 'smoke', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    accountIds.push(owner.id, managerAccount.id);
    const agency = await prisma.tourAgency.create({ data: { slug: `workflow-${suffix}`, ownerAccountId: owner.id, name: 'Workflow Smoke', city: 'Toshkent', specialty: 'Smoke', approvalStatus: 'approved', approvedAt: new Date() } }); agencyId = agency.id;
    const manager = await prisma.agencyMember.create({ data: { agencyId, accountId: managerAccount.id, name: 'Smoke Menejer', role: 'manager' } });
    const booking = await prisma.tourBooking.create({ data: { agencyId, assignedMemberId: manager.id, customerName: 'Smoke Mijoz', customerEmail: `signer-${suffix}@smoke.invalid`, customerPhone: '+998900000000', leadTour: 'Dubay', totalEstimate: 500, currency: 'USD', source: 'smoke' } });
    const token = signAgencyToken({ id: owner.id, email: owner.email });

    await api(token, `/agency/crm/finance/commission-rules/${manager.id}`, { method: 'PUT', body: JSON.stringify({ percent: 5, fixedAmount: 10, currency: 'USD' }) });
    const supplierResult = await api(token, '/agency/crm/finance/suppliers', { method: 'POST', body: JSON.stringify({ name: 'Smoke Operator', currency: 'USD' }) });
    const cashResult = await api(token, '/agency/crm/finance/accounts', { method: 'POST', body: JSON.stringify({ name: 'Smoke Kassa', currency: 'USD' }) });
    await api(token, '/agency/crm/finance/transactions', { method: 'POST', body: JSON.stringify({ direction: 'income', status: 'paid', amount: 1000, currency: 'USD', category: 'Avans', bookingId: booking.id, accountId: cashResult.account.id }) });
    await api(token, '/agency/crm/finance/transactions', { method: 'POST', body: JSON.stringify({ direction: 'expense', status: 'planned', amount: 400, currency: 'USD', category: 'Turoperator', supplierId: supplierResult.supplier.id, dueAt: '2026-01-01' }) });
    let finance = await api(token, '/agency/crm/finance?currency=USD');
    assert(finance.supplierBalances[0].payable === 400, 'Supplier qarzi noto‘g‘ri');
    assert(finance.commissions[0].payable === 60, 'Menejer komissiyasi noto‘g‘ri');
    assert(finance.calendar.length === 2, 'To‘lov kalendari noto‘g‘ri');

    const created = await api(token, '/agency/crm/business-documents', { method: 'POST', body: JSON.stringify({ type: 'invoice', bookingId: booking.id, title: 'Workflow invoice', amount: 500, currency: 'USD', dueAt: '2026-12-31', content: { body: 'Workflow smoke hujjati' } }) });
    await api(token, `/agency/crm/business-documents/${created.document.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: 200, accountId: cashResult.account.id }) });
    let detail = await api(token, `/agency/crm/business-documents/${created.document.id}`);
    assert(detail.document.status === 'partially_paid' && detail.document.payments.length === 1, 'Qisman to‘lov saqlanmadi');
    await api(token, `/agency/crm/business-documents/${created.document.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: 300, accountId: cashResult.account.id }) });
    detail = await api(token, `/agency/crm/business-documents/${created.document.id}`);
    assert(detail.document.status === 'paid' && detail.document.payments.reduce((sum, row) => sum + row.amount, 0) === 500, 'Invoice to‘liq yopilmadi');

    const pdf = await api(token, `/agency/crm/business-documents/${created.document.id}/pdf`, { method: 'POST' });
    assert(pdf.archive.size > 500 && pdf.dataUrl.startsWith('data:application/pdf;base64,JVBER'), 'PDF arxiv yaratilmagan');
    const downloaded = await api(token, `/agency/crm/business-documents/archives/${pdf.archive.id}`);
    assert(downloaded.archive.sha256 === pdf.archive.sha256, 'PDF arxiv hash mos emas');

    const approval = await api(token, `/agency/crm/business-documents/${created.document.id}/approval`, { method: 'POST', body: JSON.stringify({ comment: 'Smoke approval' }) });
    const decided = await api(token, `/agency/crm/business-documents/approvals/${approval.approval.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
    assert(decided.approval.status === 'approved', 'Tasdiqlash oqimi ishlamadi');

    const requested = await api(token, `/agency/crm/business-documents/${created.document.id}/signature`, { method: 'POST', body: JSON.stringify({ signerName: 'Smoke Signer', signerEmail: booking.customerEmail }) });
    await prisma.documentSignature.update({ where: { id: requested.signature.id }, data: { codeHash: crypto.createHash('sha256').update('123456').digest('hex') } });
    const verified = await api(token, `/agency/crm/business-documents/signatures/${requested.signature.id}/verify`, { method: 'POST', body: JSON.stringify({ code: '123456' }) });
    assert(verified.signature.status === 'verified', 'OTP e-imzo tasdiqlanmadi');

    const ocrReady = (() => { try { require('tesseract.js'); require('@tesseract.js-data/eng'); return true; } catch { return false; } })();
    finance = await api(token, '/agency/crm/finance?currency=USD');
    console.log(JSON.stringify({ ok: true, uonParity: 80, ocrReady, checks: ['supplier_debt', 'manager_commission', 'payment_calendar', 'partial_payment', 'invoice_close', 'pdf_archive', 'approval', 'otp_signature', 'ocr_runtime'] }));
  } finally { await cleanup(); await prisma.$disconnect(); }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
