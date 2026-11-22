const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { logger } = require('../config/logger');
const {
  AuthCodeType,
  AuthProvider,
  buildPublicUser,
  consumeAuthCode,
  internalError,
  issueAuthCode,
  normalizeEmail,
  verifyGoogleIdToken,
} = require('../services/auth.service');
const { sendEmailChangedNoticeEmail } = require('../services/email.service');
const { signToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const {
  SUPPORT_EMAIL,
  withDecay,
  getActiveLock,
  lockedResponse,
  registerFailure,
  RESET_ON_SUCCESS,
} = require('../services/loginSecurity.service');

const PASSWORD_SALT_ROUNDS = 10;
const DEFAULT_PREFERENCES = {
  style: 'mid',
  interests: ['tarixiy', 'madaniy'],
  updatedAt: null,
};
const MAX_SECURITY_CODE_REQUESTS = 3;
const MAX_NAME_LENGTH = 50;
// Paroli yo'q (faqat Google) akkauntda emailni almashtirish uchun yaqinda kirgan
// bo'lish talab qilinadi — o'g'irlangan eski token bilan emailni almashtirib bo'lmaydi.
const RECENT_LOGIN_SECONDS = 15 * 60;

function mapPreferences(pref) {
  if (!pref) return DEFAULT_PREFERENCES;
  return {
    style: pref.style || DEFAULT_PREFERENCES.style,
    interests: Array.isArray(pref.interests) && pref.interests.length > 0 ? pref.interests : DEFAULT_PREFERENCES.interests,
    updatedAt: pref.updatedAt,
  };
}

function createAuthPayload(user) {
  const publicUser = buildPublicUser(user);
  return {
    // tv — tokenVersion: parol tiklanganda oshadi va eski tokenlar bekor bo'ladi.
    token: signToken({ id: user.id, email: user.email, tv: user.tokenVersion || 0 }),
    user: publicUser,
  };
}

function mapCodeError(res, err) {
  if (err.message === 'CODE_EXPIRED') {
    return error(res, 'Kod muddati tugagan. Yangisini yuboring.', 400);
  }
  if (err.message === 'CODE_TOO_MANY_ATTEMPTS') {
    return error(res, 'Juda ko‘p noto‘g‘ri urinish. Kod bekor qilindi — yangisini so‘rang.', 400, {
      attemptsRemaining: 0,
      requiresNewCode: true,
    });
  }
  if (err.message === 'CODE_INVALID' || err.message === 'CODE_NOT_FOUND') {
    return error(res, 'Kod noto\'g\'ri yoki yaroqsiz.', 400, {
      ...(typeof err.attemptsRemaining === 'number' ? { attemptsRemaining: err.attemptsRemaining } : {}),
    });
  }
  return internalError(res, err, 'auth.code');
}

// Boshqaruv belgilarini olib tashlaydi (email shablonlari va UI uchun xavfsiz ism).
function cleanName(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();
}

function notifyEmailChanged(oldEmail, newEmail) {
  // Ikkala manzilga ham xabar: eski egasi o'zgarishdan bexabar qolmasin.
  Promise.resolve()
    .then(() => sendEmailChangedNoticeEmail({ oldEmail, newEmail, accountLabel: 'TravelorAI akkauntingiz' }))
    .catch((err) => logger.error('Email-changed notice failed', { message: err.message }));
}

async function register(req, res) {
  try {
    const { email, password } = req.body;
    const name = cleanName(req.body.name);
    // Sxema faqat min uzunlikni tekshiradi — max shu yerda (schemas papkasi boshqa egada).
    if (name.length < 2) {
      return error(res, 'name: Ism kamida 2 harf', 422);
    }
    if (name.length > MAX_NAME_LENGTH) {
      return error(res, `name: Ism ${MAX_NAME_LENGTH} belgidan oshmasin`, 422);
    }
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      const authProvider = existing.googleId && !existing.password ? 'google' : 'local';
      const message =
        authProvider === 'google'
          ? 'Bu Gmail Google orqali avval ro‘yxatdan o‘tgan. Google bilan kiring.'
          : existing.emailVerified
            ? 'Bu Gmail bilan avval ro‘yxatdan o‘tilgan. Kirish bo‘limidan foydalaning.'
            : 'Bu Gmail bilan ro‘yxatdan o‘tilgan, lekin email hali tasdiqlanmagan. Kodni qayta yuboring.';

      return error(res, message, 409, {
        authProvider,
        requiresVerification: authProvider === 'local' && !existing.emailVerified,
        email: existing.email,
      });
    }

    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        authProvider: AuthProvider.LOCAL,
        emailVerified: false,
      },
    });

    const codeResult = await issueAuthCode({ user, type: AuthCodeType.EMAIL_VERIFICATION });

    return success(
      res,
      {
        message: 'Tasdiqlash kodi yuborildi.',
        email: user.email,
        requiresVerification: true,
        delivery: codeResult.delivery,
        ...(codeResult.devCode ? { devCode: codeResult.devCode } : {}),
      },
      201
    );
  } catch (err) {
    if (err.code === 'P2002') {
      return error(res, 'Bu Gmail bilan avval ro‘yxatdan o‘tilgan. Kirish bo‘limidan foydalaning.', 409);
    }
    return internalError(res, err, 'auth.register');
  }
}

