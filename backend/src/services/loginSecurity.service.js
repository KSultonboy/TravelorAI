// ─── Login brute-force protection ─────────────────────────────────────────────
// After MAX_ATTEMPTS_BEFORE_LOCK consecutive wrong passwords the account is locked
// for an escalating duration. Each new lock bumps the level, so a persistent
// attacker faces progressively longer cool-downs before we point them at support.
//
//   level 1 → 5 minutes
//   level 2 → 20 minutes
//   level 3 → 60 minutes (final tier — from here we also surface the support email)
//
// Counters decay after DECAY_WINDOW_MS of no failed attempts so an honest user who
// mistypes today is not punished for a mistake weeks ago.

const MAX_ATTEMPTS_BEFORE_LOCK = 5;
const LOCK_DURATIONS_MINUTES = [5, 20, 60]; // index = level - 1
const DECAY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'support@travelorai.local';

function humanDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} soniya`;
  if (seconds === 0) return `${minutes} daqiqa`;
  return `${minutes} daqiqa ${seconds} soniya`;
}

// Zero the counters if the last failure is old and the account is not currently
// locked. Pure — returns a (possibly) adjusted shallow copy of the user.
function withDecay(user, now = new Date()) {
  const notLocked = !user.lockoutUntil || new Date(user.lockoutUntil) <= now;
  const stale =
    user.lastFailedLoginAt && now.getTime() - new Date(user.lastFailedLoginAt).getTime() > DECAY_WINDOW_MS;
  if (notLocked && stale) {
    return { ...user, failedLoginAttempts: 0, lockoutLevel: 0 };
  }
  return user;
}

// Is the account currently locked? Returns remaining time + whether we should
// nudge the user toward support (final tier).
function getActiveLock(user, now = new Date()) {
  if (user.lockoutUntil && new Date(user.lockoutUntil) > now) {
    const remainingSeconds = Math.max(1, Math.ceil((new Date(user.lockoutUntil).getTime() - now.getTime()) / 1000));
    const level = user.lockoutLevel || 0;
    return {
      locked: true,
      remainingSeconds,
      level,
      atSupportTier: level >= LOCK_DURATIONS_MINUTES.length,
    };
  }
  return { locked: false, remainingSeconds: 0, level: user.lockoutLevel || 0, atSupportTier: false };
}

// Build the response payload for an account that is already locked.
function lockedResponse(lock) {
  const wait = humanDuration(lock.remainingSeconds);
  const base = `Hisob vaqtincha bloklandi. ${wait} dan so'ng qayta urinib ko'ring.`;
  return {
    status: 423,
    message: lock.atSupportTier
      ? `${base} Parolni eslay olmasangiz, "Parolni unutdingizmi?" orqali tiklang yoki qo'llab-quvvatlashga yozing: ${SUPPORT_EMAIL}`
      : base,
    extra: {
      locked: true,
      retrySeconds: lock.remainingSeconds,
      lockoutLevel: lock.level,
      ...(lock.atSupportTier ? { supportEmail: SUPPORT_EMAIL } : {}),
    },
  };
}

// Register one wrong-password attempt. Returns the Prisma update `data`, plus the
// HTTP status / message / extra to send back.
function registerFailure(user, now = new Date()) {
  const attempts = (user.failedLoginAttempts || 0) + 1;

  if (attempts >= MAX_ATTEMPTS_BEFORE_LOCK) {
    const nextLevel = Math.min((user.lockoutLevel || 0) + 1, LOCK_DURATIONS_MINUTES.length);
    const durationMinutes = LOCK_DURATIONS_MINUTES[nextLevel - 1];
    const lockoutUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const atSupportTier = nextLevel >= LOCK_DURATIONS_MINUTES.length;

    return {
      data: {
        failedLoginAttempts: 0, // reset the window; next 5 fails escalate the level
        lastFailedLoginAt: now,
        lockoutUntil,
        lockoutLevel: nextLevel,
      },
      status: 423,
      message: atSupportTier
        ? `Juda ko'p noto'g'ri urinish. Hisob ${durationMinutes} daqiqaga bloklandi. Parolni "Parolni unutdingizmi?" orqali tiklang yoki qo'llab-quvvatlashga yozing: ${SUPPORT_EMAIL}`
        : `Juda ko'p noto'g'ri urinish. Hisob ${durationMinutes} daqiqaga bloklandi.`,
      extra: {
        locked: true,
        retrySeconds: durationMinutes * 60,
        lockoutLevel: nextLevel,
        ...(atSupportTier ? { supportEmail: SUPPORT_EMAIL } : {}),
      },
    };
  }

  const attemptsRemaining = MAX_ATTEMPTS_BEFORE_LOCK - attempts;
  return {
    data: { failedLoginAttempts: attempts, lastFailedLoginAt: now },
    status: 401,
    message: `Email yoki parol noto'g'ri. Yana ${attemptsRemaining} ta urinish qoldi.`,
    extra: { attemptsRemaining },
  };
}

// Applied after any successful password check — clears all counters.
const RESET_ON_SUCCESS = {
  failedLoginAttempts: 0,
  lockoutLevel: 0,
  lockoutUntil: null,
  lastFailedLoginAt: null,
};

module.exports = {
  MAX_ATTEMPTS_BEFORE_LOCK,
  LOCK_DURATIONS_MINUTES,
  SUPPORT_EMAIL,
  humanDuration,
  withDecay,
  getActiveLock,
  lockedResponse,
  registerFailure,
  RESET_ON_SUCCESS,
};
