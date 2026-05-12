const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { cityKey, normalizeCity } = require('../utils/city');

function upsertCoverage(map, city) {
  const normalized = normalizeCity(city);
  if (!normalized) return null;
  const key = cityKey(normalized);
  if (!key) return null;
  if (!map.has(key)) {
    map.set(key, {
      city: normalized,
      destinationCount: 0,
      poiCount: 0,
      transportRouteCount: 0,
      avgConfidence: null,
      offlinePack: null,
      coverageLevel: 'missing',
    });
  }
  return map.get(key);
}

function coverageLevel(item) {
  if (item.destinationCount > 0 && item.poiCount >= 30 && item.transportRouteCount >= 3) return 'strong';
  if (item.destinationCount > 0 && item.poiCount >= 10 && item.transportRouteCount >= 1) return 'usable';
  if (item.destinationCount > 0 || item.poiCount > 0) return 'starter';
  return 'missing';
}

async function getAll(req, res) {
  try {
    const [destinations, poiGroups, routeGroups, packs] = await Promise.all([
      prisma.destination.findMany({
        select: { name: true, confidenceScore: true, lastVerifiedAt: true, coverageTier: true },
      }),
      prisma.poi.groupBy({ by: ['city'], _count: { _all: true }, _avg: { confidenceScore: true } }),
      prisma.transportRoute.findMany({
        where: { active: true },
        select: { fromCity: true, toCity: true },
      }),
      prisma.cityPack.findMany(),
    ]);

    const coverage = new Map();

    destinations.forEach((dest) => {
      const item = upsertCoverage(coverage, dest.name);
      if (!item) return;
      item.destinationCount += 1;
      item.avgConfidence = dest.confidenceScore;
      item.coverageTier = dest.coverageTier;
      item.lastVerifiedAt = dest.lastVerifiedAt;
    });

    poiGroups.forEach((group) => {
      const item = upsertCoverage(coverage, group.city);
      if (!item) return;
      item.poiCount = group._count._all;
      item.avgConfidence = item.avgConfidence == null
        ? group._avg.confidenceScore
        : Number(((item.avgConfidence + Number(group._avg.confidenceScore || 0)) / 2).toFixed(2));
    });

    routeGroups.forEach((route) => {
      const from = upsertCoverage(coverage, route.fromCity);
      const to = upsertCoverage(coverage, route.toCity);
      if (from) from.transportRouteCount += 1;
      if (to) to.transportRouteCount += 1;
    });

    packs.forEach((pack) => {
      const item = upsertCoverage(coverage, pack.city);
      if (!item) return;
      item.offlinePack = {
        version: pack.version,
        offlineReady: pack.offlineReady,
        poiCount: pack.poiCount,
        destinationCount: pack.destinationCount,
        transportRouteCount: pack.transportRouteCount,
        emergencyContacts: pack.emergencyContacts,
        transportNotes: pack.transportNotes,
        sourceSummary: pack.sourceSummary,
        updatedAt: pack.updatedAt,
      };
    });

    const items = Array.from(coverage.values())
      .map((item) => ({ ...item, coverageLevel: coverageLevel(item) }))
      .sort((a, b) => a.city.localeCompare(b.city));

    return success(res, { items, total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { getAll };
