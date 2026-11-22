// To'lov jadvali, qarzdorlik va guruh ro'yxati — HTTP darajasida: rollar,
// agentliklararo izolyatsiya, validatsiya, idempotent to'lov va eslatmalar.
// Prisma xotiradagi kichik jadval bilan almashtirilgan (where/select subset).

const store = {};
let seq = 0;
const UNIQUE = { auditLog: ['dedupeKey'], paymentInstalment: ['financeTransactionId'] };
const DEFAULTS = {
  paymentInstalment: { status: 'planned', paidAt: null, paidAmount: null, financeTransactionId: null, note: null, position: 0, reminderSentAt: null },
};

const num = (v) => (v instanceof Date ? v.getTime() : v);
function matchValue(actual, cond) {
  if (cond instanceof Date) return actual != null && num(actual) === cond.getTime();
  if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
    if ('in' in cond && !cond.in.includes(actual)) return false;
    if ('notIn' in cond && cond.notIn.includes(actual)) return false;
    if ('lt' in cond && !(actual != null && num(actual) < num(cond.lt))) return false;
    if ('lte' in cond && !(actual != null && num(actual) <= num(cond.lte))) return false;
    if ('gt' in cond && !(actual != null && num(actual) > num(cond.gt))) return false;
    if ('gte' in cond && !(actual != null && num(actual) >= num(cond.gte))) return false;
    if ('not' in cond && (cond.not === null ? actual == null : actual === cond.not)) return false;
    return true;
  }
  return actual === cond;
}
function matches(row, where = {}) {
  for (const [key, cond] of Object.entries(where || {})) {
    if (cond === undefined) continue;
    if (key === 'OR') { if (!cond.some((w) => matches(row, w))) return false; continue; }
    if (key === 'AND') { if (!(Array.isArray(cond) ? cond : [cond]).every((w) => matches(row, w))) return false; continue; }
    if (key === 'NOT') { if ((Array.isArray(cond) ? cond : [cond]).some((w) => matches(row, w))) return false; continue; }
    if (cond === null) { if (row[key] != null) return false; continue; }
    if (!matchValue(row[key], cond)) return false;
  }
  return true;
}
const pick = (row, select) => {
  if (!row) return null;
  const copy = { ...row };
  if (!select) return copy;
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, copy[k]]));
};
function model(name) {
  store[name] = store[name] || [];
  const rows = () => store[name];
  const sortRows = (list, orderBy) => {
    const order = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []);
    return [...list].sort((a, b) => {
      for (const o of order) {
        const [k, dir] = Object.entries(o)[0];
        const av = num(a[k]); const bv = num(b[k]);
        if (av === bv) continue;
        return (av > bv ? 1 : -1) * (dir === 'desc' ? -1 : 1);
      }
      return 0;
    });
  };
  const checkUnique = (row, except) => {
    for (const field of UNIQUE[name] || []) {
      if (row[field] != null && rows().some((r) => r !== except && r[field] === row[field])) {
        const err = new Error('Unique constraint failed'); err.code = 'P2002'; throw err;
      }
    }
  };
  return {
    findFirst: jest.fn(async ({ where, select } = {}) => pick(rows().find((r) => matches(r, where)), select)),
    findUnique: jest.fn(async ({ where, select } = {}) => pick(rows().find((r) => matches(r, where)), select)),
    findMany: jest.fn(async ({ where, select, orderBy, take } = {}) => sortRows(rows().filter((r) => matches(r, where)), orderBy).slice(0, take || undefined).map((r) => pick(r, select))),
    count: jest.fn(async ({ where } = {}) => rows().filter((r) => matches(r, where)).length),
    create: jest.fn(async ({ data, select }) => {
      const row = { id: `${name}-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[name] || {}), ...data };
      checkUnique(row); rows().push(row); return pick(row, select);
    }),
    createMany: jest.fn(async ({ data }) => {
      for (const d of data) rows().push({ id: `${name}-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[name] || {}), ...d });
      return { count: data.length };
    }),
    update: jest.fn(async ({ where, data }) => {
      const row = rows().find((r) => matches(r, where)); if (!row) throw new Error('not found');
      const next = { ...row, ...data, updatedAt: new Date() }; checkUnique(next, row); Object.assign(row, next); return { ...row };
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      const hit = rows().filter((r) => matches(r, where)); hit.forEach((r) => Object.assign(r, data, { updatedAt: new Date() }));
      return { count: hit.length };
    }),
    delete: jest.fn(async ({ where }) => { const i = rows().findIndex((r) => matches(r, where)); const [row] = store[name].splice(i, 1); return row; }),
    deleteMany: jest.fn(async ({ where }) => { const before = rows().length; store[name] = rows().filter((r) => !matches(r, where)); return { count: before - store[name].length }; }),
    groupBy: jest.fn(async ({ by, where, _sum }) => {
      const groups = new Map();
      for (const r of rows().filter((x) => matches(x, where))) {
        const key = r[by[0]];
        const g = groups.get(key) || { [by[0]]: key, _sum: Object.fromEntries(Object.keys(_sum || {}).map((k) => [k, 0])) };
        for (const k of Object.keys(_sum || {})) g._sum[k] += r[k] || 0;
        groups.set(key, g);
      }
      return [...groups.values()];
    }),
  };
}

