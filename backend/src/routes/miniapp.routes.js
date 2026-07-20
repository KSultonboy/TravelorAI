const router = require('express').Router();
const miniapp = require('../controllers/miniapp.controller');

// Barcha so'rovlar POST — initData imzosi URL'da emas, tanada yuboriladi.
// Auth har bir endpoint ichida: agentlik slug -> bot tokeni -> initData HMAC tekshiruvi.
router.post('/session', miniapp.session);
router.post('/tours', miniapp.tours);
router.post('/tour', miniapp.tour);
router.post('/me', miniapp.me);
router.post('/request', miniapp.request);

module.exports = router;
