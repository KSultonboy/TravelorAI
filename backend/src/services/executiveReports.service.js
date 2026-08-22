const PAYROLL_RE = /(maosh|oylik|salary|payroll|komiss)/i;

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inPeriod(value, from, to) {
  const date = asDate(value);
  return !!date && date >= from && date <= to;
}

function paidDate(row) { return asDate(row.paidAt) || asDate(row.createdAt); }
function closedDate(row) { return asDate(row.completedAt) || asDate(row.confirmedAt) || asDate(row.updatedAt); }
function branchIdOf(row) {
  return row.branchId || row.assignedMember?.branchId || row.booking?.branchId || row.booking?.assignedMember?.branchId || row.managerMember?.branchId || row.account?.branchId || null;
}

function monthKey(value) {
  const d = asDate(value);
  return d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : null;
}

function monthRange(from, to) {
  const rows = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end && rows.length < 60) {
    rows.push({ key: monthKey(cursor), income: 0, costOfSales: 0, payroll: 0, operatingExpenses: 0, netProfit: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return rows;
}

function classifyExpense(row) {
  if (row.supplierId) return 'costOfSales';
  if (row.managerMemberId || PAYROLL_RE.test(String(row.category || ''))) return 'payroll';
  return 'operatingExpenses';
}

function profitAndLoss(transactions, { currency, from, to }) {
  const rows = transactions.filter((row) => row.currency === currency && row.status === 'paid' && inPeriod(paidDate(row), from, to));
  const months = monthRange(from, to);
  const byMonth = new Map(months.map((item) => [item.key, item]));
  const categories = new Map();
  let income = 0; let costOfSales = 0; let payroll = 0; let operatingExpenses = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    const key = monthKey(paidDate(row));
    const month = byMonth.get(key);
    if (row.direction === 'income') {
      income += amount;
      if (month) month.income += amount;
    } else {
      const kind = classifyExpense(row);
      if (kind === 'costOfSales') costOfSales += amount;
      else if (kind === 'payroll') payroll += amount;
      else operatingExpenses += amount;
      if (month) month[kind] += amount;
    }
    const categoryKey = `${row.direction}:${row.category || 'Boshqa'}`;
    const category = categories.get(categoryKey) || { name: row.category || 'Boshqa', direction: row.direction, amount: 0 };
    category.amount += amount;
    categories.set(categoryKey, category);
  }
  for (const month of months) month.netProfit = month.income - month.costOfSales - month.payroll - month.operatingExpenses;
  const grossProfit = income - costOfSales;
  const expenses = costOfSales + payroll + operatingExpenses;
  const netProfit = income - expenses;
  return {
    currency, from, to, income, costOfSales, grossProfit, payroll, operatingExpenses, expenses, netProfit,
    grossMarginPct: income ? Math.round((grossProfit / income) * 1000) / 10 : 0,
    netMarginPct: income ? Math.round((netProfit / income) * 1000) / 10 : 0,
    monthly: months,
    categories: Array.from(categories.values()).sort((a, b) => b.amount - a.amount),
  };
}

function accountBalances(accounts, transactions, currency) {
  const deltas = new Map();
  for (const row of transactions) {
    if (row.currency !== currency || row.status !== 'paid' || !row.accountId) continue;
    deltas.set(row.accountId, (deltas.get(row.accountId) || 0) + (row.direction === 'income' ? row.amount : -row.amount));
  }
  return accounts.filter((row) => row.currency === currency && row.active !== false).map((row) => ({
    id: row.id, name: row.name, branchId: row.branchId || null,
    balance: Number(row.openingBalance || 0) + (deltas.get(row.id) || 0),
  }));
}

function cashflowForecast(accounts, transactions, { currency, now = new Date(), weeks = 12 }) {
  const balances = accountBalances(accounts, transactions, currency);
  let projected = balances.reduce((sum, row) => sum + row.balance, 0);
  const plannedAll = transactions.filter((row) => row.currency === currency && row.status === 'planned');
  const planned = plannedAll.filter((row) => row.dueAt);
  const overdueRows = planned.filter((row) => asDate(row.dueAt) < now);
  const overdue = overdueRows.reduce((sum, row) => sum + (row.direction === 'income' ? row.amount : -row.amount), 0);
  projected += overdue;
  const buckets = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let index = 0; index < weeks; index += 1) {
    const from = new Date(start.getTime() + index * 7 * 86400000);
    const to = new Date(from.getTime() + 7 * 86400000 - 1);
    const rows = planned.filter((row) => { const due = asDate(row.dueAt); return due && due >= from && due <= to; });
    const income = rows.filter((row) => row.direction === 'income').reduce((sum, row) => sum + row.amount, 0);
    const expense = rows.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + row.amount, 0);
    projected += income - expense;
    buckets.push({ index: index + 1, from, to, income, expense, net: income - expense, closingBalance: projected, atRisk: projected < 0 });
  }
  return {
    currency, generatedAt: now, openingBalance: balances.reduce((sum, row) => sum + row.balance, 0),
    overdueIncome: overdueRows.filter((r) => r.direction === 'income').reduce((s, r) => s + r.amount, 0),
    overdueExpense: overdueRows.filter((r) => r.direction === 'expense').reduce((s, r) => s + r.amount, 0),
    unscheduled: plannedAll.filter((row) => !row.dueAt).length, accounts: balances, weeks: buckets,
  };
}