const mockPrisma = {};
for (const name of ['tourAgency', 'agencyMember', 'tourBooking', 'paymentInstalment', 'financeAccount', 'financeTransaction', 'auditLog', 'tour', 'crmPipelineStage', 'leadFile', 'telegramMessage']) mockPrisma[name] = model(name);
mockPrisma.$transaction = jest.fn(async (fn) => fn(mockPrisma));
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const ACCOUNTS = {
  ownerA: { id: 'acc-owner-a', email: 'a@example.com', status: 'approved' },
  managerA: { id: 'acc-manager-a', email: 'm@example.com', status: 'approved' },
  agentA: { id: 'acc-agent-a', email: 'g@example.com', status: 'approved' },
  accountantA: { id: 'acc-accountant-a', email: 'c@example.com', status: 'approved' },
  ownerB: { id: 'acc-owner-b', email: 'b@example.com', status: 'approved' },
};
jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    const account = ACCOUNTS[req.headers['x-test-account']];
    if (!account) return res.status(401).json({ success: false });
    req.agencyAccount = account;
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/telegram.service', () => ({ sendMessage: jest.fn(async () => ({})) }));

const express = require('express');
const request = require('supertest');
const tg = require('../src/services/telegram.service');
const schedule = require('../src/services/paymentSchedule.service');

const app = express();
app.use(express.json());
app.use('/agency', require('../src/routes/agency.routes'));
const as = (who) => ({ 'x-test-account': who });

const AGENCY_A = { id: 'ag-a', ownerAccountId: 'acc-owner-a', name: 'Agentlik A', active: true, approvalStatus: 'approved', tariff: null, tariffId: null, subscriptionUntil: null, telegramBotActive: true, telegramBotToken: '1:a', notifyChatId: 'notify-a', updatedAt: new Date() };
const AGENCY_B = { ...AGENCY_A, id: 'ag-b', ownerAccountId: 'acc-owner-b', name: 'Agentlik B', telegramBotToken: '1:b', notifyChatId: null };
const today = schedule.tashkentToday();
const day = (offset) => schedule.addDays(today, offset);
const isoDay = (offset) => day(offset).toISOString().slice(0, 10);

