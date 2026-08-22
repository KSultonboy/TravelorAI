const { cleanDate, getExchangeRates, normalizeRows } = require('../src/services/exchangeRate.service');

describe('Markaziy bank valyuta kurslari', () => {
  afterEach(() => { delete global.fetch; });

  test('kursni nominal bo‘yicha bitta birlikka hisoblaydi', () => {
    const result = normalizeRows([
      { Ccy: 'USD', CcyNm_UZ: 'AQSH dollari', Nominal: '1', Rate: '12650.12', Diff: '10.5', Date: '22.08.2026' },
      { Ccy: 'JPY', CcyNm_UZ: 'Yaponiya iyenasi', Nominal: '100', Rate: '8500', Diff: '-2', Date: '22.08.2026' },
    ]);
    expect(result.rates.find((row) => row.code === 'USD').unitRateUzs).toBe(12650.12);
    expect(result.rates.find((row) => row.code === 'JPY').unitRateUzs).toBe(85);
  });

  test('noto‘g‘ri sana rad etiladi', () => {
    expect(() => cleanDate('22.08.2026')).toThrow('YYYY-MM-DD');
    expect(() => cleanDate('2026-02-31')).toThrow('noto‘g‘ri');
  });

  test('rasmiy endpointdan kurslarni oladi', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ Ccy: 'USD', CcyNm_UZ: 'AQSH dollari', Nominal: '1', Rate: '12650', Diff: '5', Date: '22.08.2026' }],
    });
    const result = await getExchangeRates({ date: '2026-08-22', force: true });
    expect(global.fetch.mock.calls[0][0]).toContain('/all/2026-08-22/');
    expect(result.baseCurrency).toBe('UZS');
    expect(result.rates[0].code).toBe('USD');
  });
});
