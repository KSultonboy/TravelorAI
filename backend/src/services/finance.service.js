const DIRECTIONS = new Set(['income', 'expense']);
const STATUSES = new Set(['planned', 'paid', 'cancelled']);
const ACCOUNT_TYPES = new Set(['cash', 'bank', 'card', 'wallet']);

function cleanCurrency(value) {
  const currency = String(value || 'USD').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
}

function positiveAmount(value) {
  const amount = Number.parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function summarizeTransactions(transactions = [], accounts = [], currency = 'USD', now = new Date()) {
  const code = cleanCurrency(currency);
  const rows = transactions.filter((row) => row.currency === code && row.status !== 'cancelled');
  let received = 0; let spent = 0; let receivable = 0; let payable = 0; let overdue = 0;
  const deltas = new Map();
  for (const row of rows) {
    if (row.status === 'paid') {
      if (row.direction === 'income') received += row.amount;
      else spent += row.amount;
      if (row.accountId) deltas.set(row.accountId, (deltas.get(row.accountId) || 0) + (row.direction === 'income' ? row.amount : -row.amount));
    } else if (row.status === 'planned') {
      if (row.direction === 'income') receivable += row.amount;
      else payable += row.amount;
      if (row.dueAt && new Date(row.dueAt) < now) overdue += row.amount;
    }
  }
  const accountBalances = accounts.filter((account) => account.currency === code).map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    balance: account.openingBalance + (deltas.get(account.id) || 0),
  }));
  return { currency: code, received, spent, profit: received - spent, receivable, payable, overdue, accountBalances };
}

module.exports = { ACCOUNT_TYPES, DIRECTIONS, STATUSES, cleanCurrency, optionalDate, positiveAmount, summarizeTransactions };
