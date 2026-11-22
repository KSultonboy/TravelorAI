// Aktivatsiya ro'yxati — agency.routes.js ichida requireApprovedAgency'dan keyin ulanadi
// (agencyAuth + agencyPlan + audit allaqachon ishlagan). Shu yerda kengaytirilgan
// modullar darvozasi ham ulanadi — agency.routes.js'da bitta qator.
const router = require('express').Router();
const { requireOwner } = require('../middleware/agencyPlan.middleware');
const { requireAdvancedFeatures } = require('../middleware/advancedFeatures.middleware');
const activation = require('../controllers/activation.controller');

// Kengaytirilgan modullar (API/webhook, avtomatizatsiya, bank solishtirish, payroll,
// filiallar, hujjat tasdiq/e-imzo, WhatsApp, AI izoh) — advancedFeatures=false bo'lsa 403.
router.use(requireAdvancedFeatures);

router.get('/activation', activation.getActivation);
router.post('/activation/dismiss', requireOwner, activation.dismissActivation);

module.exports = router;
