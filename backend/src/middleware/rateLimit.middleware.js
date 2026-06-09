const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Juda ko\'p so\'rovlar. Biroz kuting va qayta urinib ko\'ring.' },
});

const plannerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Reja tuzish limitiga yetdingiz. Biroz kuting.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Kirish urinishlari limiti tugadi. Keyinroq qayta urinib ko\'ring.' },
});

const securityCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Kod so\'rash limiti tugadi. Keyinroq qayta urinib ko\'ring.' },
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bron qilish limiti tugadi. Keyinroq qayta urinib ko\'ring.' },
});

const interactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Interaction limiti tugadi. Biroz kuting.' },
});

module.exports = {
  rateLimiter,
  plannerLimiter,
  authLimiter,
  securityCodeLimiter,
  bookingLimiter,
  interactionLimiter,
};
