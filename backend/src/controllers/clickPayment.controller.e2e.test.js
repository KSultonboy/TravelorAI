/**
 * "To'g'ri pul kelib tushsa, Premium chindan ochiladimi va muddat
 * chindan uzayadimi?" — savoliga real javob.
 *
 * Bu test PRODUKSIYA kontrollerini (clickPayment.controller.js) O'ZGARTIRMASDAN,
 * haqiqiy MD5 imzo formulasi bilan yasalgan CLICK so'rovlarini haydab o'tkazadi.
 * Faqat Postgres (prisma) xotira-ichi soxta jadval bilan almashtirilgan —
 * hamma biznes mantiq (imzo tekshiruvi, holat mashinasi, muddat hisoblash,
 * stacking, IDOR) ASL kod orqali ishlaydi.
 */

process.env.CLICK_SERVICE_ID = 'test_service';
process.env.CLICK_MERCHANT_ID = 'test_merchant';
process.env.CLICK_SECRET_KEY = 'test_secret_key_12345';
process.env.USER_PREMIUM_PRICE_UZS = '29000';
process.env.PUBLIC_SITE_URL = 'https://travelorai.com';

const crypto = require('crypto');

// jest.mock() chaqiruvlari babel tomonidan fayl boshiga "hoisting" qilinadi —
// shu sabab fabrika (factory) ICHIDA hech qanday tashqi o'zgaruvchiga
// murojaat qilinmaydi (Jest cheklovi). Xotira-ichi "baza" shu yerda,
// factory ICHIDA yaratiladi; keyin uni pastda qayta require() qilib olamiz.
jest.mock('../config/database', () => {
  function matchesWhere(row, where = {}) {
    return Object.entries(where).every(([key, cond]) => {
      const val = row[key];
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('in' in cond) return cond.in.includes(val);
        if ('gt' in cond) return val instanceof Date ? val.getTime() > cond.gt.getTime() : val > cond.gt;
        if ('lt' in cond) return val instanceof Date ? val.getTime() < cond.lt.getTime() : val < cond.lt;
        if ('contains' in cond) return typeof val === 'string' && val.includes(cond.contains);
        return true;
      }
      return val === cond;
    });
  }

  let idCounter = 0;
  function makeModel() {
    const rows = new Map();
    return {
      _rows: rows,
      async create({ data }) {
        const id = data.id || `fake_${++idCounter}`;
        const row = { id, createdAt: new Date(), ...data };
        rows.set(id, row);
        return { ...row };
      },
      async findUnique({ where }) {
        const [key, val] = Object.entries(where)[0];
        for (const row of rows.values()) if (row[key] === val) return { ...row };
        return null;
      },
      async update({ where, data }) {
        const [key, val] = Object.entries(where)[0];
        for (const [id, row] of rows.entries()) {
          if (row[key] === val) {
            const updated = { ...row, ...data };
            rows.set(id, updated);
            return { ...updated };
          }
        }
        throw new Error(`update: record not found (${key}=${val})`);
      },
      async count({ where } = {}) {
        return [...rows.values()].filter((r) => matchesWhere(r, where)).length;
      },
      async findMany({ where, orderBy, take } = {}) {
        let list = [...rows.values()].filter((r) => matchesWhere(r, where));
        if (orderBy) {
          const [[field, dir]] = Object.entries(orderBy);
          list = list.slice().sort((a, b) => {
            const av = a[field] instanceof Date ? a[field].getTime() : a[field];
            const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
            return dir === 'desc' ? bv - av : av - bv;
          });
        }
        if (take) list = list.slice(0, take);
        return list.map((r) => ({ ...r }));
      },
    };
  }

  return {
    prisma: {
      clickTransaction: makeModel(),
      user: makeModel(),
      userPayment: makeModel(),
      tourAgency: makeModel(),
      agencyPayment: makeModel(),
      tariff: makeModel(),
    },
  };
});
jest.mock('../config/logger', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
}));

// Xuddi kontroller ishlatadigan REFERENCEning O'ZINI olamiz (mock singleton).
const { prisma: fakeDb } = require('../config/database');
const ctrl = require('./clickPayment.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function jsonOf(res) {
  return res.json.mock.calls[res.json.mock.calls.length - 1][0];
}

