// Server tomonidagi mahsulot voronkasi hodisalari (ProductEvent).
//
// Qoidalar:
//  • track() — fire-and-forget: chaqiruvchi await qilmaydi, hech qachon throw qilmaydi
//    (DB xatosi, noto'g'ri argument, jadval yo'qligi — hammasi jimgina log'ga).
//  • PII yo'q: har bir hodisa uchun ruxsat etilgan props kalitlari (allowlist);
//    qiymatlar faqat qisqa primitivlar; email/telefonga o'xshash matn tashlanadi.
//  • props JSON hajmi 2 KB bilan cheklangan.
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');

const MAX_PROPS_BYTES = 2048;
const MAX_STRING = 120;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Hodisa nomi → ruxsat etilgan props kalitlari. Ro'yxatda yo'q hodisa yozilmaydi.
const EVENT_PROPS = Object.freeze({
  landing_view: [...UTM_KEYS, 'path', 'referrer_host'],
  agency_signup_started: [...UTM_KEYS, 'path', 'referrer_host'],
  agency_registered: ['method'],
  agency_email_verified: ['method'],
  agency_application_submitted: [],
  agency_approved: [],
  telegram_bot_connected: [],
  first_tour_published: ['via'],
  lead_created: ['source', 'count'],
  offer_sent: [],
  offer_opened: [],
  lead_won: ['amount_bucket', 'currency'],
  checkout_started: ['plan', 'months'],
  subscription_paid: ['plan', 'months'],
});

// Brauzerdan qabul qilinadigan (ommaviy) hodisalar — faqat shu ikkitasi.
const PUBLIC_EVENTS = Object.freeze(['landing_view', 'agency_signup_started']);

// Voronka tartibi (admin hisobotida qadamlar shu tartibda).
const FUNNEL_STEPS = Object.freeze([
  'landing_view',
  'agency_signup_started',
  'agency_registered',
  'agency_email_verified',
  'agency_application_submitted',
  'agency_approved',
  'telegram_bot_connected',
  'first_tour_published',
  'lead_created',
  'offer_sent',
  'offer_opened',
  'lead_won',
  'checkout_started',
  'subscription_paid',
]);

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// 7+ raqam (bo'shliq/tire/qavs bilan) — telefon raqamiga o'xshash.
const PHONE_RE = /(?:\+?\d[\s\-().]*){7,}/;

function looksLikePii(value) {
  return EMAIL_RE.test(value) || PHONE_RE.test(value);
}

function cleanValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined; // obyekt/massiv/null — yozilmaydi
  const trimmed = value.trim().slice(0, MAX_STRING);
  if (!trimmed || looksLikePii(trimmed)) return undefined;
  return trimmed;
}

/** Ruxsat etilgan kalitlar bo'yicha tozalangan props (yoki null). */
function sanitizeProps(name, props) {
  const allowed = EVENT_PROPS[name];
  if (!allowed || !allowed.length || !props || typeof props !== 'object' || Array.isArray(props)) return null;
  const out = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const value = cleanValue(props[key]);
    if (value !== undefined) out[key] = value;
  }
  // Hajm cheklovi: 2 KB dan oshsa oxirgi kalitlardan boshlab tashlanadi.
  const keys = Object.keys(out);
  while (keys.length && Buffer.byteLength(JSON.stringify(out), 'utf8') > MAX_PROPS_BYTES) {
    delete out[keys.pop()];
  }
  return Object.keys(out).length ? out : null;
}

function idOrNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, 64) : null;
}

/**
 * Hodisani yozadi. Hech qachon throw qilmaydi; Promise<boolean> qaytaradi
 * (true — yozildi). Chaqiruvchilar odatda natijani kutmaydi.
 */
function track(name, options) {
  try {
    const { agencyId, userId, props } = options || {};
    if (!Object.prototype.hasOwnProperty.call(EVENT_PROPS, name)) return Promise.resolve(false);
    // Model mavjud emas (eski Prisma client yoki qisman mock) — jimgina o'tkazamiz.
    if (!prisma || !prisma.productEvent) return Promise.resolve(false);
    const data = {
      name,
      agencyId: idOrNull(agencyId),
      userId: idOrNull(userId),
      props: sanitizeProps(name, props) || undefined,
    };
    return Promise.resolve()
      .then(() => prisma.productEvent.create({ data, select: { id: true } }))
      .then(() => true)
      .catch((err) => {
        logger.warn('[productEvents] track failed', { name, message: err && err.message });
        return false;
      });
  } catch (err) {
    return Promise.resolve(false);
  }
}

/** Agentlik uchun faqat birinchi marta yoziladi (masalan first_tour_published). */
function trackOnce(name, options) {
  try {
    const { agencyId, userId, props } = options || {};
    if (!agencyId || !prisma || !prisma.productEvent) return Promise.resolve(false);
    return Promise.resolve()
      .then(() => prisma.productEvent.findFirst({ where: { name, agencyId: String(agencyId) }, select: { id: true } }))
      .then((existing) => (existing ? false : track(name, { agencyId, userId, props })))
      .catch((err) => {
        logger.warn('[productEvents] trackOnce failed', { name, message: err && err.message });
        return false;
      });
  } catch (err) {
    return Promise.resolve(false);
  }
}

/** Summa → kattalik oralig'i (aniq summa yozilmaydi). */
function amountBucket(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'none';
  if (n < 1000) return '1-999';
  if (n < 10_000) return '1k-10k';
  if (n < 100_000) return '10k-100k';
  if (n < 1_000_000) return '100k-1m';
  if (n < 10_000_000) return '1m-10m';
  return '10m+';
}

/** Lid "kelishildi"ga (won) o'tdi — summa oralig'i bilan. */
function trackLeadWon(booking, options) {
  if (!booking) return Promise.resolve(false);
  const userId = options && options.userId;
  return track('lead_won', {
    agencyId: booking.agencyId,
    userId,
    props: {
      amount_bucket: amountBucket(booking.paidAmount != null ? booking.paidAmount : booking.totalEstimate),
      currency: booking.currency || undefined,
    },
  });
}

module.exports = {
  EVENT_PROPS,
  FUNNEL_STEPS,
  MAX_PROPS_BYTES,
  PUBLIC_EVENTS,
  amountBucket,
  sanitizeProps,
  track,
  trackLeadWon,
  trackOnce,
};
