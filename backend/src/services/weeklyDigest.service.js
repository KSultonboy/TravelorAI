// Haftalik egasi hisoboti — har dushanba 09:00 (Toshkent) agentlikning Telegram
// xabarnoma chatiga: oxirgi 7 kun lidlari (manba bo'yicha), birinchi javob
// medianasi, yopilgan bitimlar + tushum, muddati o'tgan vazifalar va bitta
// amaliy maslahat. 2+ hafta faolsiz agentlikka bitta "sizni sog'indik" xabari
// yuboriladi, keyin u faollashguncha jim turamiz.
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const tg = require('./telegram.service');
const { getSettings } = require('./crmAutomation.service');
const { profitAndLoss } = require('./executiveReports.service');
const { sourceLabel } = require('./leadAlert.service');

const DAY_MS = 86400000;
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const DIGEST_WEEKDAY = 1; // dushanba
const DIGEST_HOUR = 9;
const IDLE_DAYS = 14;
const TEST_LIMIT_PER_DAY = 3;
const WON_STAGES = ['won', 'completed'];
const OPEN_STAGES = ['new', 'contacted', 'quoted'];
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

const toLocal = (d) => new Date(new Date(d).getTime() + TZ_OFFSET_MS);
const ymdLocal = (d) => toLocal(d).toISOString().slice(0, 10);
const time = (v) => (v ? new Date(v).getTime() : NaN);
const inRange = (v, from, to) => { const t = time(v); return !Number.isNaN(t) && t >= from && t <= to; };
const closedAt = (b) => b.completedAt || b.confirmedAt || b.updatedAt || null;

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function addMoney(map, currency, amount) {
  const cur = String(currency || 'USD').toUpperCase();
  map[cur] = (map[cur] || 0) + Math.max(0, Number(amount) || 0);
}

/**
 * Sof hisob (testlanadi). Kiruvchi massivlar agentlik bo'yicha allaqachon filtrlangan.
 * bookings: { createdAt, firstResponseAt, source, pipelineStage, archived, confirmedAt, completedAt, updatedAt, paidAmount, totalEstimate, currency }
 * tasks: { dueAt, completedAt } · transactions: FinanceTransaction (income/paid)
 */
