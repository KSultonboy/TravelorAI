// Yangi lid haqida agentlikning Telegram xabarnoma chatiga darhol xabar
// (+ "✅ Qabul qildim" tugmasi orqali birinchi javob vaqtini qayd etish).
//
// Xabar agentlikning O'Z boti orqali `notifyChatId` ga yuboriladi (agent CRM →
// Telegram'da /xabarnoma <kod> bilan yoqadi). Hech bir funksiya xato TASHLAMAYDI:
// lid yaratish so'rovi xabarnoma sabab hech qachon yiqilmasligi kerak.
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { getSecret } = require('../config/env');
const tg = require('./telegram.service');

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');
const CRM_URL = `${SITE_URL}/agency`;
const CALLBACK_PREFIX = 'la:';
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent (UTC+5, DST yo'q)

const SOURCE_LABELS = {
  web: 'Sayt',
  mobile: 'Mobil ilova',
  miniapp: 'Telegram mini ilova',
  manual: 'Qo‘lda kiritilgan',
  offline: 'Qo‘lda kiritilgan',
  instagram: 'Instagram Direct',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram bot',
  csv: 'CSV import',
  storefront: 'Agentlik sahifasi',
  marketplace: 'Marketplace',
  api: 'API',
};

function sourceLabel(source) {
  const key = String(source || '').toLowerCase();
  return SOURCE_LABELS[key] || (key ? key.slice(0, 40) : 'Noma’lum');
}

// Public booking `source` erkin matn — ma'lum qiymatlarga keltiramiz.
function normalizeBookingSource(source) {
  const key = String(source || '').toLowerCase().trim();
  if (SOURCE_LABELS[key]) return key;
  if (key === 'website' || key === 'site') return 'web';
  if (key === 'android' || key === 'ios' || key === 'app') return 'mobile';
  return key ? 'web' : 'mobile';
}

/* ───────── callback imzosi ───────── */

function callbackKey() {
  let secret = '';
  try { secret = getSecret('AGENCY_JWT_SECRET'); } catch { secret = ''; }
  return `lead-accept|${secret}`;
}

// 16 hex (64 bit) — callback_data 64 baytga sig'adi: "la:" + cuid(25) + ":" + 16.
function signLeadCallback(agencyId, bookingId) {
  return crypto.createHmac('sha256', callbackKey()).update(`${agencyId}|${bookingId}`).digest('hex').slice(0, 16);
}

function verifyLeadCallback(agencyId, bookingId, sig) {
  if (typeof sig !== 'string' || sig.length !== 16) return false;
  const expected = signLeadCallback(agencyId, bookingId);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function buildCallbackData(agencyId, bookingId) {
  return `${CALLBACK_PREFIX}${bookingId}:${signLeadCallback(agencyId, bookingId)}`;
}

/* ───────── formatlash ───────── */

function clean(value, max = 200) {
  return String(value ?? '').replace(/[\r\t]+/g, ' ').replace(/\s+\n/g, '\n').trim().slice(0, max);
}

// Telegram mijozlari "+998..." ko'rinishidagi raqamni avtomatik bosiladigan qiladi.
function formatPhone(phone) {
  const raw = clean(phone, 40);
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return raw;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date(d.getTime() + TZ_OFFSET_MS);
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${t.getUTCFullYear()}`;
}

function formatTime(value) {
  const t = new Date(new Date(value).getTime() + TZ_OFFSET_MS);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

function buildLeadAlertText(booking, { source, tourTitle } = {}) {
  const lines = [`🆕 Yangi lid · ${sourceLabel(source || booking.source)}`];
  const tour = clean(tourTitle || booking.leadTour, 120);
  if (tour) lines.push(`🧭 Tur: ${tour}`);
  lines.push(`👤 Mijoz: ${clean(booking.customerName, 120) || '—'}`);
  const phone = formatPhone(booking.customerPhone);
  if (phone) lines.push(`📞 ${phone}`);
  if (booking.travelers && Number(booking.travelers) > 1) lines.push(`👥 Kishi soni: ${Number(booking.travelers)}`);
  const date = formatDate(booking.travelDate);
  if (date) lines.push(`📅 Sana: ${date}`);
  const msg = clean(booking.message, 1000);
  if (msg) lines.push(`💬 «${msg.length > 280 ? `${msg.slice(0, 277)}…` : msg}»`);
  return lines.join('\n');
}

function alertKeyboard(agencyId, bookingId) {
  return {
    inline_keyboard: [
      [{ text: '✅ Qabul qildim', callback_data: buildCallbackData(agencyId, bookingId) }],
      [{ text: 'CRM’da ochish', url: CRM_URL }],
    ],
  };
}

/* ───────── yuborish ───────── */

async function loadAlertTarget(agencyId) {
  const agency = await prisma.tourAgency.findUnique({
    where: { id: agencyId },
    select: {
      id: true, notifyChatId: true, telegramBotToken: true, telegramBotActive: true,
      crmSettings: { select: { leadAlertsEnabled: true } },
    },
  });
  if (!agency || !agency.notifyChatId || !agency.telegramBotToken || !agency.telegramBotActive) return null;
  if (agency.crmSettings && agency.crmSettings.leadAlertsEnabled === false) return null;
  return agency;
}

/**
 * Yangi lid haqida xabar. Hech qachon xato tashlamaydi — chaqiruvchi kutmasdan
 * (fire-and-forget) ishlatishi mumkin.
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function notifyNewLead(booking, { source } = {}) {
  try {
    if (!booking || !booking.id || !booking.agencyId) return { sent: false, reason: 'no_agency' };
    const agency = await loadAlertTarget(booking.agencyId);
    if (!agency) return { sent: false, reason: 'disabled' };
    let tourTitle = (booking.tour && booking.tour.title) || null;
    if (!tourTitle && booking.tourId && !booking.leadTour) {
      const tour = await prisma.tour.findUnique({ where: { id: booking.tourId }, select: { title: true } }).catch(() => null);
      tourTitle = tour ? tour.title : null;
    }
    const text = buildLeadAlertText(booking, { source, tourTitle });
    await tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, text, {
      reply_markup: alertKeyboard(agency.id, booking.id),
      disable_web_page_preview: true,
    });
    return { sent: true };
  } catch (err) {
    logger.warn('[leadAlert] yuborilmadi', { message: err && err.message });
    return { sent: false, reason: 'error' };
  }
}

/** CSV import — har qator emas, bitta jamlovchi xabar. */
async function notifyLeadImport(agencyId, { count, fileName, source = 'csv' } = {}) {
  try {
    if (!agencyId || !count) return { sent: false, reason: 'empty' };
    const agency = await loadAlertTarget(agencyId);
    if (!agency) return { sent: false, reason: 'disabled' };
    const text = [
      `📥 ${Number(count)} ta yangi lid import qilindi · ${sourceLabel(source)}`,
      fileName ? `📄 Fayl: ${clean(fileName, 120)}` : null,
      'Lidlar CRM’da «Yangi» ustunida.',
    ].filter(Boolean).join('\n');
    await tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, text, {
      reply_markup: { inline_keyboard: [[{ text: 'CRM’da ochish', url: CRM_URL }]] },
      disable_web_page_preview: true,
    });
    return { sent: true };
  } catch (err) {
    logger.warn('[leadAlert] import xabari yuborilmadi', { message: err && err.message });
    return { sent: false, reason: 'error' };
  }
}

/* ───────── "✅ Qabul qildim" ───────── */

function actorName(from) {
  if (!from) return 'Agent';
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  return clean(name || (from.username ? `@${from.username}` : 'Agent'), 60);
}

/**
 * Webhook callback_query'ni qayta ishlaydi. `agency` — webhook URL va maxfiy
 * sarlavha bilan allaqachon tasdiqlangan agentlik. Bizning callback bo'lmasa false.
 * Himoya: (1) imzo shu agentlik id'si bilan tekshiriladi — boshqa agentlik lidi
 * uchun yasalgan tugma rad etiladi; (2) tugma faqat agentlikning xabarnoma
 * chatidan qabul qilinadi; (3) lid shu agentlikka tegishli bo'lishi shart.
 */
async function handleLeadAcceptCallback(agency, cb) {
  const data = String((cb && cb.data) || '');
  if (!data.startsWith(CALLBACK_PREFIX)) return false;
  const token = agency.telegramBotToken;
  const answer = (text) => tg.answerCallbackQuery(token, cb.id, text).catch(() => {});

  const [bookingId, sig] = data.slice(CALLBACK_PREFIX.length).split(':');
  const chatId = String((cb.message && cb.message.chat && cb.message.chat.id) || '');
  if (!bookingId || !sig || !verifyLeadCallback(agency.id, bookingId, sig)
    || !agency.notifyChatId || chatId !== String(agency.notifyChatId)) {
    await answer('Ruxsat yo‘q');
    return true;
  }

  try {
    const booking = await prisma.tourBooking.findFirst({
      where: { id: bookingId, agencyId: agency.id },
      select: { id: true, firstResponseAt: true },
    });
    if (!booking) { await answer('Lid topilmadi'); return true; }

    const now = new Date();
    const who = actorName(cb.from);
    const updated = await prisma.tourBooking.updateMany({
      where: { id: booking.id, agencyId: agency.id, firstResponseAt: null },
      data: { firstResponseAt: now },
    });
    const first = updated.count > 0;
    if (first) {
      await prisma.leadActivity.create({
        data: {
          agencyId: agency.id, bookingId: booking.id, type: 'accepted',
          text: `Telegram orqali qabul qilindi: ${who}`,
          metadata: { via: 'telegram_lead_alert', telegramUserId: cb.from && cb.from.id ? String(cb.from.id) : null },
        },
      }).catch(() => {});
    }

    const original = String((cb.message && cb.message.text) || '').slice(0, 3500);
    const stamp = first
      ? `✅ Qabul qildi: ${who} · ${formatTime(now)}`
      : `✅ Allaqachon qabul qilingan${booking.firstResponseAt ? ` · ${formatTime(booking.firstResponseAt)}` : ''}`;
    if (cb.message && cb.message.message_id) {
      await tg.tgCall(token, 'editMessageText', {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text: `${original}\n\n${stamp}`,
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: 'CRM’da ochish', url: CRM_URL }]] },
      }).catch(() => {});
    }
    await answer(first ? 'Qabul qilindi ✅' : 'Bu lid allaqachon qabul qilingan');
  } catch (err) {
    logger.warn('[leadAlert] callback xatosi', { message: err && err.message });
    await answer('Xatolik, qayta urinib ko‘ring');
  }
  return true;
}

module.exports = {
  SOURCE_LABELS,
  sourceLabel,
  normalizeBookingSource,
  signLeadCallback,
  verifyLeadCallback,
  buildCallbackData,
  buildLeadAlertText,
  formatPhone,
  notifyNewLead,
  notifyLeadImport,
  handleLeadAcceptCallback,
};
