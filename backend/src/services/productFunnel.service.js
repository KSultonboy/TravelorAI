// Voronka hisob-kitobi (sof funksiya — DB'ga murojaat qilmaydi, test qilinadi).
const { FUNNEL_STEPS } = require('./productEvents.service');

const DAY_MS = 86400000;
// Anonim (brauzer) qadamlar — unikal hisob = hodisalar soni.
const ANONYMOUS_STEPS = new Set(['landing_view', 'agency_signup_started']);
const IDENTIFIED_STEPS = FUNNEL_STEPS.filter((name) => !ANONYMOUS_STEPS.has(name));

const STEP_LABELS = Object.freeze({
  landing_view: 'Landing ko‘rildi',
  agency_signup_started: 'Ro‘yxatdan o‘tish boshlandi',
  agency_registered: 'Akkaunt yaratildi',
  agency_email_verified: 'Email tasdiqlandi',
  agency_application_submitted: 'Ariza yuborildi',
  agency_approved: 'Admin tasdiqladi',
  telegram_bot_connected: 'Telegram bot ulandi',
  first_tour_published: 'Birinchi tur e’lon qilindi',
  lead_created: 'Lid yaratildi',
  offer_sent: 'Taklif yuborildi',
  offer_opened: 'Taklif ochildi',
  lead_won: 'Bitim yopildi',
  checkout_started: 'To‘lov boshlandi',
  subscription_paid: 'Obuna to‘landi',
});

function pct(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function ts(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {object} input
 * @param {number} input.days      oyna (kun)
 * @param {Date}   input.now
 * @param {Record<string, number>} input.counts  hodisa nomi → jami soni (oyna ichida)
 * @param {{name:string, agencyId?:string|null, userId?:string|null, createdAt:Date|string}[]} input.events
 *        oyna ichidagi identifikatsiyalangan hodisalar
 * @param {{id:string, ownerAccountId:string|null}[]} input.agencies  ro'yxatdan o'tgan akkauntlar agentliklari
 */
function computeFunnel({ days, now = new Date(), counts = {}, events = [], agencies = [] }) {
  const nowMs = ts(now) ?? Date.now();

  // Qadam bo'yicha unikal ishtirokchilar (agentlik, bo'lmasa akkaunt).
  const uniques = new Map(FUNNEL_STEPS.map((name) => [name, new Set()]));
  for (const e of events) {
    const set = uniques.get(e.name);
    const actor = e.agencyId || e.userId;
    if (set && actor) set.add(actor);
  }

  const steps = FUNNEL_STEPS.map((name, index) => {
    const count = Number(counts[name] || 0);
    const unique = ANONYMOUS_STEPS.has(name) ? count : uniques.get(name).size;
    return { key: name, label: STEP_LABELS[name] || name, index, count, unique };
  });
  steps.forEach((step, i) => {
    step.conversionFromPrev = i === 0 ? null : pct(step.unique, steps[i - 1].unique);
  });

  // Akkaunt → agentlik: TourAgency.ownerAccountId va agency_approved (ikkala id bor).
  const agencyByUser = new Map();
  for (const a of agencies) if (a.ownerAccountId) agencyByUser.set(a.ownerAccountId, a.id);
  for (const e of events) {
    if (e.name === 'agency_approved' && e.userId && e.agencyId && !agencyByUser.has(e.userId)) agencyByUser.set(e.userId, e.agencyId);
  }

  // Agentlik bo'yicha birinchi lid / birinchi to'lov vaqti.
  const firstAt = (name) => {
    const map = new Map();
    for (const e of events) {
      if (e.name !== name || !e.agencyId) continue;
      const t = ts(e.createdAt);
      if (t === null) continue;
      if (!map.has(e.agencyId) || t < map.get(e.agencyId)) map.set(e.agencyId, t);
    }
    return map;
  };
  const firstLead = firstAt('lead_created');
  const firstPaid = firstAt('subscription_paid');

  // Kohorta: oynada ro'yxatdan o'tgan akkauntlar (har biri bir marta, eng erta vaqt).
  const registeredAt = new Map();
  for (const e of events) {
    if (e.name !== 'agency_registered' || !e.userId) continue;
    const t = ts(e.createdAt);
    if (t === null) continue;
    if (!registeredAt.has(e.userId) || t < registeredAt.get(e.userId)) registeredAt.set(e.userId, t);
  }

  const headline = (firstMap, windowDays) => {
    let converted = 0;
    let matured = 0;
    for (const [userId, regAt] of registeredAt) {
      if (nowMs - regAt >= windowDays * DAY_MS) matured += 1;
      const agencyId = agencyByUser.get(userId);
      const at = agencyId ? firstMap.get(agencyId) : undefined;
      if (at !== undefined && at - regAt <= windowDays * DAY_MS) converted += 1;
    }
    const cohort = registeredAt.size;
    return { windowDays, cohort, matured, converted, pct: pct(converted, cohort) };
  };

  return {
    days,
    from: new Date(nowMs - days * DAY_MS).toISOString(),
    to: new Date(nowMs).toISOString(),
    steps,
    headline: {
      firstLeadWithin7d: headline(firstLead, 7),
      paidWithin30d: headline(firstPaid, 30),
    },
  };
}

module.exports = { ANONYMOUS_STEPS, IDENTIFIED_STEPS, STEP_LABELS, computeFunnel };
