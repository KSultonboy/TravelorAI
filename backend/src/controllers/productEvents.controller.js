// Mahsulot voronkasi: ommaviy hodisa qabul qilish (landing) va admin voronka hisoboti.
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { createWindowLimiter } = require('../services/memoryCache.service');
const { PUBLIC_EVENTS, track } = require('../services/productEvents.service');
const { computeFunnel, IDENTIFIED_STEPS } = require('../services/productFunnel.service');

// Bir IP'dan 10 daqiqada ko'pi bilan 20 ta ommaviy hodisa (sahifa + sessiya uchun yetarli).
const PUBLIC_EVENT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_EVENT_PER_IP = Number(process.env.PRODUCT_EVENTS_PER_IP_10MIN || 20);
const publicLimiter = createWindowLimiter({ windowMs: PUBLIC_EVENT_WINDOW_MS, max: PUBLIC_EVENT_PER_IP });

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

// POST /api/v1/home/events  { name: 'landing_view' | 'agency_signup_started', props?: { utm_* , path } }
async function publicEvent(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!PUBLIC_EVENTS.includes(name)) return error(res, "Noma'lum hodisa", 400);
  if (body.props !== undefined && (body.props === null || typeof body.props !== 'object' || Array.isArray(body.props))) {
    return error(res, "props obyekt bo'lishi kerak", 400);
  }

  const limit = publicLimiter.hit(clientIp(req));
  if (!limit.allowed) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))));
    return error(res, "Juda ko'p so'rov", 429);
  }

  // Ommaviy hodisa hech qachon agentlik/foydalanuvchiga bog'lanmaydi (anonim).
  track(name, { props: body.props || null });
  return success(res, { ok: true }, 202);
}

function resetPublicEventLimiter() {
  publicLimiter.reset();
}

// GET /api/v1/admin/funnel?days=30
async function adminFunnel(req, res) {
  try {
    const raw = Number.parseInt(String(req.query.days || '30'), 10);
    const days = Number.isFinite(raw) ? Math.min(365, Math.max(1, raw)) : 30;
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);
    const where = { createdAt: { gte: since } };

    const [grouped, events] = await Promise.all([
      prisma.productEvent.groupBy({ by: ['name'], where, _count: { _all: true } }),
      prisma.productEvent.findMany({
        where: { ...where, name: { in: IDENTIFIED_STEPS } },
        select: { name: true, agencyId: true, userId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 50000,
      }),
    ]);

    const ownerIds = [...new Set(events.filter((e) => e.name === 'agency_registered' && e.userId).map((e) => e.userId))];
    const agencies = ownerIds.length
      ? await prisma.tourAgency.findMany({ where: { ownerAccountId: { in: ownerIds } }, select: { id: true, ownerAccountId: true } })
      : [];

    const counts = Object.fromEntries(grouped.map((row) => [row.name, row._count?._all || 0]));
    return success(res, computeFunnel({ days, now, counts, events, agencies }));
  } catch (err) {
    return error(res, 'Voronkani hisoblab bo‘lmadi', 500);
  }
}

module.exports = { adminFunnel, publicEvent, resetPublicEventLimiter };
