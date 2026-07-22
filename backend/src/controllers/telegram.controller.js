const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');
const tg = require('../services/telegram.service');
const { DEFAULT_BIRTHDAY, fillBirthday } = require('../services/scheduler.service');

const PUBLIC_BASE = process.env.PUBLIC_API_URL || 'https://travelorai.com/api/v1';
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

// Agent o'z botiga shu kodni yuborsa — o'sha chat xabarnoma manzili bo'lib qoladi.
// Kod agentlik id + bot tokenidan kelib chiqadi, alohida saqlash shart emas.
function notifyCode(agency) {
  return crypto
    .createHash('sha256')
    .update(`${agency.id}|${agency.telegramBotToken || ''}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

/* ============ AGENCY-FACING (auth) ============ */

async function getTelegram(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    return success(res, {
      connected: !!(agency.telegramBotActive && agency.telegramBotToken),
      username: agency.telegramBotUsername || null,
      welcome: agency.telegramWelcome || '',
      birthdayTemplate: agency.birthdayTemplate || '',
      birthdayDefault: DEFAULT_BIRTHDAY,
      notifyEnabled: !!agency.notifyChatId,
      notifyCode: agency.telegramBotToken ? notifyCode(agency) : null,
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

    // Bot menyusiga Mini App tugmasi — mijoz turlarni bot ichida ko'radi.
    // Xato bo'lsa ulanish baribir davom etadi (menyu ikkinchi darajali).
    try {
      await tg.setChatMenuButton(token, {
        type: 'web_app',
        text: 'Turlar',
        web_app: { url: `${SITE_URL}/tg/${agency.slug}` },
      });
    } catch { /* ignore */ }

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

// Tug'ilgan kun tabrigi shablonini saqlash. Bo'sh bo'lsa — standart matnga qaytadi.
async function setBirthdayTemplate(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    const text = String((req.body && req.body.text) || '').trim().slice(0, 1500);
    await prisma.tourAgency.update({ where: { id: agency.id }, data: { birthdayTemplate: text || null } });
    return success(res, { birthdayTemplate: text, preview: fillBirthday(text, 'Aziz Karimov', agency.name) });
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

async function getProfile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!agency.telegramBotToken) return error(res, 'Telegram bot ulanmagan', 400);
    const t = agency.telegramBotToken;
    const [name, desc, shortDesc] = await Promise.all([
      tg.getMyName(t).catch(() => ({})),
      tg.getMyDescription(t).catch(() => ({})),
      tg.getMyShortDescription(t).catch(() => ({})),
    ]);
    return success(res, {
      name: name.name || '',
      description: desc.description || '',
      shortDescription: shortDesc.short_description || '',
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function setProfile(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!agency.telegramBotToken) return error(res, 'Telegram bot ulanmagan', 400);
    const t = agency.telegramBotToken;
    const b = req.body || {};
    if (b.name !== undefined) await tg.setMyName(t, String(b.name).trim().slice(0, 64));
    if (b.description !== undefined) await tg.setMyDescription(t, String(b.description).slice(0, 512));
    if (b.shortDescription !== undefined) await tg.setMyShortDescription(t, String(b.shortDescription).slice(0, 120));
    return success(res, { saved: true });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

function parseConfig(agency) {
  const base = { commands: [], templates: [] };
  try { return agency.telegramConfig ? { ...base, ...JSON.parse(agency.telegramConfig) } : base; } catch { return base; }
}

async function getConfig(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    return success(res, parseConfig(agency));
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function setConfig(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!agency.telegramBotToken) return error(res, 'Telegram bot ulanmagan', 400);
    const b = req.body || {};
    const commands = (Array.isArray(b.commands) ? b.commands : []).map((c) => ({
      command: String((c && c.command) || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32),
      description: String((c && c.description) || '').slice(0, 256),
      reply: String((c && c.reply) || '').slice(0, 2000),
    })).filter((c) => c.command).slice(0, 100);
    const templates = (Array.isArray(b.templates) ? b.templates : []).map((t) => ({
      id: String((t && t.id) || Math.random().toString(36).slice(2, 9)),
      title: String((t && t.title) || '').trim().slice(0, 64),
      text: String((t && t.text) || '').slice(0, 2000),
    })).filter((t) => t.title && t.text).slice(0, 50);

    // Telegram menyusini sinxronlaymiz (izohi bor buyruqlar)
    const menu = commands.filter((c) => c.description).map((c) => ({ command: c.command, description: c.description }));
    try { await tg.setMyCommands(agency.telegramBotToken, menu); } catch { /* ignore */ }

    const cfg = { commands, templates };
    await prisma.tourAgency.update({ where: { id: agency.id }, data: { telegramConfig: JSON.stringify(cfg) } });
    return success(res, cfg);
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

    // ── Inline tugma bosildi (yo'nalish tanlovi) ──
    const cb = (req.body && req.body.callback_query) || null;
    if (cb) {
      const data = String(cb.data || '');
      const cbChat = String((cb.message && cb.message.chat && cb.message.chat.id) || '');
      if (cbChat && data.startsWith('dest:')) {
        const dest = data.slice(5).trim().slice(0, 80);
        const bk = await prisma.tourBooking.findFirst({
          where: { agencyId: agency.id, telegramChatId: cbChat },
        });
        if (bk && dest) {
          await prisma.tourBooking.update({ where: { id: bk.id }, data: { leadTour: dest } });
          await prisma.telegramMessage.create({
            data: {
              agencyId: agency.id, bookingId: bk.id, direction: 'in',
              text: `Yoʻnalish tanlandi: ${dest}`, fromName: bk.customerName,
            },
          });
          try {
            await tg.sendMessage(
              agency.telegramBotToken, cbChat,
              `Rahmat! «${dest}» boʻyicha eng mos takliflarni tayyorlaymiz — agentimiz tez orada bogʻlanadi.`
            );
          } catch { /* ignore */ }
        }
      }
      try { await tg.answerCallbackQuery(agency.telegramBotToken, cb.id); } catch { /* ignore */ }
      return res.status(200).json({ ok: true });
    }

    const message = (req.body && req.body.message) || null;
    if (!message || !message.chat) return res.status(200).json({ ok: true });
    const text = String(message.text || message.caption || '').slice(0, 4000);
    if (!text) return res.status(200).json({ ok: true });

    const chatId = String(message.chat.id);
    const from = message.from || {};
    const fromName =
      [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Telegram mijoz';
    const uname = from.username ? `@${from.username}` : null;

    // Agentning o'zi xabarnomani yoqmoqchi — bu LID EMAS, shuning uchun oldinroq ushlaymiz.
    const trimmed = text.trim();
    if (/^\/xabarnoma(\s|$)/i.test(trimmed)) {
      const given = (trimmed.split(/\s+/)[1] || '').toUpperCase();
      const ok = given && given === notifyCode(agency);
      if (ok) {
        await prisma.tourAgency.update({ where: { id: agency.id }, data: { notifyChatId: chatId } });
      }
      try {
        await tg.sendMessage(
          agency.telegramBotToken,
          chatId,
          ok
            ? 'Xabarnomalar yoqildi. Mijoz taklifni ochganda yoki qiziqish bildirganda shu yerga xabar keladi.'
            : 'Kod notoʻgʻri. CRM → Telegram sahifasidan toʻgʻri kodni koʻchiring.'
        );
      } catch {
        /* jimgina */
      }
      return res.status(200).json({ ok: true });
    }

    // Xabarnoma chatidan kelgan xabarlar ham lid bo'lmasligi kerak.
    if (agency.notifyChatId && agency.notifyChatId === chatId) {
      return res.status(200).json({ ok: true });
    }

    // Deep-link manbasi: t.me/bot?start=instagram -> lid "instagram"dan kelgani yoziladi.
    // Agentlik har kanalga alohida havola tarqatadi va qaysi biri ishlayotganini ko'radi.
    const startMatch = trimmed.match(/^\/start\s+([A-Za-z0-9_-]{1,60})/i);
    const startPayload = startMatch ? startMatch[1] : '';

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
          // Birinchi teginish saqlanadi — keyingi havolalar uni almashtirmaydi.
          utmSource: startPayload || null,
          utmMedium: startPayload ? 'telegram_link' : null,
          status: 'pending',
          pipelineStage: 'new',
        },
      });
    }

    await prisma.telegramMessage.create({
      data: { agencyId: agency.id, bookingId: booking.id, direction: 'in', text, fromName: uname || fromName },
    });

    // Salomlashishni birinchi kontaktda YOKI /start bosilganda yuboramiz
    const isStart = text.trim().toLowerCase().startsWith('/start');

    // Buyruqqa avto-javob (config.commands.reply)
    let cmdReply = null;
    if (text.trim().startsWith('/') && !isStart) {
      const cmd = text.trim().slice(1).split(/[\s@]/)[0].toLowerCase();
      const match = parseConfig(agency).commands.find((c) => c.command === cmd && c.reply);
      if (match) cmdReply = match.reply;
    }

    if ((isNew || isStart) && agency.telegramWelcome) {
      try {
        await tg.sendMessage(agency.telegramBotToken, chatId, agency.telegramWelcome);
        await prisma.telegramMessage.create({
          data: { agencyId: agency.id, bookingId: booking.id, direction: 'out', text: agency.telegramWelcome, fromName: 'Bot' },
        });
      } catch { /* ignore send failure */ }
    }
    // Yangi mijozdan yo'nalishni SO'RAYMIZ — javob lidga yoziladi va agent
    // taklif yaratganda mos tur avtomatik tanlanadi. Tugmalar agentlikning
    // o'z turlaridan quriladi; turi bo'lmasa savol berilmaydi.
    if (isNew && !booking.leadTour) {
      const tours = await prisma.tour.findMany({
        where: { agencyId: agency.id, active: true },
        select: { city: true, destinationCountry: true },
        take: 40,
      });
      const seen = new Set();
      const dests = [];
      for (const t of tours) {
        const label = String(t.city || t.destinationCountry || '').trim();
        if (!label || label.length > 40 || seen.has(label.toLowerCase())) continue;
        seen.add(label.toLowerCase());
        dests.push(label);
        if (dests.length >= 8) break;
      }
      if (dests.length) {
        const rows = [];
        for (let i = 0; i < dests.length; i += 2) {
          rows.push(dests.slice(i, i + 2).map((d) => ({ text: d, callback_data: `dest:${d}`.slice(0, 64) })));
        }
        const ask = 'Qaysi yoʻnalish sizni qiziqtiradi?';
        try {
          await tg.sendMessage(agency.telegramBotToken, chatId, ask, {
            reply_markup: { inline_keyboard: rows },
          });
          await prisma.telegramMessage.create({
            data: { agencyId: agency.id, bookingId: booking.id, direction: 'out', text: ask, fromName: 'Bot' },
          });
        } catch { /* ignore send failure */ }
      }
    }

    if (cmdReply) {
      try {
        await tg.sendMessage(agency.telegramBotToken, chatId, cmdReply);
        await prisma.telegramMessage.create({
          data: { agencyId: agency.id, bookingId: booking.id, direction: 'out', text: cmdReply, fromName: 'Bot' },
        });
      } catch { /* ignore send failure */ }
    }

    return res.status(200).json({ ok: true });
  } catch {
    // Telegram'ga har doim 200 qaytaramiz — aks holda u qayta-qayta yuboradi
    return res.status(200).json({ ok: true });
  }
}

async function broadcast(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!agency.telegramBotToken || !agency.telegramBotActive) return error(res, 'Telegram bot ulanmagan', 400);
    const text = String((req.body && req.body.text) || '').trim();
    if (!text) return error(res, 'Xabar bosh', 400);
    if (text.length > 3000) return error(res, 'Xabar juda uzun (maks 3000 belgi)', 400);

    // Ixtiyoriy: bosqich bo'yicha filtr
    const stage = String((req.body && req.body.stage) || '').trim();
    const where = { agencyId: agency.id, telegramChatId: { not: null } };
    if (['new', 'contacted', 'quoted', 'won', 'completed', 'lost'].includes(stage)) where.pipelineStage = stage;

    const targets = await prisma.tourBooking.findMany({ where, select: { id: true, telegramChatId: true } });

    let sent = 0;
    let failed = 0;
    const seen = new Set();
    for (const t of targets) {
      if (!t.telegramChatId || seen.has(t.telegramChatId)) continue;
      seen.add(t.telegramChatId);
      try {
        await tg.sendMessage(agency.telegramBotToken, t.telegramChatId, text);
        await prisma.telegramMessage.create({
          data: { agencyId: agency.id, bookingId: t.id, direction: 'out', text, fromName: 'Broadcast' },
        });
        sent += 1;
      } catch {
        failed += 1;
      }
      await new Promise((r) => setTimeout(r, 40)); // ~25 xabar/sek — Telegram limitidan past
    }
    return success(res, { total: seen.size, sent, failed });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = { getTelegram, connectTelegram, disconnectTelegram, setWelcome, setBirthdayTemplate, getProfile, setProfile, getConfig, setConfig, listMessages, reply, broadcast, webhook };
