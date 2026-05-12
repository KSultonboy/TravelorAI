const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createFeedbackSchema } = require('../schemas/feedback.schema');
const { create } = require('../controllers/feedback.controller');

router.use(authMiddleware);
router.post('/', validate(createFeedbackSchema), create);

module.exports = router;
