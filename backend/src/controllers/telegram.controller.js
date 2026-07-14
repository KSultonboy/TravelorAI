const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');
const tg = require('../services/telegram.service');

const PUBLIC_BASE = process.env.PUBLIC_API_URL || 'https://travelorai.com/api/v1';

/* ============ AGENCY-FACING (auth) ============ */

async function getTelegram(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    return success(res, {
      connected: !!(agency.telegramBotActive && agency.telegramBotToken),
      username: agency.telegramBotUsername || null,
      welcome: agency.telegramWelcome || '',
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function connectTelegram(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const token = String((req.body && req.body.token) || '').trim();
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) return error(res, 'Token formati notogri', 400);

    let me;
    try {
      me = await tg.getMe(token);
    } catch {
      return error(res, 'Token yaroqsiz yoki bot topilmadi', 400);
    }

    const secret = tg.webhookSecret(token);
    const url = `${PUBLIC_BASE}/telegram/webhook/${agency.id}`;
    await tg.setWebhook(token, url, secret);

    const updated = await prisma.tourAgency.update({
      where: { id: agency.id },
      data: {
        telegramBotToken: token,
        telegramBotUsername: me.username || null,
        telegramBotActive: true,
      },
    });
    return success(res, { connected: true, username: updated.telegramBotUsername });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function disconnectTelegram(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (agency.telegramBotToken) {
      try { await tg.deleteWebhook(agency.telegramBotToken); } catch { /* ignore */ }
    }
    await prisma.tourAgency.update({
      where: { id: agency.id },
      data: { telegramBotActive: false, telegramBotToken: null },
    });
    return success(res, { connected: false });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function setWelcome(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const text = String((req.body && req.body.text) || '').trim().slice(0, 1000);
    await prisma.tourAgency.update({ where: { id: agency.id }, data: { telegramWelcome: text || null } });
    return success(res, { welcome: text });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function listMessages(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const bookingId = String(req.query.bookingId || '');
    if (!bookingId) return error(res, 'bookingId kerak', 400);
    const booking = await prisma.tourBooking.findFirst({ where: { id: bookingId, agencyId: agency.id } });
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const messages = await prisma.telegramMessage.findMany({
      where: { agencyId: agency.id, bookingId },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    return success(res, { messages, chatId: booking.telegramChatId, canReply: !!booking.telegramChatId });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function reply(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!agency.telegramBotToken || !agency.telegramBotActive) return error(res, 'Telegram bot ulanmagan', 400);
    const bookingId = String((req.body && req.body.bookingId) || '');
    const text = String((req.body && req.body.text) || '').trim();
    if (!text) return error(res, 'Xabar bosh', 400);
    const booking = await prisma.tourBooking.findFirst({ where: { id: bookingId, agencyId: agency.id } });
    if (!booking || !booking.telegramChatId) return error(res, 'Bu lidda Telegram suhbati yoq', 400);
    await tg.sendMessage(agency.telegramBotToken, booking.telegramChatId, text);
    const message = await prisma.telegramMessage.create({
      data: { agencyId: agency.id, bookingId, direction: 'out', text, fromName: 'Agent' },
    });
    return success(res, { message });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

/* ============ PUBLIC WEBHOOK (no auth) ============ */

async function webhook(req, res) {
  try {
    const agencyId = String(req.params.agencyId || '');
    const agency = await prisma.tourAgency.findUnique({ where: { id: agencyId } });
    if (!agency || !agency.telegramBotToken || !agency.telegramBotActive) return res.status(200).json({ ok: true });

    const expected = tg.webhookSecret(agency.telegramBotToken);
    if (req.get('x-telegram-bot-api-secret-token') !== expected) return res.status(403).json({ ok: false });

    const message = (req.body && req.body.message) || null;
    if (!message || !message.chat) return res.status(200).json({ ok: true });
    const text = String(message.text || message.caption || '').slice(0, 4000);
    if (!text) return res.status(200).json({ ok: true });

    const chatId = String(message.chat.id);
    const from = message.from || {};
    const fromName =
      [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Telegram mijoz';
    const uname = from.username ? `@${from.username}` : null;

    let booking = await prisma.tourBooking.findFirst({ where: { agencyId: agency.id, telegramChatId: chatId } });
    let isNew = false;
    if (!booking) {
      isNew = true;
      booking = await prisma.tourBooking.create({
        data: {
          agencyId: agency.id,
          tourId: null,
          customerName: fromName,
          customerPhone: (message.contact && message.contact.phone_number) || null,
          message: text,
          telegramChatId: chatId,
          travelers: 1,
          currency: 'USD',
          source: 'telegram',
          status: 'pending',
          pipelineStage: 'new',
        },
      });
    }

    await prisma.telegramMessage.create({
      data: { agencyId: agency.id, bookingId: booking.id, direction: 'in', text, fromName: uname || fromName },
    });

    if (isNew && agency.telegramWelcome) {
      try {
        await tg.sendMessage(agency.telegramBotToken, chatId, agency.telegramWelcome);
        await prisma.telegramMessage.create({
          data: { agencyId: agency.id, bookingId: booking.id, direction: 'out', text: agency.telegramWelcome, fromName: 'Bot' },
        });
      } catch { /* ignore send failure */ }
    }

    return res.status(200).json({ ok: true });
  } catch {
    // Telegram'ga har doim 200 qaytaramiz — aks holda u qayta-qayta yuboradi
    return res.status(200).json({ ok: true });
  }
}

module.exports = { getTelegram, connectTelegram, disconnectTelegram, setWelcome, listMessages, reply, webhook };
