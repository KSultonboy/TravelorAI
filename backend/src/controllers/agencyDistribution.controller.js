// Distribution: public storefront (/a/<slug>), Telegram kanalga tur joylash va
// taklif sahifasidagi agentlik to'lov havolasi.
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { success, error } = require('../utils/response');
const { formatTour, publicTourWhere } = require('./home.controller');
const { createWindowLimiter } = require('../services/memoryCache.service');
const tg = require('../services/telegram.service');
const dist = require('../services/distribution.service');

const STOREFRONT_TOUR_LIMIT = 60;
const REPOST_WINDOW_MS = 10 * 60 * 1000;

/* ===================== PUBLIC: storefront ===================== */

// Faqat ommaviy maydonlar — bot tokeni, egasi emaili, to'lov sozlamalari va h.k. YO'Q.
const STOREFRONT_AGENCY_SELECT = Object.freeze({
  id: true,
  slug: true,
  name: true,
  city: true,
  description: true,
  specialty: true,
  rating: true,
  reviews: true,
  phone: true,
  telegram: true,
  website: true,
  imageUrl: true,
  approvalStatus: true,
  active: true,
  updatedAt: true,
});

function storefrontAgency(a, toursCount) {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    city: a.city || null,
    description: a.description || '',
    specialty: a.specialty || null,
    rating: a.rating ?? 0,
    reviews: a.reviews ?? 0,
    // Storefront faqat admin tasdiqlagan faol agentlik uchun ochiladi.
    verified: a.approvalStatus === 'approved' && a.active === true,
    phone: a.phone || null,
    telegram: a.telegram || null,
    website: a.website || null,
    imageUrl: a.imageUrl || null,
    toursCount,
    updatedAt: a.updatedAt || null,
  };
}

