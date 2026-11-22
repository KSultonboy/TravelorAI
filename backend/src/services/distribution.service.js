// Distribution: agentlik storefront havolasi (/a/<slug>), turni Telegram kanalga
// joylash va taklif sahifasidagi agentlikning o'z to'lov havolasi.
// Bu yerda faqat sof (DB'siz) yordamchilar + Telegram chaqiruvlari — controller
// testlarda alohida tekshirilishi oson bo'lsin.
const tg = require('./telegram.service');

const SITE_URL = () => (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

/* ===================== To'lov havolasi ===================== */

// Faqat shu xostlar avtomatik qabul qilinadi; boshqa https xost — faqat
// `allowCustomHost: true` bilan (agentlik o'zi tasdiqlaydi).
const PAYMENT_HOST_ALLOWLIST = Object.freeze([
  'my.click.uz',
  'click.uz',
  'payme.uz',
  'checkout.paycom.uz',
  'uzumbank.uz',
  'pay.uzum.uz',
]);
const PAYMENT_URL_MAX = 500;
const REQUISITES_MAX = 500;

function isAllowlistedPaymentHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return PAYMENT_HOST_ALLOWLIST.some((allowed) => host === allowed || host === `www.${allowed}`);
}

/**
 * To'lov havolasini tekshiradi. Natija: { ok: true, value } yoki { ok: false, error, code }.
 * Bo'sh qiymat — { ok: true, value: null } (havolani o'chirish).
 */
function validatePaymentLink(raw, { allowCustomHost = false } = {}) {
  const value = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!value) return { ok: true, value: null };
  if (value.length > PAYMENT_URL_MAX) {
    return { ok: false, code: 'PAYMENT_URL_TOO_LONG', error: `Havola ${PAYMENT_URL_MAX} belgidan oshmasin` };
  }
  // Boshqaruv belgilari / bo'shliqlar — brauzerlar ularni "yutib" yuboradi va
  // `java\tscript:` kabi aylanma yo'llar ochiladi.
  if (/[\s\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, code: 'PAYMENT_URL_INVALID', error: 'Havolada bo‘sh joy yoki maxsus belgilar bo‘lmasin' };
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, code: 'PAYMENT_URL_INVALID', error: 'Havola noto‘g‘ri. https:// bilan boshlanadigan to‘liq manzil kiriting' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, code: 'PAYMENT_URL_NOT_HTTPS', error: 'Faqat https:// havolalar qabul qilinadi' };
  }
  if (url.username || url.password) {
    return { ok: false, code: 'PAYMENT_URL_INVALID', error: 'Havolada login/parol bo‘lmasin' };
  }
  if (!url.hostname || !url.hostname.includes('.')) {
    return { ok: false, code: 'PAYMENT_URL_INVALID', error: 'Havola manzili noto‘g‘ri' };
  }
  if (!isAllowlistedPaymentHost(url.hostname) && allowCustomHost !== true) {
    return {
      ok: false,
      code: 'PAYMENT_HOST_NOT_ALLOWED',
      error: `Bu xost ruxsat etilganlar ro‘yxatida yo‘q (${PAYMENT_HOST_ALLOWLIST.join(', ')}). Boshqa saytni ishlatish uchun «boshqa sayt» belgisini yoqing.`,
    };
  }
  return { ok: true, value: url.toString() };
}

/** Rekvizitlar matni: oddiy matn, 500 belgigacha, boshqaruv belgilarisiz (yangi qator qoladi). */
function sanitizeRequisites(raw) {
  const value = String(raw === null || raw === undefined ? '' : raw)
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!value) return { ok: true, value: null };
  if (value.length > REQUISITES_MAX) {
    return { ok: false, code: 'REQUISITES_TOO_LONG', error: `Rekvizitlar ${REQUISITES_MAX} belgidan oshmasin` };
  }
  return { ok: true, value };
}

/**
 * Public sahifaga chiqadigan to'lov ma'lumoti. Saqlangan qiymat yana bir bor
 * tekshiriladi (faqat https) — bazaga qo'lda yozilgan yaroqsiz havola chiqmasin.
 */
function publicPayment(agency) {
  if (!agency) return null;
  let url = null;
  const stored = String(agency.paymentLinkUrl || '').trim();
  if (stored) {
    const checked = validatePaymentLink(stored, { allowCustomHost: true });
    if (checked.ok && checked.value) url = checked.value;
  }
  const req = sanitizeRequisites(agency.paymentRequisitesText);
  const requisites = req.ok ? req.value : null;
  if (!url && !requisites) return null;
  return { url, requisites };
}

/* ===================== Storefront havolasi ===================== */

function storefrontUrl(slug, params) {
  const base = `${SITE_URL()}/a/${encodeURIComponent(String(slug || ''))}`;
  if (!params) return base;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}?${qs}` : base;
}

/* ===================== Telegram kanal ===================== */

/**
 * Kanal kiritmasini normallashtiradi: `@kanal`, `kanal`, `t.me/kanal`,
 * `https://t.me/kanal` yoki raqamli id (`-1001234567890`).
 * Natija: chat_id (string) yoki null.
 */
