const { findBestMatch, inspectBankStatement, mapBankStatement, parseAmount, parseDate } = require('../src/services/bankStatement.service');

describe('Bank CSV reconciliation', () => {
  test('semicolon format va Uzbek/Rus sarlavhalarini aniqlaydi', () => {
    const csv = 'Sana;Kirim;Chiqim;Kontragent;Izoh\n22.08.2026;1 250 000,00;;Ali Travel;Tur to‘lovi\n23.08.2026;;500000;Hotel;Bron';
    const inspected = inspectBankStatement(csv);
    expect(inspected.delimiter).toBe(';');
    expect(inspected.suggestedMapping.date).toBe('Sana');
    expect(inspected.suggestedMapping.credit).toBe('Kirim');
    const mapped = mapBankStatement(csv, inspected.suggestedMapping, 'UZS');
    expect(mapped.rows).toHaveLength(2);
    expect(mapped.rows[0]).toMatchObject({ direction: 'income', amount: 1250000, currency: 'UZS' });
    expect(mapped.rows[1]).toMatchObject({ direction: 'expense', amount: 500000 });
  });

  test('lokal summa va sanalarni xavfsiz o‘qiydi', () => {
    expect(parseAmount("1'234'567.50 UZS")).toBe(1234568);
    expect(parseAmount('(1 200,00)')).toBe(-1200);
    expect(parseDate('31.12.2026').toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(parseDate('31.02.2026')).toBeNull();
  });

  test('summa, yo‘nalish va sanaga ko‘ra eng yaxshi CRM tranzaksiyasini topadi', () => {
    const row = { amount: 500, currency: 'USD', direction: 'income', transactionDate: new Date('2026-08-22T12:00:00Z'), counterparty: 'Ali Travel', description: 'Tur to‘lovi' };
    const result = findBestMatch(row, [
      { id: 'wrong', amount: 600, currency: 'USD', direction: 'income', status: 'planned', dueAt: new Date('2026-08-22T12:00:00Z') },
      { id: 'right', amount: 500, currency: 'USD', direction: 'income', status: 'planned', dueAt: new Date('2026-08-22T12:00:00Z'), counterparty: 'Ali Travel', note: 'Tur' },
    ]);
    expect(result.transaction.id).toBe('right');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
