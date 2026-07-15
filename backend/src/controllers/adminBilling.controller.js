const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tarif';
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
      return { ...rest, totalPaid };
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
    // Obunani avtomatik yangilash: tarif + muddatni uzaytirish + faollashtirish
    const now = new Date();
    const base = agency.subscriptionUntil && agency.subscriptionUntil > now ? new Date(agency.subscriptionUntil) : now;
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
      prisma.tourAgency.findMany({ select: { subscriptionStatus: true, tariff: { select: { priceMonthly: true } } } }),
    ]);
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const last30 = payments.filter((p) => p.paidAt >= monthAgo).reduce((s, p) => s + p.amount, 0);
    const active = agencies.filter((a) => a.subscriptionStatus === 'active');
    const mrr = active.reduce((s, a) => s + (a.tariff?.priceMonthly || 0), 0);
    const byStatus = {};
    for (const a of agencies) byStatus[a.subscriptionStatus] = (byStatus[a.subscriptionStatus] || 0) + 1;
    return success(res, {
      totalRevenue, last30, mrr,
      activeCount: active.length, agencyCount: agencies.length,
      paymentsCount: payments.length, byStatus,
    });
  } catch (err) { return error(res, err.message, 500); }
}

module.exports = {
  getTariffs, createTariff, updateTariff, deleteTariff,
  getSubscriptions, setAgencySubscription,
  getPayments, createPayment, deletePayment,
  getBillingStats,
};
