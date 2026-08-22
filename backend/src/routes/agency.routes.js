const router = require('express').Router();
const agency = require('../controllers/agency.controller');
const { agencyAuthMiddleware } = require('../middleware/agencyAuth.middleware');
const { agencyPlan, blockWhenReadOnly, requireCapability, requireOwner } = require('../middleware/agencyPlan.middleware');
const telegram = require('../controllers/telegram.controller');
const team = require('../controllers/agencyTeam.controller');
const presentation = require('../controllers/presentation.controller');
const geocodeCtrl = require('../controllers/geocode.controller');
const aiCtrl = require('../controllers/ai.controller');
const leadFiles = require('../controllers/leadFiles.controller');
const clickPay = require('../controllers/clickPayment.controller');
const crm = require('../controllers/agencyCrm.controller');
const { agencyAuditMiddleware } = require('../middleware/agencyAudit.middleware');

router.post('/auth/register', agency.register);
router.post('/auth/verify-email', agency.verifyEmail);
router.post('/auth/login', agency.login);
router.post('/auth/google', agency.googleAuth);
router.post('/auth/reset-password', agency.resetPassword);

router.use(agencyAuthMiddleware);
router.use(agencyPlan); // req.agency + req.access (tarif/obuna) — barcha authed route'lar uchun
router.use(agencyAuditMiddleware); // barcha muvaffaqiyatli POST/PUT/PATCH/DELETE amallarini AuditLog'ga yozadi

// Hisob boshqaruvi — readOnly'да ham ochiq (onboarding + email o'zgartirish bloklanmaydi).
router.get('/auth/me', agency.me);
router.post('/auth/change-password', agency.changePassword); // bir martalik parol — readOnly'да ham ochiq
router.post('/auth/email-change/request', agency.requestEmailChange);
router.post('/auth/email-change/resend', agency.resendEmailChange);
router.post('/auth/email-change/confirm', agency.confirmEmailChange);
router.get('/application', agency.getApplication);
router.put('/application', agency.upsertApplication);
router.post('/application/submit', agency.submitApplication);

router.get('/profile', agency.getAgencyProfile);
router.put('/profile', blockWhenReadOnly, requireOwner, agency.updateAgencyProfile);

// Obuna to'lovi (CLICK) — blockWhenReadOnly ATAYIN YO'Q:
// obunasi tugagan agentlik aynan to'lov qilishi kerak.
// Diqqat: `/payments/plans` `/payments/:merchantTransId`dan OLDIN turishi shart.
router.get('/payments/plans', clickPay.listPlans);
router.post('/payments/checkout', clickPay.checkout);
router.get('/payments/:merchantTransId', clickPay.paymentStatus);

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
router.patch('/bookings/:id/birthday', blockWhenReadOnly, agency.setCustomerBirthday);
router.patch('/bookings/:id', blockWhenReadOnly, agency.updateLead); // lid maydonlarini tahrirlash

// Server CRM: vazifa, teg, faoliyat, hujjat, menejer va migratsiya/import.
router.get('/crm/bootstrap', crm.bootstrap);
router.post('/crm/tasks', blockWhenReadOnly, crm.createTask);
router.patch('/crm/tasks/:id', blockWhenReadOnly, crm.updateTask);
router.delete('/crm/tasks/:id', blockWhenReadOnly, crm.deleteTask);
router.put('/crm/bookings/:id/tags', blockWhenReadOnly, crm.replaceTags);
router.post('/crm/bookings/:id/activities', blockWhenReadOnly, crm.addActivity);
router.patch('/crm/bookings/:id/assignee', blockWhenReadOnly, crm.assignLead);
router.put('/crm/documents', blockWhenReadOnly, crm.saveDocuments);
router.post('/crm/import/local', crm.importLocal); // eski localStorage ma'lumotini yo'qotmaslik uchun readOnly'da ham ochiq
router.post('/crm/import/csv', blockWhenReadOnly, requireCapability('manualLeads'), crm.importCsv);
router.get('/crm/audit', requireOwner, crm.listAudit);

// Mijoz sharhlari + reyting (marketplace'да ko'rinadi) — ko'rish hammaga ochiq.
router.get('/reviews', agency.listReviews);
router.patch('/reviews/:id', blockWhenReadOnly, agency.setReviewStatus);

// Lid fayllari (pasport / viza / shartnoma) — DB'да, faqat egasiga.
router.get('/bookings/:id/files', leadFiles.listFiles);
router.post('/bookings/:id/files', blockWhenReadOnly, leadFiles.uploadFile);
router.get('/files/:id', leadFiles.downloadFile);
router.delete('/files/:id', blockWhenReadOnly, leadFiles.deleteFile);

// AI yordamchilar — faqat Premium.
router.get('/ai/status', requireCapability('ai'), aiCtrl.status);
router.post('/ai/presentation-note', blockWhenReadOnly, requireCapability('ai'), aiCtrl.presentationNote);

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
router.put('/telegram/birthday-template', blockWhenReadOnly, telegram.setBirthdayTemplate);
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
