const crypto = require('crypto');
const { prisma } = require('../config/database');
const { refineTripPlanWithGemini } = require('./geminiPlanner.service');

const INTEREST_KEYWORDS = {
  tarixiy: ['history', 'historical', 'museum', 'ark', 'fortress', 'qala', 'madrasah', 'maqbara'],
  madaniy: ['culture', 'art', 'heritage', 'gallery', 'center'],
  tabiat: ['nature', 'park', 'lake', 'river', 'eco', 'garden'],
  gastronomiya: ['food', 'restaurant', 'cafe', 'tea', 'dish'],
  gastronomy: ['food', 'restaurant', 'cafe', 'tea', 'dish'],
  arxitektura: ['architecture', 'building', 'tower', 'minaret', 'mosque'],
  din: ['mosque', 'shrine', 'religious', 'ziyorat'],
  zamonaviy: ['modern', 'mall', 'shopping', 'entertainment'],
  hunarmandchilik: ['craft', 'workshop', 'artisan', 'bazaar'],
};

function genId() {
  return crypto.randomUUID();
}

function formatCityName(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cityKey(value) {
  return normalizeText(value);
}

function toInterestKeywords(interests) {
  return (Array.isArray(interests) ? interests : []).flatMap((interest) => INTEREST_KEYWORDS[interest] || [interest]);
}

function fallbackTypePrice(type, style) {
  if (type === 'restaurant') return style === 'budget' ? 55_000 : style === 'mid' ? 95_000 : 165_000;
  if (type === 'hotel') return style === 'budget' ? 180_000 : style === 'mid' ? 310_000 : 520_000;
  if (type === 'transport') return style === 'budget' ? 28_000 : style === 'mid' ? 42_000 : 70_000;
  return style === 'budget' ? 35_000 : style === 'mid' ? 60_000 : 105_000;
}

function resolvePoiCost(poi, style) {
  const value = Number(poi?.price || 0);
  if (value > 0) return value;
  return fallbackTypePrice(String(poi?.type || ''), style);
}

function findBestPoiByInterests(points, interests) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const keywords = toInterestKeywords(interests).map((item) => normalizeText(item));
  return points
    .map((poi) => {
      const haystack = normalizeText(`${poi.name} ${poi.info} ${poi.subtype || ''}`);
      const score = keywords.reduce((sum, kw) => (kw && haystack.includes(kw) ? sum + 2 : sum), 0);
      return { poi, score: score + (poi.type === 'landmark' ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.poi);
}

function pickByIndex(items, index) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[index % items.length];
}

function uniquePoiByName(items) {
  const list = Array.isArray(items) ? items : [];
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const name = normalizeText(item?.name || item);
    if (!name || seen.has(name)) return;
    seen.add(name);
    result.push(item);
  });
  return result;
}

function getTransportMultiplier(type) {
  if (type === 'cheap') return 0.85;
  if (type === 'comfort') return 1.15;
  return 1;
}

