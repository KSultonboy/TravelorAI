const router = require('express').Router();
const { geocode, getNearbyPlaces, reverse, searchPlaces, suggest } = require('../controllers/yandex.controller');
const { yandexProxyLimit } = require('../middleware/yandexProxyLimit.middleware');

// Pullik Yandex API'larga proksi — har bir IP uchun alohida limit.
router.use(yandexProxyLimit);

router.get('/places/nearby', getNearbyPlaces);
router.get('/places/search', searchPlaces);
router.get('/suggest', suggest);
router.get('/geocode', geocode);
router.get('/reverse', reverse);

module.exports = router;
