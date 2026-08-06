const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tarif';
}

// Jonli (lazy) obuna holati — saqlangan status emas, subscriptionUntil sanasi bo'yicha.
// Muddat o'tsa 'expired', kelajakda bo'lsa 'active', sanasiz bo'lsa saqlangan status.
function effectiveStatus(a) {
  const until = a && a.subscriptionUntil ? new Date(a.subscriptionUntil).getTime() : null;
  if (until !== null && !Number.isNaN(until)) return until < Date.now() ? 'expired' : 'active';
  return (a && a.subscriptionStatus) || 'none';
}

function normalizeTariff(b) {
  const d = {};
  if (b.name !== undefined) d.name = String(b.name).trim().slice(0, 80);
  if (b.priceMonthly !== undefined) d.priceMonthly = Math.max(0, parseInt(b.priceMonthly, 10) || 0);
  if (b.commissionPct !== undefined) d.commissionPct = Math.max(0, Math.min(100, parseFloat(b.commissionPct) || 0));
  if (b.features !== undefined) d.features = typeof b.features === 'string' ? b.features.slice(0, 2000) : JSON.stringify(b.features).slice(0, 2000);
  if (b.sortOrder !== undefined) d.sortOrder = parseInt(b.sortOrder, 10) || 0;
  if (b.active !== undefined) d.active = !!b.active;
  return d;
}

/* ─────────── TARIFLAR ─────────── */
async function getTariffs(req, res) {
  try {
    const items = await prisma.tariff.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
      include: { _count: { select: { agencies: true } } },
    });
    return success(res, { items: items.map((t) => ({ ...t, agencyCount: t._count.agencies })), total: items.length });
  } catch (err) { return error(res, err.message, 500); }
}

async function createTariff(req, res) {
  try {
    const d = normalizeTariff(req.body || {});
    if (!d.name) return error(res, 'name majburiy', 400);
    let base = slugify(req.body?.slug || d.name), slug = base, i = 1;
    while (await prisma.tariff.findUnique({ where: { slug } })) slug = `${base}-${++i}`;
    d.slug = slug;
    const item = await prisma.tariff.create({ data: d });
    return success(res, item, 201);
  } catch (err) { return error(res, err.message, 500); }
}

async function updateTariff(req, res) {
  try {
    const d = normalizeTariff(req.body || {});
    const item = await prisma.tariff.update({ where: { id: req.params.id }, data: d });
    return success(res, item);
  } catch (err) { return error(res, err.message, 500); }
}

async function deleteTariff(req, res) {
  try {
    await prisma.tourAgency.updateMany({ where: { tariffId: req.params.id }, data: { tariffId: null } });
    await prisma.tariff.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── OBUNALAR (agentliklar) ─────────── */
async function getSubscriptions(req, res) {
  try {
    const items = await prisma.tourAgency.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true, name: true, city: true, phone: true, imageUrl: true,
        tariffId: true, subscriptionStatus: true, subscriptionUntil: true,
        tariff: { select: { id: true, name: true, priceMonthly: true } },
        payments: { select: { amount: true } },
      },
    });
    const mapped = items.map((a) => {
      const totalPaid = a.payments.reduce((s, p) => s + p.amount, 0);
      const { payments, ...rest } = a;
      return { ...rest, subscriptionStatus: effectiveStatus(a), totalPaid };
    });
    return success(res, { items: mapped, total: mapped.length });
  } catch (err) { return error(res, err.message, 500); }
}

