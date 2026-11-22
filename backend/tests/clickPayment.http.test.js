// CLICK SHOP API callback'lari: imzo, summa, Prepare'siz Complete, takroriy
// (parallel) Complete — obuna faqat BIR MARTA uzaytirilishi kerak.
process.env.CLICK_SERVICE_ID = '777';
process.env.CLICK_MERCHANT_ID = '888';
process.env.CLICK_SECRET_KEY = 'test-click-secret';

const crypto = require('crypto');

// Oddiy "baza": ClickTransaction qatorlari xotirada, updateMany shartli.
const store = { tx: null, agency: null, payments: [] };

function matchesWhere(row, where) {
  if (where.id && row.id !== where.id) return false;
  if (typeof where.state === 'string' && row.state !== where.state) return false;
  if (where.state && where.state.in && !where.state.in.includes(row.state)) return false;
  return true;
}

const mockPrisma = {
  clickTransaction: {
    findUnique: jest.fn(async ({ where }) => {
      if (!store.tx) return null;
      if (where.merchantTransId && where.merchantTransId !== store.tx.merchantTransId) return null;
      if (where.id && where.id !== store.tx.id) return null;
      return { ...store.tx };
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      if (!store.tx || !matchesWhere(store.tx, where)) return { count: 0 };
      Object.assign(store.tx, data);
      return { count: 1 };
    }),
  },
  tourAgency: {
    findUnique: jest.fn(async () => ({ id: store.agency.id, subscriptionUntil: store.agency.subscriptionUntil })),
    update: jest.fn(async ({ data }) => Object.assign(store.agency, data)),
  },
  agencyPayment: {
    create: jest.fn(async ({ data }) => { store.payments.push(data); return data; }),
  },
  // Interaktiv tranzaksiya: xato bo'lsa holat orqaga qaytariladi (Postgres kabi).
  $transaction: jest.fn(async (fn) => {
    const snapshot = { tx: { ...store.tx }, agency: { ...store.agency }, payments: store.payments.length };
    try {
      return await fn(mockPrisma);
    } catch (err) {
      store.tx = snapshot.tx;
      store.agency = snapshot.agency;
      store.payments.length = snapshot.payments;
      throw err;
    }
  }),
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');

const app = express();
app.use('/click', express.urlencoded({ extended: false }), require('../src/routes/clickPublic.routes'));

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

function prepareBody(overrides = {}) {
  const b = {
    click_trans_id: '5001', service_id: '777', click_paydoc_id: '9001',
    merchant_trans_id: 'TA1', amount: '199000.00', action: '0', error: '0',
    error_note: 'Success', sign_time: '2026-11-22 10:00:00', ...overrides,
  };
  b.sign_string = overrides.sign_string || md5(`${b.click_trans_id}${b.service_id}test-click-secret${b.merchant_trans_id}${b.amount}${b.action}${b.sign_time}`);
  return b;
}

function completeBody(overrides = {}) {
  const b = {
    click_trans_id: '5001', service_id: '777', click_paydoc_id: '9001',
    merchant_trans_id: 'TA1', merchant_prepare_id: String(store.tx?.prepareId || ''), amount: '199000.00',
    action: '1', error: '0', error_note: 'Success', sign_time: '2026-11-22 10:01:00', ...overrides,
  };
  b.sign_string = overrides.sign_string
    || md5(`${b.click_trans_id}${b.service_id}test-click-secret${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`);
  return b;
}

beforeEach(() => {
  jest.clearAllMocks();
  store.tx = { id: 'tx1', merchantTransId: 'TA1', agencyId: 'ag1', tariffId: 't-pro', amount: 199000, months: 1, state: 'created', prepareId: null, confirmId: null };
  store.agency = { id: 'ag1', subscriptionUntil: null };
  store.payments = [];
});

const post = (path, body) => request(app).post(path).type('form').send(body);

describe('CLICK Prepare', () => {
  test('noto‘g‘ri imzo -1 qaytaradi va holat o‘zgarmaydi', async () => {
    const res = await post('/click/prepare', prepareBody({ sign_string: 'deadbeef' }));
    expect(res.body.error).toBe(-1);
    expect(store.tx.state).toBe('created');
  });

  test('summa mos kelmasa -2', async () => {
    const res = await post('/click/prepare', prepareBody({ amount: '1000.00' }));
    expect(res.body.error).toBe(-2);
    expect(store.tx.state).toBe('created');
  });

  test('muvaffaqiyatli prepare merchant_prepare_id beradi; takroriy prepare bir xil id', async () => {
    const first = await post('/click/prepare', prepareBody());
    expect(first.body.error).toBe(0);
    expect(store.tx.state).toBe('prepared');
    const again = await post('/click/prepare', prepareBody());
    expect(again.body.error).toBe(0);
    expect(again.body.merchant_prepare_id).toBe(first.body.merchant_prepare_id);
  });
});

describe('CLICK Complete', () => {
  test('Prepare bo‘lmagan tranzaksiyani tasdiqlamaydi (-6)', async () => {
    const res = await post('/click/complete', completeBody({ merchant_prepare_id: '123456789' }));
    expect(res.body.error).toBe(-6);
    expect(store.tx.state).toBe('created');
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('noto‘g‘ri imzo -1', async () => {
    await post('/click/prepare', prepareBody());
    const res = await post('/click/complete', completeBody({ sign_string: '00' }));
    expect(res.body.error).toBe(-1);
    expect(store.tx.state).toBe('prepared');
  });

  test('summa mos kelmasa -2 va obuna faollashmaydi', async () => {
    await post('/click/prepare', prepareBody());
    const res = await post('/click/complete', completeBody({ amount: '99000.00' }));
    expect(res.body.error).toBe(-2);
    expect(store.tx.state).toBe('prepared');
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('muvaffaqiyatli tasdiq obunani bir marta faollashtiradi', async () => {
    await post('/click/prepare', prepareBody());
    const res = await post('/click/complete', completeBody());
    expect(res.body.error).toBe(0);
    expect(res.body.merchant_confirm_id).toEqual(expect.any(Number));
    expect(store.tx.state).toBe('paid');
    expect(store.payments).toHaveLength(1);
    expect(store.agency.subscriptionStatus).toBe('active');
    expect(store.agency.tariffId).toBe('t-pro');
  });

  test('takroriy Complete -4 qaytaradi (avvalgi confirm id bilan) va obunani qayta uzaytirmaydi', async () => {
    await post('/click/prepare', prepareBody());
    const first = await post('/click/complete', completeBody());
    const untilAfterFirst = store.agency.subscriptionUntil;
    const second = await post('/click/complete', completeBody());
    expect(second.body.error).toBe(-4);
    expect(second.body.merchant_confirm_id).toBe(first.body.merchant_confirm_id);
    expect(store.payments).toHaveLength(1);
    expect(store.agency.subscriptionUntil).toBe(untilAfterFirst);
  });

  test('parallel Complete: faqat bittasi obunani uzaytiradi', async () => {
    await post('/click/prepare', prepareBody());
    const [a, b] = await Promise.all([post('/click/complete', completeBody()), post('/click/complete', completeBody())]);
    const codes = [a.body.error, b.body.error].sort();
    expect(codes).toEqual([-4, 0]);
    expect(store.payments).toHaveLength(1);
    expect(mockPrisma.tourAgency.update).toHaveBeenCalledTimes(1);
  });

  test('to‘langan tranzaksiyani CLICK xato bilan bekor qila olmaydi', async () => {
    await post('/click/prepare', prepareBody());
    await post('/click/complete', completeBody());
    const res = await post('/click/complete', completeBody({ error: '-5017' }));
    expect(res.body.error).toBe(-4);
    expect(store.tx.state).toBe('paid');
  });

  test('obuna faollashmasa ham CLICK’ga muvaffaqiyat, tranzaksiya paid + ACTIVATION_FAILED', async () => {
    await post('/click/prepare', prepareBody());
    mockPrisma.tourAgency.update.mockRejectedValueOnce(new Error('db down'));
    const res = await post('/click/complete', completeBody());
    expect(res.body.error).toBe(0);
    expect(store.tx.state).toBe('paid');
    expect(store.tx.errorNote).toMatch(/ACTIVATION_FAILED/);
  });
});