async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    if (!user.password) {
      return error(res, 'Bu akkaunt Google orqali yaratilgan.', 400, { authProvider: 'google' });
    }

    // Tasdiqlangan akkauntga bu yerda token berilmaydi: kod tekshirilmagan holda
    // token qaytarish faqat emailni bilgan odamga kirish imkonini berardi.
    if (user.emailVerified) {
      return error(res, 'Email allaqachon tasdiqlangan. Kirish bo‘limidan foydalaning.', 409, {
        alreadyVerified: true,
      });
    }

    if (user.blocked) {
      return error(res, 'Hisobingiz bloklangan. Qo\'llab-quvvatlashga murojaat qiling.', 403, {
        blocked: true,
        supportEmail: SUPPORT_EMAIL,
      });
    }

    try {
      await consumeAuthCode({ userId: user.id, type: AuthCodeType.EMAIL_VERIFICATION, code });
    } catch (err) {
      return mapCodeError(res, err);
    }

    const refreshedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    return success(res, {
      message: 'Email muvaffaqiyatli tasdiqlandi.',
      ...createAuthPayload(refreshedUser),
    });
  } catch (err) {
    return internalError(res, err, 'auth.verifyEmail');
  }
}

async function resendVerification(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    if (!user.password) {
      return error(res, 'Bu akkaunt Google orqali yaratilgan.', 400, { authProvider: 'google' });
    }

    if (user.emailVerified) {
      return error(res, 'Email allaqachon tasdiqlangan.', 400);
    }

    const codeResult = await issueAuthCode({ user, type: AuthCodeType.EMAIL_VERIFICATION });
    return success(res, {
      message: 'Yangi tasdiqlash kodi yuborildi.',
      email: user.email,
      delivery: codeResult.delivery,
      ...(codeResult.devCode ? { devCode: codeResult.devCode } : {}),
    });
  } catch (err) {
    return internalError(res, err, 'auth.resendVerification');
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const found = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!found) {
      return error(res, 'Email yoki parol noto\'g\'ri.', 401);
    }

    if (found.blocked) {
      return error(res, 'Hisobingiz bloklangan. Qo\'llab-quvvatlashga murojaat qiling.', 403, {
        blocked: true,
        supportEmail: SUPPORT_EMAIL,
      });
    }

    if (!found.password) {
      return error(res, 'Bu email Google orqali ochilgan (paroli yo\'q). "Parolni unutdingizmi?" orqali parol o\'rnating — keyin email va parol bilan kirasiz.', 400, {
        authProvider: 'google',
      });
    }

    const now = new Date();
    const user = withDecay(found, now);

    // Reject early if the account is still inside a lockout window.
    const lock = getActiveLock(user, now);
    if (lock.locked) {
      const payload = lockedResponse(lock);
      return error(res, payload.message, payload.status, payload.extra);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const failure = registerFailure(user, now);
      await prisma.user.update({ where: { id: user.id }, data: failure.data });
      return error(res, failure.message, failure.status, failure.extra);
    }

    if (!user.emailVerified) {
      // Correct password → clear the brute-force counters, but still require verification.
      await prisma.user.update({ where: { id: user.id }, data: RESET_ON_SUCCESS });
      return error(res, 'Email tasdiqlanmagan.', 403, {
        requiresVerification: true,
        email: user.email,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { ...RESET_ON_SUCCESS, lastLoginAt: now },
    });

    return success(res, createAuthPayload(updatedUser));
  } catch (err) {
    return internalError(res, err, 'auth.login');
  }
}