function parseChannelInput(raw) {
  let value = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!value) return null;
  if (/^-?\d{5,20}$/.test(value)) return value;
  value = value.replace(/^https?:\/\//i, '').replace(/^(www\.)?(t\.me|telegram\.me)\//i, '');
  value = value.replace(/^@/, '').replace(/\/+$/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(value)) return null;
  return `@${value}`;
}

function botIdFromToken(token) {
  const id = String(token || '').split(':')[0];
  return /^\d+$/.test(id) ? id : null;
}

class ChannelError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Agentlik boti kanalda post joylash huquqiga ega administrator ekanini
 * tekshiradi (getChat + getChatMember). Natija: { id, title, username }.
 */
async function verifyChannel(botToken, rawChannel) {
  const chatId = parseChannelInput(rawChannel);
  if (!chatId) {
    throw new ChannelError('Kanal manzili noto‘g‘ri. @kanal_nomi yoki -100… ko‘rinishidagi id kiriting.', 'CHANNEL_INVALID');
  }
  const botId = botIdFromToken(botToken);
  if (!botId) throw new ChannelError('Telegram bot tokeni yaroqsiz — botni qayta ulang.', 'BOT_NOT_CONNECTED');

  let chat;
  try {
    chat = await tg.tgCall(botToken, 'getChat', { chat_id: chatId });
  } catch {
    throw new ChannelError(
      'Kanal topilmadi yoki bot kanalga qo‘shilmagan. Botni kanalga administrator qilib qo‘shing va qayta urinib ko‘ring.',
      'CHANNEL_NOT_FOUND'
    );
  }
  if (!chat || chat.type !== 'channel') {
    throw new ChannelError('Bu Telegram kanal emas. Guruh yoki shaxsiy chat ulanmaydi.', 'NOT_A_CHANNEL');
  }

  let member;
  try {
    member = await tg.tgCall(botToken, 'getChatMember', { chat_id: chat.id, user_id: Number(botId) });
  } catch {
    throw new ChannelError('Bot kanal a‘zosi emas. Botni kanalga administrator qilib qo‘shing.', 'BOT_NOT_ADMIN');
  }
  const canPost = member
    && (member.status === 'creator' || (member.status === 'administrator' && member.can_post_messages === true));
  if (!canPost) {
    throw new ChannelError(
      'Bot kanalda administrator emas yoki unda «Xabar joylash» huquqi yo‘q. Kanal sozlamalarida botga shu huquqni bering.',
      'BOT_CANNOT_POST'
    );
  }

  return {
    id: String(chat.id),
    title: String(chat.title || '').slice(0, 200) || null,
    username: chat.username ? String(chat.username).slice(0, 64) : null,
  };
}

/* ===================== Kanal posti matni ===================== */

const CAPTION_MAX = 1024;

/** Telegram HTML parse_mode uchun escape (& < > va qo'shtirnoq). */
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function oneLine(value) {
  return String(value === null || value === undefined ? '' : value).replace(/\s+/g, ' ').trim();
}

