// To'lov jadvali va guruh ro'yxati xizmatlarining sof funksiyalari.
jest.mock('../src/config/database', () => ({ prisma: {} }));

const schedule = require('../src/services/paymentSchedule.service');
const groups = require('../src/services/groupList.service');

const D = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe('generatePlan — yaxlitlash va sanalar', () => {
  test('qoldiq oxirgi bo‘lakka tushadi, yig‘indi doim total', () => {
    const plan = schedule.generatePlan({ total: 1000, depositPercent: 30, instalments: 3, firstDueDate: '2026-12-01' });
    expect(plan.map((r) => r.amount)).toEqual([300, 233, 233, 234]);
    expect(plan.reduce((a, r) => a + r.amount, 0)).toBe(1000);
    expect(plan[0].title).toBe('Avans');
    expect(plan[3].title).toBe('3-to‘lov (qoldiq)');
    expect(plan.map((r) => r.dueDate.toISOString().slice(0, 10))).toEqual(['2026-12-01', '2026-12-01', '2026-12-31', '2027-01-30']);
  });

  test('avans foizi yaxlitlanadi (33.3% of 1001 = 333)', () => {
    const plan = schedule.generatePlan({ total: 1001, depositPercent: 33.3, instalments: 2, firstDueDate: '2026-12-01', depositDueDate: '2026-11-25', intervalDays: 14 });
    expect(plan.map((r) => r.amount)).toEqual([333, 334, 334]);
    expect(plan[0].dueDate.toISOString().slice(0, 10)).toBe('2026-11-25');
    expect(plan[2].dueDate.toISOString().slice(0, 10)).toBe('2026-12-15');
  });

  test('turli summalar uchun invariant: yig‘indi = total, hech bir bo‘lak 0 emas', () => {
    for (const total of [7, 100, 999, 12_345_678]) {
      for (const pct of [0, 10, 50, 99]) {
        for (const n of [1, 2, 3, 7]) {
          if (Math.floor((total - Math.round(total * pct / 100)) / n) <= 0) continue;
          const plan = schedule.generatePlan({ total, depositPercent: pct, instalments: n, firstDueDate: '2027-01-15' });
          expect(plan.reduce((a, r) => a + r.amount, 0)).toBe(total);
          expect(plan.every((r) => Number.isInteger(r.amount) && r.amount > 0)).toBe(true);
        }
      }
    }
  });

  test('100% avans — bitta bo‘lak; 0% — avanssiz', () => {
    expect(schedule.generatePlan({ total: 500, depositPercent: 100, instalments: 0, firstDueDate: '2026-12-01' })).toEqual([
      expect.objectContaining({ title: 'Avans', amount: 500 }),
    ]);
    const noDeposit = schedule.generatePlan({ total: 500, depositPercent: 0, instalments: 1, firstDueDate: '2026-12-01' });
    expect(noDeposit).toEqual([expect.objectContaining({ title: 'Qoldiq', amount: 500 })]);
  });

  test('noto‘g‘ri kirish — o‘zbekcha xato', () => {
    expect(() => schedule.generatePlan({ total: 0, firstDueDate: '2026-12-01' })).toThrow('Umumiy summa');
    expect(() => schedule.generatePlan({ total: 100, depositPercent: 50, instalments: 0, firstDueDate: '2026-12-01' })).toThrow('kamida bitta bo‘lak');
    expect(() => schedule.generatePlan({ total: 3, instalments: 5, firstDueDate: '2026-12-01' })).toThrow('juda ko‘p');
    expect(() => schedule.generatePlan({ total: 100, firstDueDate: '2026-02-30' })).toThrow('sanasi noto‘g‘ri');
  });
});

describe('Toshkent sanasi', () => {
  test('UTC 19:30 — Toshkentda ertangi kun', () => {
    expect(schedule.tashkentToday(new Date('2026-11-22T19:30:00Z')).toISOString()).toBe('2026-11-23T00:00:00.000Z');
    expect(schedule.tashkentHour(new Date('2026-11-23T05:00:00Z'))).toBe(10);
  });
});

