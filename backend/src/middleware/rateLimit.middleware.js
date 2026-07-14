const rateLimit = require('express-rate-limit');

// ─── Authenticated user ID extractor ─────────────────────────────────────────
// When a valid Bearer token is present we rate-limit by userId, not by IP.
// This means multiple users sharing the same IP (mobile carrier NAT, office
// Wi-Fi, etc.) each get their own independent quota.
function keyGenerator(req) {
  // req.user is populated by auth middleware when the token is valid
  if (req.user && req.user.id) {
    return `user:${req.user.id}`;
  }
  // Fall back to IP for unauthenticated requests
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ─── Global limiter — all /api/v1/* routes ────────────────────────────────────
// 500 requests per 15 minutes per user/IP.  This is generous enough that
// normal app usage (home + explore + trips + planner) never hits the ceiling,
// while still protecting against abuse.
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, message: 'Juda ko\'p so\'rovlar. Biroz kuting va qayta urinib ko\'ring.' },
});

// ─── Planner limiter — POST /api/v1/planner/generate ─────────────────────────
// AI generation is expensive; limit to 20 requests per minute per user/IP.
const plannerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator,
  message: { success: false, message: 'Reja tuzish limitiga yetdingiz. Biroz kuting.' },
});

// ─── Email-key extractor for unauthenticated auth flows ───────────────────────
// Password-reset / verification requests are anonymous, so we key by the target
// email (when present) combined with the IP. This means one person cannot burn
// through the quota for everybody on a shared IP, while still capping abuse.
function emailKeyGenerator(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email ? `${ip}:${email}` : ip;
}

// ─── Forgot-password limiter — POST /api/v1/auth/forgot-password ──────────────
// A user should not be able to request more than 3 reset codes in a short window.
// Also reused for resend-verification, which has the same abuse profile.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKeyGenerator,
  message: {
    success: false,
    message: 'Parol tiklash so\'rovi juda ko\'p (3 martadan oshdi). 15 daqiqadan so\'ng qayta urinib ko\'ring yoki qo\'llab-quvvatlash bilan bog\'laning.',
  },
});

module.exports = { rateLimiter, plannerLimiter, forgotPasswordLimiter };
