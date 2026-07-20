const router = require('express').Router();
const agency = require('../controllers/agency.controller');
const { agencyAuthMiddleware } = require('../middleware/agencyAuth.middleware');
const { agencyPlan, blockWhenReadOnly, requireCapability } = require('../middleware/agencyPlan.middleware');
const telegram = require('../controllers/telegram.controller');
const team = require('../controllers/agencyTeam.controller');
const presentation = require('../controllers/presentation.controller');
const geocodeCtrl = require('../controllers/geocode.controller');

router.post('/auth/register', agency.register);
router.post('/auth/verify-email', agency.verifyEmail);
router.post('/auth/login', agency.login);

router.use(agencyAuthMiddleware);
router.use(agencyPlan); // req.agency + req.access (tarif/obuna) — barcha authed route'lar uchun

// Hisob boshqaruvi — readOnly'да ham ochiq (onboarding + email o'zgartirish bloklanmaydi).
router.get('/auth/me', agency.me);
router.post('/auth/email-change/request', agency.requestEmailChange);
router.post('/auth/email-change/resend', agency.resendEmailChange);
router.post('/auth/email-change/confirm', agency.confirmEmailChange);
router.get('/application', agency.getApplication);
router.put('/application', agency.upsertApplication);
router.post('/application/submit', agency.submitApplication);

router.get('/profile', agency.getAgencyProfile);
router.put('/profile', blockWhenReadOnly, agency.updateAgencyProfile);

router.get('/tours', agency.listTours);
router.post('/tours', blockWhenReadOnly, agency.createTour);
router.put('/tours/:id', blockWhenReadOnly, agency.updateTour);
router.post('/tours/:id/submit', blockWhenReadOnly, agency.submitTour);
router.delete('/tours/:id', blockWhenReadOnly, agency.deleteTour);

// Marshrut nuqtalarini qidirish (OSM Nominatim) — tur tahrirlagichi uchun.
router.get('/geocode', geocodeCtrl.geocode);

router.get('/bookings', agency.listBookings);
router.patch('/bookings/:id/status', blockWhenReadOnly, agency.updateBookingStatus);
router.post('/leads', blockWhenReadOnly, requireCapability('manualLeads'), agency.createManualLead);
router.patch('/bookings/:id/stage', blockWhenReadOnly, agency.updatePipelineStage);

// Dinamik takliflar (Pro va yuqori tarif) — ochilish kuzatuvi bilan.
router.get('/presentations', requireCapability('presentations'), presentation.listPresentations);
router.post('/presentations', blockWhenReadOnly, requireCapability('presentations'), presentation.createPresentation);
router.delete('/presentations/:id', blockWhenReadOnly, requireCapability('presentations'), presentation.deletePresentation);

// Telegram bot — Pro va yuqori tarif (requireCapability). Yozuvlar muddat o'tsa ham bloklanadi.
router.use('/telegram', requireCapability('telegram'));
router.get('/telegram', telegram.getTelegram);
router.post('/telegram/connect', blockWhenReadOnly, telegram.connectTelegram);
router.post('/telegram/disconnect', blockWhenReadOnly, telegram.disconnectTelegram);
router.put('/telegram/welcome', blockWhenReadOnly, telegram.setWelcome);
router.get('/telegram/profile', telegram.getProfile);
router.put('/telegram/profile', blockWhenReadOnly, telegram.setProfile);
router.get('/telegram/config', telegram.getConfig);
router.put('/telegram/config', blockWhenReadOnly, telegram.setConfig);
router.get('/telegram/messages', telegram.listMessages);
router.post('/telegram/reply', blockWhenReadOnly, telegram.reply);
router.post('/telegram/broadcast', blockWhenReadOnly, requireCapability('broadcast'), telegram.broadcast);

// Jamoa (Business tarif) — ko'rish hammaga, boshqarish faqat egasiga (controller ichida tekshiriladi).
router.get('/team', team.listTeam);
router.post('/team', blockWhenReadOnly, requireCapability('team'), team.addMember);
router.put('/team/:id', blockWhenReadOnly, requireCapability('team'), team.updateMember);
router.delete('/team/:id', blockWhenReadOnly, requireCapability('team'), team.removeMember);

module.exports = router;
