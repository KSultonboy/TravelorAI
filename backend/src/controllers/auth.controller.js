const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const {
  AuthCodeType,
  AuthProvider,
  buildPublicUser,
  consumeAuthCode,
  issueAuthCode,
  normalizeEmail,
  verifyGoogleIdToken,
} = require('../services/auth.service');
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
    token: signToken({ id: user.id, email: user.email }),
    user: publicUser,
  };
}

function mapCodeError(res, err) {
  if (err.message === 'CODE_EXPIRED') {
    return error(res, 'Kod muddati tugagan. Yangisini yuboring.', 400);
  }
  if (err.message === 'CODE_INVALID' || err.message === 'CODE_NOT_FOUND') {
    return error(res, 'Kod noto\'g\'ri yoki yaroqsiz.', 400);
  }
  return error(res, err.message, 500);
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing?.emailVerified) {
      return error(res, 'Bu email allaqachon ro\'yxatdan o\'tgan.', 409, {
        authProvider: existing.googleId ? 'google' : 'local',
      });
    }

    if (existing?.googleId && !existing.password) {
      return error(res, 'Bu email Google orqali ro\'yxatdan o\'tgan. Google bilan kiring.', 409, {
        authProvider: 'google',
      });
    }

    const hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            password: hashedPassword,
            authProvider: AuthProvider.LOCAL,
            emailVerified: false,
            emailVerifiedAt: null,
          },
        })
      : await prisma.user.create({
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
      existing ? 200 : 201
    );
  } catch (err) {
    return error(res, err.message, 500);
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

    if (!user.emailVerified) {
      try {
        await consumeAuthCode({ userId: user.id, type: AuthCodeType.EMAIL_VERIFICATION, code });
      } catch (err) {
        return mapCodeError(res, err);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
    return success(res, {
      message: 'Email muvaffaqiyatli tasdiqlandi.',
      ...createAuthPayload(refreshedUser),
    });
  } catch (err) {
    return error(res, err.message, 500);
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
    return error(res, err.message, 500);
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
      return error(res, 'Bu email Google orqali ro\'yxatdan o\'tgan. Google bilan kiring.', 400, {
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
    return error(res, err.message, 500);
  }
}

async function forgotPassword(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.password) {
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
    return error(res, err.message, 500);
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    if (!user.password) {
      return error(res, 'Bu akkaunt Google orqali yaratilgan. Parol tiklash mavjud emas.', 400, {
        authProvider: 'google',
      });
    }

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
      },
    });

    return success(res, {
      message: 'Parol muvaffaqiyatli yangilandi.',
      ...createAuthPayload(updatedUser),
    });
  } catch (err) {
    return error(res, err.message, 500);
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
          name: googleProfile.name,
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
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
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
    if (err.response?.status === 400) {
      return error(res, 'Google token yaroqsiz yoki muddati tugagan.', 401);
    }

    if (err.message === 'GOOGLE_AUDIENCE_MISMATCH') {
      return error(res, 'Google client ID mos kelmadi. Android OAuth client (package + SHA-1) ni tekshiring.', 401, err.meta || undefined);
    }

    if (err.message === 'GOOGLE_EMAIL_NOT_VERIFIED') {
      return error(res, 'Google akkauntdagi email tasdiqlanmagan.', 401);
    }

    return error(res, err.message, 500);
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
    return error(res, err.message, 500);
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
    return error(res, err.message, 500);
  }
}

async function getPreferences(req, res) {
  try {
    const pref = await prisma.userPreference.findUnique({ where: { userId: req.user.id } });
    return success(res, { preferences: mapPreferences(pref) });
  } catch (err) {
    return error(res, err.message, 500);
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
    return error(res, err.message, 500);
  }
}

async function deleteAccount(req, res) {
  try {
    const { password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return error(res, 'Foydalanuvchi topilmadi.', 404);
    }

    if (user.password) {
      if (!password) {
        return error(res, 'Hisobni o\'chirish uchun parolni kiriting.', 400, {
          requiresPassword: true,
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return error(res, 'Parol noto\'g\'ri.', 401, {
          requiresPassword: true,
        });
      }
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return success(res, {
      message: 'Hisob muvaffaqiyatli o\'chirildi.',
    });
  } catch (err) {
    return error(res, err.message, 500);
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
  getPreferences,
  updatePreferences,
  deleteAccount,
};
