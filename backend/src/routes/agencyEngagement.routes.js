// /agency/engagement/* — agency.routes.js ichida requireApprovedAgency'dan keyin
// ulanadi (agencyAuth + agencyPlan + audit allaqachon ishlagan).
const router = require('express').Router();
const { requireOwner } = require('../middleware/agencyPlan.middleware');
const { requireRole, ROLE_GROUPS } = require('../middleware/agencyRole.middleware');
const ctrl = require('../controllers/agencyEngagement.controller');

// Xabarnoma sozlamalari faqat o'qish rejimida ham o'zgartirilishi mumkin
// (biznes ma'lumoti emas — sinov tugagan agentlik bildirishnomani o'chira olsin).
router.get('/settings', requireRole(ROLE_GROUPS.ownerManager), ctrl.getEngagementSettings);
router.put('/settings', requireOwner, ctrl.saveEngagementSettings);
router.post('/digest/test', requireOwner, ctrl.sendDigestNow);

module.exports = router;
