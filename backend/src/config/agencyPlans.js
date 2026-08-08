// Agency obuna rejalari — tarif darajasi bo'yicha bo'limlar + imkoniyatlar (yagona manba).
// Frontend (KvCabinet) va backend guard'lar shu yerdan foydalanadi.
// Enforcement qoidasi:
//   • Muddat o'tsa (subscriptionUntil < now)  → readOnly (faqat o'qish) — yozuvlar bloklanadi.
//   • Tarif darajasi                          → sections/caps cheklaydi.
//   • Tarifsiz eski agentlik (grandfather)    → "unlimited" (hech narsa cheklanmaydi).

const ALL_SECTIONS = ['dashboard', 'leads', 'customers', 'packages', 'bookings', 'payments', 'reports', 'settings'];

// DIQQAT: `integrations` — O'LIK bayroq. Hech bir route uni tekshirmaydi
// (`requireCapability('integrations')` kodda umuman yo'q). Instagram va
// Telegram `telegram` imkoniyatiga bog'langan. Uni tarif afzalligi sifatida
// ko'rsatmang — u hech narsani ochmaydi. Yangi integratsiya qo'shilganda
// yo shu bayroqni haqiqiy qilib ishlating, yo butunlay olib tashlang.
const ALL_CAPS = {
  telegram: true, broadcast: true, csvExport: true, analytics: true, manualLeads: true, team: true, integrations: true,
  presentations: true, ai: true,
};
const NO_CAPS = {
  telegram: false, broadcast: false, csvExport: false, analytics: false, manualLeads: false, team: false, integrations: false,
  presentations: false, ai: false,
};

const PLANS = {
  // Tarifsiz / eski agentliklar — to'liq (grandfather, buzilmasin).
  unlimited: { sections: ALL_SECTIONS, caps: { ...ALL_CAPS } },

  // 99 000 so'm — asosiy CRM: lidlar (qo'lda ham qo'shish mumkin), mijozlar, turlar,
  // bronlar, to'lovlar, CSV eksport. Xabar kanallari / Hisobot / Broadcast YO'Q.
  starter: {
    sections: ['dashboard', 'leads', 'customers', 'packages', 'bookings', 'payments', 'settings'],
    caps: { ...NO_CAPS, manualLeads: true, csvExport: true },
  },

  // 199 000 so'm — + Hisobotlar, xabar kanallari (Telegram bot VA Instagram Direct),
  // Broadcast, Dinamik takliflar, Analitika/CSV, qo'lda lidlar.
  //
  // DIQQAT: Instagram ataylab shu darajada — O'zbekistonda agentlik lidlarining
  // asosiy qismi Instagramdan keladi, uni Premium ortiga yashirish kichik
  // agentlik uchun mahsulotning bosh sababini yo'q qiladi. Ikkala kanal ham
  // `telegram` imkoniyatiga bog'langan (`requireCapability('telegram')`).
  //
  // Jamoa va AI — faqat Premium'da.
  pro: {
    sections: ALL_SECTIONS,
    caps: { ...ALL_CAPS, team: false, integrations: false, ai: false },
  },

  // 299 000 so'm (Premium) — Pro'dagi hammasi + jamoa va rollar + AI yordamchi.
  // `business` (eski slug) va `premium` (yangi nomdan hosil bo'lishi mumkin) — ikkisi ham to'liq.
  business: { sections: ALL_SECTIONS, caps: { ...ALL_CAPS } },
  premium: { sections: ALL_SECTIONS, caps: { ...ALL_CAPS } },

  // Enterprise — hammasi.
  enterprise: { sections: ALL_SECTIONS, caps: { ...ALL_CAPS } },
};

// Rol bo'yicha ko'rinadigan bo'limlar (tarif bilan KESISHADI — ikkalasi ham cheklaydi).
const ROLE_SECTIONS = {
  owner: ALL_SECTIONS,
  manager: ALL_SECTIONS,
  agent: ['dashboard', 'leads', 'customers', 'packages', 'bookings', 'settings'],
  accountant: ['dashboard', 'bookings', 'payments', 'reports', 'settings'],
};

const DEFAULT_TARIFF_PLAN = 'starter'; // tarifi bor, lekin slug noma'lum bo'lsa

// TourAgency (tariff bilan) yoki null + foydalanuvchi roli → access obyekti.
function resolveAccess(agency, role = 'owner') {
  const now = Date.now();
  const status = agency && agency.subscriptionStatus ? agency.subscriptionStatus : 'none';
  const untilRaw = agency && agency.subscriptionUntil ? agency.subscriptionUntil : null;
  const until = untilRaw ? new Date(untilRaw).getTime() : null;
  const hasUntil = until !== null && !Number.isNaN(until);
  const expired = hasUntil && until < now;

  // Reja kaliti: tarif slug → PLANS; tarif bor lekin slug noma'lum → starter; tarifsiz → unlimited (grandfather).
  const slug = agency && agency.tariff && agency.tariff.slug ? agency.tariff.slug : null;
  let planKey;
  if (slug && PLANS[slug]) planKey = slug;
  else if (agency && agency.tariffId) planKey = DEFAULT_TARIFF_PLAN;
  else planKey = 'unlimited';

  const plan = PLANS[planKey];

  // readOnly — FAQAT to'lov muddati o'tганда (foydalanuvchi tanlovi: "faqat o'qish").
  const readOnly = expired;

  const daysLeft = hasUntil ? Math.ceil((until - now) / 86400000) : null;

  // Rol → ko'rinadigan bo'limlar (tarif bilan kesishadi).
  const effRole = ROLE_SECTIONS[role] ? role : 'owner';
  const sections = plan.sections.filter((s) => ROLE_SECTIONS[effRole].includes(s));

  return {
    plan: planKey,
    planName: (agency && agency.tariff && agency.tariff.name) || (planKey === 'unlimited' ? 'Cheklovsiz' : planKey),
    status,
    role: effRole,
    canManageTeam: effRole === 'owner',
    active: !readOnly,
    readOnly,
    expired,
    until: untilRaw || null,
    daysLeft,
    sections,
    caps: plan.caps,
  };
}

module.exports = { PLANS, ALL_SECTIONS, ROLE_SECTIONS, resolveAccess, DEFAULT_TARIFF_PLAN };