function normalizePositive(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function pickIntercityTransport(dest, transportType, style) {
  const busPrice = normalizePositive(dest?.busPrice);
  const trainPrice = normalizePositive(dest?.trainPrice);
  const flightPrice = normalizePositive(dest?.flightPrice);

  const options =
    transportType === 'fast'
      ? [
          { mode: 'flight', cost: flightPrice, duration: String(dest?.flightDuration || '').trim() },
          { mode: 'train', cost: trainPrice, duration: String(dest?.trainDuration || '').trim() },
          { mode: 'bus', cost: busPrice, duration: String(dest?.busDuration || '').trim() },
        ]
      : transportType === 'comfort'
        ? [
            { mode: 'train', cost: trainPrice, duration: String(dest?.trainDuration || '').trim() },
            { mode: 'flight', cost: flightPrice, duration: String(dest?.flightDuration || '').trim() },
            { mode: 'bus', cost: busPrice, duration: String(dest?.busDuration || '').trim() },
          ]
        : [
            { mode: 'bus', cost: busPrice, duration: String(dest?.busDuration || '').trim() },
            { mode: 'train', cost: trainPrice, duration: String(dest?.trainDuration || '').trim() },
            { mode: 'flight', cost: flightPrice, duration: String(dest?.flightDuration || '').trim() },
          ];

  const chosen = options.find((item) => item.cost > 0);
  if (chosen) {
    return {
      mode: chosen.mode,
      cost: chosen.cost,
      duration:
        chosen.duration ||
        (chosen.mode === 'flight' ? '1-2 soat' : chosen.mode === 'train' ? '4-8 soat' : '5-10 soat'),
    };
  }

  const fallbackCost = fallbackTypePrice('transport', style) * 3;
  return {
    mode: transportType === 'fast' ? 'flight' : transportType === 'comfort' ? 'train' : 'bus',
    cost: fallbackCost,
    duration: transportType === 'fast' ? '1-2 soat' : transportType === 'comfort' ? '4-8 soat' : '5-10 soat',
  };
}

function getMealLabel(foodPreferences, base) {
  if (!foodPreferences || foodPreferences === 'none') return base;
  if (foodPreferences === 'halal') return `${base} (halal)`;
  if (foodPreferences === 'vegetarian') return `${base} (vegetarian)`;
  if (foodPreferences === 'vegan') return `${base} (vegan)`;
  return base;
}

function buildVirtualDestination(cityName, cityPois, duration, style) {
  const safeName = formatCityName(cityName);
  const pois = Array.isArray(cityPois) ? cityPois : [];
  const landmarks = pois
    .filter((poi) => poi.type === 'landmark')
    .slice(0, 8)
    .map((poi) => ({ name: poi.name, entryFee: resolvePoiCost(poi, style) }));
  const hotels = pois
    .filter((poi) => poi.type === 'hotel')
    .slice(0, 5)
    .map((poi) => ({ name: poi.name, pricePerNight: resolvePoiCost(poi, style) }));

  return {
    id: `virtual-${cityKey(safeName) || genId()}`,
    slug: `virtual-${cityKey(safeName) || genId()}`,
    name: safeName,
    region: 'Global',
    description: `${safeName} bo'yicha Yandex kontekstidan tuzilgan vaqtinchalik destination.`,
    imageUrl: '',
    rating: 4.5,
    reviewCount: pois.length,
    categories: ['culture', 'food', 'history', 'nature', 'shopping'],
    tags: ['Yandex runtime context', 'Global'],
    budgetDaily: 220000,
    midDaily: 420000,
    luxuryDaily: 850000,
    trainPrice: 0,
    trainDuration: '',
    busPrice: 0,
    busDuration: '',
    flightPrice: 0,
    flightDuration: '',
    landmarks: landmarks.length ? landmarks : [{ name: `${safeName} markazi`, entryFee: fallbackTypePrice('landmark', style) }],
    hotels: hotels.length ? hotels : [`${safeName} mehmonxonasi`],
    foodBudget: 60000,
    foodMid: 110000,
    foodLuxury: 190000,
    bestSeasons: ['Spring', 'Autumn'],
    minDays: 1,
    maxDays: Math.max(1, Math.min(Number(duration || 3), 5)),
    source: 'yandex_runtime_context',
    sourceUrl: null,
    lastVerifiedAt: new Date(),
    confidenceScore: pois.length >= 20 ? 0.68 : 0.52,
    verifiedBy: 'runtime_context',
    coverageTier: pois.length >= 20 ? 'usable' : 'starter',
  };
}

async function loadPoiCatalog() {
  try {
    const pois = await prisma.poi.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        type: true,
        subtype: true,
        info: true,
        price: true,
        lat: true,
        lng: true,
        icon: true,
        source: true,
        sourceUrl: true,
        confidenceScore: true,
        lastVerifiedAt: true,
      },
      take: 1500,
    });
    const grouped = {};
    pois.forEach((poi) => {
      const key = cityKey(poi.city);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(poi);
    });
    return grouped;
  } catch {
    return {};
  }
}

function normalizePoiContextItem(item, fallbackCity) {
  const name = String(item?.name || '').trim();
  if (!name) return null;
  const city = String(item?.city || fallbackCity || '').trim() || fallbackCity || '';
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  const price = Number(item?.price);
  const rating = Number(item?.rating);

  return {
    id: item?.id || null,
    name,
    city,
    type: String(item?.type || 'landmark').trim() || 'landmark',
    subtype: item?.subtype ? String(item.subtype).trim() : null,
    info: String(item?.info || item?.description || '').trim(),
    price: Number.isFinite(price) && price > 0 ? price : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    rating: Number.isFinite(rating) ? rating : null,
    icon: item?.icon ? String(item.icon) : undefined,
  };
}

function groupPoiContextByCity(poiContext, fallbackCity) {
  const grouped = {};
  const list = Array.isArray(poiContext) ? poiContext : [];

  list.forEach((item) => {
    const normalized = normalizePoiContextItem(item, fallbackCity);
    if (!normalized) return;
    const key = cityKey(normalized.city);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(normalized);
  });

  return grouped;
}

