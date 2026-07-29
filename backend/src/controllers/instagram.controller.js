const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');
const ig = require('../services/instagram.service');

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

/* ============ AGENTLIK TOMONI (auth talab qiladi) ============ */

async function getInstagram(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    return success(res, {
      // Meta kalitlari .env'ga qo'yilmaguncha UI «Ulash» tugmasini ko'rsatmaydi,
      // aks holda agent bosib 500 xatoga uchrardi.
      configured: ig.isConfigured(),
      connected: !!(agency.instagramActive && agency.instagramToken),
      username: agency.instagramUsername || null,
      welcome: agency.instagramWelcome || '',
      expiresAt: agency.instagramTokenExpiresAt || null,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

/**
 * Ulash tugmasi shu manzilni oladi va brauzerda ochadi.
 * To'g'ridan-to'g'ri redirect qilmaymiz: agentlik API'si Authorization
 * header'i bilan ishlaydi, oddiy navigatsiyada esa u header ketmaydi.
 */
async function authorize(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    if (!ig.isConfigured()) return error(res, 'Instagram integratsiyasi hali sozlanmagan', 503);
    return success(res, { url: ig.authorizeUrl(ig.signState(agency.id)) });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function disconnectInstagram(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res);
    if (!agency) return;
    // /data-deletion sahifasida «uzganda token darhol o'chiriladi» deb
    // yozilgan — shuni bajaramiz: token ham, akkaunt izlari ham qoladi.
    await prisma.tourAgency.update({
      where: { id: agency.id },
      data: {
        instagramActive: false,
        instagramToken: null,
        instagramTokenExpiresAt: null,
        instagramUserId: null,
        instagramUsername: null,
      },
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
    const text = String((req.body && req.body.text) || '').trim().slice(0, 900);
    await prisma.tourAgency.update({ where: { id: agency.id }, data: { instagramWelcome: text || null } });
    return success(res, { welcome: text });
  } catch (err) {
    return error(res, err.message, 400);
  }
}

/* ============ OAUTH CALLBACK (auth yo'q — state imzosi bilan) ============ */

function closeWindow(res, ok, message) {
  const url = `${SITE_URL}/agency?ig=${ok ? 'ok' : 'err'}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Ulanish tizim brauzerida ochiladi (desktop ilovada ham), shuning uchun
  // foydalanuvchini CRM'ga qaytaramiz — u yerda holat qayta yuklanadi.
  return res.status(200).send(`<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Instagram</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b2a1e;color:#eef5f0;
display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;line-height:1.6}
.c{max-width:420px}h1{font-size:1.25rem;margin:0 0 8px}p{color:#a3b7ac;margin:0 0 20px;font-size:.95rem}
a{display:inline-block;background:#34c46e;color:#06251a;text-decoration:none;font-weight:700;
padding:12px 22px;border-radius:12px}</style></head><body><div class="c">
<h1>${ok ? 'Instagram ulandi ✓' : 'Ulab bo‘lmadi'}</h1>
<p>${message}</p><a href="${url}">CRM&apos;ga qaytish</a></div></body></html>`);
}

async function callback(req, res) {
  try {
    if (req.query.error) {
      return closeWindow(res, false, 'Ruxsat berilmadi. Qayta urinib ko‘ring.');
    }
    const agencyId = ig.verifyState(req.query.state);
    if (!agencyId) return closeWindow(res, false, 'So‘rov imzosi noto‘g‘ri. Ulashni CRM ichidan qaytadan boshlang.');

    const agency = await prisma.tourAgency.findUnique({ where: { id: agencyId } });
    if (!agency) return closeWindow(res, false, 'Agentlik topilmadi.');

    const code = String(req.query.code || '');
    if (!code) return closeWindow(res, false, 'Instagram kod qaytarmadi.');

    const short = await ig.exchangeCode(code);
    const long = await ig.exchangeLongLived(short.accessToken);
    const me = await ig.getMe(long.accessToken);

    await prisma.tourAgency.update({
      where: { id: agency.id },
      data: {
        instagramUserId: me.userId || short.userId,
        instagramUsername: me.username || null,
        instagramToken: long.accessToken,
        instagramTokenExpiresAt: long.expiresIn ? new Date(Date.now() + long.expiresIn * 1000) : null,
        instagramActive: true,
      },
    });
    return closeWindow(res, true, `@${me.username || 'akkaunt'} ulandi. Endi Direct xabarlar CRM'da lid bo‘lib chiqadi.`);
  } catch (err) {
    return closeWindow(res, false, err.message || 'Kutilmagan xato.');
  }
}

/* ============ WEBHOOK (auth yo'q — imzo bilan) ============ */

function webhookVerify(req, res) {
  const challenge = ig.verifyChallenge(req.query || {});
  if (challenge === null) return res.status(403).send('forbidden');
  return res.status(200).send(challenge);
}

async function handleMessage(agency, event) {
  const senderId = String((event.sender && event.sender.id) || '');
  const text = String((event.message && event.message.text) || '').slice(0, 4000);
  if (!senderId || !text) return;

  const profile = await ig.getSenderProfile(agency.instagramToken, senderId);
  const uname = profile.username ? `@${profile.username}` : null;
  const displayName = profile.name || profile.username || 'Instagram mijoz';

  let booking = await prisma.tourBooking.findFirst({
    where: { agencyId: agency.id, instagramUserId: senderId },
  });
  const isNew = !booking;
  if (!booking) {
    booking = await prisma.tourBooking.create({
      data: {
        agencyId: agency.id,
        tourId: null,
        customerName: displayName,
        message: text,
        instagramUserId: senderId,
        instagramUsername: profile.username || null,
        travelers: 1,
        currency: 'USD',
        source: 'instagram',
        utmSource: 'instagram',
        utmMedium: 'direct',
        status: 'pending',
        pipelineStage: 'new',
      },
    });
  }

  await prisma.telegramMessage.create({
    data: {
      agencyId: agency.id,
      bookingId: booking.id,
      channel: 'instagram',
      direction: 'in',
      text,
      fromName: uname || displayName,
    },
  });

  // Salomlashish faqat BIRINCHI xabarda — Instagram'da 24 soatlik oyna bor,
  // birinchi xabar doim oyna ichida bo'ladi, shuning uchun bu xavfsiz.
  if (isNew && agency.instagramWelcome) {
    try {
      await ig.sendMessage(agency.instagramToken, agency.instagramUserId, senderId, agency.instagramWelcome);
      await prisma.telegramMessage.create({
        data: {
          agencyId: agency.id, bookingId: booking.id, channel: 'instagram',
          direction: 'out', text: agency.instagramWelcome, fromName: 'Avto',
        },
      });
    } catch { /* yuborilmasa ham lid saqlanib qoladi */ }
  }
}

async function webhook(req, res) {
  // Metaga DOIM 200 qaytaramiz: aks holda u qayta-qayta yuboraveradi va
  // oxir-oqibat obunani o'chirib qo'yadi.
  try {
    if (!ig.verifySignature(req.rawBody, req.get('x-hub-signature-256'))) {
      return res.status(403).json({ ok: false });
    }
    const body = req.body || {};
    if (body.object !== 'instagram') return res.status(200).json({ ok: true });

    for (const entry of Array.isArray(body.entry) ? body.entry : []) {
      const events = Array.isArray(entry.messaging) ? entry.messaging : [];
      if (!events.length) continue;

      // recipient.id — bizning (agentlikning) IG akkaunt id'si.
      const accountId = String((events[0].recipient && events[0].recipient.id) || entry.id || '');
      if (!accountId) continue;
      const agency = await prisma.tourAgency.findFirst({
        where: { instagramUserId: accountId, instagramActive: true },
      });
      if (!agency || !agency.instagramToken) continue;

      for (const event of events) {
        // is_echo — bu bizning o'zimiz yuborgan xabarimizning aks-sadosi.
        // Filtrlanmasa har javob ikki marta yozilardi.
        if (event.message && event.message.is_echo) continue;
        if (!event.message) continue;
        await handleMessage(agency, event).catch(() => {});
      }
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true });
  }
}

/* ============ JAVOB YUBORISH (telegram.controller.reply shu yerdan chaqiradi) ============ */

/**
 * Instagram lidiga javob. 24 soatlik oyna tugagan bo'lsa Meta 400 qaytaradi —
 * xatoni agentga tushunarli qilib aytamiz, chunki bu eng ko'p uchraydigan holat.
 */
async function sendReply(agency, booking, text) {
  if (!agency.instagramActive || !agency.instagramToken) {
    throw new Error('Instagram ulanmagan');
  }
  try {
    await ig.sendMessage(agency.instagramToken, agency.instagramUserId, booking.instagramUserId, text);
  } catch (err) {
    const m = String(err.message || '');
    if (/24|window|outside|allowed window/i.test(m)) {
      throw new Error('Instagram 24 soatlik javob oynasi yopilgan — mijoz qayta yozmaguncha Direct orqali javob berib bo‘lmaydi.');
    }
    throw err;
  }
}

module.exports = {
  getInstagram,
  authorize,
  disconnectInstagram,
  setWelcome,
  callback,
  webhookVerify,
  webhook,
  sendReply,
};
