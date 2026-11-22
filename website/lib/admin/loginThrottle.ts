/**
 * Admin login uchun brute-force himoyasi (xotirada, bitta Node jarayoni).
 *
 *  - IP bo'yicha: WINDOW ichida IP_MAX_FAILURES ta xato → o'sha IP LOCK_MS ga bloklanadi.
 *  - Global: WINDOW ichida GLOBAL_MAX_FAILURES ta xato (barcha IP'lar) → login
 *    LOCK_MS ga hammaga yopiladi (taqsimlangan / IP almashtirib hujumga qarshi).
 *
 * Konteyner qayta ishga tushsa hisoblagich nolga tushadi — bu qabul qilinadi:
 * parol baribir kuchli va tasodifiy bo'lishi shart (lib/admin/config.ts).
 */

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const IP_MAX_FAILURES = 5;
const GLOBAL_MAX_FAILURES = 50;
const MAX_TRACKED_IPS = 10_000;

type Bucket = { failures: number; windowStart: number; lockedUntil: number };

const ipBuckets = new Map<string, Bucket>();
const globalBucket: Bucket = { failures: 0, windowStart: 0, lockedUntil: 0 };

function freshen(bucket: Bucket, now: number) {
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.failures = 0;
    bucket.windowStart = now;
  }
}

function prune(now: number) {
  if (ipBuckets.size < MAX_TRACKED_IPS) return;
  for (const [ip, bucket] of ipBuckets) {
    if (bucket.lockedUntil < now && now - bucket.windowStart > WINDOW_MS) ipBuckets.delete(ip);
  }
  // Hali ham to'la bo'lsa — eng eskilarini tashlaymiz (Map qo'shilish tartibini saqlaydi).
  while (ipBuckets.size >= MAX_TRACKED_IPS) {
    const oldest = ipBuckets.keys().next().value;
    if (oldest === undefined) break;
    ipBuckets.delete(oldest);
  }
}

/** Bloklanganmi? Bloklangan bo'lsa — necha soniyadan keyin urinish mumkin. */
export function loginBlockedFor(ip: string, now = Date.now()): number {
  if (globalBucket.lockedUntil > now) return Math.ceil((globalBucket.lockedUntil - now) / 1000);
  const bucket = ipBuckets.get(ip);
  if (bucket && bucket.lockedUntil > now) return Math.ceil((bucket.lockedUntil - now) / 1000);
  return 0;
}

export function recordLoginFailure(ip: string, now = Date.now()) {
  freshen(globalBucket, now);
  globalBucket.failures += 1;
  if (globalBucket.failures >= GLOBAL_MAX_FAILURES) {
    globalBucket.lockedUntil = now + LOCK_MS;
    globalBucket.failures = 0;
    globalBucket.windowStart = now;
  }

  prune(now);
  let bucket = ipBuckets.get(ip);
  if (!bucket) {
    bucket = { failures: 0, windowStart: now, lockedUntil: 0 };
    ipBuckets.set(ip, bucket);
  }
  freshen(bucket, now);
  bucket.failures += 1;
  if (bucket.failures >= IP_MAX_FAILURES) {
    bucket.lockedUntil = now + LOCK_MS;
    bucket.failures = 0;
    bucket.windowStart = now;
  }
}

export function recordLoginSuccess(ip: string) {
  ipBuckets.delete(ip);
}
