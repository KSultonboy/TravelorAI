// Agency obuna rejalari — tarif darajasi bo'yicha bo'limlar + imkoniyatlar (yagona manba).
// Frontend (KvCabinet) va backend guard'lar shu yerdan foydalanadi.
// Enforcement qoidasi:
//   • Muddat o'tsa (subscriptionUntil < now)  → readOnly (faqat o'qish) — yozuvlar bloklanadi.
//   • Tarif darajasi                          → sections/caps cheklaydi.
//   • Tarifsiz eski agentlik (grandfather)    → "unlimited" (hech narsa cheklanmaydi).

const ALL_SECTIONS = ['dashboard', 'leads', 'customers', 'tasks', 'packages', 'bookings', 'payments', 'reports', 'documents', 'settings'];

// `integrations` Public API kalitlari va outbound webhook boshqaruvini ochadi.
// Instagram va Telegram alohida `telegram` imkoniyatiga bog'langan.
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
    sections: ['dashboard', 'leads', 'customers', 'tasks', 'packages', 'bookings', 'payments', 'documents', 'settings'],
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
  agent: ['dashboard', 'leads', 'customers', 'tasks', 'packages', 'bookings', 'documents', 'settings'],
  accountant: ['dashboard', 'tasks', 'bookings', 'payments', 'reports', 'documents', 'settings'],
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

  // Sinov muddati (engagement): faqat to'lovli obunasi YO'Q va trialEndsAt
  // qo'yilgan (yangi) agentliklarga tegishli. To'lov har doim ustun.
  const trial = trialState(agency, now);
  if (trial) planKey = 'pro';

  const plan = PLANS[planKey];

  // readOnly — FAQAT to'lov (yoki sinov) muddati o'tганда ("faqat o'qish").
  const readOnly = trial ? trial.expired : expired;

  const daysLeft = trial ? trial.daysLeft : (hasUntil ? Math.ceil((until - now) / 86400000) : null);

  // Rol → ko'rinadigan bo'limlar (tarif bilan kesishadi).
  const effRole = ROLE_SECTIONS[role] ? role : 'owner';
  const sections = plan.sections.filter((s) => ROLE_SECTIONS[effRole].includes(s));

  let accessState;
  if (trial) accessState = trial.expired ? 'trial_expired' : 'trial';
  else if (planKey === 'unlimited' && !hasUntil) accessState = 'grandfathered';
  else accessState = expired ? 'expired' : 'active';

  return {
    plan: planKey,
    planName: trial ? 'Sinov (Pro)' : ((agency && agency.tariff && agency.tariff.name) || (planKey === 'unlimited' ? 'Cheklovsiz' : planKey)),
    status: trial ? 'trial' : status,
    role: effRole,
    canManageTeam: effRole === 'owner',
    active: !readOnly,
    readOnly,
    expired: trial ? trial.expired : expired,
    until: trial ? trial.endsAt : (untilRaw || null),
    daysLeft,
    sections,
    caps: plan.caps,
    accessState,
    trialEndsAt: trial ? trial.endsAt : null,
  };
}

// Agentlik sinov holati yoki null (grandfathered / to'lovli obuna).
// To'lovli obuna = tarif biriktirilgan YOKI subscriptionUntil qo'yilgan.
function trialState(agency, now = Date.now()) {
  if (!agency || !agency.trialEndsAt) return null;
  if (agency.tariffId || agency.subscriptionUntil) return null;
  const end = new Date(agency.trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  return {
    endsAt: new Date(end).toISOString(),
    expired: end <= now,
    daysLeft: Math.max(0, Math.ceil((end - now) / 86400000)),
  };
}

module.exports = { PLANS, ALL_SECTIONS, ROLE_SECTIONS, resolveAccess, trialState, DEFAULT_TARIFF_PLAN };
