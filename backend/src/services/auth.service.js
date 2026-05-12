const crypto = require('crypto');
const axios = require('axios');
const { prisma } = require('../config/database');
const { sendPasswordResetCodeEmail, sendVerificationCodeEmail } = require('./email.service');

const AuthCodeType = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
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
  };
}

function generateNumericCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function issueAuthCode({ user, type }) {
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

  const emailResult =
    type === AuthCodeType.EMAIL_VERIFICATION
      ? await sendVerificationCodeEmail({
          email: user.email,
          name: user.name,
          code,
          expiresInMinutes: ttlMinutes,
        })
      : await sendPasswordResetCodeEmail({
          email: user.email,
          name: user.name,
          code,
          expiresInMinutes: ttlMinutes,
        });

  return {
    ...emailResult,
    expiresInMinutes: ttlMinutes,
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