function seed() {
  seq = 0;
  for (const key of Object.keys(store)) store[key] = [];
  store.tourAgency.push({ ...AGENCY_A }, { ...AGENCY_B });
  store.agencyMember.push(
    { id: 'm1', agencyId: 'ag-a', accountId: 'acc-manager-a', role: 'manager', status: 'active', agency: AGENCY_A, createdAt: new Date() },
    { id: 'm2', agencyId: 'ag-a', accountId: 'acc-agent-a', role: 'agent', status: 'active', agency: AGENCY_A, createdAt: new Date() },
    { id: 'm3', agencyId: 'ag-a', accountId: 'acc-accountant-a', role: 'accountant', status: 'active', agency: AGENCY_A, createdAt: new Date() },
  );
  store.tourBooking.push(
    { id: 'bA1', agencyId: 'ag-a', tourId: 'tA', customerName: 'Ali Valiyev', customerPhone: '+998901112233', currency: 'USD', totalEstimate: 1000, telegramChatId: '555', travelers: 2, travelDate: day(30), status: 'confirmed', pipelineStage: 'won', branchId: null, assignedMemberId: null },
    { id: 'bA2', agencyId: 'ag-a', tourId: 'tA', customerName: 'Lost Lead', currency: 'USD', travelers: 1, travelDate: day(30), status: 'rejected', pipelineStage: 'lost' },
    { id: 'bB1', agencyId: 'ag-b', tourId: 'tB', customerName: 'Begona Mijoz', currency: 'USD', telegramChatId: '777', travelers: 1, travelDate: day(30), status: 'confirmed', pipelineStage: 'won' },
  );
  store.financeAccount.push(
    { id: 'accA-usd', agencyId: 'ag-a', name: 'Kassa', currency: 'USD', active: true, branchId: null, type: 'cash' },
    { id: 'accA-uzs', agencyId: 'ag-a', name: 'Bank', currency: 'UZS', active: true, branchId: null, type: 'bank' },
    { id: 'accB-usd', agencyId: 'ag-b', name: 'Kassa', currency: 'USD', active: true, branchId: null, type: 'cash' },
  );
  store.tour.push({ id: 'tA', agencyId: 'ag-a', title: 'Umra 2026 Dekabr', city: 'Makka', days: 14, nights: 13, duration: '14 kun' }, { id: 'tB', agencyId: 'ag-b', title: 'B tur', city: 'X', days: 5 });
  store.leadFile.push({
    id: 'fA1', agencyId: 'ag-a', bookingId: 'bA1', name: 'pasport.jpg', mimeType: 'image/jpeg', size: 10,
    data: Buffer.from('SECRET-IMAGE-BYTES'), ocrStatus: 'done', createdAt: new Date(),
    ocrData: { surname: 'VALIYEV', givenNames: 'ALI', passportNumber: 'FA7654321', nationality: 'UZB', birthDate: '1985-03-04', expiryDate: isoDay(120) },
  });
}
beforeEach(() => { jest.clearAllMocks(); seed(); });

const instalment = (extra) => ({ id: `inst-${++seq}`, agencyId: 'ag-a', bookingId: 'bA1', title: 'Avans', amount: 300, currency: 'USD', dueDate: day(10), status: 'planned', paidAt: null, paidAmount: null, financeTransactionId: null, note: null, position: 0, reminderSentAt: null, createdAt: new Date(), updatedAt: new Date(), ...extra });

describe('rollar', () => {
  test.each([
    ['post', '/agency/crm/bookings/bA1/instalments'],
    ['post', '/agency/crm/bookings/bA1/instalments/plan'],
    ['patch', '/agency/crm/instalments/x'],
    ['delete', '/agency/crm/instalments/x'],
    ['post', '/agency/crm/instalments/x/pay'],
  ])('agent yoza olmaydi: %s %s → 403', async (method, path) => {
    const res = await request(app)[method](path).set(as('agentA')).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_FORBIDDEN');
  });

  test('agent jadval va qarzdorlikni ko‘ra oladi, lekin hisoblar ro‘yxatisiz', async () => {
    store.paymentInstalment.push(instalment());
    const list = await request(app).get('/agency/crm/bookings/bA1/instalments').set(as('agentA'));
    expect(list.status).toBe(200);
    expect(list.body.data.instalments).toHaveLength(1);
    expect(list.body.data.canWrite).toBe(false);
    expect(list.body.data.accounts).toEqual([]);
    const debts = await request(app).get('/agency/crm/debts').set(as('agentA'));
    expect(debts.status).toBe(200);
  });

  test('buxgalter to‘lov bo‘lagi qo‘sha oladi, lekin pasport ro‘yxatini ko‘ra/eksport qila olmaydi', async () => {
    const created = await request(app).post('/agency/crm/bookings/bA1/instalments').set(as('accountantA')).send({ title: 'Avans', amount: '1 500', dueDate: isoDay(5) });
    expect(created.status).toBe(201);
    expect(created.body.data.instalment).toEqual(expect.objectContaining({ amount: 1500, currency: 'USD', agencyId: 'ag-a' }));
    for (const path of ['/agency/crm/group-list?tourId=tA', '/agency/crm/group-list/export?tourId=tA']) {
      const res = await request(app).get(path).set(as('accountantA'));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ROLE_FORBIDDEN');
    }
    expect(store.auditLog).toHaveLength(0);
  });

  test('menejer va agent guruh ro‘yxatini ko‘ra oladi', async () => {
    for (const who of ['managerA', 'agentA']) {
      const res = await request(app).get('/agency/crm/group-list?tourId=tA').set(as(who));
      expect(res.status).toBe(200);
    }
  });
});

