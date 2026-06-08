const router = require('express').Router();
const { generate } = require('../controllers/planner.controller');
const { optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { plannerSchema } = require('../schemas/planner.schema');
const { plannerLimiter } = require('../middleware/rateLimit.middleware');

router.post('/generate', plannerLimiter, optionalAuth, validate(plannerSchema), generate);

module.exports = router;
