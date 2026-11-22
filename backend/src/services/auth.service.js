const crypto = require('crypto');
const axios = require('axios');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const { getGoogleClientIds } = require('../config/env');
const { error } = require('../utils/response');
const {
  sendAccountDeleteCodeEmail,
  sendEmailChangeCodeEmail,
  sendPasswordResetCodeEmail,
  sendVerificationCodeEmail,
} = require('./email.service');

const AuthCodeType = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_CHANGE: 'EMAIL_CHANGE',
  ACCOUNT_DELETE: 'ACCOUNT_DELETE',
};

const AuthProvider = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
};

const EMAIL_VERIFICATION_TTL_MINUTES = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 10);
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 10);
// Bitta kod uchun ruxsat etilgan noto'g'ri urinishlar soni; undan keyin kod yaroqsiz.
const MAX_CODE_ATTEMPTS = 5;
const GENERIC_SERVER_ERROR = 'Serverda xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildPublicUser(user) {
  const fullName = [user.name, user.lastName].filter(Boolean).join(' ').trim();

  return {
    id: user.id,
    name: user.name,
    lastName: user.lastName || null,
    fullName: fullName || user.name,
    bio: user.bio || null,
    avatarUrl: user.avatarUrl || null,
    email: user.email,
    emailVerified: user.emailVerified,
    authProvider: user.authProvider === AuthProvider.GOOGLE ? 'google' : 'local',
  };
}

// Kriptografik tasodifiy 6 xonali kod (100000..999999).
function generateNumericCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function safeHashEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function codeError(message, extra = {}) {
  const err = new Error(message);
  Object.assign(err, extra);
  return err;
}

// Umumiy kod iste'moli (AuthCode va AgencyAuthCode uchun). `delegate` — prisma
// modeli (prisma.authCode / prisma.agencyAuthCode). Har urinish atomar ravishda
// hisoblanadi; MAX_CODE_ATTEMPTS dan keyin kod bekor qilinadi.
// Xatolar: CODE_NOT_FOUND | CODE_EXPIRED | CODE_INVALID | CODE_TOO_MANY_ATTEMPTS
async function consumeCodeRecord(delegate, where, code) {
  const record = await delegate.findFirst({
    where: { ...where, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) throw codeError('CODE_NOT_FOUND');
  if (record.expiresAt < new Date()) throw codeError('CODE_EXPIRED');

  const invalidate = () =>
    delegate.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });

  const previousAttempts = Number(record.attempts || 0);
  if (previousAttempts >= MAX_CODE_ATTEMPTS) {
    await invalidate();
    throw codeError('CODE_TOO_MANY_ATTEMPTS', { attemptsRemaining: 0 });
  }

  // Urinishni atomar band qilamiz: parallel so'rovlar ham jami MAX dan oshmaydi.
  const reserved = await delegate.updateMany({
    where: { id: record.id, usedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (!reserved || reserved.count !== 1) {
    throw codeError('CODE_TOO_MANY_ATTEMPTS', { attemptsRemaining: 0 });
  }

  const attemptsUsed = previousAttempts + 1;
  if (!safeHashEqual(record.codeHash, hashCode(code))) {
    if (attemptsUsed >= MAX_CODE_ATTEMPTS) {
      await invalidate();
      throw codeError('CODE_TOO_MANY_ATTEMPTS', { attemptsRemaining: 0 });
    }
    throw codeError('CODE_INVALID', { attemptsRemaining: MAX_CODE_ATTEMPTS - attemptsUsed });
  }

  const consumed = await invalidate();
  if (!consumed || consumed.count !== 1) throw codeError('CODE_NOT_FOUND');
  return record;
}

async function issueAuthCode({ user, type, newEmail }) {
  const code = generateNumericCode();
  const codeHash = hashCode(code);
  const ttlMinutes = type === AuthCodeType.EMAIL_VERIFICATION ? EMAIL_VERIFICATION_TTL_MINUTES : PASSWORD_RESET_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.authCode.deleteMany({
    where: { userId: user.id, type },
  });

  await prisma.authCode.create({
    data: {
      userId: user.id,
      type,
      codeHash,
      expiresAt,
    },
  });

  const mailPayload = {
    email: user.email,
    name: user.name,
    code,
    expiresInMinutes: ttlMinutes,
  };
  let emailResult;
  if (type === AuthCodeType.EMAIL_VERIFICATION) {
    emailResult = await sendVerificationCodeEmail(mailPayload);
  } else if (type === AuthCodeType.EMAIL_CHANGE) {
    // Kod YANGI manzilga yuboriladi: shu bilan yangi email egasi ekanligi isbotlanadi.
    emailResult = await sendEmailChangeCodeEmail({ ...mailPayload, email: newEmail, newEmail });
  } else if (type === AuthCodeType.ACCOUNT_DELETE) {
    emailResult = await sendAccountDeleteCodeEmail(mailPayload);
  } else {
    emailResult = await sendPasswordResetCodeEmail(mailPayload);
  }

  return {
    ...emailResult,
    expiresInMinutes: ttlMinutes,
  };
}

async function consumeAuthCode({ userId, type, code }) {
  return consumeCodeRecord(prisma.authCode, { userId, type }, code);
}

async function verifyGoogleIdToken(idToken) {
  // Audience tekshiruvi hech qachon jimgina o'tkazib yuborilmaydi: client ID'lar
  // sozlanmagan bo'lsa Google orqali kirish umuman ishlamaydi (controller → 503).
  const allowedAudiences = getGoogleClientIds();
  if (!allowedAudiences.length) {
    throw new Error('GOOGLE_NOT_CONFIGURED');
  }

  const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: idToken },
    timeout: 10000,
  });

  const payload = response.data || {};

  const tokenAudiences = Array.from(
    new Set(
      [payload.aud, payload.azp]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );

  if (!tokenAudiences.some((aud) => allowedAudiences.includes(aud))) {
    const mismatchError = new Error('GOOGLE_AUDIENCE_MISMATCH');
    mismatchError.meta = { receivedAudiences: tokenAudiences };
    throw mismatchError;
  }

  const isEmailVerified = payload.email_verified === 'true' || payload.email_verified === true;
  if (!payload.email || !isEmailVerified || !payload.sub) {
    throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
  }

  return {
    googleId: payload.sub,
    email: normalizeEmail(payload.email),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
  };
}

// 500 javoblari uchun umumiy xabar: haqiqiy xato (Prisma va h.k.) faqat logga
// requestId bilan yoziladi, mijozga hech qachon err.message qaytmaydi.
function internalError(res, err, context = 'auth') {
  const requestId = crypto.randomUUID();
  logger.error(`${context} failed`, {
    requestId,
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });
  return error(res, GENERIC_SERVER_ERROR, 500, { requestId });
}

module.exports = {
  AuthCodeType,
  AuthProvider,
  EMAIL_VERIFICATION_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  GENERIC_SERVER_ERROR,
  normalizeEmail,
  buildPublicUser,
  generateNumericCode,
  hashCode,
  safeHashEqual,
  issueAuthCode,
  consumeAuthCode,
  consumeCodeRecord,
  verifyGoogleIdToken,
  internalError,
};
