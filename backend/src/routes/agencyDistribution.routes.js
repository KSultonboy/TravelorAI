// Agentlik CRM: sotuv kanallari — storefront havolasi, Telegram kanal ulash va
// turni kanalga joylash, taklif sahifasidagi to'lov havolasi.
// routes/index.js'da `/agency/distribution` ostida, `/agency`dan OLDIN ulanadi,
// shuning uchun auth/tarif/audit/tasdiq middleware'lari shu yerda takrorlanadi.
const router = require('express').Router();
const distribution = require('../controllers/agencyDistribution.controller');
const { agencyAuthMiddleware } = require('../middleware/agencyAuth.middleware');
const { agencyPlan, blockWhenReadOnly, requireCapability } = require('../middleware/agencyPlan.middleware');
const { agencyAuditMiddleware } = require('../middleware/agencyAudit.middleware');
const { requireRole, requireApprovedAgency, ROLE_GROUPS } = require('../middleware/agencyRole.middleware');

const OWNER = requireRole(ROLE_GROUPS.owner);
const OWNER_MANAGER = requireRole(ROLE_GROUPS.ownerManager);

router.use(agencyAuthMiddleware);
router.use(agencyPlan);
router.use(agencyAuditMiddleware);
router.use(requireApprovedAgency);

router.get('/', distribution.getSettings);

// To'lov havolasi / rekvizitlar — taklif sahifasida ko'rinadi. Faqat egasi.
router.put('/payment', blockWhenReadOnly, OWNER, distribution.savePayment);

// Telegram kanal — agentlik boti orqali (Telegram tarif imkoniyati kerak).
router.put('/channel', blockWhenReadOnly, OWNER, requireCapability('telegram'), distribution.connectChannel);
router.delete('/channel', blockWhenReadOnly, OWNER, distribution.disconnectChannel);
router.get('/channel-posts', distribution.listChannelPosts);
router.post(
  '/tours/:id/channel-post',
  blockWhenReadOnly,
  OWNER_MANAGER,
  requireCapability('telegram'),
  distribution.postTourToChannel
);

module.exports = router;
