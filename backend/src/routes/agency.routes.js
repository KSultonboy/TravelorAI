const router = require('express').Router();
const agency = require('../controllers/agency.controller');
const { agencyAuthMiddleware } = require('../middleware/agencyAuth.middleware');
const { agencyPlan, blockWhenReadOnly, requireCapability, requireOwner } = require('../middleware/agencyPlan.middleware');
const telegram = require('../controllers/telegram.controller');
const instagram = require('../controllers/instagram.controller');
const whatsapp = require('../controllers/whatsapp.controller');
const team = require('../controllers/agencyTeam.controller');
const presentation = require('../controllers/presentation.controller');
const geocodeCtrl = require('../controllers/geocode.controller');
const aiCtrl = require('../controllers/ai.controller');
const leadFiles = require('../controllers/leadFiles.controller');
const clickPay = require('../controllers/clickPayment.controller');
const crm = require('../controllers/agencyCrm.controller');
const finance = require('../controllers/agencyFinance.controller');
const executive = require('../controllers/agencyExecutive.controller');
const reconciliation = require('../controllers/agencyReconciliation.controller');
const automation = require('../controllers/agencyAutomation.controller');
const integrations = require('../controllers/agencyIntegration.controller');
const documents = require('../controllers/agencyDocuments.controller');
const { agencyAuditMiddleware } = require('../middleware/agencyAudit.middleware');
const { requireRole, requireApprovedAgency, ROLE_GROUPS } = require('../middleware/agencyRole.middleware');

// Rol guruhlari (config/agencyPlans.js ROLE_SECTIONS bilan mos):
const OWNER = requireRole(ROLE_GROUPS.owner);
const OWNER_MANAGER = requireRole(ROLE_GROUPS.ownerManager);
const LEAD_ROLES = requireRole(ROLE_GROUPS.leads); // owner, manager, agent
const PACKAGE_ROLES = requireRole(ROLE_GROUPS.packages); // owner, manager, agent
const FINANCE_ROLES = requireRole(ROLE_GROUPS.finance); // owner, manager, accountant
const LEAD_FILE_ROLES = requireRole(ROLE_GROUPS.leadFiles); // pasport fayllari: owner, manager, agent

const authLimit = require('../middleware/rateLimit.middleware').createAuthLimiters();
router.post('/auth/register', ...authLimit.register, agency.register);
router.post('/auth/verify-email', ...authLimit.verifyEmail, agency.verifyEmail);
router.post('/auth/login', ...authLimit.login, agency.login);
router.post('/auth/google', ...authLimit.google, agency.googleAuth);
router.post('/auth/reset-password', ...authLimit.reset, agency.resetPassword);

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
// Billingni o'qish rad etilgan/o'chirilgan agentlikka ham ochiq (sababini ko'rishi uchun).
router.get('/payments/plans', clickPay.listPlans);
router.get('/payments/history', clickPay.paymentHistory);
router.post('/payments/checkout', requireApprovedAgency, OWNER, clickPay.checkout);
router.get('/payments/:merchantTransId', clickPay.paymentStatus);

// ── Shu qatordan pastdagi barcha CRM yo'llari faqat admin tasdiqlagan, faol agentlik uchun.
router.use(requireApprovedAgency);
router.use('/engagement', require('./agencyEngagement.routes')); // lid xabarnomalari, haftalik hisobot

router.get('/tours', agency.listTours);
router.post('/tours', blockWhenReadOnly, PACKAGE_ROLES, agency.createTour);
router.put('/tours/:id', blockWhenReadOnly, PACKAGE_ROLES, agency.updateTour);
router.post('/tours/:id/submit', blockWhenReadOnly, PACKAGE_ROLES, agency.submitTour);
router.delete('/tours/:id', blockWhenReadOnly, PACKAGE_ROLES, agency.deleteTour);

// Marshrut nuqtalarini qidirish (OSM Nominatim) — tur tahrirlagichi uchun.
router.get('/geocode', geocodeCtrl.geocode);

// Ro'yxat va holat/bosqich buxgalterga ham ochiq: CRM'dagi To'lovlar ekrani shularni ishlatadi.
router.get('/bookings', agency.listBookings);
router.patch('/bookings/:id/status', blockWhenReadOnly, agency.updateBookingStatus);
router.post('/leads', blockWhenReadOnly, LEAD_ROLES, requireCapability('manualLeads'), agency.createManualLead);
router.patch('/bookings/:id/stage', blockWhenReadOnly, agency.updatePipelineStage);
router.patch('/bookings/:id/birthday', blockWhenReadOnly, LEAD_ROLES, agency.setCustomerBirthday);
router.patch('/bookings/:id', blockWhenReadOnly, LEAD_ROLES, agency.updateLead); // lid maydonlarini tahrirlash