function computeDigest({ bookings = [], tasks = [], transactions = [], now = new Date(), periodDays = 7 } = {}) {
  const to = new Date(now).getTime();
  const from = to - periodDays * DAY_MS;

  const newLeads = bookings.filter((b) => inRange(b.createdAt, from, to));
  const bySource = {};
  for (const b of newLeads) {
    const key = String(b.source || 'other').toLowerCase();
    bySource[key] = (bySource[key] || 0) + 1;
  }
  const responseMinutes = newLeads
    .filter((b) => b.firstResponseAt)
    .map((b) => (time(b.firstResponseAt) - time(b.createdAt)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0);
  const med = median(responseMinutes);

  const won = bookings.filter((b) => WON_STAGES.includes(b.pipelineStage) && inRange(closedAt(b), from, to));

  // Tushum — rahbar hisobotidagi P&L (to'langan kirimlar) bilan bir xil manba.
  const revenue = {};
  const currencies = Array.from(new Set(transactions.map((t) => String(t.currency || 'USD').toUpperCase())));
  for (const currency of currencies) {
    const pnl = profitAndLoss(transactions.map((t) => ({ ...t, currency: String(t.currency || 'USD').toUpperCase() })), { currency, from: new Date(from), to: new Date(to) });
    if (pnl.income) revenue[currency] = pnl.income;
  }
  // Moliya moduli ishlatilmasa — yopilgan bitimlar summasidan.
  if (!Object.keys(revenue).length) {
    for (const b of won) addMoney(revenue, b.currency, b.paidAmount || b.totalEstimate || 0);
    for (const k of Object.keys(revenue)) if (!revenue[k]) delete revenue[k];
  }

  const overdueTasks = tasks.filter((t) => !t.completedAt && t.dueAt && time(t.dueAt) < to).length;
  const unanswered24h = bookings.filter((b) => !b.archived && OPEN_STAGES.includes(b.pipelineStage || 'new')
    && !b.firstResponseAt && time(b.createdAt) <= to - DAY_MS).length;

  const digest = {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    newLeads: newLeads.length,
    bySource,
    medianFirstResponseMinutes: med == null ? null : Math.round(med),
    respondedLeads: responseMinutes.length,
    wonDeals: won.length,
    revenue,
    overdueTasks,
    unanswered24h,
  };
  digest.tip = pickTip(digest);
  return digest;
}

function pickTip(d) {
  if (d.unanswered24h > 0) return `${d.unanswered24h} ta lid 24 soatdan beri javobsiz — bugun ular bilan bog‘laning, aks holda raqobatchiga ketadi.`;
  if (d.overdueTasks > 0) return `${d.overdueTasks} ta vazifa muddati o‘tgan — ertalab 15 daqiqa ajratib ularni yoping yoki muddatini yangilang.`;
  if (d.medianFirstResponseMinutes != null && d.medianFirstResponseMinutes > 30) {
    return `Birinchi javob o‘rtacha ${formatMinutes(d.medianFirstResponseMinutes)}. Telegram’dagi «✅ Qabul qildim» tugmasi bilan 15 daqiqagacha tushirsangiz, sotuv sezilarli oshadi.`;
  }
  if (d.newLeads === 0) return 'Bu hafta yangi lid kelmadi — Instagram va Telegram kanalingizda eng mashhur turingiz haqida post joylang.';
  if (d.wonDeals === 0) return 'Lidlar bor, lekin yopilgan bitim yo‘q — «Taklif yuborildi» bosqichidagi mijozlarga qayta qo‘ng‘iroq qiling.';
  return 'Ajoyib hafta! Mamnun mijozlardan sharh so‘rashni unutmang — bu yangi lidlarni oshiradi.';
}

function formatMinutes(m) {
  if (m == null) return '—';
  if (m < 60) return `${Math.round(m)} daq.`;
  if (m < 1440) { const h = Math.floor(m / 60); const r = Math.round(m % 60); return r ? `${h} soat ${r} daq.` : `${h} soat`; }
  return `${Math.round(m / 1440)} kun`;
}

function formatAmount(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDay(value) {
  const t = toLocal(value);
  return `${String(t.getUTCDate()).padStart(2, '0')}.${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatDigest(agencyName, d, { test = false } = {}) {
  const sources = Object.entries(d.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${sourceLabel(k)}: ${v}`).join(' · ');
  const revenue = Object.entries(d.revenue).map(([cur, v]) => `${formatAmount(v)} ${cur}`).join(' · ');
  return [
    `📊 Haftalik hisobot${test ? ' (sinov)' : ''} · ${String(agencyName || '').slice(0, 80)}`,
    `${formatDay(d.from)} – ${formatDay(d.to)}`,
    '',
    `🆕 Yangi lidlar: ${d.newLeads}`,
    sources ? `   ${sources}` : null,
    `⏱ Birinchi javob (mediana): ${d.medianFirstResponseMinutes == null ? '—' : formatMinutes(d.medianFirstResponseMinutes)}`,
    `🏆 Yopilgan bitimlar: ${d.wonDeals}`,
    `💰 Tushum: ${revenue || '—'}`,
    `⚠️ Muddati o‘tgan vazifalar: ${d.overdueTasks}`,
    '',
    `💡 ${d.tip}`,
  ].filter((line) => line !== null).join('\n');
}

const IDLE_TEXT = (name) => [
  `👋 ${String(name || '').slice(0, 80)}, sizni sog‘indik!`,
  '',
  'Ikki haftadan beri CRM’da faollik ko‘rinmadi. Yangi lidlar Telegram, Instagram va saytdan kelganda shu yerga darhol xabar beramiz.',
  'Qaytib kelganingizda haftalik hisobot yana yuboriladi.',
].join('\n');

/* ───────── ma'lumotlar bazasi qatlami ───────── */

async function loadDigestData(agencyId, now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const [bookings, tasks, transactions] = await Promise.all([
    prisma.tourBooking.findMany({
      where: {
        agencyId,
        OR: [
          { createdAt: { gte: since30 } },
          { pipelineStage: { in: WON_STAGES }, updatedAt: { gte: since7 } },
        ],
      },
      select: {
        id: true, createdAt: true, updatedAt: true, firstResponseAt: true, source: true, pipelineStage: true,
        archived: true, confirmedAt: true, completedAt: true, paidAmount: true, totalEstimate: true, currency: true,
      },
      take: 5000,
    }),
    prisma.crmTask.findMany({
      where: { agencyId, completedAt: null, dueAt: { lt: now } },
      select: { id: true, dueAt: true, completedAt: true },
      take: 2000,
    }),
    prisma.financeTransaction.findMany({
      where: {
        agencyId, direction: 'income', status: 'paid',
        OR: [{ paidAt: { gte: since7 } }, { paidAt: null, createdAt: { gte: since7 } }],
      },
      select: { amount: true, currency: true, direction: true, status: true, paidAt: true, createdAt: true, supplierId: true, managerMemberId: true, category: true },
      take: 5000,
    }),
  ]);
  return { bookings, tasks, transactions };
}

// Oxirgi "inson" faolligi: yangi lid, lid tarixi yozuvi, bajarilgan vazifa, birinchi javob.
async function lastActivityAt(agencyId) {
  const [booking, activity, task, responded] = await Promise.all([
    prisma.tourBooking.findFirst({ where: { agencyId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.leadActivity.findFirst({ where: { agencyId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.crmTask.findFirst({ where: { agencyId, completedAt: { not: null } }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
    prisma.tourBooking.findFirst({ where: { agencyId, firstResponseAt: { not: null } }, orderBy: { firstResponseAt: 'desc' }, select: { firstResponseAt: true } }),
  ]);
  const times = [booking?.createdAt, activity?.createdAt, task?.completedAt, responded?.firstResponseAt]
    .map(time).filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)) : null;
}

function isIdle(last, now = new Date()) {
  return !last || now.getTime() - new Date(last).getTime() >= IDLE_DAYS * DAY_MS;
}

function crmButton() {
  return { inline_keyboard: [[{ text: 'CRM’ni ochish', url: `${SITE_URL}/agency` }]] };
}

async function sendDigest(agency, now = new Date(), { test = false } = {}) {
  const data = await loadDigestData(agency.id, now);
  const digest = computeDigest({ ...data, now });
  await tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, formatDigest(agency.name, digest, { test }), {
    reply_markup: crmButton(), disable_web_page_preview: true,
  });
  return digest;
}

/** Dushanba 09:00 dan keyin har chaqiruvda xavfsiz — haftasiga bir marta (atomik claim). */
async function runWeeklyDigests(now = new Date()) {
  const local = toLocal(now);
  if (local.getUTCDay() !== DIGEST_WEEKDAY || local.getUTCHours() < DIGEST_HOUR) return { sent: 0, skipped: 'not_time' };
  const agencies = await prisma.tourAgency.findMany({
    where: {
      active: true, approvalStatus: 'approved', telegramBotActive: true,
      notifyChatId: { not: null }, telegramBotToken: { not: null },
    },
    select: {
      id: true, name: true, notifyChatId: true, telegramBotToken: true,
      crmSettings: { select: { weeklyDigestEnabled: true, weeklyDigestLastSentAt: true, digestIdleNotifiedAt: true } },
    },
    take: 1000,
  });
  const cutoff = new Date(now.getTime() - 6 * DAY_MS);
  let sent = 0; let idle = 0;
  for (const agency of agencies) {
    try {
      const settings = agency.crmSettings || await getSettings(agency.id);
      if (settings.weeklyDigestEnabled === false) continue;
      if (settings.weeklyDigestLastSentAt && new Date(settings.weeklyDigestLastSentAt) > cutoff) continue;

      const last = await lastActivityAt(agency.id);
      const idleNow = isIdle(last, now);
      // "Sog'indik" xabari bir marta: oxirgi faollikdan keyin allaqachon yuborilgan bo'lsa — jim.
      if (idleNow && settings.digestIdleNotifiedAt && (!last || new Date(settings.digestIdleNotifiedAt) >= last)) continue;

      const claimed = await prisma.agencyCrmSettings.updateMany({
        where: { agencyId: agency.id, OR: [{ weeklyDigestLastSentAt: null }, { weeklyDigestLastSentAt: { lte: cutoff } }] },
        data: { weeklyDigestLastSentAt: now, digestIdleNotifiedAt: idleNow ? now : null },
      });
      if (!claimed.count) continue;

      if (idleNow) {
        await tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, IDLE_TEXT(agency.name), { reply_markup: crmButton() });
        idle += 1;
      } else {
        await sendDigest(agency, now);
        sent += 1;
      }
    } catch (err) {
      logger.warn('[digest] yuborilmadi', { agencyId: agency.id, message: err && err.message });
    }
  }
  return { sent, idle };
}

/**
 * "Hozir yuborish (sinov)" — kuniga 3 marta (Toshkent kuni). Limit atomik:
 * yangi kun → hisoblagich 1; aks holda faqat < 3 bo'lsa oshiriladi.
 */
async function sendTestDigest(agency, now = new Date()) {
  if (!agency.notifyChatId || !agency.telegramBotToken || !agency.telegramBotActive) {
    const err = new Error('Telegram xabarnoma chati ulanmagan. CRM → Telegram bo‘limida /xabarnoma kodini botga yuboring.');
    err.status = 400; err.code = 'NOTIFY_CHAT_MISSING';
    throw err;
  }
  await getSettings(agency.id);
  const today = ymdLocal(now);
  let claimed = await prisma.agencyCrmSettings.updateMany({
    where: { agencyId: agency.id, OR: [{ digestTestDay: null }, { digestTestDay: { not: today } }] },
    data: { digestTestDay: today, digestTestCount: 1 },
  });
  if (!claimed.count) {
    claimed = await prisma.agencyCrmSettings.updateMany({
      where: { agencyId: agency.id, digestTestDay: today, digestTestCount: { lt: TEST_LIMIT_PER_DAY } },
      data: { digestTestCount: { increment: 1 } },
    });
  }
  if (!claimed.count) {
    const err = new Error(`Sinov hisobotini kuniga ${TEST_LIMIT_PER_DAY} marta yuborish mumkin. Ertaga qayta urinib ko‘ring.`);
    err.status = 429; err.code = 'DIGEST_TEST_LIMIT';
    throw err;
  }
  return sendDigest(agency, now, { test: true });
}

function testsLeftToday(settings, now = new Date()) {
  if (!settings || settings.digestTestDay !== ymdLocal(now)) return TEST_LIMIT_PER_DAY;
  return Math.max(0, TEST_LIMIT_PER_DAY - Number(settings.digestTestCount || 0));
}

module.exports = {
  TEST_LIMIT_PER_DAY,
  IDLE_DAYS,
  computeDigest,
  formatDigest,
  formatMinutes,
  median,
  isIdle,
  lastActivityAt,
  loadDigestData,
  runWeeklyDigests,
  sendTestDigest,
  testsLeftToday,
};
