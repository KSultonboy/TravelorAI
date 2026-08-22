const { conditionMatches, matchesConditions, renderTemplate } = require('../src/services/noCodeAutomation.service');

describe('No-code avtomatizatsiya engine', () => {
  test('template ichidagi entity qiymatlarini almashtiradi', () => {
    expect(renderTemplate('{customerName}: {stage} — {amount}', { customerName: 'Ali', stage: 'new', amount: 1250000 }))
      .toBe('Ali: new — 1250000');
  });

  test('matn, summa va bo‘sh qiymat operatorlarini tekshiradi', () => {
    expect(conditionMatches({ source: 'instagram' }, { field: 'source', operator: 'equals', value: 'instagram' })).toBe(true);
    expect(conditionMatches({ customerName: 'Ali Valiyev' }, { field: 'customerName', operator: 'contains', value: 'vali' })).toBe(true);
    expect(conditionMatches({ amount: 900 }, { field: 'amount', operator: 'greater_or_equal', value: '500' })).toBe(true);
    expect(conditionMatches({ assignedMemberId: null }, { field: 'assignedMemberId', operator: 'is_empty' })).toBe(true);
  });

  test('ALL rejimida barcha, ANY rejimida bittasi mos bo‘lishi yetarli', () => {
    const conditions = [
      { field: 'stage', operator: 'equals', value: 'new' },
      { field: 'source', operator: 'equals', value: 'telegram' },
    ];
    expect(matchesConditions({ stage: 'new', source: 'instagram' }, conditions, 'all')).toBe(false);
    expect(matchesConditions({ stage: 'new', source: 'instagram' }, conditions, 'any')).toBe(true);
  });

  test('shartsiz qoida barcha entity uchun mos keladi', () => {
    expect(matchesConditions({ stage: 'new' }, [], 'all')).toBe(true);
  });
});
