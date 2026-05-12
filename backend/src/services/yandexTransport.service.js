const axios = require('axios');

const YANDEX_SEARCH_URL = 'https://search-maps.yandex.ru/v1/';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RADIUS_KM = 25;
const MAX_RESULTS_PER_QUERY = 20;

const cache = new Map();

const TYPE_QUERIES = {
  bus: ['bus stop', 'avtobus bekati'],
  train: ['railway station', 'train station'],
  metro: ['metro station'],
  airport: ['airport'],
  taxi: ['taxi'],
};

const ALL_QUERIES = ['bus stop', 'railway station', 'metro station', 'airport', 'taxi'];

function getYandexApiKey() {
  return (
    process.env.YANDEX_SEARCH_API_KEY ||
    process.env.YANDEX_MAPS_API_KEY ||
    process.env.YANDEX_MAPKIT_API_KEY ||
    process.env.YANDEX_API_KEY ||
    ''
  ).trim();
}

function clampRadiusKm(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.min(parsed, MAX_RADIUS_KM);
}

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 80;
  return Math.min(Math.max(Math.floor(parsed), 1), 80);
}

function radiusToSpan(radiusKm, lat) {
  const latDelta = Math.max(radiusKm / 111, 0.01);
  const lngDelta = Math.max(radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2)), 0.01);
  return `${lngDelta.toFixed(5)},${latDelta.toFixed(5)}`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function detectSubtype(feature, query) {
  const meta = feature?.properties?.CompanyMetaData || {};
  const text = normalizeText([
    query,
    feature?.properties?.name,
    feature?.properties?.description,
    meta.name,
    meta.address,
    ...(Array.isArray(meta.Categories) ? meta.Categories.map((item) => item?.name) : []),
  ].join(' '));

  if (/(airport|avia)/i.test(text)) return 'airport';
  if (/(metro|subway)/i.test(text)) return 'metro';
  if (/(taxi)/i.test(text)) return 'taxi';
  if (/(railway|train|station)/i.test(text)) return 'train';
  if (/(bus|stop|avtobus)/i.test(text)) return 'bus';
  return 'bus';
}

function featureId(feature, lat, lng, name) {
  const rawId =
    feature?.id ||
    feature?.properties?.CompanyMetaData?.id ||
    `${slugify(name)}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return `yandex:${rawId}`;
}

function extractPhone(meta) {
  const phones = Array.isArray(meta?.Phones) ? meta.Phones : [];
  const phone = phones.find((item) => item?.formatted || item?.number || item?.info);
  return phone ? String(phone.formatted || phone.number || phone.info || '').trim() || null : null;
}

function extractWebsite(meta) {
  const direct = String(meta?.url || meta?.site || '').trim();
  if (direct) return direct;
  const links = Array.isArray(meta?.Links) ? meta.Links : [];
  const link = links.find((item) => item?.href);
  return link ? String(link.href).trim() || null : null;
}

function normalizeFeature(feature, query) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const meta = feature?.properties?.CompanyMetaData || {};
  const name = String(meta.name || feature?.properties?.name || '').trim();
  if (!name) return null;

  const subtype = detectSubtype(feature, query);
  const description = String(
    feature?.properties?.description ||
    meta.address ||
    (subtype === 'bus' ? 'Yandex transport search result' : 'Transport point from Yandex')
  );
  const slug = `yandex-${subtype}-${slugify(name) || `${lat.toFixed(4)}-${lng.toFixed(4)}`}`;
  const lastVerifiedAt = new Date().toISOString();
  const sourceUrl = feature?.properties?.uri || `https://yandex.com/maps/?ll=${lng},${lat}&z=16&pt=${lng},${lat}&text=${encodeURIComponent(name)}`;

  return {
    id: featureId(feature, lat, lng, name),
    name,
    city: description,
    slug,
    type: 'transport',
    subtype,
    lat,
    lng,
    info: description,
    icon: 'pin',
    phone: extractPhone(meta),
    website: extractWebsite(meta),
    source: 'yandex_search',
    sourceUrl,
    lastVerifiedAt,
    confidenceScore: subtype === 'bus' ? 0.7 : 0.76,
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const key = `${normalizeText(item.name)}:${item.subtype}:${item.lat.toFixed(4)}:${item.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function fetchYandexTransportNearby({ lat, lng, radiusKm, type, limit }) {
  const apiKey = getYandexApiKey();
  if (!apiKey) {
    return {
      configured: false,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: 'Yandex API key is not configured',
    };
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: 'lat and lng are required',
    };
  }

  const normalizedRadiusKm = clampRadiusKm(radiusKm);
  const normalizedType = normalizeText(type);
  const normalizedLimit = clampLimit(limit);
  const queries = TYPE_QUERIES[normalizedType] || ALL_QUERIES;
  const cacheKey = `${parsedLat.toFixed(4)}:${parsedLng.toFixed(4)}:${normalizedRadiusKm}:${normalizedType || 'all'}:${normalizedLimit}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  const responses = await Promise.all(
    queries.map(async (text) => {
      const response = await axios.get(YANDEX_SEARCH_URL, {
        timeout: 7000,
        params: {
          apikey: apiKey,
          text,
          lang: 'ru_RU',
          ll: `${parsedLng},${parsedLat}`,
          spn: radiusToSpan(normalizedRadiusKm, parsedLat),
          rspn: 1,
          type: 'biz',
          results: MAX_RESULTS_PER_QUERY,
        },
      });

      const features = Array.isArray(response.data?.features) ? response.data.features : [];
      return features.map((feature) => normalizeFeature(feature, text)).filter(Boolean);
    })
  );

  const items = dedupeItems(responses.flat()).slice(0, normalizedLimit);
  const payload = {
    configured: true,
    items,
    total: items.length,
    source: 'yandex_search',
    cached: false,
  };

  cache.set(cacheKey, { createdAt: Date.now(), payload });
  return payload;
}

module.exports = {
  fetchYandexTransportNearby,
  getYandexApiKey,
};
