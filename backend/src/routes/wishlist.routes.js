const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createWishlistItemSchema } = require('../schemas/wishlist.schema');
const { getAll, create, remove } = require('../controllers/wishlist.controller');

router.use(authMiddleware);
router.get('/', getAll);
router.post('/', validate(createWishlistItemSchema), create);
router.delete('/:id', remove);

module.exports = router;
