// Yangi agentliklar uchun bepul sinov muddati (TRIAL_DAYS, standart 14 kun).
//
// Qoidalar (resolveAccess — config/agencyPlans.js):
//   • trialEndsAt NULL va obuna yo'q   → grandfathered (bugungi "unlimited" saqlanadi)
//   • trialEndsAt > hozir              → Pro darajasidagi to'liq kirish
//   • trialEndsAt <= hozir, obuna yo'q → faqat o'qish (402 SUBSCRIPTION_EXPIRED)
//   • to'lovli obuna har doim ustun
//
// Eslatmalar har kuni 10:00 (Toshkent) dan keyin: tugashiga 3 kun qolganda va
// tugash kuni. Idempotent — `trialReminderStage` atomik "claim" qilinadi.
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { trialDays } = require('../config/env');
const tg = require('./telegram.service');
const { sendTrialReminderEmail } = require('./email.service');

const DAY_MS = 86400000;
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const REMINDER_HOUR = 10;
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');
const BILLING_URL = `${SITE_URL}/agency`;

function newTrialEndsAt(now = new Date()) {
  return new Date(new Date(now).getTime() + trialDays() * DAY_MS);
}

// Toshkent kalendar kunlari farqi: tugash sanasi − bugungi sana (0 = bugun tugaydi).
function localDayDiff(endsAt, now) {
  const day = (d) => Math.floor((new Date(d).getTime() + TZ_OFFSET_MS) / DAY_MS);
  return day(endsAt) - day(now);
}

