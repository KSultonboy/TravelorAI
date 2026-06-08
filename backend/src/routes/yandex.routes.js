const router = require('express').Router();
const { geocode, getNearbyPlaces, reverse, searchPlaces, suggest } = require('../controllers/yandex.controller');

router.get('/places/nearby', getNearbyPlaces);
router.get('/places/search', searchPlaces);
router.get('/suggest', suggest);
router.get('/geocode', geocode);
router.get('/reverse', reverse);

module.exports = router;