function mergePoiCatalogs(dbCatalog, contextCatalog) {
  const merged = { ...(dbCatalog || {}) };
  const contextEntries = Object.entries(contextCatalog || {});

  contextEntries.forEach(([key, contextItems]) => {
    const baseItems = Array.isArray(merged[key]) ? merged[key] : [];
    const seen = new Set(
      baseItems.map((item) => `${normalizeText(item?.name || '')}|${normalizeText(item?.type || '')}`)
    );
    const extra = [];

    (Array.isArray(contextItems) ? contextItems : []).forEach((item) => {
      const dedupeKey = `${normalizeText(item?.name || '')}|${normalizeText(item?.type || '')}`;
      if (!item?.name || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      extra.push(item);
    });

    merged[key] = [...baseItems, ...extra];
  });

  return merged;
}

const TRANSPORT_MODE_PRIORITY = {
  cheap: ['bus', 'train', 'metro', 'taxi', 'flight'],
  fast: ['flight', 'train', 'taxi', 'bus', 'metro'],
  comfort: ['train', 'flight', 'taxi', 'bus', 'metro'],
};

function routePreferenceScore(route, transportType = 'comfort') {
  const modes = TRANSPORT_MODE_PRIORITY[transportType] || TRANSPORT_MODE_PRIORITY.comfort;
  const modeRank = modes.indexOf(route.mode);
  const normalizedModeRank = modeRank >= 0 ? modeRank : modes.length;
  const avgPrice = (Number(route.priceMin || 0) + Number(route.priceMax || 0)) / 2;
  return normalizedModeRank * 1_000_000 + avgPrice + Number(route.durationMinutes || 0) * 120;
}

function routeMatches(route, fromCity, toCity) {
  const from = cityKey(fromCity);
  const to = cityKey(toCity);
  const routeFrom = cityKey(route.fromCity);
  const routeTo = cityKey(route.toCity);
  if (!from || !to || !routeFrom || !routeTo) return false;
  return (routeFrom === from && routeTo === to) || (routeFrom === to && routeTo === from);
}

function durationLabel(minutes) {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) return 'taxminiy';
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (hours <= 0) return `${mins} daqiqa`;
  if (mins === 0) return `${hours} soat`;
  return `${hours} soat ${mins} daqiqa`;
}

function buildFallbackLeg(fromCity, toCity, dest, transportType, style) {
  const fallback = pickIntercityTransport(dest || {}, transportType, style);
  const estimatedCost = Number(fallback.cost || fallbackTypePrice('transport', style) * 3);
  return {
    id: `estimated-${cityKey(fromCity)}-${cityKey(toCity)}-${fallback.mode}`,
    fromCity: formatCityName(fromCity),
    toCity: formatCityName(toCity),
    mode: fallback.mode,
    providerName: 'Taxminiy transport',
    priceMin: Math.round(estimatedCost * 0.85),
    priceMax: Math.round(estimatedCost * 1.2),
    estimatedCost,
    durationMinutes: fallback.mode === 'flight' ? 90 : fallback.mode === 'train' ? 420 : 540,
    duration: fallback.duration,
    distanceKm: null,
    scheduleNote: 'Aniq jadval topilmadi. Jo`nashdan oldin rasmiy manbadan tekshiring.',
    bookingUrl: null,
    source: 'estimated_fallback',
    sourceUrl: null,
    lastVerifiedAt: null,
    confidenceScore: 0.35,
    whyChosen: 'Aniq marshrut ma`lumoti topilmagani uchun taxminiy variant berildi.',
    isEstimated: true,
  };
}

function normalizeRouteLeg(route, fromCity, toCity, transportType) {
  const avgPrice = Math.round((Number(route.priceMin || 0) + Number(route.priceMax || 0)) / 2);
  return {
    id: route.id,
    fromCity: formatCityName(fromCity),
    toCity: formatCityName(toCity),
    mode: route.mode,
    providerName: route.provider?.name || 'Transport provider',
    priceMin: Number(route.priceMin || avgPrice),
    priceMax: Number(route.priceMax || avgPrice),
    estimatedCost: avgPrice,
    durationMinutes: Number(route.durationMinutes || 0),
    duration: durationLabel(route.durationMinutes),
    distanceKm: route.distanceKm ?? null,
    scheduleNote: route.scheduleNote || 'Jadvalni jo`nashdan oldin tekshiring.',
    bookingUrl: route.bookingUrl || route.provider?.website || null,
    source: route.source || 'manual',
    sourceUrl: route.sourceUrl || route.provider?.sourceUrl || null,
    lastVerifiedAt: route.lastVerifiedAt || route.provider?.lastVerifiedAt || null,
    confidenceScore: Number(route.confidenceScore || 0.6),
    whyChosen:
      route.whyRecommended ||
      `${transportType === 'cheap' ? 'Arzonlik' : transportType === 'fast' ? 'tezlik' : 'qulaylik'} bo'yicha mos variant.`,
    isEstimated: false,
  };
}

async function buildTransportLegs(selected, { departureCity, transportType, style }) {
  const routes = await prisma.transportRoute
    .findMany({
      where: { active: true },
      include: { provider: true },
      take: 500,
    })
    .catch(() => []);

  const legs = [];
  let fromCity = departureCity || selected[0]?.name || '';

  selected.forEach((dest) => {
    const toCity = dest.name;
    const candidates = routes
      .filter((route) => routeMatches(route, fromCity, toCity))
      .sort((a, b) => routePreferenceScore(a, transportType) - routePreferenceScore(b, transportType));
    const best = candidates[0];
    const leg = best
      ? normalizeRouteLeg(best, fromCity, toCity, transportType)
      : buildFallbackLeg(fromCity, toCity, dest, transportType, style);
    leg.alternatives = candidates.slice(1, 4).map((route) => normalizeRouteLeg(route, fromCity, toCity, transportType));
    legs.push(leg);
    fromCity = toCity;
  });

  return legs;
}

