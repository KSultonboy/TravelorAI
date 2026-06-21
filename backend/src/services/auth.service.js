const crypto = require('crypto');
const axios = require('axios');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
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
    role: user.role || 'traveler',
  };
}

function generateNumericCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
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

  let sendFn;
  if (type === AuthCodeType.EMAIL_VERIFICATION) {
    sendFn = () => sendVerificationCodeEmail(mailPayload);
  } else if (type === AuthCodeType.EMAIL_CHANGE) {
    sendFn = () => sendEmailChangeCodeEmail({ ...mailPayload, newEmail });
  } else if (type === AuthCodeType.ACCOUNT_DELETE) {
    sendFn = () => sendAccountDeleteCodeEmail(mailPayload);
  } else {
    sendFn = () => sendPasswordResetCodeEmail(mailPayload);
  }

  // Emailni BLOKLAMASDAN (fire-and-forget) yuboramiz: Gmail SMTP 2-13s olishi mumkin,
  // shuning uchun javobni kutdirib qo'ymaymiz. Kod allaqachon bazaga yozilgan —
  // foydalanuvchi email kelganda kiritadi. Xato bo'lsa logga yozamiz.
  Promise.resolve()
    .then(sendFn)
    .catch((err) =>
      logger.error('Auth email send failed (async)', { type, email: user.email, message: err.message })
    );

  // SMTP sozlangan bo'lsa 'smtp', aks holda 'log' (dev'da devCode qaytaramiz).
  const willSendEmail = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
  return {
    delivery: willSendEmail ? 'smtp' : 'log',
    expiresInMinutes: ttlMinutes,
    ...(process.env.NODE_ENV !== 'production' && !willSendEmail ? { devCode: code } : {}),
  };
}

async function consumeAuthCode({ userId, type, code }) {
  const authCode = await prisma.authCode.findFirst({
    where: {
      userId,
      type,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!authCode) {
    throw new Error('CODE_NOT_FOUND');
  }

  if (authCode.expiresAt < new Date()) {
    throw new Error('CODE_EXPIRED');
  }

  if (authCode.codeHash !== hashCode(code)) {
    throw new Error('CODE_INVALID');
  }

  await prisma.authCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  });

  return authCode;
}

async function verifyGoogleIdToken(idToken) {
  const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: idToken },
    timeout: 10000,
  });

  const payload = response.data;
  const allowedAudiences = Array.from(
    new Set(
      [
        ...String(process.env.GOOGLE_CLIENT_IDS || '')
          .split(',')
          .map((item) => item.trim()),
        String(process.env.GOOGLE_ANDROID_CLIENT_ID || '').trim(),
        String(process.env.GOOGLE_ANDROID_CLIENT_ID_DEBUG || '').trim(),
        String(process.env.GOOGLE_ANDROID_CLIENT_ID_RELEASE || '').trim(),
        String(process.env.GOOGLE_WEB_CLIENT_ID_DEBUG || '').trim(),
        String(process.env.GOOGLE_WEB_CLIENT_ID || '').trim(),
        String(process.env.GOOGLE_WEB_CLIENT_ID_RELEASE || '').trim(),
        String(process.env.GOOGLE_IOS_CLIENT_ID_DEBUG || '').trim(),
        String(process.env.GOOGLE_IOS_CLIENT_ID || '').trim(),
        String(process.env.GOOGLE_IOS_CLIENT_ID_RELEASE || '').trim(),
      ].filter(Boolean)
    )
  );

  const tokenAudiences = Array.from(
    new Set(
      [payload.aud, payload.azp]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );

  if (allowedAudiences.length && !tokenAudiences.some((aud) => allowedAudiences.includes(aud))) {
    const mismatchError = new Error('GOOGLE_AUDIENCE_MISMATCH');
    mismatchError.meta = {
      receivedAudiences: tokenAudiences,
      allowedAudiences,
    };
    throw mismatchError;
  }

  const isEmailVerified = payload.email_verified === 'true' || payload.email_verified === true;
  if (!payload.email || !isEmailVerified) {
    throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
  }

  return {
    googleId: payload.sub,
    email: normalizeEmail(payload.email),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
  };
}

module.exports = {
  AuthCodeType,
  AuthProvider,
  EMAIL_VERIFICATION_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  normalizeEmail,
  buildPublicUser,
  issueAuthCode,
  consumeAuthCode,
  verifyGoogleIdToken,
};