// Server CRM: vazifa, teg, faoliyat, hujjat, menejer va migratsiya/import.
router.get('/crm/bootstrap', crm.bootstrap);
router.post('/crm/pipeline-stages', blockWhenReadOnly, requireOwner, crm.createPipelineStage);
router.put('/crm/pipeline-stages/reorder', blockWhenReadOnly, requireOwner, crm.reorderPipelineStages);
router.put('/crm/pipeline-stages/:id', blockWhenReadOnly, requireOwner, crm.updatePipelineStage);
router.delete('/crm/pipeline-stages/:id', blockWhenReadOnly, requireOwner, crm.deletePipelineStage);
router.post('/crm/tasks', blockWhenReadOnly, crm.createTask);
router.patch('/crm/tasks/:id', blockWhenReadOnly, crm.updateTask);
router.delete('/crm/tasks/:id', blockWhenReadOnly, crm.deleteTask);
router.put('/crm/bookings/:id/tags', blockWhenReadOnly, LEAD_ROLES, crm.replaceTags);
router.post('/crm/bookings/:id/activities', blockWhenReadOnly, LEAD_ROLES, crm.addActivity);
router.patch('/crm/bookings/:id/assignee', blockWhenReadOnly, LEAD_ROLES, crm.assignLead);
router.put('/crm/documents', blockWhenReadOnly, crm.saveDocuments);
router.post('/crm/import/local', crm.importLocal); // eski localStorage ma'lumotini yo'qotmaslik uchun readOnly'da ham ochiq
router.post('/crm/import/csv', blockWhenReadOnly, LEAD_ROLES, requireCapability('manualLeads'), crm.importCsv);
router.post('/crm/import/csv/preview', blockWhenReadOnly, LEAD_ROLES, requireCapability('manualLeads'), crm.previewCsv);
router.post('/crm/import/csv/commit', blockWhenReadOnly, LEAD_ROLES, requireCapability('manualLeads'), crm.commitCsv);
router.get('/crm/imports', crm.listCsvImports);
router.post('/crm/imports/:id/rollback', blockWhenReadOnly, requireOwner, crm.rollbackCsv);
router.get('/crm/settings', crm.getCrmSettings);
router.put('/crm/settings', blockWhenReadOnly, requireOwner, crm.saveCrmSettings);
router.get('/crm/insights', crm.insights);
router.get('/crm/audit', requireOwner, crm.listAudit);

// No-code trigger -> shart -> amal avtomatizatsiyasi va bajarilish jurnali.
router.get('/crm/automation', automation.list);
router.post('/crm/automation/rules', blockWhenReadOnly, requireOwner, automation.create);
router.put('/crm/automation/rules/:id', blockWhenReadOnly, requireOwner, automation.update);
router.delete('/crm/automation/rules/:id', blockWhenReadOnly, requireOwner, automation.remove);
router.post('/crm/automation/rules/:id/run', blockWhenReadOnly, requireOwner, automation.runNow);
router.post('/crm/automation/runs/:id/retry', blockWhenReadOnly, requireOwner, automation.retry);

// Public API kalitlari va outbound webhook boshqaruvi — faqat agentlik egasi.
router.get('/crm/integrations', requireOwner, requireCapability('integrations'), integrations.list);
router.post('/crm/integrations/api-keys', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.createKey);
router.delete('/crm/integrations/api-keys/:id', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.revokeKey);
router.post('/crm/integrations/webhooks', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.createEndpoint);
router.put('/crm/integrations/webhooks/:id', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.updateEndpoint);
router.delete('/crm/integrations/webhooks/:id', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.removeEndpoint);
router.post('/crm/integrations/webhooks/:id/rotate-secret', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.rotateSecret);
router.post('/crm/integrations/webhooks/:id/test', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.testEndpoint);
router.post('/crm/integrations/deliveries/:id/retry', blockWhenReadOnly, requireOwner, requireCapability('integrations'), integrations.retryDelivery);

