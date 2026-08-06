/**
 * Traveler Premium plan katalogi (agentlik Tariff'laridan ALOHIDA —
 * u CRM/B2B uchun, bu esa oddiy foydalanuvchi obunasi).
 *
 * Narx faqat serverda hisoblanadi (klient hech qachon summa yubormaydi).
 * Narxni .env orqali o'zgartirish mumkin: USER_PREMIUM_PRICE_UZS.
 */

const PREMIUM_PRICE_UZS = Math.max(0, parseInt(process.env.USER_PREMIUM_PRICE_UZS || '29000', 10) || 0);

const PLANS = [
  {
    slug: 'premium',
    name: 'TravelorAI Premium',
    priceMonthlyUzs: PREMIUM_PRICE_UZS,
    features: [
      'Cheksiz AI sayohat rejalari',
      'Premium qo\'llab-quvvatlash',
      'Yangi funksiyalarga birinchi kirish',
    ],
  },
];

function getPlan(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return PLANS.find((p) => p.slug === s && p.priceMonthlyUzs > 0) || null;
}

function listPlans() {
  return PLANS.filter((p) => p.priceMonthlyUzs > 0);
}

/** Premium holatini lazily hisoblaydi — DBda status flag saqlanmaydi. */
function premiumInfo(user) {
  const until = user && user.premiumUntil ? new Date(user.premiumUntil) : null;
  const active = Boolean(until && until.getTime() > Date.now());
  return {
    active,
    plan: active ? user.premiumPlan || 'premium' : null,
    until: until ? until.toISOString() : null,
  };
}

module.exports = { PLANS, getPlan, listPlans, premiumInfo };
