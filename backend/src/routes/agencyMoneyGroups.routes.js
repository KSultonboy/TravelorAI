// To'lov jadvali / qarzdorlik va guruh jo'nash ro'yxati.
// agency.routes.js ichida `/crm` ostiga requireApprovedAgency'dan KEYIN ulanadi,
// shuning uchun agencyAuth + agencyPlan + audit + tasdiq tekshiruvi allaqachon o'tgan.
const router = require('express').Router();
const ctrl = require('../controllers/agencyMoneyGroups.controller');
const { blockWhenReadOnly, requireCapability } = require('../middleware/agencyPlan.middleware');
const { requireRole, ROLE_GROUPS } = require('../middleware/agencyRole.middleware');
const { WRITE_ROLES } = require('../services/paymentSchedule.service');

// O'qish: barcha rollar (agent faqat ko'radi). Yozish: owner, manager, accountant.
const READ = requireRole(['owner', 'manager', 'agent', 'accountant']);
const WRITE = requireRole(WRITE_ROLES);
// Pasport ma'lumotlari — lid fayllari bilan bir xil qoida (buxgalter ko'rmaydi).
const PASSPORT = requireRole(ROLE_GROUPS.leadFiles);

router.get('/bookings/:id/instalments', READ, ctrl.listInstalments);
router.post('/bookings/:id/instalments', blockWhenReadOnly, WRITE, ctrl.createInstalment);
router.post('/bookings/:id/instalments/plan', blockWhenReadOnly, WRITE, ctrl.generateInstalmentPlan);
router.patch('/instalments/:id', blockWhenReadOnly, WRITE, ctrl.updateInstalment);
router.delete('/instalments/:id', blockWhenReadOnly, WRITE, ctrl.deleteInstalment);
router.post('/instalments/:id/pay', blockWhenReadOnly, WRITE, ctrl.payInstalment);
router.get('/debts', READ, ctrl.debts);

router.get('/group-list', PASSPORT, ctrl.groupList);
router.get('/group-list/export', PASSPORT, requireCapability('csvExport'), ctrl.exportGroupList);

module.exports = router;
