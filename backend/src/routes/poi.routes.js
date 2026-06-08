const router = require('express').Router();
const { getAll, getOne, create, update, remove, bulkCreate } = require('../controllers/poi.controller');

router.get('/',         getAll);
router.get('/:id',      getOne);
router.post('/',        create);
router.post('/bulk',    bulkCreate);
router.put('/:id',      update);
router.delete('/:id',   remove);

module.exports = router;