describe('validatsiya', () => {
  test.each([
    [{ title: 'Avans', amount: 'abc', dueDate: '2026-12-01' }, 'Musbat summa kiriting'],
    [{ title: 'Avans', amount: 100, dueDate: '2026-13-45' }, 'To‘lov sanasi noto‘g‘ri'],
    [{ title: '', amount: 100, dueDate: '2026-12-01' }, 'To‘lov nomini kiriting'],
    [{ title: 'X', amount: 100, dueDate: '2026-12-01', agencyId: 'ag-b' }, 'Noma’lum maydon: agencyId'],
  ])('%j → 400 %s', async (body, message) => {
    const res = await request(app).post('/agency/crm/bookings/bA1/instalments').set(as('ownerA')).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(store.paymentInstalment).toHaveLength(0);
  });

  test('reja: noto‘g‘ri foiz va sana', async () => {
    const bad = await request(app).post('/agency/crm/bookings/bA1/instalments/plan').set(as('ownerA')).send({ total: 1000, depositPercent: 150, instalments: 2, firstDueDate: isoDay(3) });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/Avans foizi/);
    const noDate = await request(app).post('/agency/crm/bookings/bA1/instalments/plan').set(as('ownerA')).send({ total: 1000, instalments: 2 });
    expect(noDate.status).toBe(400);
    expect(noDate.body.message).toBe('Birinchi to‘lov sanasini kiriting');
  });

  test('guruh ro‘yxati: tourId majburiy, sana formati', async () => {
    expect((await request(app).get('/agency/crm/group-list').set(as('ownerA'))).status).toBe(400);
    const res = await request(app).get('/agency/crm/group-list?tourId=tA&date=01.12.2026').set(as('ownerA'));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/YYYY-MM-DD/);
  });
});

describe('reja yaratish', () => {
  test('total/avans/bo‘laklar → teng bo‘linadi, qoldiq oxirgisida; ikkinchi marta 409; replace bilan almashtiriladi', async () => {
    const body = { total: 1000, depositPercent: 30, instalments: 3, firstDueDate: isoDay(7) };
    const preview = await request(app).post('/agency/crm/bookings/bA1/instalments/plan').set(as('managerA')).send({ ...body, dryRun: true });
    expect(preview.status).toBe(200);
    expect(preview.body.data.instalments.map((r) => r.amount)).toEqual([300, 233, 233, 234]);
    expect(store.paymentInstalment).toHaveLength(0);

    const first = await request(app).post('/agency/crm/bookings/bA1/instalments/plan').set(as('managerA')).send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.instalments.reduce((a, r) => a + r.amount, 0)).toBe(1000);
    expect(store.paymentInstalment.every((r) => r.agencyId === 'ag-a' && r.currency === 'USD')).toBe(true);

    const again = await request(app).post('/agency/crm/bookings/bA1/instalments/plan').set(as('managerA')).send(body);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('PLAN_EXISTS');

    const replaced = await request(app).post('/agency/crm/bookings/bA1/instalments/plan').set(as('managerA')).send({ ...body, total: 2000, replace: true });
    expect(replaced.status).toBe(201);
    expect(store.paymentInstalment.filter((r) => r.status === 'planned').reduce((a, r) => a + r.amount, 0)).toBe(2000);
  });
});

