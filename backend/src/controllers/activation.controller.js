// Agentlik aktivatsiya ro'yxati (CRM bosh sahifasi) va admin "kengaytirilgan modullar" tugmasi.
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');

// Har bir qadam: CRM bo'lim kaliti (KvCabinet goToView) va tarif imkoniyati sharti.
const STEP_DEFS = Object.freeze([
  {
    key: 'profile', section: 'settings', cap: null,
    title: 'Agentlik profilini to‘ldiring',
    hint: 'Logotip, qisqa tavsif va telefon raqami — mijoz ishonchi shundan boshlanadi.',
  },
  {
    key: 'telegram', section: 'telegram', cap: 'telegram',
    title: 'Telegram botni ulang',
    hint: 'Mijoz botga yozsa, xabar avtomatik lid bo‘lib CRMga tushadi.',
  },
  {
    key: 'tour', section: 'packages', cap: null,
    title: 'Birinchi turni e’lon qiling',
    hint: 'Tur saytda bepul joylashadi va sayohatchilar bron qila oladi.',
  },
  {
    key: 'lead', section: 'leads', cap: null,
    title: 'Birinchi lidni qo‘shing yoki import qiling',
    hint: '«Yangi lid» tugmasi yoki CSV import orqali mavjud mijozlaringizni olib kiring.',
  },
  {
    key: 'offer', section: 'presentations', cap: 'presentations',
    title: 'Mijozga birinchi taklifni yuboring',
    hint: 'Shaxsiy havola yuboring — mijoz ochganini darhol bilasiz.',
  },
  {
    key: 'team', section: 'settings', cap: 'team',
    title: 'Jamoa a’zosini taklif qiling',
    hint: 'Menejer yoki buxgalterni qo‘shib, rollarni belgilang.',
  },
]);

function profileComplete(agency) {
  const filled = (v) => typeof v === 'string' && v.trim().length > 0;
  return filled(agency.imageUrl) && filled(agency.description) && filled(agency.phone);
}

/** Sof funksiya: faktlar + imkoniyatlar → ro'yxat holati. */
function computeActivation({ agency, caps = {}, facts = {} }) {
  const doneByKey = {
    profile: profileComplete(agency || {}),
    telegram: !!(agency && agency.telegramBotActive),
    tour: (facts.publishedTours || 0) > 0,
    lead: (facts.leads || 0) > 0,
    offer: (facts.offers || 0) > 0,
    team: (facts.members || 0) > 0,
  };
  const steps = STEP_DEFS.map((def) => {
    // Tarif bu imkoniyatni bermasa — qadam o'tkazib yuboriladi (foizga kirmaydi).
    const skipped = def.cap ? caps[def.cap] === false : false;
    return {
      key: def.key,
      title: def.title,
      hint: def.hint,
      section: def.section,
      done: !skipped && !!doneByKey[def.key],
      skipped,
    };
  });
  const counted = steps.filter((s) => !s.skipped);
  const doneCount = counted.filter((s) => s.done).length;
  const percent = counted.length ? Math.round((doneCount / counted.length) * 100) : 100;
  const nextStep = counted.find((s) => !s.done) || null;
  const dismissedAt = agency && agency.activationDismissedAt ? agency.activationDismissedAt : null;
  return {
    steps,
    done: doneCount,
    total: counted.length,
    percent,
    complete: percent === 100,
    next: nextStep ? { key: nextStep.key, section: nextStep.section, title: nextStep.title } : null,
    dismissed: !!dismissedAt,
    dismissedAt,
  };
}

async function loadFacts(agencyId) {
  const [publishedTours, leads, offers, members] = await Promise.all([
    prisma.tour.count({ where: { agencyId, active: true, approvalStatus: 'approved' } }),
    prisma.tourBooking.count({ where: { agencyId } }),
    prisma.tourPresentation.count({ where: { agencyId } }),
    prisma.agencyMember.count({ where: { agencyId } }),
  ]);
  return { publishedTours, leads, offers, members };
}

// GET /api/v1/agency/activation
async function getActivation(req, res) {
  try {
    const agency = req.agency;
    if (!agency) return error(res, 'Agentlik topilmadi', 404);
    const facts = await loadFacts(agency.id);
    return success(res, computeActivation({ agency, caps: (req.access && req.access.caps) || {}, facts }));
  } catch (err) {
    return error(res, 'Aktivatsiya holatini olib bo‘lmadi', 500);
  }
}

// POST /api/v1/agency/activation/dismiss — faqat 100% bo'lganda.
async function dismissActivation(req, res) {
  try {
    const agency = req.agency;
    if (!agency) return error(res, 'Agentlik topilmadi', 404);
    const facts = await loadFacts(agency.id);
    const state = computeActivation({ agency, caps: (req.access && req.access.caps) || {}, facts });
    if (!state.complete) {
      return error(res, 'Ro‘yxatni barcha qadamlar bajarilgandan keyin yopish mumkin', 409, { code: 'ACTIVATION_INCOMPLETE' });
    }
    const dismissedAt = agency.activationDismissedAt || new Date();
    if (!agency.activationDismissedAt) {
      await prisma.tourAgency.update({ where: { id: agency.id }, data: { activationDismissedAt: dismissedAt }, select: { id: true } });
    }
    return success(res, { ...state, dismissed: true, dismissedAt });
  } catch (err) {
    return error(res, 'Saqlab bo‘lmadi', 500);
  }
}

// PATCH /api/v1/admin/agencies/:id/advanced-features  { enabled: boolean }
async function adminSetAdvancedFeatures(req, res) {
  try {
    const enabled = req.body ? req.body.enabled : undefined;
    if (typeof enabled !== 'boolean') return error(res, "enabled true yoki false bo'lishi kerak", 400);
    const id = String(req.params.id || '').trim();
    if (!id) return error(res, 'Agentlik topilmadi', 404);
    const existing = await prisma.tourAgency.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return error(res, 'Agentlik topilmadi', 404);
    const updated = await prisma.tourAgency.update({
      where: { id },
      data: { advancedFeatures: enabled },
      select: { id: true, name: true, advancedFeatures: true },
    });
    return success(res, updated);
  } catch (err) {
    return error(res, 'Saqlab bo‘lmadi', 500);
  }
}

module.exports = { STEP_DEFS, adminSetAdvancedFeatures, computeActivation, dismissActivation, getActivation };
