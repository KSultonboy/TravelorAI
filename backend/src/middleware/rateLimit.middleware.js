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
  return clientIp(req);
}

function clientIp(req) {
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
// Anonymous auth requests are keyed by IP + normalized target email. One person
// cannot burn through the quota for everybody on a shared IP, and one IP cannot
// hammer a single account.
function normalizedBodyEmail(req) {
  const raw = req.body?.email;
  return typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '';
}

function emailKeyGenerator(req) {
  const ip = clientIp(req);
  const email = normalizedBodyEmail(req);
  return email ? `${ip}:${email}` : ip;
}

// ─── Forgot-password limiter — POST /api/v1/auth/forgot-password ──────────────
// A user should not be able to request more than 3 reset codes in a short window.
// Also reused for resend-verification, which has the same abuse profile.
const FORGOT_MESSAGE =
  'Parol tiklash so\'rovi juda ko\'p (3 martadan oshdi). 15 daqiqadan so\'ng qayta urinib ko\'ring yoki qo\'llab-quvvatlash bilan bog\'laning.';

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKeyGenerator,
  message: { success: false, message: FORGOT_MESSAGE },
});

// ─── Auth endpoint limiters (user + agency) ───────────────────────────────────
// Har bir endpoint uchun ikki qavat: (1) IP + email — bitta akkauntga hujum,
// (2) faqat IP — bitta manzildan ko'p akkauntlarni sinash. Xotirada (in-memory);
// bir nechta instance bo'lsa har biri o'z hisobini yuritadi.
const MINUTE = 60 * 1000;
const TOO_MANY = 'Juda ko\'p urinish. Birozdan so\'ng qayta urinib ko\'ring.';

function makeLimiter({ windowMs, max, byEmail, message = TOO_MANY }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: byEmail ? emailKeyGenerator : clientIp,
    message: { success: false, message },
  });
}

// Har bir realm (user / agency) o'z hisoblagichlariga ega bo'lishi uchun factory.
function createAuthLimiters() {
  return {
    // IP-only caps are deliberately generous: Uzbek mobile carriers put many users
    // behind one NAT IP. Per-email caps and the 5-attempt code limit stop guessing.
    login: [
      makeLimiter({ windowMs: 15 * MINUTE, max: 10, byEmail: true }),
      makeLimiter({ windowMs: 15 * MINUTE, max: 300, byEmail: false }),
    ],
    register: [
      makeLimiter({ windowMs: 60 * MINUTE, max: 5, byEmail: true }),
      makeLimiter({ windowMs: 60 * MINUTE, max: 100, byEmail: false }),
    ],
    verifyEmail: [
      makeLimiter({ windowMs: 15 * MINUTE, max: 10, byEmail: true }),
      makeLimiter({ windowMs: 15 * MINUTE, max: 150, byEmail: false }),
    ],
    resend: [
      makeLimiter({ windowMs: 15 * MINUTE, max: 3, byEmail: true, message: FORGOT_MESSAGE }),
      makeLimiter({ windowMs: 15 * MINUTE, max: 80, byEmail: false }),
    ],
    forgot: [
      makeLimiter({ windowMs: 15 * MINUTE, max: 3, byEmail: true, message: FORGOT_MESSAGE }),
      makeLimiter({ windowMs: 15 * MINUTE, max: 80, byEmail: false }),
    ],
    reset: [
      makeLimiter({ windowMs: 15 * MINUTE, max: 10, byEmail: true }),
      makeLimiter({ windowMs: 15 * MINUTE, max: 150, byEmail: false }),
    ],
    google: [makeLimiter({ windowMs: 15 * MINUTE, max: 120, byEmail: false })],
  };
}

module.exports = {
  rateLimiter,
  plannerLimiter,
  forgotPasswordLimiter,
  createAuthLimiters,
  emailKeyGenerator,
};