function buildDataQuality({ selected, days, transportLegs, poiCatalog }) {
  const destinationConfidence = selected.map((dest) => Number(dest.confidenceScore || 0.6));
  const poiConfidence = selected.flatMap((dest) =>
    (poiCatalog[cityKey(dest.name)] || []).slice(0, 30).map((poi) => Number(poi.confidenceScore || 0.55))
  );
  const transportConfidence = transportLegs.map((leg) => Number(leg.confidenceScore || 0.35));
  const all = [...destinationConfidence, ...poiConfidence, ...transportConfidence].filter((item) => Number.isFinite(item));
  const score = all.length ? Number((all.reduce((sum, item) => sum + item, 0) / all.length).toFixed(2)) : 0.45;
  const verificationWarnings = [];

  transportLegs.forEach((leg) => {
    if (leg.isEstimated || leg.confidenceScore < 0.5) {
      verificationWarnings.push(`${leg.fromCity} - ${leg.toCity} transporti taxminiy. Rasmiy jadvalni tekshiring.`);
    }
  });

  selected.forEach((dest) => {
    const count = (poiCatalog[cityKey(dest.name)] || []).length;
    if (count < 10) verificationWarnings.push(`${dest.name} bo'yicha POI katalog hali to'liq emas (${count} ta joy).`);
  });

  const sourceSummary = {
    destinationCount: selected.length,
    poiCount: selected.reduce((sum, dest) => sum + (poiCatalog[cityKey(dest.name)] || []).length, 0),
    transportRouteCount: transportLegs.filter((leg) => !leg.isEstimated).length,
    hasEstimatedTransport: transportLegs.some((leg) => leg.isEstimated),
    generatedFrom: ['verified_db', 'manual_transport_routes', 'poi_context', 'gemini_refinement'],
  };

  return {
    dataConfidence: {
      score,
      level: score >= 0.75 ? 'high' : score >= 0.55 ? 'medium' : 'low',
      label: score >= 0.75 ? 'Yuqori ishonch' : score >= 0.55 ? 'O`rtacha ishonch' : 'Taxminiy reja',
    },
    sourceSummary,
    verificationWarnings,
  };
}

