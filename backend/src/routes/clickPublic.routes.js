/**
 * CLICK SHOP API callback'lari — PUBLIC (auth yo'q, imzo bilan himoyalangan).
 *
 * CLICK server-to-server POST qiladi, shuning uchun:
 *   • auth middleware YO'Q — himoya sign_string (MD5 + SECRET_KEY) orqali;
 *   • rate limiter'dan CHETDA (app.js'да rateLimiter'дан oldin mount qilinadi) —
 *     to'lov tasdig'i limitга urilib qolmasligi kerak;
 *   • body `application/x-www-form-urlencoded` (app.js'да urlencoded parser).
 *
 * CLICK kabinetida ko'rsatiladigan manzillar:
 *   Prepare  : https://travelorai.com/api/v1/payments/click/prepare
 *   Complete : https://travelorai.com/api/v1/payments/click/complete
 */

const router = require('express').Router();
const clickPay = require('../controllers/clickPayment.controller');

router.post('/prepare', clickPay.prepare);
router.post('/complete', clickPay.complete);

module.exports = router;
