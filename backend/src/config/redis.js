const { createClient } = require('redis');
const { logger } = require('./logger');

// Redis faqat kesh uchun. U ishlamasa ham backend ishga tushishi va so'rovlarga
// javob berishi shart, shuning uchun ulanish kutilishi vaqt bilan cheklangan.
const CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 3000);
const ERROR_LOG_INTERVAL_MS = 60_000;

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // Tayyor bo'lmagan klientga yuborilgan buyruq navbatda osilib qolmasin, darhol xato bersin.
  disableOfflineQueue: true,
  socket: {
    connectTimeout: CONNECT_TIMEOUT_MS,
    reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 30_000),
  },
});

let lastErrorLogAt = 0;
redisClient.on('error', (err) => {
  const now = Date.now();
  if (now - lastErrorLogAt < ERROR_LOG_INTERVAL_MS) return;
  lastErrorLogAt = now;
  logger.error('Redis client error', { message: err.message });
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

redisClient.on('ready', () => {
  logger.info('Redis ready');
});

async function connectRedis() {
  const connecting = redisClient.connect().catch((err) => {
    logger.warn('Redis ulanmadi — cache ishlamaydi', { message: err.message });
  });
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, CONNECT_TIMEOUT_MS);
  });
  await Promise.race([connecting, timeout]);
  clearTimeout(timer);
  if (!redisClient.isReady) {
    logger.warn('Redis hali tayyor emas — server keshsiz ishga tushmoqda, ulanish fonda davom etadi');
  }
}

function isCacheReady() {
  return redisClient.isReady;
}

module.exports = { redisClient, connectRedis, isCacheReady };