// Operatsion moliya: kassa/bank, kirim-chiqim, qarzdorlik va bitim foydasi.
// Moliya — faqat payments bo'limi rollari (owner, manager, accountant); agent kira olmaydi.
router.use('/crm/finance', FINANCE_ROLES);
router.get('/crm/finance', finance.listFinance);
router.get('/crm/finance/exchange-rates', finance.listExchangeRates);
router.get('/crm/finance/reconciliation', reconciliation.list);
router.post('/crm/finance/reconciliation/inspect', blockWhenReadOnly, reconciliation.inspect);
router.post('/crm/finance/reconciliation/import', blockWhenReadOnly, reconciliation.importStatement);
router.post('/crm/finance/reconciliation/rows/:id/match', blockWhenReadOnly, reconciliation.match);
router.post('/crm/finance/reconciliation/rows/:id/create', blockWhenReadOnly, reconciliation.createFromRow);
router.patch('/crm/finance/reconciliation/rows/:id/ignore', blockWhenReadOnly, reconciliation.ignore);
router.post('/crm/finance/accounts', blockWhenReadOnly, OWNER, finance.createAccount);
router.post('/crm/finance/suppliers', blockWhenReadOnly, finance.createSupplier);
router.patch('/crm/finance/suppliers/:id', blockWhenReadOnly, finance.updateSupplier);
router.put('/crm/finance/commission-rules/:memberId', blockWhenReadOnly, OWNER, finance.saveCommissionRule);
router.post('/crm/finance/transactions', blockWhenReadOnly, finance.createTransaction);
router.patch('/crm/finance/transactions/:id', blockWhenReadOnly, finance.updateTransaction);
router.delete('/crm/finance/transactions/:id', blockWhenReadOnly, OWNER, finance.deleteTransaction);

// Rahbar paneli: real P&L, 12 haftalik cashflow, payroll va filiallar kesimi.
router.get('/crm/executive-report', requireOwner, executive.executiveReport);
router.post('/crm/branches', blockWhenReadOnly, requireOwner, executive.createBranch);
router.patch('/crm/branches/:id', blockWhenReadOnly, requireOwner, executive.updateBranch);
router.put('/crm/branches/members/:memberId', blockWhenReadOnly, requireOwner, executive.assignMemberBranch);
router.put('/crm/payroll/:memberId', blockWhenReadOnly, requireOwner, executive.savePayrollProfile);

// Hujjat reyestri: status, versiya tarixi va invoice-to'lov bog'lanishi.
router.get('/crm/business-documents', documents.listDocuments);
router.get('/crm/business-documents/:id', documents.getDocument);
router.post('/crm/business-documents', blockWhenReadOnly, documents.createDocument);
router.patch('/crm/business-documents/:id', blockWhenReadOnly, documents.updateDocument);
router.post('/crm/business-documents/:id/payments', blockWhenReadOnly, documents.addPayment);
router.post('/crm/business-documents/:id/pdf', blockWhenReadOnly, documents.generatePdf);
router.get('/crm/business-documents/archives/:archiveId', documents.downloadPdf);
router.post('/crm/business-documents/:id/approval', blockWhenReadOnly, documents.requestApproval);
router.patch('/crm/business-documents/approvals/:approvalId', blockWhenReadOnly, requireOwner, documents.decideApproval);
router.post('/crm/business-documents/:id/signature', blockWhenReadOnly, documents.requestSignature);
router.post('/crm/business-documents/signatures/:signatureId/verify', blockWhenReadOnly, documents.verifySignature);

// Mijoz sharhlari + reyting (marketplace'да ko'rinadi) — ko'rish hammaga ochiq.
router.get('/reviews', agency.listReviews);
router.patch('/reviews/:id', blockWhenReadOnly, OWNER_MANAGER, agency.setReviewStatus);

// Lid fayllari (pasport / viza / shartnoma) — DB'да. Faqat lid bilan ishlaydigan
// rollar (owner, manager, agent); buxgalter pasport skanlarini ko'rmaydi.
router.get('/bookings/:id/files', LEAD_FILE_ROLES, leadFiles.listFiles);
router.post('/bookings/:id/files', blockWhenReadOnly, LEAD_FILE_ROLES, leadFiles.uploadFile);
router.get('/files/:id', LEAD_FILE_ROLES, leadFiles.downloadFile);
router.delete('/files/:id', blockWhenReadOnly, LEAD_FILE_ROLES, leadFiles.deleteFile);
router.post('/files/:id/ocr', blockWhenReadOnly, LEAD_FILE_ROLES, requireCapability('ai'), leadFiles.ocrPassport);

