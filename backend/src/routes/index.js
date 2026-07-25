const router = require('express').Router();
const { redisClient } = require('../config/redis');
const { prisma } = require('../config/database');

router.use('/auth', require('./auth.routes'));
router.use('/destinations', require('./destinations.routes'));
router.use('/cities', require('./cities.routes'));
router.use('/planner', require('./planner.routes'));
router.use('/home', require('./home.routes'));
router.use('/transport', require('./transport.routes'));
router.use('/yandex', require('./yandex.routes'));
router.use('/trips', require('./trips.routes'));
router.use('/wishlist', require('./wishlist.routes'));
router.use('/poi', require('./poi.routes'));
router.use('/achievements', require('./achievements.routes'));
router.use('/feedback', require('./feedback.routes'));
router.use('/bookings', require('./bookings.routes'));
router.use('/agency', require('./agency.routes'));
router.use('/telegram', require('./telegram.routes'));
router.use('/p', require('./presentation.routes'));
router.use('/miniapp', require('./miniapp.routes'));
router.use('/admin', require('./admin.routes'));

// Ommaviy tariflar — /pricing sahifasi va oferta uchun (narxlar so'mda).
router.get('/tariffs', async (req, res) => {
  try {
    const rows = await prisma.tariff.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        slug: true, name: true, priceMonthly: true, priceMonthlyUzs: true,
        features: true, sortOrder: true,
      },
    });
    res.json({
      success: true,
      data: rows.map((t) => ({
        ...t,
        features: t.features ? String(t.features).split('|').map((s) => s.trim()).filter(Boolean) : [],
      })),
    });
  } catch {
    res.status(500).json({ success: false, message: 'Tariflarni olib bo\'lmadi' });
  }
});

router.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let cacheStatus = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {}

  try {
    if (redisClient.isOpen) cacheStatus = 'connected';
  } catch {}

  res.json({
    status: 'ok',
    db: dbStatus,
    cache: cacheStatus,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
