const {
  withDecay,
  getActiveLock,
  registerFailure,
  lockedResponse,
  RESET_ON_SUCCESS,
  MAX_ATTEMPTS_BEFORE_LOCK,
} = require('./loginSecurity.service');

function freshUser(overrides = {}) {
  return {
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockoutUntil: null,
    lockoutLevel: 0,
    ...overrides,
  };
}

// Simulate N wrong-password attempts in a row, applying each returned patch to
// the in-memory user, and return the final result of the last attempt.
function runAttempts(user, count, now) {
  let current = user;
  let last;
  for (let i = 0; i < count; i += 1) {
    last = registerFailure(current, now);
    current = { ...current, ...last.data };
  }
  return { user: current, last };
}

describe('loginSecurity.service', () => {
  const t0 = new Date('2026-07-14T10:00:00Z');

  test('first four failures return 401 with a decreasing remaining counter', () => {
    let user = freshUser();
    for (let i = 1; i <= MAX_ATTEMPTS_BEFORE_LOCK - 1; i += 1) {
      const res = registerFailure(user, t0);
      expect(res.status).toBe(401);
      expect(res.extra.attemptsRemaining).toBe(MAX_ATTEMPTS_BEFORE_LOCK - i);
      user = { ...user, ...res.data };
    }
  });

  test('the 5th failure locks the account for 5 minutes (level 1)', () => {
    const { last } = runAttempts(freshUser(), 5, t0);
    expect(last.status).toBe(423);
    expect(last.extra.locked).toBe(true);
    expect(last.extra.retrySeconds).toBe(5 * 60);
    expect(last.extra.lockoutLevel).toBe(1);
    expect(last.extra.supportEmail).toBeUndefined();
  });

  test('escalates 5 -> 20 -> 60 minutes and only surfaces support at the final tier', () => {
    // Level 1 (5 min)
    let { user } = runAttempts(freshUser(), 5, t0);
    expect(getActiveLock(user, t0).locked).toBe(true);

    // After the lock expires, 5 more failures -> level 2 (20 min)
    let after = new Date(user.lockoutUntil.getTime() + 1000);
    let round = runAttempts(user, 5, after);
    expect(round.last.extra.retrySeconds).toBe(20 * 60);
    expect(round.last.extra.lockoutLevel).toBe(2);
    expect(round.last.extra.supportEmail).toBeUndefined();
    user = round.user;

    // After that lock expires, 5 more -> level 3 (60 min) + support
    after = new Date(user.lockoutUntil.getTime() + 1000);
    round = runAttempts(user, 5, after);
    expect(round.last.extra.retrySeconds).toBe(60 * 60);
    expect(round.last.extra.lockoutLevel).toBe(3);
    expect(round.last.extra.supportEmail).toBeTruthy();
    user = round.user;

    // Stays capped at level 3 / 60 min afterwards
    after = new Date(user.lockoutUntil.getTime() + 1000);
    round = runAttempts(user, 5, after);
    expect(round.last.extra.retrySeconds).toBe(60 * 60);
    expect(round.last.extra.lockoutLevel).toBe(3);
    expect(round.last.extra.supportEmail).toBeTruthy();
  });

  test('an active lock is rejected before any password check', () => {
    const { user } = runAttempts(freshUser(), 5, t0);
    const lock = getActiveLock(user, new Date(t0.getTime() + 60 * 1000));
    expect(lock.locked).toBe(true);
    const payload = lockedResponse(lock);
    expect(payload.status).toBe(423);
    expect(payload.extra.retrySeconds).toBeGreaterThan(0);
  });

  test('lock expires exactly after its window', () => {
    const { user } = runAttempts(freshUser(), 5, t0);
    const justBefore = new Date(user.lockoutUntil.getTime() - 1000);
    const justAfter = new Date(user.lockoutUntil.getTime() + 1000);
    expect(getActiveLock(user, justBefore).locked).toBe(true);
    expect(getActiveLock(user, justAfter).locked).toBe(false);
  });

  test('RESET_ON_SUCCESS clears every counter', () => {
    expect(RESET_ON_SUCCESS).toEqual({
      failedLoginAttempts: 0,
      lockoutLevel: 0,
      lockoutUntil: null,
      lastFailedLoginAt: null,
    });
  });

  test('counters decay after 24h of no failures when not locked', () => {
    const stale = freshUser({
      failedLoginAttempts: 4,
      lockoutLevel: 2,
      lastFailedLoginAt: new Date('2026-07-10T10:00:00Z'),
    });
    const decayed = withDecay(stale, t0);
    expect(decayed.failedLoginAttempts).toBe(0);
    expect(decayed.lockoutLevel).toBe(0);
  });

  test('a currently-locked account does NOT decay even if the last failure is old', () => {
    const locked = freshUser({
      failedLoginAttempts: 0,
      lockoutLevel: 3,
      lastFailedLoginAt: new Date('2026-07-10T10:00:00Z'),
      lockoutUntil: new Date(t0.getTime() + 30 * 60 * 1000),
    });
    const result = withDecay(locked, t0);
    expect(result.lockoutLevel).toBe(3);
    expect(getActiveLock(result, t0).locked).toBe(true);
  });
});
