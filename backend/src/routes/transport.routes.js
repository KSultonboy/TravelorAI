const router = require('express').Router();
const { getRoutes, getYandexNearby } = require('../controllers/transport.controller');

router.get('/routes', getRoutes);
router.get('/yandex/nearby', getYandexNearby);

module.exports = router;