const md5 = (s) => crypto.createHash('md5').update(String(s), 'utf8').digest('hex');
const SECRET = process.env.CLICK_SECRET_KEY;
const SERVICE_ID = process.env.CLICK_SERVICE_ID;

/** CLICK'ning aynan o'zi ishlatadigan MD5 formulasi bilan haqiqiy imzo yasaydi. */
function sign({ click_trans_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_time }) {
  const parts =
    Number(action) === 1
      ? [click_trans_id, SERVICE_ID, SECRET, merchant_trans_id, merchant_prepare_id, amount, action, sign_time]
      : [click_trans_id, SERVICE_ID, SECRET, merchant_trans_id, amount, action, sign_time];
  return md5(parts.map((v) => (v === undefined || v === null ? '' : String(v))).join(''));
}

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

let clickTransSeq = 1;

async function payViaClick({ user, months }) {
  // 1) Foydalanuvchi checkout so'rovi — havolani yasaydi, ClickTransaction 'created' bo'ladi.
  const checkoutReq = { dbUser: user, body: { planSlug: 'premium', months, platform: 'web' } };
  const checkoutRes = mockRes();
  await ctrl.userCheckout(checkoutReq, checkoutRes);
  const checkout = jsonOf(checkoutRes).data;
  expect(checkout.payUrl).toContain('my.click.uz');
  const merchantTransId = checkout.merchantTransId;

  // 2) CLICK -> bizga PREPARE (action=0) — haqiqiy MD5 imzo bilan.
  const clickTransId = String(9000000 + clickTransSeq++);
  const prepareBody = {
    click_trans_id: clickTransId,
    service_id: SERVICE_ID,
    merchant_trans_id: merchantTransId,
    amount: Number(checkout.amount).toFixed(2),
    action: '0',
    sign_time: '2026-08-05 12:00:00',
  };
  prepareBody.sign_string = sign({ ...prepareBody, action: 0 });
  const prepareRes = mockRes();
  await ctrl.prepare({ body: prepareBody }, prepareRes);
  const prepareJson = jsonOf(prepareRes);
  expect(prepareJson.error).toBe(0);

  // 3) CLICK -> bizga COMPLETE (action=1) — pul olindi, obunani ochamiz.
  const completeBody = {
    click_trans_id: clickTransId,
    service_id: SERVICE_ID,
    merchant_trans_id: merchantTransId,
    merchant_prepare_id: prepareJson.merchant_prepare_id,
    amount: Number(checkout.amount).toFixed(2),
    action: '1',
    sign_time: '2026-08-05 12:00:05',
  };
  completeBody.sign_string = sign({ ...completeBody, action: 1 });
  const completeRes = mockRes();
  await ctrl.complete({ body: completeBody }, completeRes);
  return { completeRes, completeBody, merchantTransId, checkout };
}