async function forgotPassword(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Google-only accounts (no password yet) are allowed to SET a password this
    // way — the code goes to their own email, so it's the account owner setting it.
    if (!user) {
      return success(res, {
        message: 'Agar email mavjud bo\'lsa, parol tiklash kodi yuborildi.',
      });
    }

    const codeResult = await issueAuthCode({ user, type: AuthCodeType.PASSWORD_RESET });
    return success(res, {
      message: 'Parol tiklash kodi yuborildi.',
      email: user.email,
      delivery: codeResult.delivery,
      ...(codeResult.devCode ? { devCode: codeResult.devCode } : {}),
    });
  } catch (err) {
    return internalError(res, err, 'auth.forgotPassword');
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Mavjud bo'lmagan email uchun ham kod xatosi bilan bir xil javob (enumeratsiya yo'q).
    if (!user) {
      return error(res, 'Kod noto\'g\'ri yoki yaroqsiz.', 400);
    }

    if (user.blocked) {
      return error(res, 'Hisobingiz bloklangan. Qo\'llab-quvvatlashga murojaat qiling.', 403, {
        blocked: true,
        supportEmail: SUPPORT_EMAIL,
      });
    }

    // Note: a Google-only account (no password) can set one here — the code was
    // sent to its own email, so this is the owner adding a password login.

    try {
      await consumeAuthCode({ userId: user.id, type: AuthCodeType.PASSWORD_RESET, code });
    } catch (err) {
      return mapCodeError(res, err);
    }

    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        emailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        lastLoginAt: new Date(),
        // Barcha eski sessiyalar (boshqa qurilmalardagi tokenlar) bekor qilinadi.
        tokenVersion: { increment: 1 },
        // A successful reset also lifts any brute-force lockout.
        ...RESET_ON_SUCCESS,
      },
    });

    // Mobil ilova (mobile/app/reset-password.tsx) shu javobdagi tokenni saqlab,
    // to'g'ridan-to'g'ri kiradi — shuning uchun yangi (tokenVersion'li) token qaytariladi.
    return success(res, {
      message: 'Parol muvaffaqiyatli yangilandi.',
      ...createAuthPayload(updatedUser),
    });
  } catch (err) {
    return internalError(res, err, 'auth.resetPassword');
  }
}

async function googleAuth(req, res) {
  try {
    const { idToken } = req.body;
    const googleProfile = await verifyGoogleIdToken(idToken);

    let user =
      (await prisma.user.findFirst({
        where: {
          OR: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
        },
      })) || null;

    if (user?.blocked) {
      return error(res, 'Hisobingiz bloklangan. Qo\'llab-quvvatlashga murojaat qiling.', 403, {
        blocked: true,
        supportEmail: SUPPORT_EMAIL,
      });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: cleanName(googleProfile.name).slice(0, MAX_NAME_LENGTH) || 'Sayohatchi',
          email: googleProfile.email,
          avatarUrl: googleProfile.avatarUrl,
          googleId: googleProfile.googleId,
          authProvider: AuthProvider.GOOGLE,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Pre-hijack himoyasi: kimdir bu emailga parol bilan akkaunt ochib, emailni
      // tasdiqlamagan bo'lsa, haqiqiy egasi Google bilan kirganda o'sha parol
      // o'chiriladi — aks holda hujumchi o'z paroli bilan kirib qolardi.
      const unverifiedLocalTakeover =
        !user.emailVerified && Boolean(user.password) && user.email === googleProfile.email;

      user = await prisma.user.update({
        where: { id: user.id },
        data: unverifiedLocalTakeover
          ? {
              name: cleanName(googleProfile.name).slice(0, MAX_NAME_LENGTH) || user.name,
              avatarUrl: googleProfile.avatarUrl,
              googleId: user.googleId || googleProfile.googleId,
              password: null,
              authProvider: AuthProvider.GOOGLE,
              emailVerified: true,
              emailVerifiedAt: new Date(),
              lastLoginAt: new Date(),
              tokenVersion: { increment: 1 },
              ...RESET_ON_SUCCESS,
            }
          : {
              name: user.name || googleProfile.name,
              avatarUrl: user.avatarUrl || googleProfile.avatarUrl,
              googleId: user.googleId || googleProfile.googleId,
              authProvider: user.password ? user.authProvider : AuthProvider.GOOGLE,
              emailVerified: true,
              emailVerifiedAt: user.emailVerifiedAt || new Date(),
              lastLoginAt: new Date(),
            },
      });
    }

    return success(res, createAuthPayload(user));
  } catch (err) {
    if (err.message === 'GOOGLE_NOT_CONFIGURED') {
      return error(res, 'Google orqali kirish hozircha sozlanmagan. Email va parol bilan kiring.', 503);
    }

    if (err.response?.status === 400) {
      return error(res, 'Google token yaroqsiz yoki muddati tugagan.', 401);
    }

    if (err.message === 'GOOGLE_AUDIENCE_MISMATCH') {
      return error(res, 'Google client ID mos kelmadi. Android OAuth client (package + SHA-1) ni tekshiring.', 401, err.meta || undefined);
    }

    if (err.message === 'GOOGLE_EMAIL_NOT_VERIFIED') {
      return error(res, 'Google akkauntdagi email tasdiqlanmagan.', 401);
    }

    return internalError(res, err, 'auth.google');
  }
}