describe('summarizeDebts — qarzdorlik agregatsiyasi', () => {
  const today = D('2026-11-23');
  const rows = [
    { id: 'i1', bookingId: 'b1', title: 'Avans', amount: 300, currency: 'USD', dueDate: D('2026-11-10'), status: 'planned' },
    { id: 'i2', bookingId: 'b1', title: '1-to‘lov', amount: 200, currency: 'USD', dueDate: D('2026-11-20'), status: 'planned' },
    { id: 'i3', bookingId: 'b2', title: 'Avans', amount: 5_000_000, currency: 'UZS', dueDate: D('2026-11-22'), status: 'planned' },
    { id: 'i4', bookingId: 'b3', title: 'Qoldiq', amount: 700, currency: 'USD', dueDate: D('2026-11-23'), status: 'planned' }, // bugun — muddati o'tmagan
    { id: 'i5', bookingId: 'b3', title: 'Qoldiq', amount: 50, currency: 'USD', dueDate: D('2026-11-30'), status: 'planned' }, // +7 kun — haftaga kiradi
    { id: 'i6', bookingId: 'b4', title: 'X', amount: 999, currency: 'USD', dueDate: D('2026-11-01'), status: 'paid' }, // hisobga olinmaydi
  ];
  const bookings = [{ id: 'b1', customerName: 'Ali Valiyev' }, { id: 'b2', customerName: 'Olim' }, { id: 'b3', customerName: 'Vali' }];
  const outstanding = [{ currency: 'USD', _sum: { amount: 4250 } }, { currency: 'UZS', _sum: { amount: 5_000_000 } }];

  test('valyuta bo‘yicha jami, muddati o‘tgan va 7 kunlik', () => {
    const s = schedule.summarizeDebts({ rows, outstanding, bookings, today });
    expect(s.totals).toEqual([
      { currency: 'USD', overdue: 500, overdueCount: 2, dueWeek: 750, dueWeekCount: 2, outstanding: 4250 },
      { currency: 'UZS', overdue: 5_000_000, overdueCount: 1, dueWeek: 0, dueWeekCount: 0, outstanding: 5_000_000 },
    ].sort((a, b) => a.currency.localeCompare(b.currency)));
    expect(s.overdue.map((r) => r.id)).toEqual(['i1', 'i2', 'i3']);
    expect(s.dueSoon.map((r) => r.id)).toEqual(['i4', 'i5']);
  });

  test('top qarzdor lidlar — eng uzoq kechikkan birinchi, lid bo‘yicha yig‘ilgan', () => {
    const s = schedule.summarizeDebts({ rows, outstanding, bookings, today });
    expect(s.topOverdueLeads[0]).toEqual(expect.objectContaining({ bookingId: 'b1', customerName: 'Ali Valiyev', amounts: { USD: 500 }, count: 2, daysOverdue: 13 }));
    expect(s.topOverdueLeads[1]).toEqual(expect.objectContaining({ bookingId: 'b2', daysOverdue: 1 }));
  });
});

