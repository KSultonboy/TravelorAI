const router = require('express').Router();
const whatsapp = require('../controllers/whatsapp.controller');

router.get('/webhook', whatsapp.webhookVerify);
router.post('/webhook', whatsapp.webhook);

module.exports = router;
