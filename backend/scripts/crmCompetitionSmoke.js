/* eslint-disable no-console */
const { prisma } = require('../src/config/database');
const { signAgencyToken } = require('../src/utils/agencyJwt');

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const ownerEmail = `crm-p1-owner-${suffix}@smoke.invalid`;
const memberEmail = `crm-p1-member-${suffix}@smoke.invalid`;
const slug = `crm-p1-smoke-${suffix}`;
let agencyId = null;
let accountIds = [];

function assert(condition, message) { if (!condition) throw new Error(message); }

async function api(token, path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(`${path}: ${body.message || response.status}`);
  return body.data;
}

async function cleanup() {
  if (agencyId) {
    const bookings = await prisma.tourBooking.findMany({ where: { agencyId }, select: { id: true } });
    const bookingIds = bookings.map((b) => b.id);
    await prisma.telegramMessage.deleteMany({ where: { OR: [{ agencyId }, { bookingId: { in: bookingIds } }] } });
    await prisma.tourBooking.deleteMany({ where: { agencyId } });
    await prisma.tourAgency.deleteMany({ where: { id: agencyId } });
  }
  if (accountIds.length) await prisma.agencyAccount.deleteMany({ where: { id: { in: accountIds } } });
}

async function main() {
  try {
    const owner = await prisma.agencyAccount.create({ data: { email: ownerEmail, passwordHash: 'smoke-only', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    const employee = await prisma.agencyAccount.create({ data: { email: memberEmail, passwordHash: 'smoke-only', status: 'approved', emailVerified: true, emailVerifiedAt: new Date() } });
    accountIds = [owner.id, employee.id];
    const agency = await prisma.tourAgency.create({ data: { slug, ownerAccountId: owner.id, name: 'CRM P1 Smoke', city: 'Toshkent', specialty: 'Smoke', approvalStatus: 'approved', approvedAt: new Date() } });
    agencyId = agency.id;
    const member = await prisma.agencyMember.create({ data: { agencyId, accountId: employee.id, name: 'Smoke Menejer', role: 'manager', status: 'active' } });
    const token = signAgencyToken({ id: owner.id, email: owner.email });

    const settings = await api(token, '/agency/crm/settings', { method: 'PUT', body: JSON.stringify({ firstResponseMinutes: 15, autoAssignEnabled: true, reminderEnabled: true }) });
    assert(settings.settings.firstResponseMinutes === 15 && settings.settings.autoAssignEnabled, 'SLA sozlamasi saqlanmadi');

    const csv = 'Client title,Mobile contact,Trip\nSmoke Client,+998901112233,Dubay';
    const mapping = { customerName: 'Client title', customerPhone: 'Mobile contact', leadTour: 'Trip' };
    const preview = await api(token, '/agency/crm/import/csv/preview', { method: 'POST', body: JSON.stringify({ csv, mapping }) });
    assert(preview.readyRows === 1 && preview.duplicateRows === 0, 'CSV preview noto‘g‘ri');
    const committed = await api(token, '/agency/crm/import/csv/commit', { method: 'POST', body: JSON.stringify({ csv, mapping, fileName: 'smoke.csv' }) });
    assert(committed.imported === 1 && committed.batchId, 'CSV commit ishlamadi');
    const booking = await prisma.tourBooking.findFirst({ where: { agencyId, csvImportBatchId: committed.batchId } });
    assert(booking && booking.assignedMemberId === member.id, 'Round-robin menejer biriktirmadi');

    await api(token, `/agency/crm/bookings/${booking.id}/activities`, { method: 'POST', body: JSON.stringify({ type: 'message', text: 'Smoke javobi' }) });
    const responded = await prisma.tourBooking.findUnique({ where: { id: booking.id } });
    assert(responded.firstResponseAt, 'Birinchi javob vaqti yozilmadi');

    const insights = await api(token, '/agency/crm/insights?days=7');
    assert(insights.totals.leads === 1 && insights.managers.some((m) => m.memberId === member.id), 'KPI hisobi noto‘g‘ri');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const audit = await api(token, '/agency/crm/audit?limit=100');
    assert(audit.total >= 3, 'Audit yozuvlari topilmadi');
    const whatsapp = await api(token, '/agency/whatsapp');
    assert(typeof whatsapp.connected === 'boolean', 'WhatsApp status endpoint ishlamadi');

    const rollback = await api(token, `/agency/crm/imports/${committed.batchId}/rollback`, { method: 'POST' });
    assert(rollback.deleted === 1, 'CSV rollback ishlamadi');
    assert(await prisma.tourBooking.count({ where: { agencyId } }) === 0, 'Rollback qoldiq lid qoldirdi');
    console.log(JSON.stringify({ ok: true, checks: ['settings', 'preview', 'commit', 'auto_assign', 'first_response', 'kpi', 'audit', 'whatsapp_status', 'rollback'] }));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
