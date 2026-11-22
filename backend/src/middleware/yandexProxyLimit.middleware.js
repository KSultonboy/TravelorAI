// /yandex/* va /transport/yandex/nearby — pullik Yandex API'larga proksi.
// Global limiter (500 so'rov / 15 daqiqa) bu yerda yetarli emas: bitta IP
// Yandex kvotasini tez yeb qo'yishi mumkin. Shuning uchun alohida, qattiqroq
// per-IP limit (standart: daqiqasiga 30 ta) qo'llanadi.
const { createWindowLimiter } = require('../services/memoryCache.service');

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.YANDEX_PROXY_PER_IP_PER_MIN || 30);

function createYandexProxyLimiter({ windowMs = WINDOW_MS, max = MAX_PER_WINDOW } = {}) {
  const limiter = createWindowLimiter({ windowMs, max });
  function yandexProxyLimit(req, res, next) {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const result = limiter.hit(ip);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))));
      return res.status(429).json({
        success: false,
        message: "Xarita so'rovlari juda ko'p. Bir daqiqadan so'ng qayta urinib ko'ring.",
      });
    }
    return next();
  }
  yandexProxyLimit.reset = () => limiter.reset();
  return yandexProxyLimit;
}

const yandexProxyLimit = createYandexProxyLimiter();

module.exports = { yandexProxyLimit, createYandexProxyLimiter };
