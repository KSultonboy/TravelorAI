// Jarayon ichidagi (in-memory) LRU + TTL kesh va oddiy fixed-window limiter.
// Redis'ga bog'liq emas — Redis o'chiq bo'lsa ham pullik tashqi API'lar
// (Yandex) va reyting hodisalari himoyalangan bo'ladi. Bitta backend
// instansiyasi uchun yetarli; bir nechta instansiyada har biri o'z hisobini yuritadi.

class TtlLruCache {
  constructor({ max = 1000, ttlMs = 60_000 } = {}) {
    this.max = Math.max(1, max);
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // LRU: oxirgi foydalanilgan element oxiriga ko'chadi.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    return value;
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

/**
 * Fixed-window hisoblagich: `hit(key)` har chaqiruvda hisobni oshiradi.
 * `allowed: false` — oyna ichida `max` dan oshdi.
 */
function createWindowLimiter({ windowMs, max, maxKeys = 50_000 }) {
  const store = new TtlLruCache({ max: maxKeys, ttlMs: windowMs });
  return {
    hit(key) {
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
      entry.count += 1;
      store.set(key, entry, Math.max(1, entry.resetAt - now));
      return { allowed: entry.count <= max, count: entry.count, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt };
    },
    reset() {
      store.clear();
    },
  };
}

/** Bir xil kalit uchun parallel so'rovlarni bitta tashqi chaqiruvga birlashtiradi va natijani keshlaydi. */
function createCachedFetcher({ max = 500, ttlMs = 10 * 60_000, shouldCache = () => true } = {}) {
  const cache = new TtlLruCache({ max, ttlMs });
  const inflight = new Map();
  async function run(key, loader) {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    if (inflight.has(key)) return inflight.get(key);
    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (shouldCache(value)) cache.set(key, value);
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }
  run.cache = cache;
  return run;
}

module.exports = { TtlLruCache, createWindowLimiter, createCachedFetcher };
