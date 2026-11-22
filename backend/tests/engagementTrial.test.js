// Engagement B: 14 kunlik sinov — kirish matritsasi (grandfathered / trial /
// expired / paid), faqat o'qish rejimi, eslatmalar idempotentligi va admin uzaytirish.
const DAY = 86400000;
const NOW = new Date('2026-12-10T07:00:00Z'); // 12:00 Toshkent

const mockPrisma = {
  tourAgency: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(async () => []),
    update: jest.fn(async ({ data }) => ({ id: 'ag-t', name: 'T', ...data })),
    updateMany: jest.fn(async () => ({ count: 1 })),
  },
  agencyMember: { findFirst: jest.fn(async () => null) },
  tourBooking: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []), count: jest.fn(async () => 0) },
  tour: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
  agencyApplication: { findFirst: jest.fn(async () => null) },
  tariff: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
  clickTransaction: { findMany: jest.fn(async () => []) },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    req.agencyAccount = { id: 'acc-owner', email: 'owner@example.com', status: 'approved' };
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/telegram.service', () => ({
  ...jest.requireActual('../src/services/telegram.service'),
  sendMessage: jest.fn(async () => ({})),
}));
jest.mock('../src/services/email.service', () => ({
  ...jest.requireActual('../src/services/email.service'),
  sendTrialReminderEmail: jest.fn(async () => ({ delivery: 'log' })),
}));

const express = require('express');
const request = require('supertest');
const { resolveAccess, PLANS } = require('../src/config/agencyPlans');
const trial = require('../src/services/trial.service');
const tg = require('../src/services/telegram.service');
const email = require('../src/services/email.service');
const { trialDays } = require('../src/config/env');

const base = {
  id: 'ag-t', slug: 'ag-t', name: 'Trial Tur', city: 'Toshkent', active: true, approvalStatus: 'approved',
  ownerAccountId: 'acc-owner', tariff: null, tariffId: null, subscriptionStatus: 'none', subscriptionUntil: null,
  _count: { tours: 0 },
};

describe('resolveAccess matritsasi', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  test('grandfathered (trialEndsAt NULL, obuna yo‘q) — bugungi xatti-harakat aynan', () => {
    const a = resolveAccess({ ...base, trialEndsAt: null });
    expect(a).toEqual({
      plan: 'unlimited', planName: 'Cheklovsiz', status: 'none', role: 'owner', canManageTeam: true,
      active: true, readOnly: false, expired: false, until: null, daysLeft: null,
      sections: PLANS.unlimited.sections, caps: PLANS.unlimited.caps,
      accessState: 'grandfathered', trialEndsAt: null,
    });
  });

  test('sinov faol → Pro darajasi, yozish mumkin', () => {
    const a = resolveAccess({ ...base, trialEndsAt: new Date(NOW.getTime() + 5 * DAY + 3600000) });
    expect(a).toEqual(expect.objectContaining({ plan: 'pro', status: 'trial', readOnly: false, accessState: 'trial', daysLeft: 6 }));
    expect(a.caps).toEqual(PLANS.pro.caps);
    expect(a.trialEndsAt).toBeTruthy();
  });

  test('sinov tugagan, obuna yo‘q → faqat o‘qish', () => {
    const a = resolveAccess({ ...base, trialEndsAt: new Date(NOW.getTime() - 1000) });
    expect(a).toEqual(expect.objectContaining({ plan: 'pro', readOnly: true, active: false, expired: true, accessState: 'trial_expired', daysLeft: 0 }));
    expect(a.sections).toEqual(PLANS.pro.sections); // ma'lumot ko'rinadi
  });

  test('to‘lovli obuna har doim ustun (sinov tugagan bo‘lsa ham)', () => {
    const a = resolveAccess({
      ...base, trialEndsAt: new Date(NOW.getTime() - 30 * DAY), tariffId: 'tf-1',
      tariff: { slug: 'premium', name: 'Premium' }, subscriptionStatus: 'active', subscriptionUntil: new Date(NOW.getTime() + 20 * DAY),
    });
    expect(a).toEqual(expect.objectContaining({ plan: 'premium', readOnly: false, accessState: 'active', trialEndsAt: null }));
  });

  test('to‘lovli obuna muddati o‘tgan → eski "expired" oqimi', () => {
    const a = resolveAccess({
      ...base, trialEndsAt: new Date(NOW.getTime() + 3 * DAY), tariffId: 'tf-1',
      tariff: { slug: 'pro', name: 'Pro' }, subscriptionStatus: 'active', subscriptionUntil: new Date(NOW.getTime() - DAY),
    });
    expect(a).toEqual(expect.objectContaining({ plan: 'pro', readOnly: true, accessState: 'expired' }));
  });

  test('TRIAL_DAYS env (standart 14, noto‘g‘ri qiymat → 14)', () => {
    expect(trialDays({})).toBe(14);
    expect(trialDays({ TRIAL_DAYS: '30' })).toBe(30);
    expect(trialDays({ TRIAL_DAYS: 'abc' })).toBe(14);
    expect(trialDays({ TRIAL_DAYS: '0' })).toBe(14);
    expect(trial.newTrialEndsAt(NOW).getTime() - NOW.getTime()).toBe(14 * DAY);
  });
});

