const router = require('express').Router();
const { yandexProxyLimit } = require('../middleware/yandexProxyLimit.middleware');
const { getRoutes, getYandexNearby } = require('../controllers/transport.controller');

router.get('/routes', getRoutes);
router.get('/yandex/nearby', yandexProxyLimit, getYandexNearby);

module.exports = router;
