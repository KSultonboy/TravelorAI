const router = require('express').Router();
const bookings = require('../controllers/bookings.controller');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');

router.post('/', optionalAuth, bookings.create);
router.get('/mine', authMiddleware, bookings.listMine);

module.exports = router;
