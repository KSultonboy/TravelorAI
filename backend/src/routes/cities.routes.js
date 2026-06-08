const router = require('express').Router();
const { getAll } = require('../controllers/cities.controller');

router.get('/', getAll);

module.exports = router;
