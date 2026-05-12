const router = require('express').Router();
const bookings = require('../controllers/bookings.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

router.post('/', optionalAuth, bookings.create);
router.get('/mine', optionalAuth, bookings.listMine);

module.exports = router;
