const axios = require('axios');

const YANDEX_SEARCH_URL = 'https://search-maps.yandex.ru/v1/';
const YANDEX_GEOCODER_URL = 'https://geocode-maps.yandex.ru/1.x/';
const YANDEX_GEOSUGGEST_URL = 'https://suggest-maps.yandex.ru/v1/suggest';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RADIUS_KM = 60;
const MAX_RESULTS_PER_QUERY = 50;

const cache = new Map();

const CATEGORY_QUERIES = {
  landmark: {
    all: [
      'достопримечательность',
      'музей',
      'историческое место',
      'памятник',
      'мечеть',
      'туристическое место',
      'attraction',
      'museum',
      'historical landmark',
      'mosque',
      'monument',
      'landmark',
    ],
    historical: ['историческое место', 'музей', 'памятник', 'historical landmark', 'museum', 'monument'],
    mosque: ['мечеть', 'masjid', 'mosque'],
    other: ['достопримечательность', 'туристическое место', 'attraction', 'sightseeing', 'landmark'],
  },
  restaurant: {
    all: [
      'ресторан',
      'кафе',
      'миллий таомлар',
      'узбекская кухня',
      'халяль ресторан',
      'ошхона',
      'restaurant',
      'cafe',
      'uzbek restaurant',
      'halal restaurant',
    ],
    traditional: ['узбекская кухня', 'миллий таомлар', 'национальная кухня', 'uzbek restaurant', 'national cuisine'],
    cafe: ['кафе', 'кофейня', 'cafe', 'coffee shop'],
    budget: ['столовая', 'ошхона', 'фастфуд', 'canteen', 'fast food'],
    mid: ['ресторан', 'restaurant'],
    luxury: ['ресторан премиум', 'fine dining restaurant', 'luxury restaurant'],
  },
  hotel: {
    all: ['отель', 'гостиница', 'хостел', 'гостевой дом', 'hotel', 'guest house', 'hostel'],
    budget: ['хостел', 'гостевой дом', 'hostel', 'guest house'],
    mid: ['отель', 'гостиница', 'hotel'],
    luxury: ['люкс отель', 'премиум отель', 'luxury hotel', 'resort hotel'],
  },
  transport: {
    all: ['остановка', 'автобусная остановка', 'вокзал', 'железнодорожная станция', 'аэропорт', 'такси', 'bus stop', 'railway station', 'metro station', 'airport', 'taxi'],
    bus: ['остановка', 'автобусная остановка', 'bus stop'],
    train: ['вокзал', 'железнодорожная станция', 'railway station', 'train station'],
    metro: ['метро', 'metro station'],
    airport: ['аэропорт', 'airport'],
    taxi: ['такси', 'taxi'],
  },
};

const TYPE_ICON = {
  landmark: 'pin',
  restaurant: 'restaurant',
  hotel: 'bed',
  transport: 'car',
};

function getYandexApiKey() {
  return (
    process.env.YANDEX_SEARCH_API_KEY ||
    process.env.YANDEX_MAPS_API_KEY ||
    process.env.YANDEX_MAPKIT_API_KEY ||
    process.env.YANDEX_API_KEY ||
    ''
  ).trim();
}

function getYandexGeocoderApiKey() {
  return (
    process.env.YANDEX_GEOCODER_API_KEY ||
    process.env.YANDEX_MAPS_API_KEY ||
    process.env.YANDEX_MAPKIT_API_KEY ||
    process.env.YANDEX_API_KEY ||
    ''
  ).trim();
}

