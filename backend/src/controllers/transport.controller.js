const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { sameCity } = require('../utils/city');
const { fetchYandexTransportNearby } = require('../services/yandexTransport.service');

const MODE_PRIORITY = {
  cheap: ['bus', 'train', 'taxi', 'flight'],
  fast: ['flight', 'train', 'taxi', 'bus'],
  comfort: ['train', 'flight', 'taxi', 'bus'],
};

function routeScore(route, preference = 'comfort') {
  const modes = MODE_PRIORITY[preference] || MODE_PRIORITY.comfort;
  const modeRank = modes.indexOf(route.mode);
  const normalizedModeRank = modeRank >= 0 ? modeRank : modes.length;
  const avgPrice = (Number(route.priceMin || 0) + Number(route.priceMax || 0)) / 2;
  return normalizedModeRank * 1_000_000 + avgPrice + Number(route.durationMinutes || 0) * 120;
}

function normalizeRoute(route) {
  return {
    id: route.id,
    fromCity: route.fromCity,
    toCity: route.toCity,
    mode: route.mode,
    provider: route.provider
      ? {
          id: route.provider.id,
          name: route.provider.name,
          type: route.provider.type,
          website: route.provider.website,
        }
      : null,
    priceMin: route.priceMin,
    priceMax: route.priceMax,
    durationMinutes: route.durationMinutes,
    distanceKm: route.distanceKm,
    scheduleNote: route.scheduleNote,
    bookingUrl: route.bookingUrl,
    source: route.source,
    sourceUrl: route.sourceUrl,
    lastVerifiedAt: route.lastVerifiedAt,
    confidenceScore: route.confidenceScore,
    whyRecommended: route.whyRecommended,
  };
}

async function getRoutes(req, res) {
  try {
    const { from, to, mode, preference = 'comfort' } = req.query;
    const where = { active: true };
    if (mode) where.mode = String(mode);

    const routes = await prisma.transportRoute.findMany({
      where,
      include: { provider: true },
      orderBy: [{ fromCity: 'asc' }, { toCity: 'asc' }, { mode: 'asc' }],
      take: 300,
    });

    const filtered = routes.filter((route) => {
      const fromOk = !from || sameCity(route.fromCity, from) || sameCity(route.toCity, from);
      const toOk = !to || sameCity(route.toCity, to) || sameCity(route.fromCity, to);
      return fromOk && toOk;
    });

    const items = filtered
      .sort((a, b) => routeScore(a, preference) - routeScore(b, preference))
      .map(normalizeRoute);

    return success(res, { items, total: items.length, from: from || null, to: to || null, mode: mode || null });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getYandexNearby(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radiusKm || req.query.radius || 5);
    const type = req.query.type ? String(req.query.type) : '';
    const limit = req.query.limit;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return error(res, 'lat and lng are required', 400);
    }

    const payload = await fetchYandexTransportNearby({ lat, lng, radiusKm, type, limit });
    return success(res, payload);
  } catch (err) {
    return success(res, {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: err.message || 'Yandex transport lookup failed',
    });
  }
}

module.exports = { getRoutes, getYandexNearby, normalizeRoute, routeScore };