describe('to‘landi deb belgilash', () => {
  test('aynan bitta FinanceTransaction (income) yaratiladi; qayta yuborish idempotent', async () => {
    store.paymentInstalment.push(instalment({ id: 'i1' }));
    const pay = () => request(app).post('/agency/crm/instalments/i1/pay').set(as('accountantA')).send({ accountId: 'accA-usd', paymentMethod: 'naqd' });
    const res = await pay();
    expect(res.status).toBe(201);
    expect(res.body.data.alreadyPaid).toBe(false);
    expect(store.financeTransaction).toHaveLength(1);
    expect(store.financeTransaction[0]).toEqual(expect.objectContaining({
      agencyId: 'ag-a', accountId: 'accA-usd', bookingId: 'bA1', direction: 'income', status: 'paid',
      amount: 300, currency: 'USD', counterparty: 'Ali Valiyev', paymentMethod: 'naqd', createdByAccountId: 'acc-accountant-a',
    }));
    expect(store.paymentInstalment[0]).toEqual(expect.objectContaining({ status: 'paid', paidAmount: 300, financeTransactionId: store.financeTransaction[0].id }));

    const repeat = await pay();
    expect(repeat.status).toBe(200);
    expect(repeat.body.data.alreadyPaid).toBe(true);
    expect(repeat.body.data.transactionId).toBe(store.financeTransaction[0].id);
    expect(store.financeTransaction).toHaveLength(1);
  });

  test('parallel ikki so‘rov — baribir bitta tranzaksiya', async () => {
    store.paymentInstalment.push(instalment({ id: 'i2' }));
    const [a, b] = await Promise.all([
      request(app).post('/agency/crm/instalments/i2/pay').set(as('ownerA')).send({}),
      request(app).post('/agency/crm/instalments/i2/pay').set(as('ownerA')).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(store.financeTransaction).toHaveLength(1);
  });

  test('qisman to‘lov — qoldiq uchun yangi rejalashtirilgan bo‘lak', async () => {
    store.paymentInstalment.push(instalment({ id: 'i3', amount: 233, title: '1-to‘lov' }));
    const res = await request(app).post('/agency/crm/instalments/i3/pay').set(as('ownerA')).send({ paidAmount: 100, paidAt: isoDay(0) });
    expect(res.status).toBe(201);
    expect(res.body.data.remainder).toEqual(expect.objectContaining({ amount: 133, status: 'planned', title: '1-to‘lov — qoldiq' }));
    expect(store.financeTransaction).toEqual([expect.objectContaining({ amount: 100 })]);
  });

  test('ortiqcha summa, boshqa valyutadagi va boshqa agentlik hisobi rad etiladi', async () => {
    store.paymentInstalment.push(instalment({ id: 'i4' }));
    const tooMuch = await request(app).post('/agency/crm/instalments/i4/pay').set(as('ownerA')).send({ paidAmount: 301 });
    expect(tooMuch.status).toBe(400);
    const wrongCurrency = await request(app).post('/agency/crm/instalments/i4/pay').set(as('ownerA')).send({ accountId: 'accA-uzs' });
    expect(wrongCurrency.status).toBe(400);
    expect(wrongCurrency.body.message).toMatch(/valyutasi/);
    const foreign = await request(app).post('/agency/crm/instalments/i4/pay').set(as('ownerA')).send({ accountId: 'accB-usd' });
    expect(foreign.status).toBe(404);
    expect(store.financeTransaction).toHaveLength(0);
    expect(store.paymentInstalment[0].status).toBe('planned');
  });

  test('to‘langan bo‘lakni o‘chirish yoki summasini o‘zgartirish mumkin emas', async () => {
    store.paymentInstalment.push(instalment({ id: 'i5', status: 'paid', paidAmount: 300, financeTransactionId: 'tx' }));
    expect((await request(app).delete('/agency/crm/instalments/i5').set(as('ownerA'))).status).toBe(409);
    expect((await request(app).patch('/agency/crm/instalments/i5').set(as('ownerA')).send({ amount: 10 })).status).toBe(409);
    const note = await request(app).patch('/agency/crm/instalments/i5').set(as('ownerA')).send({ note: 'Chek #12' });
    expect(note.status).toBe(200);
  });

  test('sana o‘zgarsa eslatma qayta yuboriladi (reminderSentAt tozalanadi)', async () => {
    store.paymentInstalment.push(instalment({ id: 'i6', reminderSentAt: new Date() }));
    const res = await request(app).patch('/agency/crm/instalments/i6').set(as('ownerA')).send({ dueDate: isoDay(20) });
    expect(res.status).toBe(200);
    expect(store.paymentInstalment[0].reminderSentAt).toBeNull();
  });
});

describe('agentliklararo izolyatsiya', () => {
  beforeEach(() => { store.paymentInstalment.push(instalment({ id: 'iA', dueDate: day(-5) })); });

  test.each([
    ['get', '/agency/crm/bookings/bA1/instalments', undefined],
    ['post', '/agency/crm/bookings/bA1/instalments', { title: 'X', amount: 10, dueDate: '2026-12-01' }],
    ['post', '/agency/crm/bookings/bA1/instalments/plan', { total: 100, instalments: 1, firstDueDate: '2026-12-01' }],
    ['patch', '/agency/crm/instalments/iA', { title: 'Buzildi' }],
    ['delete', '/agency/crm/instalments/iA', undefined],
    ['post', '/agency/crm/instalments/iA/pay', {}],
    ['get', '/agency/crm/group-list?tourId=tA', undefined],
    ['get', '/agency/crm/group-list/export?tourId=tA', undefined],
  ])('B agentlik egasi: %s %s → 404', async (method, path, body) => {
    const res = await request(app)[method](path).set(as('ownerB')).send(body);
    expect(res.status).toBe(404);
    expect(store.paymentInstalment).toEqual([expect.objectContaining({ id: 'iA', title: 'Avans', status: 'planned', agencyId: 'ag-a' })]);
    expect(store.financeTransaction).toHaveLength(0);
    expect(store.auditLog).toHaveLength(0);
  });

  test('B qarzdorlik ro‘yxatida A ning bo‘laklari ko‘rinmaydi', async () => {
    const res = await request(app).get('/agency/crm/debts').set(as('ownerB'));
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toEqual([]);
    expect(res.body.data.overdue).toEqual([]);
  });

  test('B guruh ro‘yxatida faqat o‘z lidlari', async () => {
    const res = await request(app).get('/agency/crm/group-list?tourId=tB').set(as('ownerB'));
    expect(res.status).toBe(200);
    expect(res.body.data.rows.map((r) => r.bookingId)).toEqual(['bB1']);
  });
});

describe('qarzdorlik', () => {
  test('muddati o‘tgan + 7 kun ichida + valyuta bo‘yicha jami', async () => {
    store.paymentInstalment.push(
      instalment({ id: 'o1', amount: 300, dueDate: day(-3) }),
      instalment({ id: 'o2', amount: 2_000_000, currency: 'UZS', dueDate: day(-1) }),
      instalment({ id: 's1', amount: 200, dueDate: day(2) }),
      instalment({ id: 'f1', amount: 500, dueDate: day(40) }),
      instalment({ id: 'p1', amount: 999, dueDate: day(-10), status: 'paid' }),
      instalment({ id: 'c1', amount: 999, dueDate: day(-10), status: 'cancelled' }),
    );
    const res = await request(app).get('/agency/crm/debts').set(as('ownerA'));
    expect(res.status).toBe(200);
    const usd = res.body.data.totals.find((t) => t.currency === 'USD');
    expect(usd).toEqual({ currency: 'USD', overdue: 300, overdueCount: 1, dueWeek: 200, dueWeekCount: 1, outstanding: 1000 });
    expect(res.body.data.totals.find((t) => t.currency === 'UZS')).toEqual(expect.objectContaining({ overdue: 2_000_000 }));
    expect(res.body.data.topOverdueLeads).toEqual([expect.objectContaining({ bookingId: 'bA1', customerName: 'Ali Valiyev', amounts: { USD: 300, UZS: 2_000_000 }, daysOverdue: 3 })]);
  });
});

describe('guruh ro‘yxati va eksport', () => {
  test('faqat kelishilgan lidlar, pasport yo‘q sayyoh ogohlantirishi, rasm yo‘q', async () => {
    const res = await request(app).get(`/agency/crm/group-list?tourId=tA&date=${isoDay(30)}`).set(as('ownerA'));
    expect(res.status).toBe(200);
    const { rows, summary, departures } = res.body.data;
    expect(rows.map((r) => r.bookingId)).toEqual(['bA1', 'bA1']); // bA2 (lost) yo'q; travelers=2
    expect(rows[0]).toEqual(expect.objectContaining({ fullName: 'VALIYEV ALI', passportNumber: 'FA7654321', nationality: 'UZB' }));
    expect(rows[0].warnings.map((w) => w.code)).toEqual(['expires_within_6_months']);
    expect(rows[1].warnings.map((w) => w.code)).toEqual(['missing_passport']);
    expect(summary).toEqual(expect.objectContaining({ bookings: 1, travelers: 2, passports: 1 }));
    expect(departures).toEqual([{ date: isoDay(30), count: 1 }]);
    expect(JSON.stringify(res.body)).not.toMatch(/SECRET-IMAGE|U0VDUkVU/);
    const fileQuery = mockPrisma.leadFile.findMany.mock.calls[0][0];
    expect(fileQuery.where).toEqual(expect.objectContaining({ agencyId: 'ag-a' }));
    expect(fileQuery.select.data).toBeUndefined();
  });

  test('boshqa sana — bo‘sh ro‘yxat', async () => {
    const res = await request(app).get(`/agency/crm/group-list?tourId=tA&date=${isoDay(31)}`).set(as('ownerA'));
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toEqual([]);
  });

  test('eksport — BOM li CSV, audit jurnalida pasport ma’lumoti yo‘q', async () => {
    store.tourBooking[0].customerName = '=cmd|calc';
    const res = await request(app).get('/agency/crm/group-list/export?tourId=tA').set(as('agentA'));
    expect(res.status).toBe(200);
    const { csv, filename } = res.body.data;
    expect(filename).toBe('guruh-umra-2026-dekabr-barcha-sanalar.csv');
    expect(csv.startsWith('﻿№,F.I.Sh (pasport)')).toBe(true);
    expect(csv).toContain('FA7654321');
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain("'+998901112233");
    expect(csv).not.toMatch(/SECRET-IMAGE|U0VDUkVU/);
    expect(store.auditLog).toEqual([expect.objectContaining({ agencyId: 'ag-a', action: 'EXPORT group-list', entityType: 'tours', entityId: 'tA', actorAccountId: 'acc-agent-a' })]);
    expect(JSON.stringify(store.auditLog[0].changes)).not.toMatch(/FA7654321|VALIYEV/);
  });
});

describe('eslatmalar (scheduler)', () => {
  // 10:30 Toshkent = 05:30 UTC
  const at = (hourUtc) => { const d = new Date(today); d.setUTCHours(hourUtc, 30, 0, 0); return d; };

  test('2 kun ichidagi bo‘lak — bitta eslatma; qayta ishga tushirish yubormaydi', async () => {
    store.paymentInstalment.push(
      instalment({ id: 'r1', dueDate: day(2) }),
      instalment({ id: 'r2', dueDate: day(3) }), // hali erta
      instalment({ id: 'r3', dueDate: day(1), agencyId: 'ag-b', bookingId: 'bA1' }), // lid boshqa agentlikniki — yuborilmaydi
    );
    expect(await schedule.runInstalmentReminders(at(5))).toBe(1);
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
    expect(tg.sendMessage).toHaveBeenCalledWith('1:a', '555', expect.stringContaining('300 USD'));
    expect(store.telegramMessage).toHaveLength(1);
    expect(await schedule.runInstalmentReminders(at(6))).toBe(0);
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
  });

  test('10:00 dan oldin hech narsa yuborilmaydi', async () => {
    store.paymentInstalment.push(instalment({ id: 'r4', dueDate: day(1) }));
    expect(await schedule.runInstalmentReminders(at(4))).toBe(0); // 09:30 Toshkent
    expect(tg.sendMessage).not.toHaveBeenCalled();
    expect(store.paymentInstalment[0].reminderSentAt).toBeNull();
  });

  test('muddati o‘tganlar xulosasi — kuniga bitta (notify chat), B da chat yo‘q', async () => {
    store.paymentInstalment.push(
      instalment({ id: 'd1', dueDate: day(-2) }),
      instalment({ id: 'd2', dueDate: day(-2), agencyId: 'ag-b', bookingId: 'bB1' }),
    );
    expect(await schedule.runOverdueDigest(at(5))).toBe(1);
    expect(await schedule.runOverdueDigest(at(7))).toBe(0);
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
    expect(tg.sendMessage).toHaveBeenCalledWith('1:a', 'notify-a', expect.stringContaining('Ali Valiyev'));
    expect(store.auditLog.filter((r) => r.dedupeKey?.startsWith('payment-overdue-digest:ag-a:'))).toHaveLength(1);
  });
});
