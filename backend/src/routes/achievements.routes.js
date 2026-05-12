const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { getMyAchievements } = require('../controllers/achievements.controller');

router.get('/', authMiddleware, getMyAchievements);

module.exports = router;
