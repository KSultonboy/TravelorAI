/**
 * CLICK to'lovlari — SHOP API (Prepare / Complete) + obuna checkout.
 * Hujjat: https://docs.click.uz/en/shop-api
 *
 * Oqim:
 *   1) Agentlik kabinetда "Tarifni to'lash"  → POST /agency/payments/checkout
 *      → ClickTransaction yaratiladi, my.click.uz havolasi qaytariladi.
 *   2) Mijoz CLICK sahifasida to'laydi.
 *   3) CLICK bizning serverga POST qiladi (x-www-form-urlencoded):
 *        /payments/click/prepare   (action=0)  → to'lovni tekshiramiz
 *        /payments/click/complete  (action=1)  → obunani FAOLLASHTIRAMIZ
 *
 * Yangi npm paket ISHLATILMAYDI (prod overlay `npm install` qilmaydi) —
 * MD5 uchun Node'ning ichki `crypto` moduli yetarli.
 */

const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const click = require('../config/click');

const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://travelorai.com').replace(/\/$/, '');

/* ────────────────────────────── CLICK xato kodlari ───────────────────────── */
const ERR = {
  OK: 0,
  SIGN: -1,
  AMOUNT: -2,
  ACTION: -3,
  ALREADY_PAID: -4,
  NO_USER: -5,
  NO_TRANSACTION: -6,
  UPDATE_FAILED: -7,
  BAD_REQUEST: -8,
  CANCELLED: -9,
};

const NOTE = {
  [ERR.OK]: 'Success',
  [ERR.SIGN]: 'SIGN CHECK FAILED!',
  [ERR.AMOUNT]: 'Incorrect parameter amount',
  [ERR.ACTION]: 'Action not found',
  [ERR.ALREADY_PAID]: 'Already paid',
  [ERR.NO_USER]: 'User does not exist',
  [ERR.NO_TRANSACTION]: 'Transaction does not exist',
  [ERR.UPDATE_FAILED]: 'Failed to update user',
  [ERR.BAD_REQUEST]: 'Error in request from click',
  [ERR.CANCELLED]: 'Transaction cancelled',
};

/** CLICK javobi — HAR DOIM 200 + JSON (aks holda CLICK qayta urinadi). */
function clickReply(res, payload) {
  return res.status(200).json(payload);
}
function clickError(res, code, extra = {}) {
  return clickReply(res, { error: code, error_note: NOTE[code] || 'Error', ...extra });
}

const md5 = (s) => crypto.createHash('md5').update(String(s), 'utf8').digest('hex');

/**
 * Imzoni tekshiradi. MUHIM: qiymatlar so'rovdan KELGAN KO'RINISHIDA olinadi
 * (masalan amount "119000.00") — parse qilinsa imzo mos kelmaydi.
 */
