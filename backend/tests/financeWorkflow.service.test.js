const { syncManagerCommission, supplierBalances, commissionSummary, paymentCalendar } = require('../src/services/financeWorkflow.service');
const { makePdf } = require('../src/services/documentPdf.service');

test('supplier qarzi, menejer komissiyasi va payment calendar hisoblanadi', () => {
  const nowPast = new Date(Date.now() - 86400000);
  const transactions = [
    { id: 's1', supplierId: 'sup1', direction: 'expense', status: 'planned', amount: 400, currency: 'USD', dueAt: nowPast },
    { id: 's2', supplierId: 'sup1', direction: 'expense', status: 'paid', amount: 600, currency: 'USD' },
    { id: 'c1', managerMemberId: 'm1', commissionSourceId: 'income1', direction: 'expense', status: 'planned', amount: 50, currency: 'USD', dueAt: nowPast },
  ];
  const suppliers = supplierBalances([{ id: 'sup1', name: 'Operator', currency: 'USD' }], transactions, 'USD');
  expect(suppliers[0]).toMatchObject({ paid: 600, payable: 400, overdue: 400, total: 1000 });
  const commissions = commissionSummary([{ id: 'm1', name: 'Ali', role: 'manager', commissionRule: { percent: 5 } }], transactions, 'USD');
  expect(commissions[0]).toMatchObject({ accrued: 50, paid: 0, payable: 50 });
  expect(paymentCalendar(transactions).map((row) => row.id)).toEqual(['s1', 'c1']);
});

test('to‘langan lid kirimi uchun komissiya avtomatik yaratiladi', async () => {
  const create = jest.fn(async ({ data }) => ({ id: 'commission', ...data }));
  const db = {
    financeTransaction: { findUnique: jest.fn(async () => null), create, update: jest.fn() },
    tourBooking: { findFirst: jest.fn(async () => ({ assignedMemberId: 'm1', assignedMember: { name: 'Ali', commissionRule: { active: true, currency: 'USD', percent: 7.5, fixedAmount: 10 } } })) },
  };
  await syncManagerCommission(db, { id: 'income1', agencyId: 'a1', bookingId: 'b1', direction: 'income', status: 'paid', amount: 1000, currency: 'USD', paidAt: new Date(), createdByAccountId: 'u1' });
  expect(create.mock.calls[0][0].data).toMatchObject({ amount: 85, managerMemberId: 'm1', commissionSourceId: 'income1', status: 'planned' });
});

test('server PDF haqiqiy PDF va deterministik SHA-256 yaratadi', () => {
  const document = { number: 'HF-2026-0001', type: 'invoice', title: 'Hisob-faktura', customerName: 'Ali', amount: 500, currency: 'USD', issuedAt: new Date(), currentVersion: 2 };
  const first = makePdf(document, { body: 'Sayohat xizmati uchun tolov' }, { legalName: 'TravelorAI MChJ', stir: '123' });
  const second = makePdf(document, { body: 'Sayohat xizmati uchun tolov' }, { legalName: 'TravelorAI MChJ', stir: '123' });
  expect(first.data.subarray(0, 5).toString()).toBe('%PDF-');
  expect(first.data.length).toBeGreaterThan(500);
  expect(first.sha256).toBe(second.sha256);
});
