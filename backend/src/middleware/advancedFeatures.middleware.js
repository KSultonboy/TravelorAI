// Kengaytirilgan modullar (TourAgency.advancedFeatures) — admin boshqaradi.
// Yangi agentliklarda sukut bo'yicha O'CHIQ (oddiy CRM chalg'itmasin);
// migratsiya mavjud agentliklar uchun YOQIQ qoldirgan.
//
// agency.routes.js'da bitta `router.use(requireAdvancedFeatures)` bilan ulanadi
// (agencyPlan + requireApprovedAgency'dan keyin) — yo'llar shu yerda sanalgan,
// shuning uchun route faylidagi mavjud qatorlarni o'zgartirish shart emas.
const { error } = require('../utils/response');

// Yo'llar /api/v1/agency ga nisbatan (router ichidagi req.path).
const ADVANCED_PATHS = Object.freeze([
  { module: 'integrations', re: /^\/crm\/integrations(?:\/|$)/ }, // Public API kalitlari + webhooklar
  { module: 'automation', re: /^\/crm\/automation(?:\/|$)/ }, // no-code avtomatizatsiya
  { module: 'reconciliation', re: /^\/crm\/finance\/reconciliation(?:\/|$)/ }, // bank ko'chirmasi
  { module: 'payroll', re: /^\/crm\/payroll(?:\/|$)/ },
  { module: 'payroll', re: /^\/crm\/finance\/commission-rules(?:\/|$)/ },
  { module: 'branches', re: /^\/crm\/branches(?:\/|$)/ },
  { module: 'documentApprovals', re: /^\/crm\/business-documents\/[^/]+\/(?:approval|signature)\/?$/ },
  { module: 'documentApprovals', re: /^\/crm\/business-documents\/(?:approvals|signatures)\/[^/]+(?:\/verify)?\/?$/ },
  { module: 'whatsapp', re: /^\/whatsapp(?:\/|$)/ },
  { module: 'aiPresentationNote', re: /^\/ai\/presentation-note\/?$/ },
]);

function advancedModuleFor(path) {
  // Express yo'llari registrga sezgir emas — tekshiruv ham kichik harfda.
  const p = String(path || '').toLowerCase();
  const hit = ADVANCED_PATHS.find((item) => item.re.test(p));
  return hit ? hit.module : null;
}

/** Bayroq aniq `false` bo'lsagina bloklaydi (ustun yo'q eski DB / mock'larda ochiq). */
function advancedFeaturesEnabled(agency) {
  return !(agency && agency.advancedFeatures === false);
}

function requireAdvancedFeatures(req, res, next) {
  const module = advancedModuleFor(req.path);
  if (!module || advancedFeaturesEnabled(req.agency)) return next();
  return error(
    res,
    "Bu kengaytirilgan modul agentligingiz uchun yoqilmagan. Yoqish uchun TravelorAI administratoriga murojaat qiling.",
    403,
    { code: 'FEATURE_DISABLED', module }
  );
}

module.exports = { ADVANCED_PATHS, advancedFeaturesEnabled, advancedModuleFor, requireAdvancedFeatures };
