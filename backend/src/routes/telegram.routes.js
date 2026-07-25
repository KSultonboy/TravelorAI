const router = require('express').Router();
const telegram = require('../controllers/telegram.controller');

// Public webhook — Telegram shu manzilga update yuboradi (auth yo'q, secret header bilan tekshiriladi)
router.post('/webhook/:agencyId', telegram.webhook);

module.exports = router;
