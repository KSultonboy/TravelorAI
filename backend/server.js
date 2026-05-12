require('dotenv').config();
const app = require('./app');
const { logger } = require('./src/config/logger');
const { connectRedis } = require('./src/config/redis');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  await connectRedis();
  app.listen(PORT, HOST, () => {
    logger.info(`TravelorAI backend running on ${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Server startup failed', err);
  process.exit(1);
});