async function setAgencySubscription(req, res) {
  try {
    const b = req.body || {};
    const data = {};
    if (b.tariffId !== undefined) data.tariffId = b.tariffId || null;
    if (b.subscriptionStatus !== undefined)
      data.subscriptionStatus = ['none', 'trial', 'active', 'expired'].includes(b.subscriptionStatus) ? b.subscriptionStatus : 'none';
    if (b.subscriptionUntil !== undefined) data.subscriptionUntil = b.subscriptionUntil ? new Date(b.subscriptionUntil) : null;
    const item = await prisma.tourAgency.update({ where: { id: req.params.id }, data });
    return success(res, item);
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── TO'LOVLAR ─────────── */
async function getPayments(req, res) {
  try {
    const where = {};
    if (req.query.agencyId) where.agencyId = String(req.query.agencyId);
    const items = await prisma.agencyPayment.findMany({
      where, orderBy: { paidAt: 'desc' }, take: 500,
      include: { agency: { select: { id: true, name: true } }, tariff: { select: { id: true, name: true } } },
    });
    return success(res, { items, total: items.length });
  } catch (err) { return error(res, err.message, 500); }
}

async function createPayment(req, res) {
  try {
    const b = req.body || {};
    if (!b.agencyId) return error(res, 'agencyId majburiy', 400);
    const amount = parseInt(b.amount, 10);
    if (!amount || amount <= 0) return error(res, 'amount notogri', 400);
    const agency = await prisma.tourAgency.findUnique({ where: { id: b.agencyId } });
    if (!agency) return error(res, 'Agentlik topilmadi', 404);
    const periodMonths = Math.max(1, parseInt(b.periodMonths, 10) || 1);
    const payment = await prisma.agencyPayment.create({
      data: {
        agencyId: b.agencyId,
        tariffId: b.tariffId || agency.tariffId || null,
        amount,
        currency: String(b.currency || 'USD').slice(0, 8),
        periodMonths,
        method: b.method ? String(b.method).slice(0, 40) : null,
        note: b.note ? String(b.note).slice(0, 500) : null,
        paidAt: b.paidAt ? new Date(b.paidAt) : new Date(),
      },
    });
    // Obunani avtomatik yangilash: muddat TO'LOV SANASIdan hisoblanadi.
    // Obuna hali faol bo'lsa — mavjud muddat ustiga qo'shiladi (stacking); aks holda to'lov sanasidan boshlanadi.
    const base = agency.subscriptionUntil && new Date(agency.subscriptionUntil) > payment.paidAt
      ? new Date(agency.subscriptionUntil)
      : new Date(payment.paidAt);
    base.setMonth(base.getMonth() + periodMonths);
    await prisma.tourAgency.update({
      where: { id: agency.id },
      data: { tariffId: b.tariffId || agency.tariffId || null, subscriptionStatus: 'active', subscriptionUntil: base },
    });
    return success(res, payment, 201);
  } catch (err) { return error(res, err.message, 500); }
}

async function deletePayment(req, res) {
  try {
    await prisma.agencyPayment.delete({ where: { id: req.params.id } });
    return success(res, { id: req.params.id });
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── STATISTIKA ─────────── */
async function getBillingStats(req, res) {
  try {
    const [payments, agencies] = await Promise.all([
      prisma.agencyPayment.findMany({ select: { amount: true, paidAt: true } }),
      prisma.tourAgency.findMany({ select: { subscriptionStatus: true, subscriptionUntil: true, tariff: { select: { priceMonthly: true } } } }),
    ]);
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const last30 = payments.filter((p) => p.paidAt >= monthAgo).reduce((s, p) => s + p.amount, 0);
    // Jonli holat bo'yicha — muddati o'tganlar 'active' hisoblanmaydi
    const active = agencies.filter((a) => effectiveStatus(a) === 'active');
    const mrr = active.reduce((s, a) => s + (a.tariff?.priceMonthly || 0), 0);
    const byStatus = {};
    for (const a of agencies) { const st = effectiveStatus(a); byStatus[st] = (byStatus[st] || 0) + 1; }
    return success(res, {
      totalRevenue, last30, mrr,
      activeCount: active.length, agencyCount: agencies.length,
      paymentsCount: payments.length, byStatus,
    });
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── HISOBOTLAR (bronlar bo'yicha) ─────────── */
async function getReports(req, res) {
  try {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const PAID = ['confirmed', 'completed'];

    const [statusGroups, last30Days, paid] = await Promise.all([
      prisma.tourBooking.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.tourBooking.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.tourBooking.findMany({
        where: { status: { in: PAID } },
        select: { totalEstimate: true, currency: true, leadTour: true, tour: { select: { title: true, city: true } } },
      }),
    ]);

    const totalRevenue = paid.reduce((s, b) => s + (b.totalEstimate || 0), 0);
    const commission = Math.round(totalRevenue * 0.05);
    const currency = (paid.find((b) => b.currency) || {}).currency || 'USD';

    const byStatus = statusGroups
      .map((g) => ({ status: g.status, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    const tourMap = new Map();
    for (const b of paid) {
      const title = (b.tour && b.tour.title) || b.leadTour || 'Boshqa';
      const city = (b.tour && b.tour.city) || '—';
      const cur = tourMap.get(title) || { title, city, bookings: 0, revenue: 0 };
      cur.bookings += 1;
      cur.revenue += b.totalEstimate || 0;
      tourMap.set(title, cur);
    }
    const topTours = [...tourMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return success(res, {
      totalRevenue, commission,
      paidBookings: paid.length,
      last30Days,
      byStatus, topTours, currency,
    });
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── TRAVELER PREMIUM (user to'lovlari) ─────────── */
// GET /admin/user-payments — Premium to'lovlar tarixi (UserPayment)
async function getUserPayments(req, res) {
  try {
    const items = await prisma.userPayment.findMany({
      orderBy: { paidAt: 'desc' },
      take: 500,
      select: {
        id: true, userId: true, userEmail: true, planSlug: true,
        amount: true, currency: true, periodMonths: true, method: true,
        note: true, paidAt: true,
      },
    });
    return success(res, { items, total: items.length });
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── CLICK TRANZAKSIYALARI (xavfsizlik/audit) ─────────── */
// GET /admin/click-transactions?state=&payerType=&take= — har ikkala payerType,
// pul harakatini va muvaffaqiyatsiz faollashtirishlarni kuzatish uchun.
async function getClickTransactions(req, res) {
  try {
    const where = {};
    if (req.query.state) where.state = String(req.query.state);
    if (req.query.payerType) where.payerType = String(req.query.payerType);
    const take = Math.min(500, Math.max(1, parseInt(req.query.take, 10) || 200));

    const items = await prisma.clickTransaction.findMany({
      where, orderBy: { createdAt: 'desc' }, take,
      select: {
        id: true, merchantTransId: true, payerType: true, agencyId: true, userId: true,
        planSlug: true, tariffSlug: true, amount: true, months: true, state: true,
        clickTransId: true, errorNote: true, createdAt: true, preparedAt: true,
        paidAt: true, cancelledAt: true,
      },
    });

    // Relation yo'q (schema izohi bo'yicha prod DB divergent) — nomlarni
    // alohida so'rov bilan biriktiramiz, faqat shu sahifada kerak bo'lgan ID'lar uchun.
    const agencyIds = [...new Set(items.map((t) => t.agencyId).filter(Boolean))];
    const userIds = [...new Set(items.map((t) => t.userId).filter(Boolean))];
    const [agencies, users] = await Promise.all([
      agencyIds.length ? prisma.tourAgency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true } }) : [],
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
    ]);
    const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name || u.email]));

    const mapped = items.map((t) => ({
      ...t,
      payerName: t.payerType === 'user' ? (userMap.get(t.userId) || null) : (agencyMap.get(t.agencyId) || null),
    }));

    return success(res, { items: mapped, total: mapped.length });
  } catch (err) { return error(res, err.message, 500); }
}

/* ─────────── BIRLASHTIRILGAN AYLANMA (agentlik + Premium) ─────────── */
// GET /admin/payments-overview — bosh sahifada "qancha pul aylanmoqda" ko'rinishi
// + xavfsizlik/ops signali: to'langan-lekin-faollashmagan tranzaksiyalar soni.
async function getPaymentsOverview(req, res) {
  try {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      agencyPayments, userPayments, activePremiumCount,
      paidClickTx, openClickTx, failedActivations,
    ] = await Promise.all([
      prisma.agencyPayment.findMany({ select: { amount: true, currency: true, method: true, paidAt: true } }),
      prisma.userPayment.findMany({ select: { amount: true, currency: true, paidAt: true } }),
      prisma.user.count({ where: { premiumUntil: { gt: now } } }),
      prisma.clickTransaction.count({ where: { state: 'paid' } }),
      // 'created'/'prepared' 30 daqiqadan eski — to'lanmagan/tashlab ketilgan urinishlar
      prisma.clickTransaction.count({
        where: { state: { in: ['created', 'prepared'] }, createdAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) } },
      }),
      // Pul olingan, lekin xizmat OCHILMAGAN — darhol e'tibor talab qiladi
      prisma.clickTransaction.findMany({
        where: { state: 'paid', errorNote: { contains: 'ACTIVATION_FAILED' } },
        orderBy: { paidAt: 'desc' }, take: 20,
        select: { merchantTransId: true, payerType: true, amount: true, errorNote: true, paidAt: true },
      }),
    ]);

    // Click UZS orqali kelgan tushum (agentlik + user) — bitta valyuta, to'g'ridan-to'g'ri qo'shiladi.
    const agencyClickUzs = agencyPayments.filter((p) => p.method === 'click').reduce((s, p) => s + p.amount, 0);
    const userClickUzs = userPayments.reduce((s, p) => s + p.amount, 0); // barchasi click, UZS
    const totalClickUzs = agencyClickUzs + userClickUzs;

    const sumSince = (rows, since) => rows.filter((p) => p.paidAt >= since).reduce((s, p) => s + p.amount, 0);
    const clickRows = [
      ...agencyPayments.filter((p) => p.method === 'click').map((p) => ({ amount: p.amount, paidAt: p.paidAt })),
      ...userPayments.map((p) => ({ amount: p.amount, paidAt: p.paidAt })),
    ];

    // Agentlik qo'lda/boshqa usulda kiritilgan to'lovlar odatda USD'da — alohida ko'rsatamiz (valyutalarni qo'shmaymiz).
    const agencyManualUsd = agencyPayments
      .filter((p) => p.method !== 'click' && (p.currency || 'USD') === 'USD')
      .reduce((s, p) => s + p.amount, 0);

    return success(res, {
      totalClickUzs,
      last7ClickUzs: sumSince(clickRows, d7),
      last30ClickUzs: sumSince(clickRows, d30),
      agencyClickUzs,
      userClickUzs,
      agencyManualUsd,
      activePremiumUsers: activePremiumCount,
      paidClickTxCount: paidClickTx,
      staleOpenClickTxCount: openClickTx,
      failedActivations,
    });
  } catch (err) { return error(res, err.message, 500); }
}

module.exports = {
  getTariffs, createTariff, updateTariff, deleteTariff,
  getSubscriptions, setAgencySubscription,
  getPayments, createPayment, deletePayment,
  getBillingStats, getReports,
  getUserPayments, getClickTransactions, getPaymentsOverview,
};
