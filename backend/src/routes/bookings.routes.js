const router = require('express').Router();
const bookings = require('../controllers/bookings.controller');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');
const { bookingLimiter } = require('../middleware/rateLimit.middleware');

router.post('/', bookingLimiter, optionalAuth, bookings.create);
router.get('/mine', authMiddleware, bookings.listMine);

module.exports = router;