// Public "am I logged in?" probe. Uses optionalAuth, so guests get 200 {user:null}
// instead of a 401 — this keeps the website header/session check out of the
// browser error console. Authenticated callers get the same public user shape.
async function getSession(req, res) {
  try {
    if (!req.user?.id) {
      return success(res, { user: null });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    return success(res, { user: user ? buildPublicUser(user) : null });
  } catch (err) {
    return internalError(res, err, 'auth.session');
  }
}

async function updateProfile(req, res) {
  try {
    const { name, lastName, bio, avatarUrl } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        lastName: lastName || null,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
      },
    });

    return success(res, {
      message: 'Profil muvaffaqiyatli yangilandi.',
      user: buildPublicUser(updatedUser),
    });
  } catch (err) {
    return internalError(res, err, 'auth.updateProfile');
  }
}

async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    return success(res, { user: buildPublicUser(user) });
  } catch (err) {
    return internalError(res, err, 'auth.me');
  }
}

async function getPreferences(req, res) {
  try {
    const pref = await prisma.userPreference.findUnique({ where: { userId: req.user.id } });
    return success(res, { preferences: mapPreferences(pref) });
  } catch (err) {
    return internalError(res, err, 'auth.getPreferences');
  }
}

async function updatePreferences(req, res) {
  try {
    const { style, interests } = req.body;
    const normalizedInterests = Array.from(
      new Set(
        (interests || [])
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      )
    );

    const next = await prisma.userPreference.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        style,
        interests: normalizedInterests,
      },
      update: {
        style,
        interests: normalizedInterests,
      },
    });

    return success(res, {
      message: 'Sayohat afzalliklari yangilandi.',
      preferences: mapPreferences(next),
    });
  } catch (err) {
    return internalError(res, err, 'auth.updatePreferences');
  }
}

async function verifyCurrentPassword(user, password) {
  if (!user.password) return true;
  if (!password) return false;
  return bcrypt.compare(password, user.password);
}

function securityRequestLimit(res, message) {
  return error(res, message, 429, {
    contactAdmin: true,
    attemptsRemaining: 0,
  });
}

function isRecentLogin(tokenPayload) {
  const issuedAt = Number(tokenPayload?.iat || 0);
  return issuedAt > 0 && Date.now() / 1000 - issuedAt <= RECENT_LOGIN_SECONDS;
}

async function requestEmailChange(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return error(res, 'Foydalanuvchi topilmadi.', 404);

    const newEmail = normalizeEmail(req.body.newEmail);
    if (newEmail === user.email) return error(res, 'Yangi email joriy emaildan farq qilishi kerak.', 400);

    const emailOwner = await prisma.user.findFirst({
      where: { OR: [{ email: newEmail }, { pendingEmail: newEmail }], NOT: { id: user.id } },
      select: { id: true },
    });
    if (emailOwner) return error(res, 'Bu Gmail boshqa akkauntda ishlatilgan.', 409);

    const passwordOk = await verifyCurrentPassword(user, req.body.password);
    if (!passwordOk) {
      return error(res, user.password ? 'Parol noto‘g‘ri yoki kiritilmagan.' : 'Tasdiqlash amalga oshmadi.', 401, {
        requiresPassword: Boolean(user.password),
      });
    }

    // Parolsiz (Google) akkaunt: joriy egalikni faqat yaqinda kirganlik bilan tasdiqlaymiz.
    if (!user.password && !isRecentLogin(req.user)) {
      return error(res, 'Xavfsizlik uchun hisobdan chiqib, Google bilan qayta kiring va keyin emailni almashtiring.', 401, {
        requiresReauth: true,
      });
    }

    const sameRequest = user.pendingEmail === newEmail;
    const requestCount = sameRequest ? user.emailChangeResendCount : 0;
    if (requestCount >= MAX_SECURITY_CODE_REQUESTS) {
      return securityRequestLimit(res, 'Kod 3 marta so‘raldi. Emailni almashtirish uchun adminga murojaat qiling.');
    }

    // Kod YANGI manzilga yuboriladi — shu bilan yangi email egasi ekanligi isbotlanadi.
    const codeResult = await issueAuthCode({ user, type: AuthCodeType.EMAIL_CHANGE, newEmail });
    const nextCount = requestCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pendingEmail: newEmail,
        emailChangeResendCount: nextCount,
        emailChangeRequestedAt: new Date(),
      },
    });

    return success(res, {
      message: `Tasdiqlash kodi yangi emailingizga yuborildi: ${newEmail}`,
      currentEmail: user.email,
      pendingEmail: newEmail,
      codeSentTo: newEmail,
      attemptsRemaining: MAX_SECURITY_CODE_REQUESTS - nextCount,
      delivery: codeResult.delivery,
      ...(codeResult.devCode ? { devCode: codeResult.devCode } : {}),
    });
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'Bu Gmail boshqa akkauntda ishlatilgan.', 409);
    return internalError(res, err, 'auth.requestEmailChange');
  }
}

