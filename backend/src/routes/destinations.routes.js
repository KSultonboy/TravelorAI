const router = require('express').Router();
const { getAll, getById } = require('../controllers/destinations.controller');

router.get('/', getAll);
router.get('/:id', getById);

module.exports = router;
