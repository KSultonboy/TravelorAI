// Sharh -> reyting oqimi (review flywheel).
// Sayohat "yakunlandi"ga o'tganda mijozga Telegram orqali baho so'rovi yuboriladi;
// baho (1-5) inline tugma orqali keladi, ixtiyoriy izoh keyingi xabar bo'ladi.
// Publish sharhlar TourAgency.rating/reviews ni oshiradi — marketplace'da ko'rinadi.
//
// Bog'liqliklar: faqat prisma + telegram.service (sikl bog'liqlik yo'q — controllerlar
// buni require qiladi, aksincha emas).
const { prisma } = require('../config/database');
const tg = require('./telegram.service');

function reviewRequestText(agencyName, name) {
  return (
    `🌟 Hurmatli ${name || 'mijoz'}!\n\n` +
    `${agencyName || 'Bizning jamoa'} bilan sayohatingiz yakunlandi. ` +
    `Xizmatimizni baholang — bu biz uchun juda muhim va boshqa sayohatchilarga ` +
    `to'g'ri tanlov qilishда yordam beradi:`
  );
}

/** 1..5 yulduzli inline klaviatura — callback_data: rate:<bookingId>:<n> */
function starKeyboard(bookingId) {
  const row = [];
  for (let n = 1; n <= 5; n += 1) {
    row.push({ text: `${n} ⭐`, callback_data: `rate:${bookingId}:${n}`.slice(0, 64) });
  }
  return { inline_keyboard: [row] };
}

/**
 * Baho so'rovини yuboradi. Telegram ulanmagan / chat yo'q / allaqachon so'ralган
 * bo'lsa jimgina o'tkazadi. Xatolar yutiladi — hech qachon chaqiruvchini buzmaydi.
 */
async function sendReviewRequest(agency, booking) {
  try {
    if (!agency || !agency.telegramBotToken || !agency.telegramBotActive) return false;
    if (!booking || !booking.telegramChatId) return false;
    if (booking.reviewRequestedAt) return false; // takror bo'lmasin

    const text = reviewRequestText(agency.name, booking.customerName);
    await tg.sendMessage(agency.telegramBotToken, booking.telegramChatId, text, {
      reply_markup: starKeyboard(booking.id),
    });
    await prisma.telegramMessage
      .create({ data: { agencyId: agency.id, bookingId: booking.id, direction: 'out', text, fromName: "Baho so'rovi" } })
      .catch(() => {});
    await prisma.tourBooking
      .update({ where: { id: booking.id }, data: { reviewRequestedAt: new Date() } })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Agentlik reytingини publish sharhlardan qayta hisoblaydi.
 * MUHIM: bironta ham real sharh yo'q bo'lsa — mavjud (seed) reytingни O'CHIRMAYMIZ,
 * aks holda marketplace'da baho birdan 0 ga tushib ketardi.
 */
async function recomputeAgencyRating(agencyId) {
  const rows = await prisma.tourReview.findMany({
    where: { agencyId, status: 'published' },
    select: { rating: true },
  });
  const count = rows.length;
  if (!count) return;
  const avg = Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  await prisma.tourAgency
    .update({ where: { id: agencyId }, data: { rating: avg, reviews: count } })
    .catch(() => {});
}

module.exports = { sendReviewRequest, recomputeAgencyRating, starKeyboard, reviewRequestText };
