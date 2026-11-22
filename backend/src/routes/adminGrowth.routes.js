// Admin: mahsulot voronkasi va agentlik "kengaytirilgan modullar" tugmasi.
// admin.routes.js ichida adminAuthMiddleware'dan keyin ulanadi.
const router = require('express').Router();
const { adminFunnel } = require('../controllers/productEvents.controller');
const { adminSetAdvancedFeatures } = require('../controllers/activation.controller');

router.get('/funnel', adminFunnel);
router.patch('/agencies/:id/advanced-features', adminSetAdvancedFeatures);

module.exports = router;
