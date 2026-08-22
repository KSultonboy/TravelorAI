const { cleanCurrency, optionalDate, positiveAmount, summarizeTransactions } = require('../src/services/finance.service');

test('summa va valyuta xavfsiz normallashtiriladi', () => {
  expect(positiveAmount('1 250')).toBe(1250);
  expect(positiveAmount('-20')).toBeNull();
  expect(cleanCurrency('uzs')).toBe('UZS');
  expect(cleanCurrency('bitcoin')).toBe('USD');
  expect(optionalDate('noto‘g‘ri')).toBeUndefined();
});

test('kirim, chiqim, qarz va hisob qoldig‘i hisoblanadi', () => {
  const now = new Date('2026-08-22T12:00:00Z');
  const transactions = [
    { currency: 'USD', status: 'paid', direction: 'income', amount: 1000, accountId: 'cash' },
    { currency: 'USD', status: 'paid', direction: 'expense', amount: 300, accountId: 'cash' },
    { currency: 'USD', status: 'planned', direction: 'income', amount: 500, dueAt: new Date('2026-08-20') },
    { currency: 'USD', status: 'planned', direction: 'expense', amount: 200, dueAt: new Date('2026-08-25') },
    { currency: 'USD', status: 'cancelled', direction: 'income', amount: 9999 },
  ];
  const summary = summarizeTransactions(transactions, [{ id: 'cash', name: 'Kassa', type: 'cash', currency: 'USD', openingBalance: 100 }], 'USD', now);
  expect(summary).toMatchObject({ received: 1000, spent: 300, profit: 700, receivable: 500, payable: 200, overdue: 500 });
  expect(summary.accountBalances[0].balance).toBe(800);
});