function managerPayroll(members, bookings, transactions, { currency, from, to }) {
  const items = members.filter((member) => member.status === 'active').map((member) => {
    const profile = member.payrollProfile && member.payrollProfile.active && member.payrollProfile.currency === currency ? member.payrollProfile : null;
    const wonRows = bookings.filter((booking) => booking.assignedMemberId === member.id && ['won', 'completed'].includes(booking.pipelineStage) && inPeriod(closedDate(booking), from, to));
    const commissionRows = transactions.filter((row) => row.currency === currency && row.managerMemberId === member.id && row.commissionSourceId && row.status !== 'cancelled' && inPeriod(row.dueAt || row.createdAt, from, to));
    const paidRows = transactions.filter((row) => row.currency === currency && row.managerMemberId === member.id && row.status === 'paid' && inPeriod(paidDate(row), from, to) && (row.commissionSourceId || PAYROLL_RE.test(String(row.category || ''))));
    const baseSalary = Number(profile?.baseSalary || 0);
    const dealBonus = Number(profile?.bonusPerWon || 0) * wonRows.length;
    const commission = commissionRows.reduce((sum, row) => sum + row.amount, 0);
    const accrued = baseSalary + dealBonus + commission;
    const paid = paidRows.reduce((sum, row) => sum + row.amount, 0);
    return {
      memberId: member.id, name: member.name, role: member.role, branchId: member.branchId || null,
      branchName: member.branch?.name || 'Biriktirilmagan', profile, wonDeals: wonRows.length,
      baseSalary, dealBonus, commission, accrued, paid, payable: Math.max(0, accrued - paid),
    };
  });
  const totals = items.reduce((acc, row) => ({ accrued: acc.accrued + row.accrued, paid: acc.paid + row.paid, payable: acc.payable + row.payable }), { accrued: 0, paid: 0, payable: 0 });
  return { currency, from, to, items: items.sort((a, b) => b.accrued - a.accrued), totals };
}

function branchDashboard(branches, members, bookings, transactions, { currency, from, to }) {
  const branchRows = [...branches.map((branch) => ({ id: branch.id, name: branch.name, city: branch.city, active: branch.active })), { id: null, name: 'Biriktirilmagan', city: null, active: true }];
  const items = branchRows.map((branch) => {
    const branchBookings = bookings.filter((row) => branchIdOf(row) === branch.id && inPeriod(row.createdAt, from, to));
    const won = branchBookings.filter((row) => ['won', 'completed'].includes(row.pipelineStage));
    const lost = branchBookings.filter((row) => row.pipelineStage === 'lost');
    const finance = transactions.filter((row) => row.currency === currency && row.status === 'paid' && branchIdOf(row) === branch.id && inPeriod(paidDate(row), from, to));
    const income = finance.filter((row) => row.direction === 'income').reduce((sum, row) => sum + row.amount, 0);
    const expense = finance.filter((row) => row.direction === 'expense').reduce((sum, row) => sum + row.amount, 0);
    const decided = won.length + lost.length;
    return {
      ...branch, members: members.filter((member) => (member.branchId || null) === branch.id && member.status === 'active').length,
      leads: branchBookings.length, won: won.length, conversionPct: decided ? Math.round((won.length / decided) * 1000) / 10 : 0,
      income, expense, profit: income - expense,
    };
  });
  return { currency, from, to, items: items.filter((row) => row.id || row.members || row.leads || row.income || row.expense).sort((a, b) => b.profit - a.profit) };
}

module.exports = { accountBalances, branchDashboard, branchIdOf, cashflowForecast, managerPayroll, profitAndLoss };
