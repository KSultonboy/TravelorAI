// Manzil qidiruvi — OpenStreetMap Nominatim (bepul, API kalit kerak emas).
// Marshrut nuqtalarini koordinataga aylantirish uchun ishlatiladi.
// Nominatim qoidalari: aniq User-Agent majburiy + soniyasiga 1 ta so'rov.
const axios = require('axios');
const { success, error } = require('../utils/response');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CONTACT = process.env.GEOCODE_CONTACT || 'info@travelorai.com';
const USER_AGENT = `TraveloraiCRM/1.0 (${CONTACT})`;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const MIN_INTERVAL_MS = 1100; // Nominatim: sekundiga 1 so'rov

const cache = new Map();
let lastCallAt = 0;
let queue = Promise.resolve();

// So'rovlarni navbatga qo'yamiz — bir vaqtda bir nechta agent qidirsa ham limit buzilmaydi.
function throttled(task) {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
}

// Nominatim "Makka, Мекка, Saudiya Arabistoni" kabi aralash qatorlarni qaytaradi.
// Nuqta nomi uchun FAQAT birinchi qismni olamiz — mijoz sahifasida toza ko'rinsin.
function shortName(displayName) {
  return String(displayName || '').split(',')[0].trim();
}

// To'liq nom — agentga qaysi joy ekanini ajratish uchun (ro'yxatda ko'rsatiladi).
function contextName(displayName) {
  return String(displayName || '').split(',').slice(0, 4).join(',').trim();
}

async function geocode(req, res) {
  try {
    const q = String((req.query && req.query.q) || '').trim();
    if (q.length < 2) return error(res, 'Qidiruv so‘zi juda qisqa', 400);

    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return success(res, { items: hit.items, cached: true });
    }

    const response = await throttled(() =>
      axios.get(NOMINATIM_URL, {
        timeout: 9000,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'uz,ru,en' },
        params: { q, format: 'json', limit: 6 },
      })
    );

    const items = (Array.isArray(response.data) ? response.data : [])
      .map((row) => ({
        name: shortName(row.display_name),
        full: contextName(row.display_name),
        lat: Number(row.lat),
        lng: Number(row.lon),
      }))
      .filter((row) => row.name && Number.isFinite(row.lat) && Number.isFinite(row.lng));

    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(key, { at: Date.now(), items });

    return success(res, { items });
  } catch (err) {
    return error(res, 'Manzil qidirishda xatolik. Qaytadan urinib ko‘ring.', 502);
  }
}

module.exports = { geocode };
