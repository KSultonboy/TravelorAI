// Telegram Mini App — agentlik boti ichida ochiladigan katalog + mijoz kabineti.
// Auth: Telegram initData imzosi (bot tokeni bilan HMAC). Alohida ro'yxatdan o'tish YO'Q —
// foydalanuvchi Telegram ID'si lidning telegramChatId'si bilan bir xil, shuning uchun
// mijoz o'z so'rovlarini va unga yuborilgan takliflarni darhol ko'radi.
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { resolveTourImageUrl } = require('../utils/tourImage');
const tg = require('../services/telegram.service');

const MAX_AGE_SEC = 24 * 60 * 60; // eski initData qabul qilinmaydi
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

/**
 * Telegram WebApp initData imzosini tekshiradi.
 *   secret = HMAC_SHA256(key: "WebAppData", msg: bot_token)
 *   hash   = HMAC_SHA256(key: secret,      msg: data_check_string)
 * Bu tekshiruvsiz istalgan odam o'zini boshqa mijoz deb ko'rsata oladi.
 */
function verifyInitData(initData, botToken) {
  const raw = String(initData || '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(String(botToken)).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(calc, 'hex');
  const b = Buffer.from(hash.toLowerCase(), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SEC) return null;

  let user = null;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
  if (!user || !user.id) return null;

  return { user, authDate };
}

// Har bir so'rovda agentlikni topib, initData'ni O'SHA agentlik boti tokeni bilan tekshiramiz.
async function authAgency(req, res) {
  const slug = String((req.body && req.body.agency) || '').trim();
  if (!slug) {
    error(res, 'Agentlik koʻrsatilmagan', 400);
    return null;
  }
  const agency = await prisma.tourAgency.findUnique({ where: { slug } });
  if (!agency || !agency.active || agency.approvalStatus !== 'approved') {
    error(res, 'Agentlik topilmadi', 404);
    return null;
  }
  if (!agency.telegramBotToken || !agency.telegramBotActive) {
    error(res, 'Bu agentlikda Telegram bot ulanmagan', 400);
    return null;
  }
  const verified = verifyInitData((req.body && req.body.initData) || '', agency.telegramBotToken);
  if (!verified) {
    error(res, 'Telegram tekshiruvidan oʻtmadi. Mini ilovani bot orqali qayta oching.', 401);
    return null;
  }
  return { agency, user: verified.user };
}

function publicAgency(a) {
  return {
    name: a.name,
    slug: a.slug,
    city: a.city,
    description: a.description,
    phone: a.phone,
    telegram: a.telegram,
    imageUrl: a.imageUrl,
    rating: a.rating,
  };
}

function listTour(t) {
  return {
    id: t.id,
    title: t.title,
    city: t.city,
    subtitle: t.subtitle,
    duration: t.duration,
    price: t.price,
    priceMin: t.priceMin,
    nights: t.nights,
    imageUrl: resolveTourImageUrl(t),
    highlights: t.highlights || [],
  };
}

function fullTour(t) {
  return {
    ...listTour(t),
    description: t.description,
    images: t.images || [],
    itinerary: t.itinerary,
    routeStops: t.routeStops,
    mapAddress: t.mapAddress,
    hotelName: t.hotelName,
    hotelCategory: t.hotelCategory,
    mealPlanLabel: t.mealPlanLabel,
    destinationCountry: t.destinationCountry,
    priceIncludes: t.priceIncludes || [],
    priceExcludes: t.priceExcludes || [],
  };
}

const STAGE_LABEL = {
  new: 'Yangi soʻrov',
  contacted: 'Bogʻlanildi',
  quoted: 'Taklif yuborildi',
  won: 'Kelishildi',
  completed: 'Yakunlandi',
  lost: 'Yopildi',
};

/* ============ ENDPOINTLAR ============ */

async function session(req, res) {
  try {
    const ctx = await authAgency(req, res);
    if (!ctx) return;
    const { agency, user } = ctx;
    return success(res, {
      user: { id: String(user.id), firstName: user.first_name || '', username: user.username || null },
      agency: publicAgency(agency),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function tours(req, res) {
  try {
    const ctx = await authAgency(req, res);
    if (!ctx) return;
    const items = await prisma.tour.findMany({
      where: { agencyId: ctx.agency.id, active: true, approvalStatus: 'approved' },
      orderBy: [{ promo: 'desc' }, { updatedAt: 'desc' }],
      take: 60,
    });
    return success(res, { items: items.map(listTour), total: items.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function tour(req, res) {
  try {
    const ctx = await authAgency(req, res);
    if (!ctx) return;
    const found = await prisma.tour.findFirst({
      where: { id: String((req.body && req.body.tourId) || ''), agencyId: ctx.agency.id, active: true },
    });
    if (!found) return error(res, 'Tur topilmadi', 404);
    return success(res, fullTour(found));
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// Mijoz kabineti — o'z so'rovlari va unga yuborilgan takliflar.
async function me(req, res) {
  try {
    const ctx = await authAgency(req, res);
    if (!ctx) return;
    const chatId = String(ctx.user.id);

    const bookings = await prisma.tourBooking.findMany({
      where: { agencyId: ctx.agency.id, telegramChatId: chatId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { tour: { select: { title: true } } },
    });

    const presentations = bookings.length
      ? await prisma.tourPresentation.findMany({
          where: { agencyId: ctx.agency.id, bookingId: { in: bookings.map((b) => b.id) } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];

    return success(res, {
      requests: bookings.map((b) => ({
        id: b.id,
        title: (b.tour && b.tour.title) || b.leadTour || 'Sayohat soʻrovi',
        stage: b.pipelineStage,
        stageLabel: STAGE_LABEL[b.pipelineStage] || b.pipelineStage,
        travelDate: b.travelDate,
        createdAt: b.createdAt,
      })),
      offers: presentations.map((p) => ({
        id: p.id,
        title: p.title,
        priceText: p.priceText,
        url: `${SITE_URL}/p/${p.token}`,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// "Qiziqdim" — lid yaratadi yoki mavjudini shu turga yo'naltiradi.
async function request(req, res) {
  try {
    const ctx = await authAgency(req, res);
    if (!ctx) return;
    const { agency, user } = ctx;
    const chatId = String(user.id);

    const found = await prisma.tour.findFirst({
      where: { id: String((req.body && req.body.tourId) || ''), agencyId: agency.id, active: true },
      select: { id: true, title: true },
    });
    if (!found) return error(res, 'Tur topilmadi', 404);

    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Telegram mijoz';
    const note = String((req.body && req.body.note) || '').trim().slice(0, 500);

    let booking = await prisma.tourBooking.findFirst({
      where: { agencyId: agency.id, telegramChatId: chatId },
    });

    if (booking) {
      booking = await prisma.tourBooking.update({
        where: { id: booking.id },
        data: {
          tourId: found.id,
          leadTour: found.title,
          ...(booking.pipelineStage === 'lost' ? { pipelineStage: 'new' } : {}),
        },
      });
    } else {
      booking = await prisma.tourBooking.create({
        data: {
          agencyId: agency.id,
          tourId: found.id,
          customerName: name,
          leadTour: found.title,
          message: note || null,
          telegramChatId: chatId,
          travelers: 1,
          currency: 'USD',
          source: 'telegram',
          utmSource: 'miniapp',
          utmMedium: 'telegram_miniapp',
          status: 'pending',
          pipelineStage: 'new',
        },
      });
    }

    await prisma.telegramMessage.create({
      data: {
        agencyId: agency.id,
        bookingId: booking.id,
        direction: 'in',
        text: `Mini ilovadan soʻrov: «${found.title}»${note ? `\n${note}` : ''}`,
        fromName: name,
      },
    });

    // Agentga darhol xabar (kutilmaydi — mijoz javobni tez olsin)
    if (agency.notifyChatId) {
      tg.sendMessage(
        agency.telegramBotToken,
        agency.notifyChatId,
        `🆕 ${name} mini ilovadan soʻrov qoldirdi\n«${found.title}»${note ? `\n\n${note}` : ''}`
      ).catch(() => {});
    }

    return success(res, { ok: true, bookingId: booking.id });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = { session, tours, tour, me, request };
