const { redisClient } = require('../config/redis');
const { logger } = require('../config/logger');

// isOpen faqat soket ochiqligini bildiradi; buyruq yuborish uchun klient tayyor (isReady) bo'lishi kerak.
async function getCache(key) {
  try {
    if (!redisClient.isReady) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn('Cache get xatosi', { key, message: err.message });
    return null;
  }
}

async function setCache(key, data, ttlSeconds = 600) {
  try {
    if (!redisClient.isReady) return;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    logger.warn('Cache set xatosi', { key, message: err.message });
  }
}

async function deleteCache(key) {
  try {
    if (!redisClient.isReady) return;
    await redisClient.del(key);
  } catch (err) {
    logger.warn('Cache delete xatosi', { key, message: err.message });
  }
}

module.exports = { getCache, setCache, deleteCache };