function formatDay(value) {
  const t = new Date(new Date(value).getTime() + TZ_OFFSET_MS);
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}.${t.getUTCFullYear()}`;
}

/** Shu agentlik uchun hozir qaysi eslatma kerak (1 | 2) yoki null. Sof funksiya. */
function reminderStageFor(agency, now = new Date()) {
  if (!agency || !agency.trialEndsAt || agency.tariffId || agency.subscriptionUntil) return null;
  const diff = localDayDiff(agency.trialEndsAt, now);
  const stage = Number(agency.trialReminderStage || 0);
  if (diff <= 0 && stage < 2) return 2;
  if (diff >= 1 && diff <= 3 && stage < 1) return 1;
  return null;
}

function reminderMessage(stage, agency, now = new Date()) {
  const ends = new Date(agency.trialEndsAt);
  const diff = localDayDiff(ends, now);
  if (stage === 1) {
    return {
      heading: `Sinov muddati: ${diff} kun qoldi`,
      body: `TravelorAI CRM sinov muddati ${formatDay(ends)} kuni tugaydi.\n`
        + 'Lidlar, mijozlar va Telegram xabarnomalari uzilmasligi uchun hozir tarif tanlang — barcha ma’lumotlaringiz saqlanadi.',
    };
  }
  const endedAlready = ends.getTime() <= now.getTime();
  return {
    heading: endedAlready ? 'Sinov muddati tugadi' : 'Sinov muddati bugun tugaydi',
    body: endedAlready
      ? 'Ma’lumotlaringiz saqlangan, lekin CRM hozir faqat o‘qish rejimida. Davom etish uchun tarif tanlang — to‘lovdan so‘ng kabinet darhol ochiladi.'
      : `Sinov muddati bugun ${formatDay(ends)} tugaydi. Ma’lumotlaringiz saqlanadi — ishni to‘xtatmaslik uchun tarif tanlang.`,
  };
}

async function deliverReminder(agency, stage, now) {
  const msg = reminderMessage(stage, agency, now);
  const jobs = [];
  if (agency.notifyChatId && agency.telegramBotToken && agency.telegramBotActive) {
    jobs.push(tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, `⏳ ${msg.heading}\n\n${msg.body}`, {
      reply_markup: { inline_keyboard: [[{ text: 'Tarif tanlash', url: BILLING_URL }]] },
      disable_web_page_preview: true,
    }));
  }
  const email = agency.ownerAccount && agency.ownerAccount.email;
  if (email) jobs.push(sendTrialReminderEmail({ email, agencyName: agency.name, heading: msg.heading, body: msg.body, ctaUrl: BILLING_URL }));
  const results = await Promise.allSettled(jobs);
  return results.filter((r) => r.status === 'fulfilled').length;
}

/** Kunlik ish: 10:00 (Toshkent) dan keyin har chaqiruvda xavfsiz (idempotent). */
async function runTrialReminders(now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  if (local.getUTCHours() < REMINDER_HOUR) return { sent: 0, skipped: 'before_hour' };
  const agencies = await prisma.tourAgency.findMany({
    where: {
      active: true,
      tariffId: null,
      subscriptionUntil: null,
      trialReminderStage: { lt: 2 },
      // 3 kunlik oyna + chekka kun; juda eski sinovlarni bezovta qilmaymiz.
      trialEndsAt: { not: null, lte: new Date(now.getTime() + 4 * DAY_MS), gte: new Date(now.getTime() - 14 * DAY_MS) },
    },
    select: {
      id: true, name: true, trialEndsAt: true, trialReminderStage: true, tariffId: true, subscriptionUntil: true,
      notifyChatId: true, telegramBotToken: true, telegramBotActive: true,
      ownerAccount: { select: { email: true } },
    },
    take: 500,
  });
  let sent = 0;
  for (const agency of agencies) {
    const stage = reminderStageFor(agency, now);
    if (!stage) continue;
    // Atomik claim: parallel ishga tushgan ikkinchi nusxa (yoki qayta urinish) takror yubormaydi.
    const claimed = await prisma.tourAgency.updateMany({
      where: { id: agency.id, trialReminderStage: { lt: stage } },
      data: { trialReminderStage: stage },
    });
    if (!claimed.count) continue;
    try {
      await deliverReminder(agency, stage, now);
      sent += 1;
    } catch (err) {
      logger.warn('[trial] eslatma yuborilmadi', { agencyId: agency.id, message: err && err.message });
    }
  }
  return { sent };
}

/**
 * Admin: sinovni N kunga uzaytirish. Muddat o'tgan bo'lsa — bugundan, aks holda
 * joriy tugash sanasidan hisoblanadi. Eslatmalar qayta yuborilishi uchun bosqich 0.
 */
async function extendTrial(agencyId, days, now = new Date()) {
  const n = Math.trunc(Number(days));
  if (!Number.isFinite(n) || n < 1 || n > 90) {
    const err = new Error('days 1..90 oralig‘ida bo‘lishi kerak');
    err.status = 400;
    throw err;
  }
  const agency = await prisma.tourAgency.findUnique({ where: { id: String(agencyId) }, select: { id: true, trialEndsAt: true } });
  if (!agency) {
    const err = new Error('Agentlik topilmadi');
    err.status = 404;
    throw err;
  }
  // Grandfathered (sinovsiz, cheklovsiz) agentlikni sinovga aylantirib qo'ymaymiz.
  if (!agency.trialEndsAt) {
    const err = new Error('Bu agentlikda sinov muddati yo‘q (eski, cheklovsiz agentlik)');
    err.status = 400;
    throw err;
  }
  const current = agency.trialEndsAt ? new Date(agency.trialEndsAt).getTime() : 0;
  const base = Math.max(current, now.getTime());
  const trialEndsAt = new Date(base + n * DAY_MS);
  return prisma.tourAgency.update({
    where: { id: agency.id },
    data: { trialEndsAt, trialReminderStage: 0 },
    select: { id: true, name: true, trialEndsAt: true, trialReminderStage: true },
  });
}

module.exports = {
  REMINDER_HOUR,
  newTrialEndsAt,
  localDayDiff,
  reminderStageFor,
  reminderMessage,
  runTrialReminders,
  extendTrial,
};
