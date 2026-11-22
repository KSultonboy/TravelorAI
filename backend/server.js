require('dotenv').config({ override: true });

// Env tekshiruvi BOSHQA har qanday moduldan oldin: production'da maxfiy kalitlar
// yo'q/zaif bo'lsa server aniq xabar bilan to'xtaydi; dev'da zaxira qiymatlar
// faqat src/config/env.js ichida.
const { bootstrapEnv } = require('./src/config/env');
bootstrapEnv();

const app = require('./app');
const { logger } = require('./src/config/logger');
const { prisma } = require('./src/config/database');
const { connectRedis, redisClient } = require('./src/config/redis');
const { startScheduler } = require('./src/services/scheduler.service');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server = null;
let shuttingDown = false;

function errorMeta(err) {
  return { message: err?.message || String(err), stack: err?.stack };
}

// Yangi ulanishlarni to'xtatadi, ochiq so'rovlarni tugatadi, DB/Redis'ni yopadi.
function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`Server to'xtatilmoqda: ${reason}`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown vaqti tugadi — majburan chiqilmoqda');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  const closeServer = server
    ? new Promise((resolve) => server.close(() => resolve()))
    : Promise.resolve();

  closeServer
    .then(() => prisma.$disconnect().catch(() => {}))
    .then(() => (redisClient?.isOpen ? redisClient.quit().catch(() => {}) : null))
    .finally(() => process.exit(exitCode));
}

// Ushlanmagan promise rad etilishi: logga yozamiz, lekin jarayonni qulatmaymiz —
// bitta "fire-and-forget" xatosi butun API'ni to'xtatib qo'ymasin.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', errorMeta(reason));
});

// Sinxron ushlanmagan xato — jarayon holati noaniq: log + graceful shutdown
// (konteyner restart siyosati serverni qayta ko'taradi).
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', errorMeta(err));
  shutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

async function start() {
  await connectRedis();
  server = app.listen(PORT, HOST, () => {
    logger.info(`TravelorAI backend running on ${HOST}:${PORT}`);
    startScheduler(); // tug'ilgan kun tabrigi + sayohat eslatmasi (fon)
  });
}

start().catch((err) => {
  logger.error('Server startup failed', errorMeta(err));
  process.exit(1);
});
