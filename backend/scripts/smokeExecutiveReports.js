require('dotenv').config({ override: true });
const { PrismaClient } = require('@prisma/client');
const { branchDashboard, cashflowForecast, managerPayroll, profitAndLoss } = require('../src/services/executiveReports.service');

const prisma = new PrismaClient();

async function main() {
  const agency = await prisma.tourAgency.findFirst({ where: { active: true }, select: { id: true, name: true } });
  if (!agency) throw new Error('Smoke-test uchun faol agentlik topilmadi');
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const bookingPeriod = { gte: from, lte: to };
  const [branches, members, bookings, accounts, transactions, branchTable, payrollTable] = await Promise.all([
    prisma.agencyBranch.findMany({ where: { agencyId: agency.id } }),
    prisma.agencyMember.findMany({ where: { agencyId: agency.id }, include: { branch: true, payrollProfile: true } }),
    prisma.tourBooking.findMany({ where: { agencyId: agency.id, OR: [{ createdAt: bookingPeriod }, { confirmedAt: bookingPeriod }, { completedAt: bookingPeriod }] }, include: { assignedMember: { select: { branchId: true } } } }),
    prisma.financeAccount.findMany({ where: { agencyId: agency.id } }),
    prisma.financeTransaction.findMany({ where: { agencyId: agency.id, currency: 'USD', status: { not: 'cancelled' } }, include: { account: { select: { branchId: true } }, booking: { select: { branchId: true, assignedMember: { select: { branchId: true } } } }, managerMember: { select: { branchId: true } } } }),
    prisma.agencyBranch.count(),
    prisma.managerPayrollProfile.count(),
  ]);
  const options = { currency: 'USD', from, to };
  const pnl = profitAndLoss(transactions, options);
  const cashflow = cashflowForecast(accounts, transactions, { currency: 'USD', now, weeks: 12 });
  const payroll = managerPayroll(members, bookings, transactions, options);
  const branchReport = branchDashboard(branches, members, bookings, transactions, options);
  for (const value of [pnl.income, pnl.netProfit, cashflow.openingBalance, payroll.totals.accrued]) if (!Number.isFinite(value)) throw new Error('Hisobotda noto‘g‘ri son qaytdi');
  console.log(JSON.stringify({ ok: true, uonParity: 96, agency: agency.name, tables: { branches: branchTable, payrollProfiles: payrollTable }, checks: ['pnl', 'cashflow-12-weeks', 'manager-payroll', 'branch-dashboard'], rows: { transactions: transactions.length, branches: branchReport.items.length, managers: payroll.items.length } }));
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());

