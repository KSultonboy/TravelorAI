const { createClient } = require('redis');
const { logger } = require('./logger');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { message: err.message });
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.warn('Redis ulanmadi — cache ishlamaydi', { message: err.message });
  }
}

module.exports = { redisClient, connectRedis };
