const router = require('express').Router();
const api = require('../controllers/publicApi.controller');
const { publicApiAuth, requireApiScope } = require('../middleware/publicApi.middleware');

router.use(publicApiAuth);
router.get('/leads', requireApiScope('leads:read'), api.listLeads);
router.get('/leads/:id', requireApiScope('leads:read'), api.getLead);
router.post('/leads', requireApiScope('leads:write'), api.createLead);
router.patch('/leads/:id', requireApiScope('leads:write'), api.updateLead);
router.get('/tours', requireApiScope('tours:read'), api.listTours);
router.get('/finance/transactions', requireApiScope('finance:read'), api.listFinance);

module.exports = router;
