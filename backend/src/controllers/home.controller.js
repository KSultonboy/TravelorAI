const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { success, error } = require('../utils/response');
const { resolveTourImageUrl } = require('../utils/tourImage');

const HOME_TYPES = ['landmark', 'restaurant', 'hotel', 'transport'];
const LEGACY_PROVIDER_TERMS = ['google', 'mapbox', '2gis', 'manual_curated', 'fallback'];
const INTERACTION_WINDOW_DAYS = 30;
const ENTITY_TYPES = new Set(['place', 'agency', 'story']);
const EVENT_WEIGHTS = Object.freeze({
  view: 0.1,
  click: 0.7,
  search: 0.8,
  open: 0.8,
  direction_click: 1.5,
  wishlist_add: 2,
  trip_add: 3,
  booking_click: 3,
  agency_click: 1.2,
  story_view: 0.2,
});

function clampLimit(value, fallback = 24, max = 80) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function clampPage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(Math.floor(parsed), 1);
}

function normalizeBoolean(value) {
  const normalized = String(value || '').toLowerCase().trim();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function normalizeType(value) {
  const type = String(value || 'all').toLowerCase();
  return HOME_TYPES.includes(type) ? type : 'all';
}

function normalizeBadge(value) {
  const badge = String(value || 'all').toLowerCase();
  if (badge === 'latest') return 'Latest';
  if (badge === 'popular') return 'Popular';
  return 'all';
}

function publicAgencyWhere() {
  return { active: true, approvalStatus: 'approved' };
}

function publicTourWhere({ agencyOnly = false } = {}) {
  const agencyWhere = publicAgencyWhere();
  return {
    active: true,
    approvalStatus: 'approved',
    AND: [
      agencyOnly
        ? { agency: { is: agencyWhere } }
        : {
            OR: [
              { agencyId: null },
              { agency: { is: agencyWhere } },
            ],
          },
    ],
  };
}

function tourOrderBy(badge) {
  if (badge === 'Popular') {
    return [{ rating: 'desc' }, { approvedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }];
  }

  return [{ approvedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }, { rating: 'desc' }];
}

function normalizeEntityType(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'poi' || raw === 'destination') return 'place';
  if (raw === 'agency' || raw === 'story' || raw === 'place') return raw;
  return null;
}

function normalizeEventType(value) {
  const raw = String(value || '').toLowerCase().trim();
  return EVENT_WEIGHTS[raw] ? raw : null;
}

function isGlobalPlace(item) {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  return Boolean(String(item.city || '').trim());
}

