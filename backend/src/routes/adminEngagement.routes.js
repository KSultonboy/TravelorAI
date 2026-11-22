// /admin/engagement/* — admin.routes.js ichida adminAuthMiddleware'dan keyin ulanadi.
// Mustaqil ishlatilsa ham himoyalangan bo'lishi uchun admin kaliti shu yerda ham tekshiriladi.
const router = require('express').Router();
const { adminAuthMiddleware } = require('../middleware/adminAuth.middleware');
const ctrl = require('../controllers/agencyEngagement.controller');

router.use(adminAuthMiddleware);
router.get('/trials', ctrl.adminListTrials);
router.post('/agencies/:id/extend-trial', ctrl.adminExtendTrial);

module.exports = router;
