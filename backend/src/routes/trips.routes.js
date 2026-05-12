const router = require('express').Router();
const { archive, create, duplicate, getAll, getOne, remove, update, updateProgress } = require('../controllers/trips.controller');
const { listMyTripReviews, saveTripReview } = require('../controllers/tripReview.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createTripReviewSchema } = require('../schemas/tripReview.schema');

router.use(authMiddleware);
router.get('/reviews', listMyTripReviews);
router.post('/:id/reviews', validate(createTripReviewSchema), saveTripReview);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id/progress', updateProgress);
router.post('/:id/duplicate', duplicate);
router.patch('/:id/archive', archive);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
