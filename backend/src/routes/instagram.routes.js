const router = require('express').Router();
const instagram = require('../controllers/instagram.controller');

// Ochiq manzillar — auth yo'q, o'z tekshiruvi bor:
//  · callback  → state HMAC imzosi
//  · webhook   → GET'da verify_token, POST'da X-Hub-Signature-256
// Bularni rateLimiter'dan OLDIN ulaymiz (app.js), aks holda Meta'ning
// xabar to'lqini limitga urilib, yo'qolib ketishi mumkin.
router.get('/callback', instagram.callback);
router.get('/webhook', instagram.webhookVerify);
router.post('/webhook', instagram.webhook);

module.exports = router;
