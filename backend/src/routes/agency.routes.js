const router = require('express').Router();
const agency = require('../controllers/agency.controller');
const { agencyAuthMiddleware } = require('../middleware/agencyAuth.middleware');
const telegram = require('../controllers/telegram.controller');

router.post('/auth/register', agency.register);
router.post('/auth/verify-email', agency.verifyEmail);
router.post('/auth/login', agency.login);
router.post('/auth/google', agency.googleAuth);

router.use(agencyAuthMiddleware);

router.get('/auth/me', agency.me);
router.post('/auth/email-change/request', agency.requestEmailChange);
router.post('/auth/email-change/resend', agency.resendEmailChange);
router.post('/auth/email-change/confirm', agency.confirmEmailChange);
router.get('/application', agency.getApplication);
router.put('/application', agency.upsertApplication);
router.post('/application/submit', agency.submitApplication);

router.get('/profile', agency.getAgencyProfile);
router.put('/profile', agency.updateAgencyProfile);

router.get('/tours', agency.listTours);
router.post('/tours', agency.createTour);
router.put('/tours/:id', agency.updateTour);
router.post('/tours/:id/submit', agency.submitTour);
router.delete('/tours/:id', agency.deleteTour);

router.get('/bookings', agency.listBookings);
router.patch('/bookings/:id/status', agency.updateBookingStatus);

router.get('/telegram', telegram.getTelegram);
router.post('/telegram/connect', telegram.connectTelegram);
router.post('/telegram/disconnect', telegram.disconnectTelegram);
router.put('/telegram/welcome', telegram.setWelcome);
router.get('/telegram/profile', telegram.getProfile);
router.put('/telegram/profile', telegram.setProfile);
router.get('/telegram/config', telegram.getConfig);
router.put('/telegram/config', telegram.setConfig);
router.get('/telegram/messages', telegram.listMessages);
router.post('/telegram/reply', telegram.reply);

module.exports = router;