function clip(value, max) {
  const s = oneLine(value);
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function groupDigits(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Narx: aniq son bo'lsa — "1 250 000 so‘mdan" (USD — "$1 200 dan"), aks holda matn. */
function formatTourPrice(tour) {
  const cur = String(tour?.priceCurrency || '').toUpperCase();
  const min = Number(tour?.priceMin);
  if (Number.isFinite(min) && min > 0) {
    if (!cur || cur === 'UZS' || cur === 'SUM' || cur === 'SOM') return `${groupDigits(min)} so‘mdan`;
    if (cur === 'USD') return `$${groupDigits(min)} dan`;
    return `${groupDigits(min)} ${cur} dan`;
  }
  const text = oneLine(tour?.price);
  if (text) return text.replace(/so'm/gi, 'so‘m');
  return 'Narx so‘rov bo‘yicha';
}

function tourInclusions(tour) {
  const items = [];
  if (tour?.hotelIncluded) items.push(tour.hotelName ? `Mehmonxona: ${tour.hotelName}` : 'Mehmonxona');
  if (tour?.flightIncluded) items.push('Aviabilet');
  if (tour?.transferIncluded) items.push('Transfer');
  if (tour?.insuranceIncluded) items.push('Sug‘urta');
  if (tour?.mealPlanLabel) items.push(`Ovqatlanish: ${tour.mealPlanLabel}`);
  for (const x of Array.isArray(tour?.priceIncludes) ? tour.priceIncludes : []) items.push(x);
  for (const x of Array.isArray(tour?.highlights) ? tour.highlights : []) items.push(x);
  const seen = new Set();
  return items
    .map(oneLine)
    .filter((x) => {
      const k = x.toLowerCase();
      if (!x || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

function durationText(tour) {
  const d = oneLine(tour?.duration);
  if (d) return d;
  const parts = [];
  if (Number(tour?.days) > 0) parts.push(`${tour.days} kun`);
  if (Number(tour?.nights) > 0) parts.push(`${tour.nights} kecha`);
  return parts.join(' / ');
}

/**
 * Kanal posti matni (HTML parse_mode). Telegram rasm izohi 1024 belgigacha —
 * sig'masa avval qo'shimcha qatorlar, keyin ro'yxat, so'ng nom qisqartiriladi.
 * Uzunlik escape qilingan matn bo'yicha o'lchanadi (Telegram parse qilgandan
 * keyingi uzunlikdan doim katta yoki teng — demak xavfsiz).
 */
function buildTourCaption(tour, { maxLength = CAPTION_MAX } = {}) {
  const place = [oneLine(tour?.city), oneLine(tour?.destinationCountry)]
    .filter(Boolean)
    .filter((v, i, all) => all.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .join(', ');
  const duration = durationText(tour);
  const price = formatTourPrice(tour);
  const allIncl = tourInclusions(tour);

  const attempts = [
    { title: 200, sub: 200, incl: 5, item: 90, meta: 120 },
    { title: 160, sub: 120, incl: 5, item: 70, meta: 100 },
    { title: 140, sub: 0, incl: 4, item: 60, meta: 80 },
    { title: 120, sub: 0, incl: 3, item: 50, meta: 60 },
    { title: 80, sub: 0, incl: 3, item: 30, meta: 40 },
    { title: 60, sub: 0, incl: 0, item: 0, meta: 30 },
  ];

  let out = '';
  for (const a of attempts) {
    const lines = [`<b>${escapeHtml(clip(tour?.title || 'Tur', a.title))}</b>`];
    if (a.sub && tour?.subtitle) lines.push(`<i>${escapeHtml(clip(tour.subtitle, a.sub))}</i>`);
    lines.push('');
    if (place) lines.push(`📍 ${escapeHtml(clip(place, a.meta))}`);
    if (duration) lines.push(`🗓 ${escapeHtml(clip(duration, a.meta))}`);
    lines.push(`💰 ${escapeHtml(clip(price, a.meta))}`);
    const incl = allIncl.slice(0, a.incl);
    if (incl.length) {
      lines.push('');
      lines.push('<b>Narxga kiritilgan:</b>');
      for (const x of incl) lines.push(`✅ ${escapeHtml(clip(x, a.item))}`);
    }
    lines.push('');
    lines.push('👇 Batafsil ma‘lumot va bron — pastdagi tugma orqali');
    out = lines.join('\n');
    if (out.length <= maxLength) return out;
  }
  // Nazariy jihatdan bu yerga kelinmaydi (oxirgi urinish ~250 belgi), lekin
  // xavfsizlik uchun: teglarsiz, escape qilingan qisqa matn.
  return escapeHtml(clip(tour?.title || 'Tur', Math.min(200, maxLength - 10)));
}

/** Tur rasmi faqat ommaviy https manzil bo'lsa ishlatiladi (data:/http: — matnli post). */
function publicPhotoUrl(tour) {
  const raw = String(tour?.imageUrl || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/uploads/')) return `${SITE_URL()}${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function channelPostButtonUrl(agencySlug, tourSlug) {
  return storefrontUrl(agencySlug, {
    utm_source: 'telegram',
    utm_medium: 'channel',
    utm_campaign: String(tourSlug || ''),
  });
}

/**
 * Turni kanalga yuboradi. Rasm bo'lsa sendPhoto, bo'lmasa (yoki Telegram rasmni
 * yuklay olmasa) sendMessage. Natija: { messageId, withPhoto }.
 */
async function sendTourToChannel({ botToken, channelId, tour, agencySlug }) {
  const caption = buildTourCaption(tour);
  const replyMarkup = {
    inline_keyboard: [[{ text: 'Batafsil va bron', url: channelPostButtonUrl(agencySlug, tour.slug) }]],
  };
  const photo = publicPhotoUrl(tour);
  if (photo) {
    try {
      const msg = await tg.tgCall(botToken, 'sendPhoto', {
        chat_id: channelId,
        photo,
        caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
      return { messageId: String(msg.message_id), withPhoto: true };
    } catch {
      /* rasm yuklanmadi — matnli post bilan davom etamiz */
    }
  }
  const msg = await tg.tgCall(botToken, 'sendMessage', {
    chat_id: channelId,
    text: caption,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
    link_preview_options: { is_disabled: true },
  });
  return { messageId: String(msg.message_id), withPhoto: false };
}

module.exports = {
  PAYMENT_HOST_ALLOWLIST,
  CAPTION_MAX,
  validatePaymentLink,
  sanitizeRequisites,
  publicPayment,
  storefrontUrl,
  parseChannelInput,
  verifyChannel,
  ChannelError,
  escapeHtml,
  formatTourPrice,
  tourInclusions,
  buildTourCaption,
  publicPhotoUrl,
  channelPostButtonUrl,
  sendTourToChannel,
};