function verifySign(body, action) {
  const {
    click_trans_id, service_id, merchant_trans_id, merchant_prepare_id,
    amount, sign_time, sign_string,
  } = body;

  if (!sign_string) return false;

  const parts =
    Number(action) === 1
      ? [click_trans_id, service_id, click.SECRET_KEY, merchant_trans_id, merchant_prepare_id, amount, action, sign_time]
      : [click_trans_id, service_id, click.SECRET_KEY, merchant_trans_id, amount, action, sign_time];

  const expected = md5(parts.map((v) => (v === undefined || v === null ? '' : String(v))).join(''));

  // Doimiy vaqtli solishtirish (timing attack'ga qarshi)
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(sign_string).toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Summalar mosligini tekshiradi (1 so'm farqga yo'l qo'yiladi — yumaloqlash). */
function amountMatches(received, expected) {
  return Math.abs(Number(received) - Number(expected)) < 1;
}

/* ──────────────────────────────── PREPARE ────────────────────────────────── */
// action = 0 — to'lovni tekshirish va "band qilish"
async function prepare(req, res) {
  try {
    if (!click.isCallbackConfigured()) return clickError(res, ERR.BAD_REQUEST);

    const b = req.body || {};
    if (String(b.action) !== '0') return clickError(res, ERR.ACTION);
    if (String(b.service_id) !== click.SERVICE_ID) return clickError(res, ERR.BAD_REQUEST);
    if (!verifySign(b, 0)) return clickError(res, ERR.SIGN);

    const merchantTransId = String(b.merchant_trans_id || '').trim();
    if (!merchantTransId) return clickError(res, ERR.NO_USER);

    const tx = await prisma.clickTransaction.findUnique({ where: { merchantTransId } });
    if (!tx) return clickError(res, ERR.NO_USER);

    // CLICK o'zi xato yubordi — bizda bekor qilamiz
    if (Number(b.error) < 0) {
      await cancelTx(tx.id, `CLICK error ${b.error}`);
      return clickError(res, ERR.CANCELLED);
    }

    if (tx.state === 'paid') {
      return clickReply(res, {
        error: ERR.ALREADY_PAID, error_note: NOTE[ERR.ALREADY_PAID],
        click_trans_id: b.click_trans_id, merchant_trans_id: merchantTransId,
      });
    }
    if (tx.state === 'cancelled') return clickError(res, ERR.CANCELLED);

    if (!amountMatches(b.amount, tx.amount)) return clickError(res, ERR.AMOUNT);

    // merchant_prepare_id — int bo'lishi kerak (CLICK Complete'da qaytaradi)
    const prepareId = tx.prepareId || Math.floor(Math.random() * 900000000) + 100000000;

    await prisma.clickTransaction.update({
      where: { id: tx.id },
      data: {
        state: 'prepared',
        prepareId,
        clickTransId: b.click_trans_id ? String(b.click_trans_id) : null,
        clickPaydocId: b.click_paydoc_id ? String(b.click_paydoc_id) : null,
        preparedAt: new Date(),
      },
    });

    return clickReply(res, {
      error: ERR.OK,
      error_note: NOTE[ERR.OK],
      click_trans_id: b.click_trans_id,
      merchant_trans_id: merchantTransId,
      merchant_prepare_id: prepareId,
    });
  } catch (e) {
    console.error('[click:prepare]', e.message);
    return clickError(res, ERR.UPDATE_FAILED);
  }
}

/* ─────────────────────────────── COMPLETE ────────────────────────────────── */
// action = 1 — pul olindi, xizmatni ochamiz
async function complete(req, res) {
  try {
    if (!click.isCallbackConfigured()) return clickError(res, ERR.BAD_REQUEST);

    const b = req.body || {};
    if (String(b.action) !== '1') return clickError(res, ERR.ACTION);
    if (String(b.service_id) !== click.SERVICE_ID) return clickError(res, ERR.BAD_REQUEST);
    if (!verifySign(b, 1)) return clickError(res, ERR.SIGN);

    const merchantTransId = String(b.merchant_trans_id || '').trim();
    const tx = await prisma.clickTransaction.findUnique({ where: { merchantTransId } });
    if (!tx) return clickError(res, ERR.NO_USER);

    if (String(tx.prepareId || '') !== String(b.merchant_prepare_id || '')) {
      return clickError(res, ERR.NO_TRANSACTION);
    }

    // CLICK bekor qildi (masalan pul qaytarildi)
    if (Number(b.error) < 0) {
      await cancelTx(tx.id, `CLICK error ${b.error}`);
      return clickReply(res, {
        error: ERR.CANCELLED, error_note: NOTE[ERR.CANCELLED],
        click_trans_id: b.click_trans_id, merchant_trans_id: merchantTransId,
      });
    }

    // Idempotentlik: takroriy tasdiq
    if (tx.state === 'paid') {
      return clickReply(res, {
        error: ERR.ALREADY_PAID, error_note: NOTE[ERR.ALREADY_PAID],
        click_trans_id: b.click_trans_id, merchant_trans_id: merchantTransId,
        merchant_confirm_id: tx.confirmId,
      });
    }
    if (tx.state === 'cancelled') return clickError(res, ERR.CANCELLED);
    if (!amountMatches(b.amount, tx.amount)) return clickError(res, ERR.AMOUNT);

    const confirmId = Math.floor(Math.random() * 900000000) + 100000000;

    // Pul allaqachon olingan — bu yerdan keyin XATO QAYTARMASLIK kerak.
    // Obunani faollashtirishda muammo bo'lsa ham "muvaffaqiyatli" deb javob
    // beramiz va qo'lda hal qilish uchun log qoldiramiz (hujjat talabi).
    let activationFailed = null;
    try {
      await activateSubscription(tx);
    } catch (e) {
      activationFailed = e.message;
      console.error('[click:complete] OBUNA FAOLLASHMADI —', merchantTransId, e.message);
    }

    await prisma.clickTransaction.update({
      where: { id: tx.id },
      data: {
        state: 'paid',
        confirmId,
        clickTransId: b.click_trans_id ? String(b.click_trans_id) : tx.clickTransId,
        paidAt: new Date(),
        errorNote: activationFailed ? `ACTIVATION_FAILED: ${activationFailed}` : null,
      },
    });

    return clickReply(res, {
      error: ERR.OK,
      error_note: NOTE[ERR.OK],
      click_trans_id: b.click_trans_id,
      merchant_trans_id: merchantTransId,
      merchant_confirm_id: confirmId,
    });
  } catch (e) {
    console.error('[click:complete]', e.message);
    return clickError(res, ERR.UPDATE_FAILED);
  }
}

/* ─────────────────────────── obunani faollashtirish ──────────────────────── */
async function activateSubscription(tx) {
  const agency = await prisma.tourAgency.findUnique({
    where: { id: tx.agencyId },
    select: { id: true, subscriptionUntil: true },
  });
  if (!agency) throw new Error(`agency ${tx.agencyId} topilmadi`);

  // Muddat tugamagan bo'lsa — qolgan kunlar ustiga qo'shiladi.
  const now = new Date();
  const current = agency.subscriptionUntil ? new Date(agency.subscriptionUntil) : null;
  const base = current && current.getTime() > now.getTime() ? current : now;
  const until = new Date(base);
  until.setMonth(until.getMonth() + Math.max(1, tx.months || 1));

  const data = { subscriptionStatus: 'active', subscriptionUntil: until };
  if (tx.tariffId) data.tariffId = tx.tariffId;

  await prisma.tourAgency.update({ where: { id: agency.id }, data });

  // To'lov tarixi (admin panel "To'lovlar" bo'limi shu jadvaldan o'qiydi)
  await prisma.agencyPayment.create({
    data: {
      agencyId: agency.id,
      tariffId: tx.tariffId || null,
      amount: tx.amount,
      currency: 'UZS',
      periodMonths: Math.max(1, tx.months || 1),
      method: 'click',
      note: `CLICK · ${tx.merchantTransId}`,
    },
  });
}

async function cancelTx(id, note) {
  try {
    await prisma.clickTransaction.update({
      where: { id },
      data: { state: 'cancelled', cancelledAt: new Date(), errorNote: String(note || '').slice(0, 200) },
    });
  } catch (e) {
    console.error('[click:cancelTx]', e.message);
  }
}

/* ──────────────────────────────── CHECKOUT ───────────────────────────────── */
// POST /agency/payments/checkout  { tariffSlug, months }  → to'lov havolasi
async function checkout(req, res) {
  try {
    if (!click.isConfigured()) {
      return error(res, "Onlayn to'lov hozircha sozlanmagan. Administrator bilan bog'laning.", 503);
    }
    const agency = req.agency;
    if (!agency) return error(res, 'Agentlik topilmadi', 404);

    const slug = String((req.body && req.body.tariffSlug) || '').trim();
    const months = Math.min(12, Math.max(1, parseInt((req.body && req.body.months) || 1, 10) || 1));
    if (!slug) return error(res, 'Tarif tanlanmagan', 400);

    const tariff = await prisma.tariff.findUnique({ where: { slug } });
    if (!tariff || !tariff.active) return error(res, 'Tarif topilmadi', 404);

    const monthly = Number(tariff.priceMonthlyUzs || 0);
    if (monthly <= 0) {
      return error(res, `«${tariff.name}» tarifi narxi kelishiladi — bizga murojaat qiling.`, 400);
    }

    const amount = monthly * months;
    const merchantTransId = newTransId();

    await prisma.clickTransaction.create({
      data: {
        merchantTransId,
        agencyId: agency.id,
        tariffId: tariff.id,
        tariffSlug: tariff.slug,
        amount,
        months,
        state: 'created',
      },
    });

    const payUrl = click.buildPayUrl({
      merchantTransId,
      amount,
      returnUrl: `${SITE_URL}/agency?payment=${encodeURIComponent(merchantTransId)}`,
    });

    return success(res, {
      payUrl, merchantTransId, amount, months,
      tariff: { slug: tariff.slug, name: tariff.name },
    });
  } catch (e) {
    console.error('[click:checkout]', e.message);
    return error(res, "To'lov havolasini yasab bo'lmadi", 500);
  }
}

// GET /agency/payments/:merchantTransId — kabinet to'lov holatini bilish uchun
async function paymentStatus(req, res) {
  try {
    const agency = req.agency;
    const tx = await prisma.clickTransaction.findUnique({
      where: { merchantTransId: String(req.params.merchantTransId || '') },
      select: { merchantTransId: true, state: true, amount: true, months: true, agencyId: true, paidAt: true },
    });
    if (!tx || !agency || tx.agencyId !== agency.id) return error(res, 'Tranzaksiya topilmadi', 404);
    const { agencyId, ...safe } = tx;
    return success(res, safe);
  } catch (e) {
    return error(res, 'Xatolik', 500);
  }
}

// GET /agency/payments/history — kabinetdagi «To'lov tarixi» ro'yxati.
// CLICK menejerlari uchun ham muhim: to'lovlar qayd etilishini ko'rsatadi.
async function paymentHistory(req, res) {
  try {
    const agency = req.agency;
    if (!agency) return error(res, 'Agentlik topilmadi', 404);
    const rows = await prisma.clickTransaction.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        merchantTransId: true, tariffSlug: true, months: true,
        amount: true, state: true, paidAt: true, createdAt: true,
      },
    });
    return success(res, { items: rows });
  } catch (e) {
    return error(res, 'Tarixni olib bo\'lmadi', 500);
  }
}

// GET /agency/payments/plans — kabinet uchun: tariflar (so'mda) + to'lov yoqilganmi
async function listPlans(req, res) {
  try {
    const rows = await prisma.tariff.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true, priceMonthly: true, priceMonthlyUzs: true },
    });
    return success(res, {
      clickEnabled: click.isConfigured(),
      currentTariffId: (req.agency && req.agency.tariffId) || null,
      plans: rows.filter((t) => Number(t.priceMonthlyUzs) > 0),
    });
  } catch (e) {
    return error(res, 'Tariflarni olib bo\'lmadi', 500);
  }
}

/** Buyurtma raqami — qisqa, URL-xavfsiz, takrorlanmaydigan. */
function newTransId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TA${ts}${rnd}`;
}

module.exports = { prepare, complete, checkout, paymentStatus, listPlans, paymentHistory };
