/**
 * Traveler Premium to'lov marshrutlari — /api/v1/payments/*
 *
 * DIQQAT: CLICK server callback'lari (/payments/click/prepare|complete) bu yerda
 * EMAS — ular app.js'da rate limiter'dan OLDIN alohida mount qilingan
 * (clickPublic.routes.js). Bu router faqat autentifikatsiyalangan user oqimi.
 *
 * Bitta endpoint to'plami ikkala klientga xizmat qiladi:
 *   mobil ilova — Bearer token bilan to'g'ridan-to'g'ri;
 *   sayt        — /api/backend proxy (httpOnly cookie → Bearer) orqali.
 */

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');
const { requireDbUser } = require('../middleware/paymentUser.middleware');
const clickPay = require('../controllers/clickPayment.controller');

// Checkout — tranzaksiya-spamga qarshi tor limit (holat so'rovlariga tegmaydi)
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : req.ip || 'unknown'),
  message: { success: false, message: "To'lov urinishlari juda ko'p. 15 daqiqadan so'ng qayta urinib ko'ring." },
});

router.get('/plans', optionalAuth, clickPay.userPlansList);
router.post('/checkout', authMiddleware, requireDbUser({ requireVerifiedEmail: true }), checkoutLimiter, clickPay.userCheckout);
router.get('/me', authMiddleware, requireDbUser(), clickPay.myPayments);
router.get('/status/:merchantTransId', authMiddleware, requireDbUser(), clickPay.userPaymentStatus);

module.exports = router;