describe('pasport muddati', () => {
  const dep = D('2026-12-01');
  const ret = D('2026-12-11');
  test('aynan qaytish + 6 oy — yetarli', () => {
    expect(groups.passportExpiryWarning('2027-06-11', { departureDate: dep, returnDate: ret })).toBeNull();
  });
  test('bir kun kam — ogohlantirish', () => {
    expect(groups.passportExpiryWarning('2027-06-10', { departureDate: dep, returnDate: ret })).toEqual(expect.objectContaining({ code: 'expires_within_6_months' }));
  });
  test('jo‘nashdan oldin tugaydi', () => {
    expect(groups.passportExpiryWarning('2026-11-30', { departureDate: dep, returnDate: ret })).toEqual(expect.objectContaining({ code: 'passport_expired' }));
  });
  test('muddat o‘qilmagan', () => {
    expect(groups.passportExpiryWarning(null, { departureDate: dep, returnDate: ret })).toEqual(expect.objectContaining({ code: 'expiry_unknown' }));
  });
  test('oy oxiri: 31-avgust + 6 oy → 28-fevral (kabisa bo‘lmagan yil)', () => {
    expect(groups.addMonthsUtc(D('2026-08-31'), 6).toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(groups.addMonthsUtc(D('2027-08-31'), 6).toISOString().slice(0, 10)).toBe('2028-02-29');
    expect(groups.passportExpiryWarning('2027-02-28', { departureDate: D('2026-08-20'), returnDate: D('2026-08-31') })).toBeNull();
    expect(groups.passportExpiryWarning('2027-02-27', { departureDate: D('2026-08-20'), returnDate: D('2026-08-31') })).not.toBeNull();
  });
  test('tur davomiyligi: days → nights+1 → matn', () => {
    expect(groups.tourDurationDays({ days: 10 })).toBe(10);
    expect(groups.tourDurationDays({ nights: 6 })).toBe(7);
    expect(groups.tourDurationDays({ duration: '14 kun / 13 tun' })).toBe(14);
    expect(groups.tourDurationDays({})).toBe(0);
  });
});

describe('ism solishtirish', () => {
  test.each([
    ['Alisher Aliyev', 'ALIYEV ALISHER', true],
    ['Алишер Алиев', 'ALIEV ALISHER', true],
    ['Xasanov Bobur', 'KHASANOV BOBUR', true],
    ['G‘ulomov Shoxrux', 'GULOMOV SHOKHRUKH', true],
    ['Ali aka', 'ALIYEV ALI', true],
    ['Alisher Valiyev', 'ALIYEV ALISHER', false],
    ['Dilnoza', 'KARIMOVA MADINA', false],
  ])('%s ~ %s → %s', (lead, passport, expected) => {
    expect(groups.namesMatch(lead, passport)).toBe(expected);
  });
});

describe('guruh qatorlari', () => {
  const tour = { days: 10 };
  const passport = (id, bookingId, ocr, createdAt = '2026-11-01T00:00:00Z') => ({ id, bookingId, ocrStatus: 'done', ocrData: ocr, createdAt });
  test('pasport yo‘q sayyohlar, ism mos emasligi va dublikat pasport', () => {
    const rows = groups.buildGroupRows({
      tour, today: D('2026-11-23'),
      bookings: [{ id: 'b1', customerName: 'Dilnoza', customerPhone: '+998901112233', travelers: 3, travelDate: D('2026-12-01') }],
      files: [
        passport('f1', 'b1', { surname: 'KARIMOVA', givenNames: 'MADINA', passportNumber: 'FA1234567', nationality: 'UZB', birthDate: '1990-01-02', expiryDate: '2030-01-01' }),
        passport('f2', 'b1', { surname: 'KARIMOVA', givenNames: 'MADINA', passportNumber: 'FA1234567', expiryDate: '2030-01-01' }, '2026-10-01T00:00:00Z'),
        { id: 'f3', bookingId: 'b1', ocrStatus: 'failed', ocrData: null, createdAt: '2026-11-02T00:00:00Z' },
      ],
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(expect.objectContaining({ no: 1, fileId: 'f1', fullName: 'KARIMOVA MADINA', returnDate: '2026-12-11' }));
    expect(rows[0].warnings.map((w) => w.code)).toEqual(['name_mismatch']);
    expect(rows[1].warnings.map((w) => w.code)).toEqual(['missing_passport']);
    expect(rows[2].fullName).toBe('Dilnoza — 3-sayyoh');
  });

  test('sanasiz lid — ogohlantirish', () => {
    const rows = groups.buildGroupRows({ tour, today: D('2026-11-23'), bookings: [{ id: 'b2', customerName: 'Ali', travelers: 1, travelDate: null }], files: [] });
    expect(rows[0].warnings.map((w) => w.code)).toEqual(['missing_passport', 'no_departure_date']);
  });
});

describe('CSV — formula injection va escaping', () => {
  test.each([
    ['=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ['+998901112233', "'+998901112233"],
    ['-5', "'-5"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tTAB', "'\tTAB"],
    ['\rCR', "\"'\rCR\""],
    ['Ali, Vali', '"Ali, Vali"'],
    ['a;b', '"a;b"'],
    ['oddiy', 'oddiy'],
    [null, ''],
  ])('%j → %j', (input, expected) => {
    expect(groups.csvCell(input)).toBe(expected);
  });

  test('BOM, sarlavha va CRLF', () => {
    const csv = groups.buildGroupCsv([{ no: 1, fullName: 'ALIYEV ALI', passportNumber: 'FA1', nationality: 'UZB', birthDate: '1990-01-02', expiryDate: '2030-05-06', phone: '+998', note: '', warnings: [{ message: 'A' }, { message: 'B' }] }]);
    expect(csv.startsWith('﻿№,F.I.Sh (pasport),Pasport raqami,Fuqaroligi,Tug‘ilgan sana,Pasport amal qilish muddati,Telefon,Izoh,Ogohlantirish\r\n')).toBe(true);
    expect(csv.split('\r\n')[1]).toBe("1,ALIYEV ALI,FA1,UZB,02.01.1990,06.05.2030,'+998,,A; B".replace('A; B', '"A; B"'));
  });
});
