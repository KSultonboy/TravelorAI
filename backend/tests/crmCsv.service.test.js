const { mapCsv, parseCsv } = require('../src/services/crmCsv.service');

describe('CRM CSV import', () => {
  test('quoted comma va ikki qatorni o‘qiydi', () => {
    expect(parseCsv('name,note\n"Ali, Vali","VIP, qayta aloqa"')).toEqual([
      ['name', 'note'], ['Ali, Vali', 'VIP, qayta aloqa'],
    ]);
  });

  test('o‘zbekcha ustunlarni TourBooking maʼlumotiga o‘giradi', () => {
    const result = mapCsv('Mijoz ismi,Telefon,Tur nomi,Kishilar,Summa,Bosqich\nAli,+998901234567,Dubay,2,"1,200",taklif');
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ customerName: 'Ali', travelers: 2, pipelineStage: 'quoted', leadTour: 'Dubay' });
    expect(result.rows[0].totalEstimate).toBe(1200);
  });

  test('mijoz ismisiz qatorni xato sifatida qaytaradi', () => {
    const result = mapCsv('name,phone\n,+99890');
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain('2-qator');
  });
});