async function generateTripPlanBase({
  budget,
  duration,
  travelers,
  style,
  interests,
  departureCity,
  city,
  companions,
  foodPreferences,
  transportType,
  flexibility,
  recommendedPoiNames,
  analysisContext,
  poiContext,
}) {
  const safeBudget = Number(budget || 0);
  const safeDuration = Math.max(1, Number(duration || 1));
  const safeTravelers = Math.max(1, Number(travelers || 1));
  const safeStyle = ['budget', 'mid', 'luxury'].includes(style) ? style : 'mid';
  const preferredCity = formatCityName(city || departureCity);
  const miscBudget = Math.round(safeBudget * 0.05);

  const [dbPoiCatalog, destinationsRaw] = await Promise.all([
    loadPoiCatalog(),
    prisma.destination.findMany().catch(() => []),
  ]);
  const poiContextCatalog = groupPoiContextByCity(poiContext, preferredCity);
  const poiCatalog = mergePoiCatalogs(dbPoiCatalog, poiContextCatalog);
  const preferredPoiContext = poiCatalog[cityKey(preferredCity)] || [];
  const destinations = [...destinationsRaw];

  if (
    preferredCity &&
    !destinations.some((dest) => cityKey(dest.name) === cityKey(preferredCity)) &&
    preferredPoiContext.length > 0
  ) {
    destinations.unshift(buildVirtualDestination(preferredCity, preferredPoiContext, safeDuration, safeStyle));
  }

  const scored = destinations.map((dest) => {
    let score = 0;
    const categories = Array.isArray(dest.categories) ? dest.categories : [];
    for (const interest of interests || []) {
      if (categories.some((c) => normalizeText(c).includes(normalizeText(interest)))) {
        score += 10;
      }
    }

    const landmarks = Array.isArray(dest.landmarks) ? dest.landmarks : [];
    score += landmarks.length * 3;
    score += Number(dest.rating || 0) * 2;

    const cityPois = poiCatalog[cityKey(dest.name)] || [];
    score += Math.min(cityPois.length, 50) * 0.45;

    if (cityKey(dest.name) === cityKey(preferredCity)) {
      score += 45;
    }

    const matchedPoiCount = findBestPoiByInterests(cityPois, interests).slice(0, 8).length;
    score += matchedPoiCount * 1.5;

    return { ...dest, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = selectDestinations(scored, safeDuration, preferredCity);
  const transportLegs = await buildTransportLegs(selected, {
    departureCity,
    transportType,
    style: safeStyle,
  });
  const days = buildDays(selected, {
    style: safeStyle,
    travelers: safeTravelers,
    departureCity,
    companions,
    foodPreferences,
    transportType,
    flexibility,
    interests,
    poiCatalog,
    recommendedPoiNames,
    transportLegs,
  });

  const totalAccommodation = days.reduce((sum, day) => sum + Number(day.accommodation?.cost || 0), 0) * safeTravelers;
  const totalFood =
    days.reduce(
      (sum, day) =>
        sum +
        day.activities
          .filter((activity) => activity.type === 'food')
          .reduce((sub, activity) => sub + Number(activity.cost || 0), 0),
      0
    ) * safeTravelers;
  const totalAttractions =
    days.reduce(
      (sum, day) =>
        sum +
        day.activities
          .filter((activity) => activity.type === 'landmark')
          .reduce((sub, activity) => sub + Number(activity.cost || 0), 0),
      0
    ) * safeTravelers;

  let transportCost =
    days.reduce(
      (sum, day) =>
        sum +
        day.activities
          .filter((activity) => activity.type === 'transport')
          .reduce((sub, activity) => sub + Number(activity.cost || 0), 0),
      0
    ) * safeTravelers;

  if (transportCost <= 0 && selected.length > 0) {
    transportCost = Math.round(fallbackTypePrice('transport', safeStyle) * Math.max(1, safeDuration) * safeTravelers);
  }

  const totalCost = transportCost + totalAccommodation + totalFood + totalAttractions + miscBudget;
  const perPersonCost = Math.round(totalCost / Math.max(safeTravelers, 1));
  const budgetUsed = safeBudget > 0 ? Number(((totalCost / safeBudget) * 100).toFixed(1)) : 0;
  const budgetRemaining = safeBudget - totalCost;

  const warnings = [];
  if (totalCost > safeBudget) {
    warnings.push(safeStyle !== 'budget' ? "Budget yetarli emas. Tejamkor uslubni sinab ko'ring." : 'Budget yetarli emas. Budgetni oshiring.');
  }
  if (cityKey(preferredCity) && !selected.some((item) => cityKey(item.name) === cityKey(preferredCity))) {
    warnings.push(`${preferredCity} bo'yicha aniq ma'lumot kam. Eng yaqin mos yo'nalishlar tanlandi.`);
  }
  if (analysisContext?.estimatedTripCost && Number(analysisContext.estimatedTripCost) > safeBudget) {
    warnings.push('POI tahliliga ko`ra reja budjetdan yuqori bo`lishi mumkin.');
  }

  const destinationNames = selected.map((dest) => dest.name);
  const quality = buildDataQuality({ selected, days, transportLegs, poiCatalog });

  return {
    id: genId(),
    title: buildTitle(destinationNames, safeDuration),
    totalCost,
    perPersonCost,
    budgetUsed,
    budgetRemaining,
    style: safeStyle,
    travelers: safeTravelers,
    duration: safeDuration,
    destinations: destinationNames,
    transportLegs,
    days,
    breakdown: {
      transport: transportCost,
      accommodation: totalAccommodation,
      food: totalFood,
      attractions: totalAttractions,
      misc: miscBudget,
    },
    tips: generateTips(safeStyle, {
      companions,
      flexibility,
      foodPreferences,
      transportType,
      recommendedPoiNames,
      analysisContext,
      dataConfidence: quality.dataConfidence,
    }),
    warnings: Array.from(new Set([...warnings, ...quality.verificationWarnings])),
    highlights: generateHighlights(selected),
    dataConfidence: quality.dataConfidence,
    sourceSummary: quality.sourceSummary,
    alternatives: {
      transport: transportLegs.flatMap((leg) => leg.alternatives || []).slice(0, 8),
    },
    verificationWarnings: quality.verificationWarnings,
  };
}

async function generateTripPlan(input) {
  const basePlan = await generateTripPlanBase(input);
  const refinedPlan = await refineTripPlanWithGemini({
    basePlan,
    request: input,
  });

  return refinedPlan || basePlan;
}

function selectDestinations(scored, duration, preferredCity) {
  const selected = [];
  let daysLeft = duration;
  const usedIds = new Set();

  const preferred = scored.find((item) => cityKey(item.name) === cityKey(preferredCity));
  if (preferred) {
    const minDays = Number(preferred.minDays || 1);
    const maxDays = Number(preferred.maxDays || 3);
    const allocate = Math.min(maxDays, daysLeft);
    if (allocate >= minDays) {
      selected.push({ ...preferred, allocatedDays: allocate });
      usedIds.add(preferred.id);
      daysLeft -= allocate;
    }
  }

  for (const dest of scored) {
    if (daysLeft <= 0) break;
    if (usedIds.has(dest.id)) continue;
    const minDays = Number(dest.minDays || 1);
    const maxDays = Number(dest.maxDays || 3);
    const allocate = Math.min(maxDays, daysLeft);
    if (allocate >= minDays) {
      selected.push({ ...dest, allocatedDays: allocate });
      usedIds.add(dest.id);
      daysLeft -= allocate;
    }
  }

  if (daysLeft > 0 && selected.length > 0) {
    selected[selected.length - 1].allocatedDays += daysLeft;
  }

  if (!selected.length && scored.length > 0) {
    selected.push({ ...scored[0], allocatedDays: Math.max(1, duration) });
  }

  return selected;
}

function buildDays(selected, options) {
  const {
    style,
    travelers,
    departureCity,
    companions,
    foodPreferences,
    transportType,
    flexibility,
    interests,
    poiCatalog,
    recommendedPoiNames,
    transportLegs = [],
  } = options;

  const days = [];
  let dayNumber = 1;
  const departure = formatCityName(departureCity);
  const transportMultiplier = getTransportMultiplier(transportType);
  const preferredNamesSet = new Set((Array.isArray(recommendedPoiNames) ? recommendedPoiNames : []).map((item) => normalizeText(item)));

  selected.forEach((dest, index) => {
    const allocatedDays = Number(dest.allocatedDays || 1);
    const cityPois = poiCatalog[cityKey(dest.name)] || [];
    const landmarkPois = cityPois.filter((poi) => poi.type === 'landmark');
    const restaurantPois = cityPois.filter((poi) => poi.type === 'restaurant');
    const hotelPois = cityPois.filter((poi) => poi.type === 'hotel');
    const transportPois = cityPois.filter((poi) => poi.type === 'transport');
    const interestRanked = findBestPoiByInterests(landmarkPois, interests);
    const recommendedLandmarks = landmarkPois.filter((poi) => preferredNamesSet.has(normalizeText(poi.name)));
    const prioritizedLandmarks = uniquePoiByName([
      ...recommendedLandmarks,
      ...interestRanked,
      ...landmarkPois,
    ]);

    const landmarks = prioritizedLandmarks.length > 0 ? prioritizedLandmarks : Array.isArray(dest.landmarks) ? dest.landmarks : [];
    const hotelPoi = pickByIndex(hotelPois, 0);
    const hotelName = hotelPoi?.name || getHotelName(dest, style);
    const perPersonDaily = style === 'budget' ? Number(dest.budgetDaily || 0) : style === 'mid' ? Number(dest.midDaily || 0) : Number(dest.luxuryDaily || 0);
    const hotelCost = hotelPoi ? Math.round(resolvePoiCost(hotelPoi, style)) : Math.round(perPersonDaily * 0.45);
    const foodCostBase = style === 'budget' ? Number(dest.foodBudget || 0) : style === 'mid' ? Number(dest.foodMid || 0) : Number(dest.foodLuxury || 0);

    for (let d = 0; d < allocatedDays; d++) {
      const isFirstDayInCity = d === 0;
      const activities = [];

      if (isFirstDayInCity && index === 0) {
        const fromPoi = pickByIndex(transportPois, 0);
        const isSameCityStart = cityKey(departure) === cityKey(dest.name);
        const routeLeg = transportLegs[index];
        const intercity = pickIntercityTransport(dest, transportType, style);
        const localCostBase = Math.max(fallbackTypePrice('transport', style), Math.round(intercity.cost * 0.22));
        activities.push({
          time: '07:00',
          name: isSameCityStart
            ? fromPoi
              ? `${dest.name} ichida ${fromPoi.name} orqali yo'nalish`
              : `${dest.name} ichida transport yo'nalishi`
            : `${routeLeg?.fromCity || departure}dan ${routeLeg?.providerName || routeLeg?.mode || 'transport'} orqali ${routeLeg?.toCity || dest.name}ga yo'l`,
          cost: Math.round((isSameCityStart ? localCostBase : routeLeg?.estimatedCost || intercity.cost) * transportMultiplier),
          duration: isSameCityStart ? '30-60 daqiqa' : routeLeg?.duration || intercity.duration,
          durationMinutes: isSameCityStart ? 45 : routeLeg?.durationMinutes,
          distanceKm: routeLeg?.distanceKm ?? undefined,
          type: 'transport',
          lat: Number.isFinite(Number(fromPoi?.lat)) ? Number(fromPoi.lat) : undefined,
          lng: Number.isFinite(Number(fromPoi?.lng)) ? Number(fromPoi.lng) : undefined,
          source: routeLeg?.source || fromPoi?.source || 'estimated_fallback',
          confidenceScore: isSameCityStart ? Number(fromPoi?.confidenceScore || 0.55) : Number(routeLeg?.confidenceScore || 0.35),
          bookingUrl: routeLeg?.bookingUrl || undefined,
          note: routeLeg?.scheduleNote,
        });
      } else if (isFirstDayInCity && index > 0) {
        const prev = selected[index - 1];
        const routeLeg = transportLegs[index];
        const transfer = pickIntercityTransport(dest, transportType, style);
        const transferPoi = pickByIndex(transportPois, 0);
        activities.push({
          time: '08:00',
          name: `${routeLeg?.fromCity || prev.name}dan ${routeLeg?.providerName || routeLeg?.mode || 'transport'} orqali ${routeLeg?.toCity || dest.name}ga o'tish`,
          cost: Math.round((routeLeg?.estimatedCost || transfer.cost * 0.6) * transportMultiplier),
          duration: routeLeg?.duration || transfer.duration,
          durationMinutes: routeLeg?.durationMinutes,
          distanceKm: routeLeg?.distanceKm ?? undefined,
          type: 'transport',
          lat: Number.isFinite(Number(transferPoi?.lat)) ? Number(transferPoi.lat) : undefined,
          lng: Number.isFinite(Number(transferPoi?.lng)) ? Number(transferPoi.lng) : undefined,
          source: routeLeg?.source || transferPoi?.source || 'estimated_fallback',
          confidenceScore: Number(routeLeg?.confidenceScore || 0.35),
          bookingUrl: routeLeg?.bookingUrl || undefined,
          note: routeLeg?.scheduleNote,
        });
      }

      let time = isFirstDayInCity ? 10 : 9;
      const dayLandmarks = Array.from({ length: 2 })
        .map((_, i) => pickByIndex(landmarks, d * 2 + i))
        .filter(Boolean);

      dayLandmarks.forEach((landmark) => {
        const name = typeof landmark === 'string' ? landmark : landmark.name || dest.name;
        const costRaw = typeof landmark === 'string' ? fallbackTypePrice('landmark', style) : Number(landmark.entryFee || landmark.entry_fee || resolvePoiCost(landmark, style));
        activities.push({
          time: `${String(time).padStart(2, '0')}:00`,
          name,
          cost: Math.round(costRaw),
          duration: '1.5 soat',
          durationMinutes: Number(landmark.duration || 90),
          type: 'landmark',
          lat: landmark.lat || undefined,
          lng: landmark.lng || undefined,
          source: landmark.source || 'verified_db',
          confidenceScore: Number(landmark.confidenceScore || dest.confidenceScore || 0.6),
          bookingUrl: landmark.website || undefined,
        });
        time += 2;
      });

      const lunchPoi = pickByIndex(restaurantPois, d * 2);
      const dinnerPoi = pickByIndex(restaurantPois, d * 2 + 1);
      activities.push({
        time: `${String(time).padStart(2, '0')}:30`,
        name: lunchPoi ? getMealLabel(foodPreferences, `Tushlik - ${lunchPoi.name}`) : getMealLabel(foodPreferences, 'Tushlik - mahalliy restoran'),
        cost: lunchPoi ? Math.round(resolvePoiCost(lunchPoi, style) * 0.7) : Math.round(foodCostBase * 0.4),
        duration: '1 soat',
        durationMinutes: 60,
        type: 'food',
        lat: Number.isFinite(Number(lunchPoi?.lat)) ? Number(lunchPoi.lat) : undefined,
        lng: Number.isFinite(Number(lunchPoi?.lng)) ? Number(lunchPoi.lng) : undefined,
        source: lunchPoi?.source || 'estimated_fallback',
        confidenceScore: Number(lunchPoi?.confidenceScore || 0.55),
      });
      time += 2;

      activities.push({
        time: `${String(Math.min(time, 19)).padStart(2, '0')}:00`,
        name: dinnerPoi ? getMealLabel(foodPreferences, `Kechki ovqat - ${dinnerPoi.name}`) : getMealLabel(foodPreferences, 'Kechki ovqat'),
        cost: dinnerPoi ? Math.round(resolvePoiCost(dinnerPoi, style) * 0.75) : Math.round(foodCostBase * 0.35),
        duration: '1 soat',
        durationMinutes: 60,
        type: 'food',
        lat: Number.isFinite(Number(dinnerPoi?.lat)) ? Number(dinnerPoi.lat) : undefined,
        lng: Number.isFinite(Number(dinnerPoi?.lng)) ? Number(dinnerPoi.lng) : undefined,
        source: dinnerPoi?.source || 'estimated_fallback',
        confidenceScore: Number(dinnerPoi?.confidenceScore || 0.55),
      });

      if (companions === 'family') {
        activities.push({
          time: '20:30',
          name: 'Oilaviy dam olish va engil sayr',
          cost: Math.round(fallbackTypePrice('landmark', style) * 0.4),
          duration: '1 soat',
          type: 'landmark',
          optional: true,
        });
      } else if (companions === 'couple') {
        activities.push({
          time: '20:30',
          name: 'Romantik kechki sayr',
          cost: Math.round(fallbackTypePrice('landmark', style) * 0.45),
          duration: '1 soat',
          type: 'landmark',
          optional: true,
        });
      }

      if (flexibility === 'flexible') {
        const optionalPoi = landmarkPois.find((poi) => !activities.some((item) => normalizeText(item.name) === normalizeText(poi.name)));
        if (optionalPoi) {
          activities.push({
            time: '17:30',
            name: `Optional: ${optionalPoi.name}`,
            cost: Math.round(resolvePoiCost(optionalPoi, style)),
            duration: '1 soat',
            type: 'landmark',
            optional: true,
            lat: optionalPoi.lat || undefined,
            lng: optionalPoi.lng || undefined,
          });
        }
      }

      const matchedRecommended = activities.filter((activity) => preferredNamesSet.has(normalizeText(activity.name))).length;
      const estimatedCost = activities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0) + hotelCost;
      const dailyCost = matchedRecommended > 0 ? Math.round(estimatedCost * 0.97) : estimatedCost;

      days.push({
        dayNumber: dayNumber++,
        city: dest.name,
        title: `${dest.name} - ${d + 1}-kun`,
        activities,
        accommodation: { name: hotelName, cost: hotelCost },
        transportNote:
          isFirstDayInCity && index === 0
            ? `${departure}dan ${transportType === 'cheap' ? 'arzon' : transportType === 'comfort' ? 'qulay' : 'tez'} transport bilan`
            : `${dest.name} ichida marshrut`,
        estimatedCost: dailyCost,
      });
    }
  });

  return days;
}

function getHotelName(dest, style) {
  const hotels = Array.isArray(dest.hotels) ? dest.hotels : [];
  if (!hotels.length) return style === 'budget' ? 'Hostel' : style === 'mid' ? 'Mehmonxona' : 'Premium mehmonxona';

  const styleToIndex = { budget: 0, mid: 1, luxury: 2 };
  const idx = Math.min(styleToIndex[style] || 0, hotels.length - 1);
  return typeof hotels[idx] === 'string' ? hotels[idx] : hotels[idx]?.name || 'Mehmonxona';
}

function buildTitle(destinationNames, duration) {
  if (!destinationNames.length) return `${duration} kunlik sayohat`;
  if (destinationNames.length === 1) return `${destinationNames[0]} - ${duration} kunlik sayohat`;
  return `${destinationNames.slice(0, 2).join(' va ')} - ${duration} kunlik sayohat`;
}

function generateTips(style, context = {}) {
  const { companions, flexibility, foodPreferences, transportType, recommendedPoiNames, analysisContext } = context;

  const tips = [
    "Ovqatni mahalliy bozorlarda iste'mol qiling - arzonroq va mazaliroq.",
    "Diqqatga sazovor joylarga ertalab boring - kam odam bo'ladi.",
    'Bir kunda bir-biriga yaqin joylarni ko`rish vaqtni tejaydi.',
  ];

  if (style === 'budget') {
    tips.push("Hostelda yashash va jamoat transportidan foydalanish xarajatni tushiradi.");
  }
  if (style === 'mid' || style === 'luxury') {
    tips.push("Mehmonxonani oldindan bron qilsangiz narxlar pastroq bo'ladi.");
  }
  if (companions === 'family') {
    tips.push("Oilaviy safarda tushdan keyin qisqa dam olish vaqti qoldiring.");
  }
  if (companions === 'couple') {
    tips.push('Kechki payt markaziy hududlarda sayr uchun 1 soat ajrating.');
  }
  if (foodPreferences && foodPreferences !== 'none') {
    tips.push(`Ovqat tavsiyalari ${foodPreferences} afzalligiga moslashtirildi.`);
  }
  if (transportType === 'fast') {
    tips.push('Tez transport tanlangani uchun kunlik ko`rish nuqtalari zichroq berildi.');
  }
  if (transportType === 'cheap') {
    tips.push('Transport xarajatini pasaytirish uchun yaqin nuqtalar ketma-ket berildi.');
  }
  if (flexibility === 'flexible') {
    tips.push('Har kun uchun optional variantlar qo`shildi.');
  }
  if (Array.isArray(recommendedPoiNames) && recommendedPoiNames.length > 0) {
    tips.push(`Top mos joylar: ${recommendedPoiNames.slice(0, 3).join(', ')}.`);
  }
  if (analysisContext?.estimatedTripCost) {
    tips.push(`POI tahlili bo'yicha taxminiy umumiy xarajat: ${Number(analysisContext.estimatedTripCost).toLocaleString('ru-RU')} so'm.`);
  }

  return Array.from(new Set(tips)).slice(0, 8);
}

function generateHighlights(selected) {
  const highlights = [];

  selected.forEach((dest) => {
    const landmarks = Array.isArray(dest.landmarks) ? dest.landmarks : [];
    if (landmarks.length > 0) {
      const landmark = landmarks[0];
      highlights.push(typeof landmark === 'string' ? landmark : landmark.name || dest.name);
    }
  });

  if (highlights.length < 3) {
    selected.forEach((dest) => {
      if (highlights.length < 3) highlights.push(`${dest.name} sayohati`);
    });
  }

  return highlights.slice(0, 4);
}

module.exports = { generateTripPlan };