// GET /home/agencies/:slug/storefront
async function getStorefront(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug || slug.length > 160) return error(res, 'Agentlik topilmadi', 404);

    const agency = await prisma.tourAgency.findFirst({
      where: { slug, active: true, approvalStatus: 'approved' },
      select: STOREFRONT_AGENCY_SELECT,
    });
    if (!agency) return error(res, 'Agentlik topilmadi yoki hozircha faol emas', 404);

    const where = { ...publicTourWhere(), agencyId: agency.id };
    const tours = await prisma.tour.findMany({
      where,
      include: { agency: true },
      orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: STOREFRONT_TOUR_LIMIT,
    });

    return success(res, {
      agency: storefrontAgency(agency, tours.length),
      tours: tours.map(formatTour),
      total: tours.length,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

/* ===================== AGENCY: sozlamalar ===================== */

function channelOf(agency) {
  if (!agency?.telegramChannelId) return null;
  return {
    id: agency.telegramChannelId,
    title: agency.telegramChannelTitle || null,
    username: agency.telegramChannelUsername || null,
  };
}

// GET /agency/distribution
async function getSettings(req, res) {
  try {
    const agency = req.agency;
    const role = req.memberRole;
    return success(res, {
      slug: agency.slug,
      storefrontUrl: dist.storefrontUrl(agency.slug),
      botConnected: Boolean(agency.telegramBotActive && agency.telegramBotToken),
      botUsername: agency.telegramBotUsername || null,
      channel: channelOf(agency),
      payment: {
        url: agency.paymentLinkUrl || null,
        requisites: agency.paymentRequisitesText || null,
        allowlist: dist.PAYMENT_HOST_ALLOWLIST,
      },
      canManage: role === 'owner',
      canPost: role === 'owner' || role === 'manager',
      telegramCapability: Boolean(req.access?.caps?.telegram),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// PUT /agency/distribution/channel { channel } — faqat egasi
async function connectChannel(req, res) {
  try {
    const agency = req.agency;
    if (!agency.telegramBotToken || !agency.telegramBotActive) {
      return error(res, 'Avval agentlik Telegram botini ulang (Sozlamalar → Ulanishlar).', 400, { code: 'BOT_NOT_CONNECTED' });
    }
    let channel;
    try {
      channel = await dist.verifyChannel(agency.telegramBotToken, req.body?.channel);
    } catch (err) {
      if (err instanceof dist.ChannelError) return error(res, err.message, err.status, { code: err.code });
      throw err;
    }
    await prisma.tourAgency.update({
      where: { id: agency.id },
      data: {
        telegramChannelId: channel.id,
        telegramChannelTitle: channel.title,
        telegramChannelUsername: channel.username,
      },
    });
    return success(res, { channel });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// DELETE /agency/distribution/channel — faqat egasi
async function disconnectChannel(req, res) {
  try {
    await prisma.tourAgency.update({
      where: { id: req.agency.id },
      data: { telegramChannelId: null, telegramChannelTitle: null, telegramChannelUsername: null },
    });
    return success(res, { channel: null });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// PUT /agency/distribution/payment { paymentLinkUrl, paymentRequisitesText, allowCustomHost } — faqat egasi
async function savePayment(req, res) {
  try {
    const body = req.body || {};
    const data = {};
    if (body.paymentLinkUrl !== undefined) {
      const link = dist.validatePaymentLink(body.paymentLinkUrl, { allowCustomHost: body.allowCustomHost === true });
      if (!link.ok) return error(res, link.error, 400, { code: link.code });
      data.paymentLinkUrl = link.value;
    }
    if (body.paymentRequisitesText !== undefined) {
      const req2 = dist.sanitizeRequisites(body.paymentRequisitesText);
      if (!req2.ok) return error(res, req2.error, 400, { code: req2.code });
      data.paymentRequisitesText = req2.value;
    }
    if (!Object.keys(data).length) return error(res, 'O‘zgartirish uchun maydon yuborilmadi', 400);

    const updated = await prisma.tourAgency.update({
      where: { id: req.agency.id },
      data,
      select: { paymentLinkUrl: true, paymentRequisitesText: true },
    });
    return success(res, {
      payment: { url: updated.paymentLinkUrl || null, requisites: updated.paymentRequisitesText || null },
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

/* ===================== AGENCY: kanalga joylash ===================== */

// GET /agency/distribution/channel-posts — har tur bo'yicha oxirgi joylash vaqti
async function listChannelPosts(req, res) {
  try {
    const rows = await prisma.tourChannelPost.groupBy({
      by: ['tourId'],
      where: { agencyId: req.agency.id },
      _max: { postedAt: true },
      _count: { _all: true },
    });
    return success(res, {
      items: rows.map((r) => ({ tourId: r.tourId, lastPostedAt: r._max?.postedAt || null, count: r._count?._all || 0 })),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

// Bir vaqtda ikki marta bosilsa ham bitta post ketsin (bitta jarayon ichida).
const inflightPosts = new Set();

// POST /agency/distribution/tours/:id/channel-post { force } — egasi yoki menejer
async function postTourToChannel(req, res) {
  const agency = req.agency;
  const lockKey = `${agency.id}:${String(req.params.id)}`;
  if (inflightPosts.has(lockKey)) {
    return error(res, 'Bu tur hozir kanalga joylanmoqda — biroz kuting.', 409, { code: 'POST_IN_PROGRESS' });
  }
  inflightPosts.add(lockKey);
  try {
    if (!agency.telegramBotToken || !agency.telegramBotActive) {
      return error(res, 'Telegram bot ulanmagan.', 400, { code: 'BOT_NOT_CONNECTED' });
    }
    if (!agency.telegramChannelId) {
      return error(res, 'Telegram kanal ulanmagan. Sozlamalar → Sotuv kanallari bo‘limida kanalni ulang.', 400, { code: 'CHANNEL_NOT_CONNECTED' });
    }

    // Tenant izolyatsiyasi: tur faqat shu agentlikniki bo'lsa topiladi.
    const tour = await prisma.tour.findFirst({ where: { id: String(req.params.id), agencyId: agency.id } });
    if (!tour) return error(res, 'Tur topilmadi', 404);
    if (!tour.active || tour.approvalStatus !== 'approved') {
      return error(res, 'Tur hali saytda e‘lon qilinmagan — avval uni e‘lon qiling (tugma havolasi do‘kon sahifasiga olib boradi).', 400, { code: 'TOUR_NOT_PUBLIC' });
    }

    const force = req.body?.force === true;
    const recent = await prisma.tourChannelPost.findFirst({
      where: {
        agencyId: agency.id,
        tourId: tour.id,
        channelId: agency.telegramChannelId,
        postedAt: { gte: new Date(Date.now() - REPOST_WINDOW_MS) },
      },
      orderBy: { postedAt: 'desc' },
    });
    if (recent && !force) {
      return error(res, 'Bu tur so‘nggi 10 daqiqa ichida kanalga joylangan. Baribir qayta joylash uchun tasdiqlang.', 409, {
        code: 'RECENTLY_POSTED',
        lastPostedAt: recent.postedAt,
      });
    }

    let sent;
    try {
      sent = await dist.sendTourToChannel({
        botToken: agency.telegramBotToken,
        channelId: agency.telegramChannelId,
        tour,
        agencySlug: agency.slug,
      });
    } catch (err) {
      logger.warn('Kanalga joylab bo‘lmadi', { agencyId: agency.id, tourId: tour.id, message: err.message });
      return error(res, 'Telegram postni qabul qilmadi. Bot kanalda «Xabar joylash» huquqiga ega ekanini tekshiring.', 502, {
        code: 'TELEGRAM_POST_FAILED',
      });
    }

    const post = await prisma.tourChannelPost.create({
      data: {
        agencyId: agency.id,
        tourId: tour.id,
        channelId: agency.telegramChannelId,
        messageId: sent.messageId,
        postedByAccountId: req.agencyAccount?.id || null,
      },
    });

    const username = agency.telegramChannelUsername;
    return success(res, {
      posted: true,
      withPhoto: sent.withPhoto,
      messageId: sent.messageId,
      postedAt: post.postedAt,
      messageUrl: username ? `https://t.me/${username}/${sent.messageId}` : null,
    }, 201);
  } catch (err) {
    return error(res, err.message, 500);
  } finally {
    inflightPosts.delete(lockKey);
  }
}

/* ===================== PUBLIC: taklif sahifasidagi «To‘lash» ===================== */

const PAYMENT_CLICK_WINDOW_MS = 60 * 60 * 1000;
const paymentClickLimiter = createWindowLimiter({ windowMs: PAYMENT_CLICK_WINDOW_MS, max: 10 });

function notifyAgent(agency, text) {
  if (!agency || !agency.notifyChatId || !agency.telegramBotToken || !agency.telegramBotActive) return;
  tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, text).catch(() => {});
}

// POST /p/:token/payment-click — payment_clicked hodisasi (open/interest kabi)
async function trackPaymentClick(req, res) {
  try {
    const token = String(req.params.token || '');
    if (!token || token.length > 100) return error(res, 'Taklif topilmadi', 404);
    const p = await prisma.tourPresentation.findUnique({
      where: { token },
      select: {
        id: true, title: true, customerName: true, paymentClickedAt: true,
        agency: {
          select: {
            id: true, notifyChatId: true, telegramBotToken: true, telegramBotActive: true,
            paymentLinkUrl: true, paymentRequisitesText: true,
          },
        },
      },
    });
    if (!p) return error(res, 'Taklif topilmadi', 404);
    if (!dist.publicPayment(p.agency)) return success(res, { recorded: false });

    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    if (!paymentClickLimiter.hit(`${ip}|${p.id}`).allowed) {
      return success(res, { recorded: false, throttled: true }, 202);
    }

    await prisma.tourPresentation.update({
      where: { id: p.id },
      data: { paymentClickCount: { increment: 1 }, paymentClickedAt: new Date() },
    });

    // Faqat birinchi bosishda xabar — spam bo'lmasin.
    if (!p.paymentClickedAt) {
      notifyAgent(
        p.agency,
        `💳 ${p.customerName || 'Mijoz'} «To‘lash» tugmasini bosdi\n«${p.title}»\n\nTo‘lov tushganini tekshiring va mijoz bilan bog‘laning.`
      );
    }
    return success(res, { recorded: true, event: 'payment_clicked' });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

function resetDistributionLimiters() {
  paymentClickLimiter.reset();
  inflightPosts.clear();
}

module.exports = {
  getStorefront,
  getSettings,
  connectChannel,
  disconnectChannel,
  savePayment,
  listChannelPosts,
  postTourToChannel,
  trackPaymentClick,
  resetDistributionLimiters,
  STOREFRONT_AGENCY_SELECT,
};