function getYandexGeosuggestApiKey() {
  return (
    process.env.YANDEX_GEOSUGGEST_API_KEY ||
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
  if (!Number.isFinite(parsed) || parsed <= 0) return 150;
  return Math.min(Math.max(Math.floor(parsed), 1), 150);
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
    .replace(/[^a-z0-9\u0400-\u04ff\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeCategory(type) {
  const normalized = normalizeText(type);
  return CATEGORY_QUERIES[normalized] ? normalized : 'landmark';
}

function normalizeSubtype(subtype) {
  const normalized = normalizeText(subtype);
  return normalized && normalized !== 'all' ? normalized : 'all';
}

function queriesFor(type, subtype) {
  const category = normalizeCategory(type);
  const sub = normalizeSubtype(subtype);
  return CATEGORY_QUERIES[category][sub] || CATEGORY_QUERIES[category].all;
}

function searchParamsForCategory(category) {
  // Landmarks are often map/toponym objects, not only organizations.
  // Hotels, restaurants and transport need organization metadata such as phone/hours.
  return category === 'landmark' ? {} : { type: 'biz' };
}

function categoryNames(feature) {
  const categories = feature?.properties?.CompanyMetaData?.Categories;
  if (!Array.isArray(categories)) return '';
  return categories.map((item) => item?.name || '').join(' ');
}

function detectPlaceType(feature, query, fallbackType) {
  const text = normalizeText([
    fallbackType,
    query,
    feature?.properties?.name,
    feature?.properties?.description,
    feature?.properties?.CompanyMetaData?.name,
    categoryNames(feature),
  ].join(' '));

  if (/(hotel|hostel|guest house|resort|отель|гостиниц|хостел|гостевой дом)/i.test(text)) return 'hotel';
  if (/(restaurant|cafe|coffee|food|dining|halal|cuisine|ресторан|кафе|кофейн|столов|ошхона|кухн|таом|халяль)/i.test(text)) return 'restaurant';
  if (/(bus|station|airport|metro|taxi|railway|train|останов|вокзал|аэропорт|метро|такси|железнодорож)/i.test(text)) return 'transport';
  return 'landmark';
}

function detectSubtype(feature, query, type) {
  const text = normalizeText([
    query,
    feature?.properties?.name,
    feature?.properties?.description,
    feature?.properties?.CompanyMetaData?.name,
    categoryNames(feature),
  ].join(' '));

  if (type === 'transport') {
    if (/(airport|аэропорт)/i.test(text)) return 'airport';
    if (/(metro|subway|метро)/i.test(text)) return 'metro';
    if (/(taxi|такси)/i.test(text)) return 'taxi';
    if (/(railway|train|station|вокзал|железнодорож)/i.test(text)) return 'train';
    return 'bus';
  }

  if (type === 'landmark') {
    if (/(mosque|masjid|мечеть)/i.test(text)) return 'mosque';
    if (/(museum|historical|monument|landmark|музей|истор|памятник|достопримечатель)/i.test(text)) return 'historical';
    return 'other';
  }

  if (type === 'restaurant') {
    if (/(cafe|coffee|кафе|кофейн)/i.test(text)) return 'cafe';
    if (/(uzbek|national|cuisine|halal|узбек|националь|халяль|миллий|таом)/i.test(text)) return 'traditional';
    return 'mid';
  }

  if (type === 'hotel') {
    if (/(hostel|guest house|хостел|гостевой дом)/i.test(text)) return 'budget';
    if (/(luxury|resort|premium|люкс|премиум)/i.test(text)) return 'luxury';
    return 'mid';
  }

  return null;
}

function featureId(feature, lat, lng, name, type) {
  const rawId =
    feature?.id ||
    feature?.properties?.CompanyMetaData?.id ||
    `${slugify(name)}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  return `yandex:${type}:${rawId}`;
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

function extractOpeningHours(meta) {
  const hours = meta?.Hours;
  if (!hours) return null;
  if (typeof hours.text === 'string' && hours.text.trim()) return [hours.text.trim()];
  if (typeof hours.Text === 'string' && hours.Text.trim()) return [hours.Text.trim()];
  const availabilities = Array.isArray(hours.Availabilities) ? hours.Availabilities : [];
  const lines = availabilities
    .map((item) => item?.Intervals || item?.Everyday || item?.TwentyFourHours)
    .filter(Boolean)
    .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
  return lines.length > 0 ? lines : null;
}

function normalizeFeature(feature, query, fallbackType) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const meta = feature?.properties?.CompanyMetaData || {};
  const name = String(meta.name || feature?.properties?.name || '').trim();
  if (!name) return null;

  const type = detectPlaceType(feature, query, fallbackType);
  const subtype = detectSubtype(feature, query, type);
  const address = String(meta.address || feature?.properties?.description || '').trim();
  const categories = categoryNames(feature);
  const info = [address, categories].filter(Boolean).join(' - ') || 'Yandex Maps search result';
  const slug = `yandex-${type}-${slugify(name) || `${lat.toFixed(4)}-${lng.toFixed(4)}`}`;
  const lastVerifiedAt = new Date().toISOString();

  return {
    id: featureId(feature, lat, lng, name, type),
    name,
    city: address || 'Yandex Maps',
    slug,
    type,
    subtype,
    lat,
    lng,
    info,
    description: info,
    imageUrl: null,
    rating: meta.rating ? Number(meta.rating) : null,
    ratingCount: meta.reviewCount ? Number(meta.reviewCount) : null,
    phone: extractPhone(meta),
    website: extractWebsite(meta),
    priceLevel: null,
    price: null,
    icon: TYPE_ICON[type] || 'pin',
    openingHours: extractOpeningHours(meta),
    source: 'yandex_search',
    sourceUrl: feature?.properties?.uri || null,
    lastVerifiedAt,
    confidenceScore: type === fallbackType ? 0.74 : 0.62,
    verifiedBy: 'yandex_search_runtime',
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const key = `${normalizeText(item.name)}:${item.type}:${item.subtype || ''}:${Number(item.lat).toFixed(4)}:${Number(item.lng).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function fetchYandexPlacesNearby({ lat, lng, radiusKm, type, subtype, limit }) {
  const apiKey = getYandexApiKey();
  const category = normalizeCategory(type);
  const normalizedRadiusKm = clampRadiusKm(radiusKm);
  const normalizedSubtype = normalizeSubtype(subtype);
  const normalizedLimit = clampLimit(limit);

  if (!apiKey) {
    return {
      configured: false,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: 'Yandex API key is not configured',
    };
  }

  const queries = queriesFor(category, normalizedSubtype);
  const cacheKey = `${category}:${normalizedSubtype}:${Number(lat).toFixed(4)}:${Number(lng).toFixed(4)}:${normalizedRadiusKm}:${normalizedLimit}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  const responses = await Promise.all(
    queries.map(async (text) => {
      try {
        const response = await axios.get(YANDEX_SEARCH_URL, {
          timeout: 9000,
          params: {
            apikey: apiKey,
            text,
            lang: 'ru_RU',
            ll: `${lng},${lat}`,
            spn: radiusToSpan(normalizedRadiusKm, lat),
            rspn: 1,
            results: MAX_RESULTS_PER_QUERY,
            ...searchParamsForCategory(category),
          },
        });

        const features = Array.isArray(response.data?.features) ? response.data.features : [];
        return {
          items: features.map((feature) => normalizeFeature(feature, text, category)).filter(Boolean),
          warning: null,
        };
      } catch (err) {
        return {
          items: [],
          warning: `${text}: ${err.response?.status || err.message || 'request failed'}`,
        };
      }
    })
  );

  const warnings = responses.map((entry) => entry.warning).filter(Boolean);
  const items = dedupeItems(responses.flatMap((entry) => entry.items))
    .filter((item) => item.type === category)
    .slice(0, normalizedLimit);

  const payload = {
    configured: true,
    items,
    total: items.length,
    source: 'yandex_search',
    cached: false,
    warning: warnings.length > 0 ? warnings.slice(0, 4).join('; ') : undefined,
  };

  cache.set(cacheKey, { createdAt: Date.now(), payload });
  return payload;
}

async function fetchYandexPlacesSearch({ query, lat, lng, radiusKm, type }) {
  const apiKey = getYandexApiKey();
  const searchText = String(query || '').trim();
  const category = type ? normalizeCategory(type) : null;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const hasCenter = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const normalizedRadiusKm = clampRadiusKm(radiusKm || 8);

  if (!apiKey) {
    return {
      configured: false,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: 'Yandex API key is not configured',
    };
  }

  if (searchText.length < 2) {
    return {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: 'Query is too short',
    };
  }

  const centerKey = hasCenter ? `${parsedLat.toFixed(4)}:${parsedLng.toFixed(4)}:${normalizedRadiusKm}` : 'global';
  const cacheKey = `search:${normalizeText(searchText)}:${category || 'any'}:${centerKey}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  const params = {
    apikey: apiKey,
    text: searchText,
    lang: 'ru_RU',
    results: MAX_RESULTS_PER_QUERY,
    ...(category ? searchParamsForCategory(category) : {}),
  };

  if (hasCenter) {
    params.ll = `${parsedLng},${parsedLat}`;
    params.spn = radiusToSpan(normalizedRadiusKm, parsedLat);
    params.rspn = 1;
  }

  const response = await axios.get(YANDEX_SEARCH_URL, {
    timeout: 7000,
    params,
  });

  const features = Array.isArray(response.data?.features) ? response.data.features : [];
  const fallbackType = category || 'landmark';
  const items = dedupeItems(features.map((feature) => normalizeFeature(feature, searchText, fallbackType)).filter(Boolean))
    .filter((item) => !category || item.type === category)
    .slice(0, 40);

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

function normalizeSuggestItem(item) {
  const title = String(item?.title?.text || item?.title || item?.display_text || item?.name || '').trim();
  if (!title) return null;
  const subtitle = String(item?.subtitle?.text || item?.subtitle || item?.description || '').trim();
  return {
    id: String(item?.uri || item?.id || `${slugify(title)}:${slugify(subtitle)}`),
    title,
    subtitle,
    uri: item?.uri || null,
    source: 'yandex_geosuggest',
    confidenceScore: 0.7,
  };
}

async function fetchYandexSuggest({ query, lat, lng, results = 8 }) {
  const apiKey = getYandexGeosuggestApiKey();
  const text = String(query || '').trim();

  if (!apiKey) {
    return { configured: false, items: [], total: 0, source: 'yandex_geosuggest', warning: 'Yandex Geosuggest API key is not configured' };
  }

  if (text.length < 2) {
    return { configured: true, items: [], total: 0, source: 'yandex_geosuggest', warning: 'Query is too short' };
  }

  const params = {
    apikey: apiKey,
    text,
    lang: 'ru_RU',
    results: Math.max(1, Math.min(Number(results) || 8, 20)),
  };

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
    params.ll = `${parsedLng},${parsedLat}`;
  }

  const response = await axios.get(YANDEX_GEOSUGGEST_URL, { timeout: 7000, params });
  const rawItems = response.data?.results || response.data?.suggests || response.data?.items || [];
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map(normalizeSuggestItem)
    .filter(Boolean);

  return { configured: true, items, total: items.length, source: 'yandex_geosuggest' };
}

function normalizeGeoObject(feature) {
  const pointText = feature?.Point?.pos || feature?.GeoObject?.Point?.pos;
  const [lngRaw, latRaw] = String(pointText || '').split(/\s+/);
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const geoObject = feature?.GeoObject || feature;
  const meta = geoObject?.metaDataProperty?.GeocoderMetaData || {};
  const name = String(geoObject?.name || meta?.text || '').trim();
  const address = String(meta?.text || geoObject?.description || '').trim();

  return {
    id: `yandex:geocode:${slugify(name || address)}:${lat.toFixed(5)}:${lng.toFixed(5)}`,
    name: name || address || 'Yandex geocode result',
    address,
    lat,
    lng,
    source: 'yandex_geocoder',
    confidenceScore: meta?.precision === 'exact' ? 0.86 : 0.68,
  };
}

async function fetchYandexGeocode({ query, results = 8 }) {
  const apiKey = getYandexGeocoderApiKey();
  const text = String(query || '').trim();

  if (!apiKey) {
    return { configured: false, items: [], total: 0, source: 'yandex_geocoder', warning: 'Yandex Geocoder API key is not configured' };
  }

  if (text.length < 2) {
    return { configured: true, items: [], total: 0, source: 'yandex_geocoder', warning: 'Query is too short' };
  }

  const response = await axios.get(YANDEX_GEOCODER_URL, {
    timeout: 7000,
    params: {
      apikey: apiKey,
      geocode: text,
      format: 'json',
      lang: 'ru_RU',
      results: Math.max(1, Math.min(Number(results) || 8, 20)),
    },
  });

  const members = response.data?.response?.GeoObjectCollection?.featureMember || [];
  const items = (Array.isArray(members) ? members : [])
    .map((member) => normalizeGeoObject(member?.GeoObject))
    .filter(Boolean);

  return { configured: true, items, total: items.length, source: 'yandex_geocoder' };
}

async function fetchYandexReverse({ lat, lng, results = 1 }) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return { configured: true, items: [], total: 0, source: 'yandex_geocoder', warning: 'lat and lng are required' };
  }

  return fetchYandexGeocode({
    query: `${parsedLng},${parsedLat}`,
    results,
  });
}

module.exports = {
  fetchYandexPlacesNearby,
  fetchYandexPlacesSearch,
  fetchYandexSuggest,
  fetchYandexGeocode,
  fetchYandexReverse,
  getYandexApiKey,
  getYandexGeocoderApiKey,
  getYandexGeosuggestApiKey,
};