describe('sinov tugagan agentlik — HTTP', () => {
  const app = express();
  app.use(express.json());
  app.use('/agency', require('../src/routes/agency.routes'));
  app.use('/admin', require('../src/routes/admin.routes'));

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.tourAgency.findFirst.mockResolvedValue({ ...base, trialEndsAt: new Date(Date.now() - DAY) });
  });

  test('yozish 402 SUBSCRIPTION_EXPIRED + TRIAL_EXPIRED', async () => {
    const res = await request(app).post('/agency/tours').send({ title: 'x' });
    expect(res.status).toBe(402);
    expect(res.body).toEqual(expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED', reason: 'TRIAL_EXPIRED' }));
    expect(res.body.message).toContain('Sinov muddati tugadi');
  });

  test('o‘qish ochiq (lidlar ro‘yxati)', async () => {
    const res = await request(app).get('/agency/bookings');
    expect(res.status).toBe(200);
  });

  test('/auth/me access ichida trialEndsAt + accessState', async () => {
    mockPrisma.tourBooking.findMany.mockResolvedValue([]);
    const res = await request(app).get('/agency/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.access).toEqual(expect.objectContaining({ accessState: 'trial_expired', readOnly: true, trialEndsAt: expect.any(String) }));
  });

  test('billing (tariflar, checkout) bloklanmaydi', async () => {
    const plans = await request(app).get('/agency/payments/plans');
    expect(plans.status).toBe(200);
    const checkout = await request(app).post('/agency/payments/checkout').send({ tariffSlug: 'pro' });
    expect(checkout.status).not.toBe(402);
  });

  test('sinov faol agentlik yoza oladi (402 emas)', async () => {
    mockPrisma.tourAgency.findFirst.mockResolvedValue({ ...base, trialEndsAt: new Date(Date.now() + 5 * DAY) });
    const res = await request(app).put('/agency/profile').send({ name: '' });
    expect(res.status).not.toBe(402);
  });

  test('admin: kalitsiz 403, kalit bilan ro‘yxat va uzaytirish', async () => {
    expect((await request(app).get('/admin/engagement/trials')).status).toBe(403);
    const key = { 'x-admin-key': 'change_me' }; // dev fallback (env.js DEV_FALLBACKS)
    mockPrisma.tourAgency.findMany.mockResolvedValueOnce([{ ...base, trialEndsAt: new Date(Date.now() + 2 * DAY), trialReminderStage: 1 }]);
    const list = await request(app).get('/admin/engagement/trials').set(key);
    expect(list.status).toBe(200);
    expect(list.body.data.items[0]).toEqual(expect.objectContaining({ id: 'ag-t', accessState: 'trial', daysLeft: 2 }));

    const bad = await request(app).post('/admin/engagement/agencies/ag-t/extend-trial').set(key).send({ days: 0 });
    expect(bad.status).toBe(400);

    const current = new Date(Date.now() + 2 * DAY);
    mockPrisma.tourAgency.findUnique.mockResolvedValueOnce({ id: 'ag-t', trialEndsAt: current });
    const ok = await request(app).post('/admin/engagement/agencies/ag-t/extend-trial').set(key).send({ days: 7 });
    expect(ok.status).toBe(200);
    expect(mockPrisma.tourAgency.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ag-t' },
      data: { trialEndsAt: new Date(current.getTime() + 7 * DAY), trialReminderStage: 0 },
    }));
  });

  test('arizani tasdiqlash: YANGI agentlik 14 kunlik sinov oladi, mavjudi tegilmaydi', async () => {
    const key = { 'x-admin-key': 'change_me' };
    const app2 = { id: 'app-1', accountId: 'acc-new', agencyId: null, companyName: 'Yangi Tur', city: 'Samarqand', serviceTypes: [], phone: null, website: null, imageUrl: null, description: null };
    mockPrisma.agencyApplication.findUnique = jest.fn(async () => app2);
    mockPrisma.agencyApplication.update = jest.fn(async () => ({}));
    mockPrisma.agencyAccount = { update: jest.fn(async () => ({})) };
    mockPrisma.tourAgency.findFirst.mockResolvedValue(null); // slug bo'sh
    mockPrisma.tourAgency.create = jest.fn(async ({ data }) => ({ id: 'ag-new', ...data }));
    mockPrisma.$transaction = jest.fn(async (ops) => Promise.all(ops));
    const before = Date.now();
    const res = await request(app).patch('/admin/agency-applications/app-1/approve').set(key).send({});
    expect(res.status).toBe(200);
    const { data } = mockPrisma.tourAgency.create.mock.calls[0][0];
    expect(data.trialEndsAt.getTime()).toBeGreaterThanOrEqual(before + 14 * DAY - 1000);
    expect(data.trialEndsAt.getTime()).toBeLessThanOrEqual(Date.now() + 14 * DAY);

    // Mavjud agentlik qayta tasdiqlanadi → trialEndsAt qo'yilmaydi (grandfathered qoladi).
    mockPrisma.agencyApplication.findUnique = jest.fn(async () => ({ ...app2, agencyId: 'ag-old' }));
    mockPrisma.tourAgency.update.mockClear();
    await request(app).patch('/admin/agency-applications/app-1/approve').set(key).send({});
    expect(mockPrisma.tourAgency.update.mock.calls[0][0].data).not.toHaveProperty('trialEndsAt');
  });

  test('admin: grandfathered agentlikni sinovga aylantirib bo‘lmaydi', async () => {
    mockPrisma.tourAgency.findUnique.mockResolvedValueOnce({ id: 'ag-old', trialEndsAt: null });
    const res = await request(app).post('/admin/engagement/agencies/ag-old/extend-trial').set({ 'x-admin-key': 'change_me' }).send({ days: 7 });
    expect(res.status).toBe(400);
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });
});

