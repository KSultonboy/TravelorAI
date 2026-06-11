require('dotenv').config({ override: true });

if (process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL ||= 'postgresql://travelorai:travelorai_pass@localhost:5433/travelorai_db';
  process.env.REDIS_URL ||= 'redis://localhost:6380';
  process.env.ADMIN_SECRET_KEY ||= 'change_me';
}

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
