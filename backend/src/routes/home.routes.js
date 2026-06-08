const router = require('express').Router();
const {
  getAgencies,
  getHeroSlides,
  getHome,
  getPlaces,
  getStories,
  getTours,
  recordInteraction,
} = require('../controllers/home.controller');

router.get('/', getHome);
router.get('/hero-slides', getHeroSlides);
router.get('/places', getPlaces);
router.get('/tours', getTours);
router.get('/agencies', getAgencies);
router.get('/stories', getStories);
router.post('/interactions', recordInteraction);

module.exports = router;
