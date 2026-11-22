// Public agentlik storefront'i — /a/<slug> sahifasi uchun (auth yo'q).
// routes/index.js'da `/home/agencies` ostida ulanadi.
const router = require('express').Router();
const distribution = require('../controllers/agencyDistribution.controller');

router.get('/:slug/storefront', distribution.getStorefront);

module.exports = router;