// AI yordamchilar — faqat Premium.
router.get('/ai/status', requireCapability('ai'), aiCtrl.status);
router.post('/ai/presentation-note', blockWhenReadOnly, LEAD_ROLES, requireCapability('ai'), aiCtrl.presentationNote);

// Dinamik takliflar (Pro va yuqori tarif) — ochilish kuzatuvi bilan.
router.get('/presentations', requireCapability('presentations'), presentation.listPresentations);
router.post('/presentations', blockWhenReadOnly, LEAD_ROLES, requireCapability('presentations'), presentation.createPresentation);
router.delete('/presentations/:id', blockWhenReadOnly, LEAD_ROLES, requireCapability('presentations'), presentation.deletePresentation);

// Telegram bot — Pro va yuqori tarif (requireCapability). Yozuvlar muddat o'tsa ham bloklanadi.
router.use('/telegram', requireCapability('telegram'));
router.get('/telegram', telegram.getTelegram);
// Botni ulash/uzish va broadcast — faqat egasi; bot sozlamalari — egasi yoki menejer;
// mijoz bilan yozishma — lid rollari (buxgalter emas).
router.post('/telegram/connect', blockWhenReadOnly, OWNER, telegram.connectTelegram);
router.post('/telegram/disconnect', blockWhenReadOnly, OWNER, telegram.disconnectTelegram);
router.put('/telegram/welcome', blockWhenReadOnly, OWNER_MANAGER, telegram.setWelcome);
router.put('/telegram/birthday-template', blockWhenReadOnly, OWNER_MANAGER, telegram.setBirthdayTemplate);
router.get('/telegram/profile', OWNER_MANAGER, telegram.getProfile);
router.put('/telegram/profile', blockWhenReadOnly, OWNER_MANAGER, telegram.setProfile);
router.get('/telegram/config', LEAD_ROLES, telegram.getConfig); // shablonlar chat oynasida ham kerak
router.put('/telegram/config', blockWhenReadOnly, OWNER_MANAGER, telegram.setConfig);
router.get('/telegram/messages', LEAD_ROLES, telegram.listMessages);
router.post('/telegram/reply', blockWhenReadOnly, LEAD_ROLES, telegram.reply);
router.post('/telegram/broadcast', blockWhenReadOnly, OWNER, requireCapability('broadcast'), telegram.broadcast);

// Instagram Direct — Telegram bilan bir xil tarif darajasi ('telegram'
// capability = «xabar kanallari»). Javob yuborish /telegram/reply orqali
// ketadi: u kanalni lidning o'zidan aniqlaydi.
router.use('/instagram', requireCapability('telegram'));
router.get('/instagram', instagram.getInstagram);
router.get('/instagram/authorize', requireOwner, instagram.authorize);
router.post('/instagram/disconnect', blockWhenReadOnly, requireOwner, instagram.disconnectInstagram);
router.put('/instagram/welcome', blockWhenReadOnly, OWNER_MANAGER, instagram.setWelcome);

// WhatsApp Cloud API — shu xabar kanallari tarifi ichida.
router.use('/whatsapp', requireCapability('telegram'));
router.get('/whatsapp', whatsapp.getWhatsApp);
router.post('/whatsapp/connect', blockWhenReadOnly, requireOwner, whatsapp.connect);
router.post('/whatsapp/disconnect', blockWhenReadOnly, requireOwner, whatsapp.disconnect);
router.put('/whatsapp/welcome', blockWhenReadOnly, OWNER_MANAGER, whatsapp.setWelcome);
router.get('/whatsapp/templates', LEAD_ROLES, whatsapp.templates);
router.post('/whatsapp/send', blockWhenReadOnly, LEAD_ROLES, whatsapp.send);

// Jamoa (Business tarif) — ko'rish hammaga, boshqarish faqat egasiga (yo'lda ham, controller ichida ham).
router.get('/team', team.listTeam);
router.post('/team', blockWhenReadOnly, OWNER, requireCapability('team'), team.addMember);
router.put('/team/:id', blockWhenReadOnly, OWNER, requireCapability('team'), team.updateMember);
router.delete('/team/:id', blockWhenReadOnly, OWNER, requireCapability('team'), team.removeMember);

module.exports = router;
