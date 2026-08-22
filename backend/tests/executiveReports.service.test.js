const { branchDashboard, cashflowForecast, managerPayroll, profitAndLoss } = require('../src/services/executiveReports.service');

const from = new Date('2026-08-01T00:00:00.000Z');
const to = new Date('2026-08-31T23:59:59.999Z');
const paidAt = new Date('2026-08-10T10:00:00.000Z');

test('P&L supplier, payroll va operatsion xarajatni alohida hisoblaydi', () => {
  const rows = [
    { direction: 'income', status: 'paid', amount: 10000, currency: 'USD', category: 'Mijoz to‘lovi', paidAt },
    { direction: 'expense', status: 'paid', amount: 4000, currency: 'USD', category: 'Turoperator', supplierId: 's1', paidAt },
    { direction: 'expense', status: 'paid', amount: 1000, currency: 'USD', category: 'Menejer maoshi', managerMemberId: 'm1', paidAt },
    { direction: 'expense', status: 'paid', amount: 500, currency: 'USD', category: 'Reklama', paidAt },
  ];
  const pnl = profitAndLoss(rows, { currency: 'USD', from, to });
  expect(pnl).toMatchObject({ income: 10000, costOfSales: 4000, grossProfit: 6000, payroll: 1000, operatingExpenses: 500, netProfit: 4500, netMarginPct: 45 });
  expect(pnl.monthly[0].netProfit).toBe(4500);
});

test('cashflow mavjud balansdan 12 haftalik prognoz chiqaradi va minus xavfini ko‘rsatadi', () => {
  const accounts = [{ id: 'cash', name: 'Kassa', openingBalance: 1000, currency: 'USD', active: true }];
  const now = new Date('2026-08-10T00:00:00.000Z');
  const rows = [
    { accountId: 'cash', direction: 'income', status: 'paid', amount: 500, currency: 'USD' },
    { accountId: 'cash', direction: 'expense', status: 'paid', amount: 200, currency: 'USD' },
    { direction: 'expense', status: 'planned', amount: 2000, currency: 'USD', dueAt: new Date('2026-08-12T00:00:00.000Z') },
    { direction: 'income', status: 'planned', amount: 100, currency: 'USD', dueAt: new Date('2026-08-01T00:00:00.000Z') },
    { direction: 'expense', status: 'planned', amount: 40, currency: 'USD', dueAt: null },
  ];
  const cashflow = cashflowForecast(accounts, rows, { currency: 'USD', now, weeks: 4 });
  expect(cashflow.openingBalance).toBe(1300);
  expect(cashflow.overdueIncome).toBe(100);
  expect(cashflow.unscheduled).toBe(1);
  expect(cashflow.weeks[0]).toMatchObject({ income: 0, expense: 2000, closingBalance: -600, atRisk: true });
});

test('payroll bazaviy maosh, bitim bonusi va komissiyani jamlaydi', () => {
  const members = [{ id: 'm1', name: 'Ali', role: 'manager', status: 'active', branchId: 'b1', branch: { name: 'Markaz' }, payrollProfile: { active: true, currency: 'USD', baseSalary: 800, bonusPerWon: 50 } }];
  const bookings = [
    { assignedMemberId: 'm1', pipelineStage: 'won', confirmedAt: paidAt },
    { assignedMemberId: 'm1', pipelineStage: 'completed', completedAt: paidAt },
  ];
  const rows = [
    { managerMemberId: 'm1', commissionSourceId: 'income1', status: 'planned', amount: 120, currency: 'USD', dueAt: paidAt, category: 'Menejer komissiyasi' },
    { managerMemberId: 'm1', status: 'paid', amount: 500, currency: 'USD', paidAt, category: 'Menejer maoshi' },
  ];
  const payroll = managerPayroll(members, bookings, rows, { currency: 'USD', from, to });
  expect(payroll.items[0]).toMatchObject({ wonDeals: 2, baseSalary: 800, dealBonus: 100, commission: 120, accrued: 1020, paid: 500, payable: 520 });
});

test('filial dashboardi lid, konversiya va haqiqiy pul oqimini filialga ajratadi', () => {
  const branches = [{ id: 'b1', name: 'Markaz', city: 'Toshkent', active: true }];
  const members = [{ id: 'm1', status: 'active', branchId: 'b1' }];
  const bookings = [
    { id: 'l1', branchId: 'b1', pipelineStage: 'won', createdAt: paidAt },
    { id: 'l2', assignedMember: { branchId: 'b1' }, pipelineStage: 'lost', createdAt: paidAt },
  ];
  const rows = [
    { branchId: 'b1', direction: 'income', status: 'paid', amount: 2000, currency: 'USD', paidAt },
    { managerMember: { branchId: 'b1' }, direction: 'expense', status: 'paid', amount: 300, currency: 'USD', paidAt },
  ];
  const report = branchDashboard(branches, members, bookings, rows, { currency: 'USD', from, to });
  expect(report.items[0]).toMatchObject({ id: 'b1', members: 1, leads: 2, won: 1, conversionPct: 50, income: 2000, expense: 300, profit: 1700 });
});