function dedupePlaces(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item || !item.name || !isGlobalPlace(item)) continue;
    const key = [
      String(item.type || '').toLowerCase(),
      String(item.name || '').toLowerCase().replace(/\s+/g, ' ').trim(),
      Number(item.lat || 0).toFixed(4),
      Number(item.lng || 0).toFixed(4),
    ].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function legacyProviderWhere() {
  const and = [];
  for (const term of LEGACY_PROVIDER_TERMS) {
    and.push({ NOT: { source: { contains: term, mode: 'insensitive' } } });
    and.push({
      OR: [
        { sourceUrl: null },
        { NOT: { sourceUrl: { contains: term, mode: 'insensitive' } } },
      ],
    });
    and.push({
      OR: [
        { verifiedBy: null },
        { NOT: { verifiedBy: { contains: term, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}

function formatPoi(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    city: item.city,
    type: item.type,
    subtype: item.subtype || null,
    icon: item.icon || 'pin',
    imageUrl: item.imageUrl || null,
    info: item.info || '',
    description: item.description || item.info || '',
    lat: item.lat,
    lng: item.lng,
    rating: item.rating ?? null,
    ratingCount: item.ratingCount ?? null,
    phone: item.phone || null,
    website: item.website || null,
    openingHours: Array.isArray(item.openingHours) ? item.openingHours : [],
    gallery: [],
    source: item.source || 'db',
    sourceUrl: item.sourceUrl || null,
    lastVerifiedAt: item.lastVerifiedAt || null,
    confidenceScore: item.confidenceScore ?? null,
    featured: Boolean(item.featured),
    manualBoost: item.manualBoost ?? 0,
    qualityScore: item.qualityScore ?? item.confidenceScore ?? 0.7,
    landingSortOrder: item.landingSortOrder ?? 0,
  };
}

function formatTour(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    city: item.city,
    subtitle: item.subtitle,
    description: item.description || '',
    duration: item.duration,
    responseTimeMinutes: item.responseTimeMinutes ?? 45,
    price: item.price || '',
    priceMin: item.priceMin ?? null,
    priceCurrency: item.priceCurrency || null,
    priceBasis: item.priceBasis || null,
    rating: item.rating ?? 0,
    badge: item.badge || 'Latest',
    imageUrl: resolveTourImageUrl(item),
    highlights: Array.isArray(item.highlights) ? item.highlights : [],
    itinerary: item.itinerary || null,
    departureCity: item.departureCity || null,
    destinationCountry: item.destinationCountry || null,
    tourGroup: item.tourGroup || null,
    nights: item.nights ?? null,
    hotelIncluded: Boolean(item.hotelIncluded),
    hotelName: item.hotelName || null,
    hotelCategory: item.hotelCategory || null,
    hotelLocation: item.hotelLocation || null,
    roomType: item.roomType || null,
    mealPlan: item.mealPlan || null,
    mealPlanLabel: item.mealPlanLabel || null,
    childPolicy: item.childPolicy || null,
    flightSeatStatus: item.flightSeatStatus || null,
    availabilityStatus: item.availabilityStatus || null,
    instantConfirmation: Boolean(item.instantConfirmation),
    stopSale: Boolean(item.stopSale),
    promo: Boolean(item.promo),
    priceIncludes: Array.isArray(item.priceIncludes) ? item.priceIncludes : [],
    priceExcludes: Array.isArray(item.priceExcludes) ? item.priceExcludes : [],
    agency: item.agency
      ? {
          id: item.agency.id,
          slug: item.agency.slug,
          name: item.agency.name,
          city: item.agency.city,
          rating: item.agency.rating,
          phone: item.agency.phone,
          telegram: item.agency.telegram || null,
          website: item.agency.website,
          imageUrl: item.agency.imageUrl,
        }
      : null,
    source: item.source || 'admin',
    sourceUrl: item.sourceUrl || null,
    lastVerifiedAt: item.lastVerifiedAt || null,
    confidenceScore: item.confidenceScore ?? null,
  };
}

function formatAgency(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    city: item.city,
    description: item.description || '',
    specialty: item.specialty,
    rating: item.rating ?? 0,
    reviews: item.reviews ?? 0,
    tours: item.toursCount ?? item._count?.tours ?? 0,
    phone: item.phone || null,
    telegram: item.telegram || null,
    website: item.website || null,
    imageUrl: item.imageUrl || null,
    source: item.source || 'admin',
    sourceUrl: item.sourceUrl || null,
    lastVerifiedAt: item.lastVerifiedAt || null,
    confidenceScore: item.confidenceScore ?? null,
    featured: Boolean(item.featured),
    manualBoost: item.manualBoost ?? 0,
    qualityScore: item.qualityScore ?? item.confidenceScore ?? 0.7,
    landingSortOrder: item.landingSortOrder ?? 0,
  };
}

function formatHeroSlide(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle || '',
    imageUrl: item.imageUrl,
    actionUrl: item.actionUrl || null,
    placeSlug: item.placeSlug || null,
    sortOrder: item.sortOrder,
    source: item.source || 'admin',
    sourceUrl: item.sourceUrl || null,
    lastVerifiedAt: item.lastVerifiedAt || null,
    confidenceScore: item.confidenceScore ?? null,
  };
}

function formatTravelerStory(item) {
  return {
    id: item.id,
    slug: item.slug,
    quote: item.quote,
    authorName: item.authorName,
    authorRole: item.authorRole,
    avatar: item.avatar || item.authorName?.charAt(0) || 'T',
    avatarColor: item.avatarColor || '#0c8b63',
    rating: item.rating ?? 5,
    sortOrder: item.sortOrder,
    source: item.source || 'admin',
    sourceUrl: item.sourceUrl || null,
    lastVerifiedAt: item.lastVerifiedAt || null,
    confidenceScore: item.confidenceScore ?? null,
    featured: Boolean(item.featured),
    manualBoost: item.manualBoost ?? 0,
    qualityScore: item.qualityScore ?? item.confidenceScore ?? 0.8,
  };
}

async function getInteractionScores(entityType, ids) {
  const cleanIds = [...new Set(ids.filter(Boolean).map(String))];
  if (!ENTITY_TYPES.has(entityType) || cleanIds.length === 0) return new Map();

  const since = new Date(Date.now() - INTERACTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  try {
    const rows = await prisma.landingInteraction.groupBy({
      by: ['entityId'],
      where: {
        entityType,
        entityId: { in: cleanIds },
        createdAt: { gte: since },
      },
      _sum: { weight: true },
    });

    return new Map(rows.map((row) => [row.entityId, row._sum.weight || 0]));
  } catch {
    return new Map();
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getItemRatingCount(item) {
  return toNumber(item.ratingCount ?? item.reviews ?? 0, 0);
}

function rankLandingItems(items, entityType, interactionScores) {
  return items
    .map((item) => {
      const interactionScore = toNumber(interactionScores.get(String(item.id)), 0);
      const featuredScore = item.featured ? 100 : 0;
      const manualScore = toNumber(item.manualBoost, 0) * 10;
      const qualityScore = toNumber(item.qualityScore ?? item.confidenceScore, 0.6) * 15;
      const ratingScore = toNumber(item.rating, 0) * 5;
      const popularityScore = Math.log10(getItemRatingCount(item) + 1) * 2;
      const sortOrder = toNumber(item.landingSortOrder ?? item.sortOrder, 0);
      const sortOrderScore = sortOrder > 0 ? Math.max(0, 12 - sortOrder) : 0;
      const rankingScore =
        featuredScore + manualScore + qualityScore + ratingScore + popularityScore + sortOrderScore + interactionScore;

      return {
        ...item,
        interactionScore: Number(interactionScore.toFixed(2)),
        rankingScore: Number(rankingScore.toFixed(2)),
        rankingSource: entityType === 'place' ? 'admin+yandex+user_events' : 'admin+user_events',
      };
    })
    .sort((a, b) => {
      const scoreDelta = b.rankingScore - a.rankingScore;
      if (scoreDelta !== 0) return scoreDelta;
      return String(a.name || a.authorName || a.slug).localeCompare(String(b.name || b.authorName || b.slug));
    });
}

async function getDbHomePlaces({ type = 'all', limit = 40 }) {
  const where = legacyProviderWhere();
  if (type !== 'all') where.type = type;
  where.landingActive = true;

  const items = await prisma.poi.findMany({
    where,
    orderBy: [{ featured: 'desc' }, { landingSortOrder: 'asc' }, { rating: 'desc' }, { updatedAt: 'desc' }],
    take: Math.max(limit * 8, 80),
  });

  return items.map(formatPoi).slice(0, limit);
}

async function resolvePlaces({ type = 'all', limit = 40 }) {
  const dbItems = await getDbHomePlaces({ type, limit }).catch(() => []);
  const mergedItems = dedupePlaces(dbItems);

  if (mergedItems.length > 0) {
    const scores = await getInteractionScores(
      'place',
      mergedItems.filter((item) => item.source !== 'yandex').map((item) => item.id)
    );
    return rankLandingItems(mergedItems, 'place', scores).slice(0, limit);
  }

  return [];
}

async function resolveTours({
  badge = 'all',
  limit = 12,
  page = 1,
  q = '',
  agencyOnly = false,
  paginated = false,
}) {
  const where = publicTourWhere({ agencyOnly });
  if (badge !== 'all') where.badge = badge;
  const search = String(q || '').trim();
  if (search) {
    where.AND.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { subtitle: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const query = {
    where,
    include: { agency: true },
    orderBy: tourOrderBy(badge),
    take: limit,
  };

  if (paginated) {
    query.skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.tour.findMany(query),
      prisma.tour.count({ where }),
    ]);

    return {
      items: items.map(formatTour),
      total,
      page,
      limit,
      badge,
      agencyOnly,
    };
  }

  const items = await prisma.tour.findMany(query);

  return items.map(formatTour);
}

async function resolveAgencies({ sort = 'top', limit = 8 }) {
  const orderBy =
    sort === 'mostTours'
      ? [{ featured: 'desc' }, { landingSortOrder: 'asc' }, { toursCount: 'desc' }, { rating: 'desc' }]
      : [{ featured: 'desc' }, { landingSortOrder: 'asc' }, { rating: 'desc' }, { reviews: 'desc' }];
  const items = await prisma.tourAgency.findMany({
    where: publicAgencyWhere(),
    include: { _count: { select: { tours: true } } },
    orderBy,
    take: Math.max(limit * 4, 40),
  });

  const formatted = items.map(formatAgency);
  const scores = await getInteractionScores(
    'agency',
    formatted.map((item) => item.id)
  );
  return rankLandingItems(formatted, 'agency', scores).slice(0, limit);
}

async function resolveHeroSlides({ limit = 6 }) {
  const items = await prisma.homeHeroSlide.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return items.map(formatHeroSlide);
}

async function resolveStories({ limit = 6 }) {
  const items = await prisma.travelerStory.findMany({
    where: { active: true },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: Math.max(limit * 4, 40),
  });

  const formatted = items.map(formatTravelerStory);
  const scores = await getInteractionScores(
    'story',
    formatted.map((item) => item.id)
  );
  return rankLandingItems(formatted, 'story', scores).slice(0, limit);
}

async function getHome(req, res) {
  try {
    const limit = clampLimit(req.query.limit, 40, 80);
    const [places, latestTours, popularTours, agencies, heroSlides, stories] = await Promise.all([
      resolvePlaces({ type: 'all', limit }),
      resolveTours({ badge: 'Latest', limit: 8 }),
      resolveTours({ badge: 'Popular', limit: 8 }),
      resolveAgencies({ sort: 'top', limit: 6 }),
      resolveHeroSlides({ limit: 8 }),
      resolveStories({ limit: 6 }),
    ]);

    return success(res, {
      places,
      tours: [...latestTours, ...popularTours],
      agencies,
      heroSlides,
      stories,
      stats: {
        places: places.length,
        tours: latestTours.length + popularTours.length,
        agencies: agencies.length,
        stories: stories.length,
        source: 'backend_home_api',
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getPlaces(req, res) {
  try {
    const type = normalizeType(req.query.type);
    const limit = clampLimit(req.query.limit, 40, 100);
    const items = await resolvePlaces({ type, limit });
    return success(res, { items, total: items.length, type });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getTours(req, res) {
  try {
    const badge = normalizeBadge(req.query.badge || req.query.filter);
    const limit = clampLimit(req.query.limit, 20, 60);
    const page = clampPage(req.query.page);
    const q = String(req.query.q || req.query.search || '').trim();
    const agencyOnly = normalizeBoolean(req.query.agencyOnly);
    const result = await resolveTours({ badge, limit, page, q, agencyOnly, paginated: true });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getAgencies(req, res) {
  try {
    const sort = String(req.query.sort || 'top') === 'mostTours' ? 'mostTours' : 'top';
    const limit = clampLimit(req.query.limit, 40, 100);
    const items = await resolveAgencies({ sort, limit });
    return success(res, { items, total: items.length, sort });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getHeroSlides(req, res) {
  try {
    const limit = clampLimit(req.query.limit, 8, 30);
    const items = await resolveHeroSlides({ limit });
    return success(res, { items, total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function getStories(req, res) {
  try {
    const limit = clampLimit(req.query.limit, 12, 40);
    const items = await resolveStories({ limit });
    return success(res, { items, total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function recordInteraction(req, res) {
  try {
    const entityType = normalizeEntityType(req.body?.entityType);
    const eventType = normalizeEventType(req.body?.eventType);
    const entityId = String(req.body?.entityId || '').trim();

    if (!entityType || !eventType || !entityId) {
      return error(res, 'Invalid interaction payload', 400);
    }

    const sessionId = req.body?.sessionId ? String(req.body.sessionId).slice(0, 120) : null;
    const userId = req.user?.id || (req.body?.userId ? String(req.body.userId).slice(0, 120) : null);
    const source = req.body?.source ? String(req.body.source).slice(0, 80) : 'website';
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined;

    const interactionData = {
      entityType,
      entityId,
      eventType,
      weight: EVENT_WEIGHTS[eventType],
      sessionId,
      userId,
      source,
      metadata,
    };

    try {
      await prisma.landingInteraction.create({ data: interactionData });
    } catch (err) {
      logger.warn('Landing interaction was not stored', {
        entityType,
        entityId,
        eventType,
        message: err.message,
      });

      return success(res, { ok: true, stored: false }, 202);
    }

    return success(res, { ok: true, stored: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = { getHome, getPlaces, getTours, getAgencies, getHeroSlides, getStories, recordInteraction };
