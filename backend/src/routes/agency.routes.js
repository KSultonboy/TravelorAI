const router = require('express').Router();
const agency = require('../controllers/agency.controller');
const { agencyAuthMiddleware } = require('../middleware/agencyAuth.middleware');
const { authLimiter, securityCodeLimiter } = require('../middleware/rateLimit.middleware');

router.post('/auth/register', authLimiter, agency.register);
router.post('/auth/verify-email', authLimiter, agency.verifyEmail);
router.post('/auth/login', authLimiter, agency.login);

router.use(agencyAuthMiddleware);

router.get('/auth/me', agency.me);
router.post('/auth/email-change/request', securityCodeLimiter, agency.requestEmailChange);
router.post('/auth/email-change/resend', securityCodeLimiter, agency.resendEmailChange);
router.post('/auth/email-change/confirm', securityCodeLimiter, agency.confirmEmailChange);
router.get('/application', agency.getApplication);
router.put('/application', agency.upsertApplication);
router.post('/application/submit', agency.submitApplication);

router.get('/profile', agency.getAgencyProfile);
router.put('/profile', agency.updateAgencyProfile);

router.get('/tours', agency.listTours);
router.post('/tours', agency.createTour);
router.put('/tours/:id', agency.updateTour);
router.post('/tours/:id/submit', agency.submitTour);

router.get('/bookings', agency.listBookings);
router.patch('/bookings/:id/status', agency.updateBookingStatus);

module.exports = router;
