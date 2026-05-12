const { success } = require('../utils/response');
const {
  fetchYandexGeocode,
  fetchYandexPlacesNearby,
  fetchYandexPlacesSearch,
  fetchYandexReverse,
  fetchYandexSuggest,
} = require('../services/yandexPlaces.service');

async function getNearbyPlaces(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radiusKm || req.query.radius || 5);
    const type = req.query.type ? String(req.query.type) : 'landmark';
    const subtype = req.query.subtype ? String(req.query.subtype) : 'all';
    const limit = req.query.limit;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }

    const payload = await fetchYandexPlacesNearby({ lat, lng, radiusKm, type, subtype, limit });
    return success(res, payload);
  } catch (err) {
    return success(res, {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: err.message || 'Yandex places lookup failed',
    });
  }
}

async function searchPlaces(req, res) {
  try {
    const query = req.query.query || req.query.q || '';
    const lat = req.query.lat;
    const lng = req.query.lng;
    const radiusKm = Number(req.query.radiusKm || req.query.radius || 8);
    const type = req.query.type ? String(req.query.type) : undefined;

    const payload = await fetchYandexPlacesSearch({ query, lat, lng, radiusKm, type });
    return success(res, payload);
  } catch (err) {
    return success(res, {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_search',
      warning: err.message || 'Yandex places search failed',
    });
  }
}

async function suggest(req, res) {
  try {
    const query = req.query.query || req.query.q || '';
    const payload = await fetchYandexSuggest({
      query,
      lat: req.query.lat,
      lng: req.query.lng,
      results: req.query.results,
    });
    return success(res, payload);
  } catch (err) {
    return success(res, {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_geosuggest',
      warning: err.message || 'Yandex suggest failed',
    });
  }
}

async function geocode(req, res) {
  try {
    const query = req.query.query || req.query.q || '';
    const payload = await fetchYandexGeocode({ query, results: req.query.results });
    return success(res, payload);
  } catch (err) {
    return success(res, {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_geocoder',
      warning: err.message || 'Yandex geocode failed',
    });
  }
}

async function reverse(req, res) {
  try {
    const payload = await fetchYandexReverse({
      lat: req.query.lat,
      lng: req.query.lng,
      results: req.query.results,
    });
    return success(res, payload);
  } catch (err) {
    return success(res, {
      configured: true,
      items: [],
      total: 0,
      source: 'yandex_geocoder',
      warning: err.message || 'Yandex reverse geocode failed',
    });
  }
}

module.exports = { getNearbyPlaces, searchPlaces, suggest, geocode, reverse };
