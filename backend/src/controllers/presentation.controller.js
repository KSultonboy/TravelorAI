// Dinamik taklif (prezentatsiya) — agent mijozga shaxsiy link yuboradi, ochilishi kuzatiladi.
// Public sahifa mijoz telefoni/emailini KO'RSATMAYDI — faqat agent kiritgan ism.
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');
const tg = require('../services/telegram.service');

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

// 24 belgi, crypto — taxmin qilib bo'lmaydi.
function makeToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function str(v, max) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  return max && s.length > max ? s.slice(0, max) : s;
}

function shape(p) {
  return {
    id: p.id,
    token: p.token,
    url: `${SITE_URL}/p/${p.token}`,
    title: p.title,
    customerName: p.customerName || null,
    priceText: p.priceText || null,
    note: p.note || null,
    status: p.status,
    openCount: p.openCount,
    firstOpenedAt: p.firstOpenedAt,
    lastOpenedAt: p.lastOpenedAt,
    interestedAt: p.interestedAt,
    createdAt: p.createdAt,
    bookingId: p.bookingId || null,
    tourId: p.tourId || null,
    tourTitle: p.tour ? p.tour.title : null,
  };
}

/* ============ AGENCY-FACING (auth) ============ */

async function listPresentations(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;

    const items = await prisma.tourPresentation.findMany({
      where: { agencyId: agency.id },
      include: { tour: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return success(res, { items: items.map(shape), total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function createPresentation(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;

    const body = req.body || {};
    let booking = null;
    let tour = null;

    if (body.bookingId) {
      booking = await prisma.tourBooking.findFirst({
        where: { id: String(body.bookingId), agencyId: agency.id },
      });
      if (!booking) return error(res, 'Lid topilmadi', 404);
    }

    if (body.tourId) {
      tour = await prisma.tour.findFirst({
        where: { id: String(body.tourId), agencyId: agency.id },
      });
      if (!tour) return error(res, 'Tur topilmadi', 404);
    }

    const title = str(body.title, 160)
      || (tour && tour.title)
      || (booking && booking.leadTour)
      || 'Sayohat taklifi';
    const customerName = str(body.customerName, 80) || (booking && booking.customerName) || '';
    const priceText = str(body.priceText, 60) || (tour && tour.price) || '';

    const created = await prisma.tourPresentation.create({
      data: {
        token: makeToken(),
        agencyId: agency.id,
        bookingId: booking ? booking.id : null,
        tourId: tour ? tour.id : null,
        title,
        customerName: customerName || null,
        priceText: priceText || null,
        note: str(body.note, 2000) || null,
      },
      include: { tour: { select: { title: true } } },
    });

    return success(res, shape(created), 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function deletePresentation(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;

    const found = await prisma.tourPresentation.findFirst({
      where: { id: String(req.params.id), agencyId: agency.id },
      select: { id: true },
    });
    if (!found) return error(res, 'Taklif topilmadi', 404);

    await prisma.tourPresentation.delete({ where: { id: found.id } });
    return success(res, { deleted: true });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

// Agentga Telegram xabarnomasi. Mijozni kutkazmaslik uchun ATAYLAB await qilinmaydi —
// xabar yuborilmasa ham sahifa va kuzatuv normal ishlashda davom etadi.
function notifyAgent(agency, text) {
  if (!agency || !agency.notifyChatId || !agency.telegramBotToken || !agency.telegramBotActive) return;
  tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, text).catch(() => {});
}

const NOTIFY_AGENCY_SELECT = {
  select: { id: true, notifyChatId: true, telegramBotToken: true, telegramBotActive: true },
};

/* ============ PUBLIC (auth yo'q) ============ */

// Faqat o'qish — SSR va link-preview shu yerdan oladi, ochilish HISOBLANMAYDI.
async function publicPresentation(req, res) {
  try {
    const p = await prisma.tourPresentation.findUnique({
      where: { token: String(req.params.token) },
      include: {
        agency: {
          select: { name: true, city: true, phone: true, telegram: true, imageUrl: true, slug: true },
        },
        tour: {
          select: {
            title: true, city: true, subtitle: true, description: true, duration: true,
            price: true, imageUrl: true, images: true, mapAddress: true, routeStops: true,
            highlights: true, itinerary: true, nights: true,
            hotelName: true, hotelCategory: true, mealPlanLabel: true,
            priceIncludes: true, priceExcludes: true, destinationCountry: true,
          },
        },
      },
    });
    if (!p) return error(res, 'Taklif topilmadi', 404);

    return success(res, {
      title: p.title,
      customerName: p.customerName || null,
      priceText: p.priceText || null,
      note: p.note || null,
      interested: p.status === 'interested',
      createdAt: p.createdAt,
      agency: p.agency,
      tour: p.tour,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// Haqiqiy brauzer ochganda chaqiriladi (sahifa yuklangach) — shuning uchun botlar hisoblanmaydi.
async function trackOpen(req, res) {
  try {
    const p = await prisma.tourPresentation.findUnique({
      where: { token: String(req.params.token) },
      select: {
        id: true, status: true, firstOpenedAt: true, title: true, customerName: true,
        agency: NOTIFY_AGENCY_SELECT,
      },
    });
    if (!p) return error(res, 'Taklif topilmadi', 404);

    const now = new Date();
    await prisma.tourPresentation.update({
      where: { id: p.id },
      data: {
        openCount: { increment: 1 },
        lastOpenedAt: now,
        firstOpenedAt: p.firstOpenedAt || now,
        // "interested" — kuchliroq holat, "viewed" uni bosib ketmasin.
        status: p.status === 'interested' ? 'interested' : 'viewed',
      },
    });

    // Faqat BIRINCHI ochilishda xabar beramiz — har qayta ochilishda spam bo'lmasin.
    if (!p.firstOpenedAt) {
      notifyAgent(
        p.agency,
        `👁 ${p.customerName || 'Mijoz'} taklifni hozir ochdi\n«${p.title}»\n\nEng yaxshi payt — hoziroq bogʻlaning.`
      );
    }

    return success(res, { ok: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// Mijoz "Menga mos" tugmasini bosdi — bir marta yoziladi (idempotent).
async function markInterest(req, res) {
  try {
    const p = await prisma.tourPresentation.findUnique({
      where: { token: String(req.params.token) },
      select: {
        id: true, status: true, interestedAt: true, title: true, customerName: true,
        agency: NOTIFY_AGENCY_SELECT,
      },
    });
    if (!p) return error(res, 'Taklif topilmadi', 404);

    if (p.status !== 'interested') {
      await prisma.tourPresentation.update({
        where: { id: p.id },
        data: { status: 'interested', interestedAt: p.interestedAt || new Date() },
      });
      notifyAgent(
        p.agency,
        `⭐ ${p.customerName || 'Mijoz'} QIZIQISH BILDIRDI!\n«${p.title}»\n\nMijoz «Menga mos» tugmasini bosdi — darhol bogʻlaning.`
      );
    }

    return success(res, { interested: true });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

module.exports = {
  listPresentations,
  createPresentation,
  deletePresentation,
  publicPresentation,
  trackOpen,
  markInterest,
};