describe('CLICK to\'lovi -> Premium ochilishi (real kontroller, xotira-ichi baza)', () => {
  test('to\'g\'ri imzo bilan to\'lov: Premium ochiladi, User.premiumUntil kelajakka o\'rnatiladi', async () => {
    const user = await fakeDb.user.create({
      data: { email: 'sardor@example.com', name: 'Sardor', blocked: false, premiumPlan: null, premiumUntil: null },
    });

    const before = new Date();
    const { completeRes } = await payViaClick({ user, months: 1 });
    const completeJson = jsonOf(completeRes);

    expect(completeJson.error).toBe(0);
    expect(completeJson.merchant_confirm_id).toBeGreaterThan(0);

    const fresh = await fakeDb.user.findUnique({ where: { id: user.id } });
    expect(fresh.premiumPlan).toBe('premium');
    expect(fresh.premiumUntil).toBeInstanceOf(Date);
    const daysAhead = daysBetween(before, fresh.premiumUntil);
    // 1 oy = taxminan 28-31 kun
    expect(daysAhead).toBeGreaterThan(25);
    expect(daysAhead).toBeLessThan(35);

    // Moliyaviy iz — admin panel "Premium to'lovlar" jadvali shu yerdan o'qiydi
    const payments = await fakeDb.userPayment.findMany({ where: { userId: user.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(29000);
    expect(payments[0].method).toBe('click');
  });

  test('ikkinchi to\'lov: muddat NOLGA TUSHIB QAYTA BOSHLANMAYDI — mavjud muddat USTIGA qo\'shiladi (stacking)', async () => {
    const user = await fakeDb.user.create({
      data: { email: 'dilnoza@example.com', name: 'Dilnoza', blocked: false },
    });

    const { completeRes: r1 } = await payViaClick({ user, months: 1 });
    expect(jsonOf(r1).error).toBe(0);
    const afterFirst = (await fakeDb.user.findUnique({ where: { id: user.id } })).premiumUntil;

    // Bir zumda ikkinchi to'lov — agar kod "har doim bugundan boshla" desa
    // (xato), farq ~1 oy bo'ladi. To'g'ri stacking'da farq ~2 oy bo'lishi kerak.
    const { completeRes: r2 } = await payViaClick({ user, months: 2 });
    expect(jsonOf(r2).error).toBe(0);
    const afterSecond = (await fakeDb.user.findUnique({ where: { id: user.id } })).premiumUntil;

    expect(afterSecond.getTime()).toBeGreaterThan(afterFirst.getTime());
    const deltaDays = daysBetween(afterFirst, afterSecond);
    // Reset-bug bo'lganda farq ~30 kun bo'lardi; stacking to'g'ri ishlasa ~59-62 kun.
    expect(deltaDays).toBeGreaterThan(50);

    const payments = await fakeDb.userPayment.findMany({ where: { userId: user.id } });
    expect(payments).toHaveLength(2);
  });

  test('CLICK takror tasdiq yuborsa (replay/tarmoq qayta urinishi) — obuna QAYTA uzaytirilmaydi', async () => {
    const user = await fakeDb.user.create({ data: { email: 'olim@example.com', name: 'Olim', blocked: false } });
    const { completeBody } = await payViaClick({ user, months: 1 });
    const untilAfterFirst = (await fakeDb.user.findUnique({ where: { id: user.id } })).premiumUntil;

    // Xuddi shu imzolangan Complete so'rovini CLICK yana yuborsa (ular buni retry sifatida qiladi)
    const replayRes = mockRes();
    await ctrl.complete({ body: completeBody }, replayRes);
    const replayJson = jsonOf(replayRes);

    expect(replayJson.error).toBe(-4); // ALREADY_PAID
    const untilAfterReplay = (await fakeDb.user.findUnique({ where: { id: user.id } })).premiumUntil;
    expect(untilAfterReplay.getTime()).toBe(untilAfterFirst.getTime()); // ikki marta kredit YO'Q
  });

  test('imzo noto\'g\'ri (soxta so\'rov) — rad etiladi, obuna ochilmaydi', async () => {
    const user = await fakeDb.user.create({ data: { email: 'zarina@example.com', name: 'Zarina', blocked: false } });
    const checkoutRes = mockRes();
    await ctrl.userCheckout({ dbUser: user, body: { planSlug: 'premium', months: 1 } }, checkoutRes);
    const { merchantTransId, amount } = jsonOf(checkoutRes).data;

    const fakePrepare = {
      click_trans_id: '1',
      service_id: SERVICE_ID,
      merchant_trans_id: merchantTransId,
      amount: Number(amount).toFixed(2),
      action: '0',
      sign_time: '2026-08-05 12:00:00',
      sign_string: 'noto_gri_imzo_deadbeef',
    };
    const res = mockRes();
    await ctrl.prepare({ body: fakePrepare }, res);
    expect(jsonOf(res).error).toBe(-1); // SIGN CHECK FAILED

    const tx = await fakeDb.clickTransaction.findUnique({ where: { merchantTransId } });
    expect(tx.state).toBe('created'); // hech narsa o'zgarmadi

    const fresh = await fakeDb.user.findUnique({ where: { id: user.id } });
    expect(fresh.premiumUntil).toBeFalsy();
  });

  test('summasi mos kelmasa (tranzaksiyada yozilgandan farqli) — rad etiladi', async () => {
    const user = await fakeDb.user.create({ data: { email: 'aziz@example.com', name: 'Aziz', blocked: false } });
    const checkoutRes = mockRes();
    await ctrl.userCheckout({ dbUser: user, body: { planSlug: 'premium', months: 1 } }, checkoutRes);
    const { merchantTransId } = jsonOf(checkoutRes).data;

    // Amal qiluvchi imzo, lekin summasi (masalan 1 so'm) bazadagi 29000 bilan mos emas
    const badAmountBody = {
      click_trans_id: '1', service_id: SERVICE_ID, merchant_trans_id: merchantTransId,
      amount: '1.00', action: '0', sign_time: '2026-08-05 12:00:00',
    };
    badAmountBody.sign_string = sign({ ...badAmountBody, action: 0 });
    const res = mockRes();
    await ctrl.prepare({ body: badAmountBody }, res);
    expect(jsonOf(res).error).toBe(-2); // AMOUNT
  });

  test('IDOR: boshqa foydalanuvchi tranzaksiya holatini ko\'ra olmaydi', async () => {
    const owner = await fakeDb.user.create({ data: { email: 'egasi@example.com', name: 'Egasi', blocked: false } });
    const stranger = await fakeDb.user.create({ data: { email: 'begona@example.com', name: 'Begona', blocked: false } });

    const checkoutRes = mockRes();
    await ctrl.userCheckout({ dbUser: owner, body: { planSlug: 'premium', months: 1 } }, checkoutRes);
    const { merchantTransId } = jsonOf(checkoutRes).data;

    const res = mockRes();
    await ctrl.userPaymentStatus({ dbUser: stranger, params: { merchantTransId } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(jsonOf(res).success).toBe(false);
  });
});

describe('Agentlik oqimi regressiyasi (eski mantiq buzilmaganini tekshirish)', () => {
  test('agentlik tarifi to\'lovi ham eskisidek TourAgency.subscriptionUntil ni ochadi', async () => {
    const tariff = await fakeDb.tariff.create({
      data: { name: 'Pro', slug: 'pro', priceMonthlyUzs: 299000, active: true },
    });
    const agency = await fakeDb.tourAgency.create({
      data: { name: 'Test Agency', subscriptionStatus: 'none', subscriptionUntil: null },
    });

    const checkoutRes = mockRes();
    await ctrl.checkout({ agency, body: { tariffSlug: 'pro', months: 1 } }, checkoutRes);
    const { merchantTransId, amount } = jsonOf(checkoutRes).data;
    expect(amount).toBe(299000);

    const prepareBody = {
      click_trans_id: '1', service_id: SERVICE_ID, merchant_trans_id: merchantTransId,
      amount: '299000.00', action: '0', sign_time: '2026-08-05 12:00:00',
    };
    prepareBody.sign_string = sign({ ...prepareBody, action: 0 });
    const prepareRes = mockRes();
    await ctrl.prepare({ body: prepareBody }, prepareRes);
    expect(jsonOf(prepareRes).error).toBe(0);
    const prepareId = jsonOf(prepareRes).merchant_prepare_id;

    const completeBody = {
      click_trans_id: '1', service_id: SERVICE_ID, merchant_trans_id: merchantTransId,
      merchant_prepare_id: prepareId, amount: '299000.00', action: '1', sign_time: '2026-08-05 12:00:05',
    };
    completeBody.sign_string = sign({ ...completeBody, action: 1 });
    const completeRes = mockRes();
    await ctrl.complete({ body: completeBody }, completeRes);
    expect(jsonOf(completeRes).error).toBe(0);

    const freshAgency = await fakeDb.tourAgency.findUnique({ where: { id: agency.id } });
    expect(freshAgency.subscriptionStatus).toBe('active');
    expect(freshAgency.subscriptionUntil).toBeInstanceOf(Date);
    expect(freshAgency.subscriptionUntil.getTime()).toBeGreaterThan(Date.now());
  });
});
