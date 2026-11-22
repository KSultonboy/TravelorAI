const router = require('express').Router();
const { getAll, getOne, create, update, remove, bulkCreate } = require('../controllers/poi.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth.middleware');

router.get('/',         getAll);
router.get('/:id',      getOne);

// Katalogni o'zgartirish faqat admin kaliti bilan.
router.post('/',        adminAuthMiddleware, create);
router.post('/bulk',    adminAuthMiddleware, bulkCreate);
router.put('/:id',      adminAuthMiddleware, update);
router.delete('/:id',   adminAuthMiddleware, remove);

module.exports = router;