describe('sinov eslatmalari', () => {
  const agency = (overrides = {}) => ({
    id: 'ag-t', name: 'Trial Tur', trialReminderStage: 0, tariffId: null, subscriptionUntil: null,
    notifyChatId: '1001', telegramBotToken: '111:aaa', telegramBotActive: true, ownerAccount: { email: 'owner@example.com' },
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  test('bosqich tanlash: 3 kun qolganda 1, tugash kuni/keyin 2, aks holda yo‘q', () => {
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() + 3 * DAY) }), NOW)).toBe(1);
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() + 5 * DAY) }), NOW)).toBeNull();
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() + 3 * 3600000) }), NOW)).toBe(2); // bugun
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() - DAY), trialReminderStage: 1 }), NOW)).toBe(2);
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() - DAY), trialReminderStage: 2 }), NOW)).toBeNull();
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() + 2 * DAY), trialReminderStage: 1 }), NOW)).toBeNull();
    expect(trial.reminderStageFor(agency({ trialEndsAt: new Date(NOW.getTime() + 2 * DAY), tariffId: 'tf' }), NOW)).toBeNull();
  });

  test('10:00 dan oldin hech narsa qilinmaydi', async () => {
    const early = new Date('2026-12-10T04:00:00Z'); // 09:00 Toshkent
    expect(await trial.runTrialReminders(early)).toEqual({ sent: 0, skipped: 'before_hour' });
    expect(mockPrisma.tourAgency.findMany).not.toHaveBeenCalled();
  });

  test('Telegram + email yuboriladi va qayta ishga tushirishda takrorlanmaydi', async () => {
    const row = agency({ trialEndsAt: new Date(NOW.getTime() + 3 * DAY) });
    mockPrisma.tourAgency.findMany.mockResolvedValue([row]);
    mockPrisma.tourAgency.updateMany.mockResolvedValueOnce({ count: 1 });

    expect(await trial.runTrialReminders(NOW)).toEqual({ sent: 1 });
    expect(mockPrisma.tourAgency.updateMany).toHaveBeenCalledWith({ where: { id: 'ag-t', trialReminderStage: { lt: 1 } }, data: { trialReminderStage: 1 } });
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
    expect(tg.sendMessage.mock.calls[0][2]).toContain('Sinov muddati: 3 kun qoldi');
    expect(email.sendTrialReminderEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'owner@example.com', heading: 'Sinov muddati: 3 kun qoldi' }));

    // Ikkinchi ishga tushirish (yoki parallel nusxa): claim muvaffaqiyatsiz → yuborilmaydi.
    mockPrisma.tourAgency.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await trial.runTrialReminders(NOW)).toEqual({ sent: 0 });
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
    expect(email.sendTrialReminderEmail).toHaveBeenCalledTimes(1);
  });

  test('tugash kuni xabari', async () => {
    mockPrisma.tourAgency.findMany.mockResolvedValue([agency({ trialEndsAt: new Date(NOW.getTime() - 3600000), trialReminderStage: 1 })]);
    mockPrisma.tourAgency.updateMany.mockResolvedValueOnce({ count: 1 });
    await trial.runTrialReminders(NOW);
    expect(mockPrisma.tourAgency.updateMany).toHaveBeenCalledWith({ where: { id: 'ag-t', trialReminderStage: { lt: 2 } }, data: { trialReminderStage: 2 } });
    expect(tg.sendMessage.mock.calls[0][2]).toContain('Sinov muddati tugadi');
  });

  test('email HTML qiymatlari escape qilinadi', () => {
    const { escapeHtml } = jest.requireActual('../src/services/email.service');
    expect(escapeHtml('<b>"x"</b>')).not.toContain('<b>');
  });
});