async function verifyEmailChange(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return error(res, 'Foydalanuvchi topilmadi.', 404);
    if (!user.pendingEmail) return error(res, 'Email almashtirish so‘rovi topilmadi.', 400);

    // Kod faqat pendingEmail manziliga yuborilgan — uni kiritish yangi emailga
    // egalikni isbotlaydi, shundan keyingina u "tasdiqlangan" deb belgilanadi.
    try {
      await consumeAuthCode({ userId: user.id, type: AuthCodeType.EMAIL_CHANGE, code: req.body.code });
    } catch (err) {
      return mapCodeError(res, err);
    }

    const oldEmail = user.email;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailChangeResendCount: 0,
        emailChangeRequestedAt: null,
      },
    });

    notifyEmailChanged(oldEmail, updatedUser.email);

    return success(res, {
      message: 'Email muvaffaqiyatli almashtirildi.',
      ...createAuthPayload(updatedUser),
    });
  } catch (err) {
    if (err.code === 'P2002') return error(res, 'Bu Gmail boshqa akkauntda ishlatilgan.', 409);
    return internalError(res, err, 'auth.verifyEmailChange');
  }
}

async function requestAccountDeletion(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return error(res, 'Foydalanuvchi topilmadi.', 404);

    const passwordOk = await verifyCurrentPassword(user, req.body.password);
    if (!passwordOk) {
      return error(res, user.password ? 'Hisobni o‘chirish uchun parol noto‘g‘ri yoki kiritilmagan.' : 'Tasdiqlash amalga oshmadi.', 401, {
        requiresPassword: Boolean(user.password),
      });
    }

    if (user.accountDeleteResendCount >= MAX_SECURITY_CODE_REQUESTS) {
      return securityRequestLimit(res, 'Kod 3 marta so‘raldi. Hisobni o‘chirish uchun adminga murojaat qiling.');
    }

    const codeResult = await issueAuthCode({ user, type: AuthCodeType.ACCOUNT_DELETE });
    const nextCount = user.accountDeleteResendCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accountDeleteResendCount: nextCount,
        accountDeleteRequestedAt: new Date(),
      },
    });

    return success(res, {
      message: `Hisobni o‘chirish kodi ${user.email} manziliga yuborildi.`,
      email: user.email,
      attemptsRemaining: MAX_SECURITY_CODE_REQUESTS - nextCount,
      delivery: codeResult.delivery,
      ...(codeResult.devCode ? { devCode: codeResult.devCode } : {}),
    });
  } catch (err) {
    return internalError(res, err, 'auth.requestAccountDeletion');
  }
}

async function deleteAccount(req, res) {
  try {
    const { code } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    try {
      await consumeAuthCode({ userId: user.id, type: AuthCodeType.ACCOUNT_DELETE, code });
    } catch (err) {
      return mapCodeError(res, err);
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return success(res, {
      message: 'Hisob muvaffaqiyatli o\'chirildi.',
    });
  } catch (err) {
    return internalError(res, err, 'auth.deleteAccount');
  }
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  googleAuth,
  updateProfile,
  getMe,
  getSession,
  getPreferences,
  updatePreferences,
  requestEmailChange,
  verifyEmailChange,
  requestAccountDeletion,
  deleteAccount,
};
