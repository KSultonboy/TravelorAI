// Voronka hodisalari haqiqiy joyida (controller'larda) chiqarilishi — productEvents mock.
process.env.CLICK_SERVICE_ID = '777';
process.env.CLICK_MERCHANT_ID = '888';
process.env.CLICK_SECRET_KEY = 'test-click-secret';
process.env.ADMIN_SECRET_KEY = 'test-admin-key-0123456789abcdef';

const crypto = require('crypto');

const mockTrack = jest.fn(async () => true);
const mockTrackOnce = jest.fn(async () => true);
const mockTrackLeadWon = jest.fn(async () => true);
jest.mock('../src/services/productEvents.service', () => {
  const actual = jest.requireActual('../src/services/productEvents.service');
  return { ...actual, track: mockTrack, trackOnce: mockTrackOnce, trackLeadWon: mockTrackLeadWon };
});

const ACCOUNT = { id: 'acc-owner', email: 'owner@example.com', status: 'approved', emailVerified: true };
const AGENCY = {
  id: 'ag-1', slug: 'ag-1', name: 'Demo', city: 'Toshkent', active: true, approvalStatus: 'approved',
  ownerAccountId: 'acc-owner', tariff: null, tariffId: null, subscriptionUntil: null, _count: { tours: 0 },
};

const sha = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const mockPrisma = {
  agencyAccount: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  agencyAuthCode: { findFirst: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })), create: jest.fn(async () => ({})) },
  agencyApplication: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  tourAgency: {
    findFirst: jest.fn(async ({ where }) => (where.ownerAccountId === 'acc-owner' ? AGENCY : null)),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(async ({ data }) => ({ ...AGENCY, ...data })),
  },
  agencyMember: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  tour: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn(async () => 1) },
  tourBooking: {
    findFirst: jest.fn(), findMany: jest.fn(async () => []), create: jest.fn(), update: jest.fn(),
  },
  leadActivity: { create: jest.fn(async () => ({})) },
  crmPipelineStage: {
    findMany: jest.fn(async () => [{ id: 's-won', key: 'won', name: 'Kelishildi', systemType: 'won', position: 40 }]),
    findUnique: jest.fn(async ({ where }) => (where.agencyId_key.key === 'won' ? { id: 's-won', key: 'won', name: 'Kelishildi', systemType: 'won' } : null)),
    createMany: jest.fn(),
  },
  tourPresentation: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(async () => ({})) },
  tariff: { findUnique: jest.fn() },
  clickTransaction: { create: jest.fn(async () => ({})), findUnique: jest.fn(), updateMany: jest.fn() },
  agencyPayment: { create: jest.fn(async () => ({})) },
  crmSettings: { findUnique: jest.fn(async () => null) },
  agencyCrmSettings: { findUnique: jest.fn(async () => null) },
  $transaction: jest.fn(async (arg) => (typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg))),
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    if (req.headers['x-test-account'] !== 'owner') return res.status(401).json({ success: false });
    req.agencyAccount = { ...ACCOUNT };
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/crmAutomation.service', () => {
  const actual = jest.requireActual('../src/services/crmAutomation.service');
  return { ...actual, assignNextMember: jest.fn(async () => null) };
});
jest.mock('../src/services/telegram.service', () => {
  const actual = jest.requireActual('../src/services/telegram.service');
  return {
    ...actual,
    getMe: jest.fn(async () => ({ username: 'demo_bot' })),
    setWebhook: jest.fn(async () => ({})),
    setChatMenuButton: jest.fn(async () => ({})),
    sendMessage: jest.fn(async () => ({})),
  };
});
jest.mock('../src/services/email.service', () => new Proxy({}, { get: () => jest.fn(async () => ({})) }));

const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());
app.use('/agency', require('../src/routes/agency.routes'));
app.use('/admin', require('../src/routes/admin.routes'));
app.use('/p', require('../src/routes/presentation.routes'));
app.use('/click', express.urlencoded({ extended: false }), require('../src/routes/clickPublic.routes'));

const owner = { 'x-test-account': 'owner' };
const eventNames = () => mockTrack.mock.calls.map((c) => c[0]);

beforeEach(() => {
  jest.clearAllMocks();
});

test('agency_registered — yangi akkaunt', async () => {
  mockPrisma.agencyAccount.findUnique.mockResolvedValue(null);
  mockPrisma.agencyAccount.create.mockResolvedValue({ id: 'acc-new', email: 'n@x.uz', emailVerified: false, status: 'pending' });
  const res = await request(app).post('/agency/auth/register').send({ email: 'n@x.uz', password: 'password123' });
  expect(res.status).toBe(201);
  expect(mockTrack).toHaveBeenCalledWith('agency_registered', { userId: 'acc-new', props: { method: 'email' } });
});

test('agency_registered — mavjud (tasdiqlanmagan) akkauntda qayta yozilmaydi', async () => {
  mockPrisma.agencyAccount.findUnique.mockResolvedValue({ id: 'acc-old', email: 'o@x.uz', emailVerified: false, status: 'pending' });
  mockPrisma.agencyAuthCode.findFirst.mockResolvedValue(null);
  mockPrisma.agencyAccount.update.mockResolvedValue({ id: 'acc-old', email: 'o@x.uz', emailVerified: false, status: 'pending' });
  await request(app).post('/agency/auth/register').send({ email: 'o@x.uz', password: 'password123' });
  expect(eventNames()).not.toContain('agency_registered');
});

test('agency_email_verified', async () => {
  mockPrisma.agencyAccount.findUnique.mockResolvedValue({ id: 'acc-v', email: 'v@x.uz', emailVerified: false, status: 'pending' });
  mockPrisma.agencyAuthCode.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: new Date(Date.now() + 60000), attempts: 0 });
  mockPrisma.agencyAccount.update.mockResolvedValue({ id: 'acc-v', email: 'v@x.uz', emailVerified: true, status: 'pending', tokenVersion: 0 });
  const res = await request(app).post('/agency/auth/verify-email').send({ email: 'v@x.uz', code: '123456' });
  expect(res.status).toBe(200);
  expect(mockTrack).toHaveBeenCalledWith('agency_email_verified', { userId: 'acc-v', props: { method: 'email' } });
});

test('agency_application_submitted', async () => {
  mockPrisma.agencyApplication.findFirst.mockResolvedValue({
    id: 'app1', status: 'draft', companyName: 'Demo Travel', legalName: null, contactPerson: 'Ali Vali',
    phone: '+998901234567', email: 'demo@x.uz', city: 'Toshkent', country: 'Uzbekistan', website: null,
    telegram: null, instagram: null, serviceTypes: ['Tur paketlar'], description: 'Bizning agentlik 10 yildan beri ishlaydi.', documents: null,
  });
  mockPrisma.agencyApplication.update.mockResolvedValue({ id: 'app1', status: 'pending' });
  mockPrisma.agencyAccount.update.mockResolvedValue({});
  const res = await request(app).post('/agency/application/submit').set(owner);
  expect(res.status).toBe(200);
  expect(mockTrack).toHaveBeenCalledWith('agency_application_submitted', { userId: 'acc-owner' });
});

test('agency_approved — admin tasdiqlaganda', async () => {
  mockPrisma.agencyApplication.findUnique.mockResolvedValue({
    id: 'app1', status: 'pending', accountId: 'acc-new', agencyId: null, companyName: 'Demo', city: 'Toshkent',
    description: 'x', serviceTypes: [], phone: '1', telegram: null, website: null, imageUrl: null,
  });
  mockPrisma.tourAgency.create.mockResolvedValue({ id: 'ag-new' });
  mockPrisma.tourAgency.findUnique.mockResolvedValue(null); // uniqueAgencySlug
  mockPrisma.agencyApplication.update.mockResolvedValue({ id: 'app1', status: 'approved' });
  mockPrisma.agencyAccount.update.mockResolvedValue({});
  const res = await request(app).patch('/admin/agency-applications/app1/approve')
    .set('x-admin-key', process.env.ADMIN_SECRET_KEY).send({});
  expect(res.status).toBe(200);
  expect(mockTrack).toHaveBeenCalledWith('agency_approved', { agencyId: 'ag-new', userId: 'acc-new' });
});

test('telegram_bot_connected', async () => {
  const res = await request(app).post('/agency/telegram/connect').set(owner).send({ token: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabc' });
  expect(res.status).toBe(200);
  expect(mockTrack).toHaveBeenCalledWith('telegram_bot_connected', { agencyId: 'ag-1', userId: 'acc-owner' });
});

test('first_tour_published — trackOnce (agentlik + admin)', async () => {
  mockPrisma.tour.findFirst.mockResolvedValue({ id: 't1', agencyId: 'ag-1' });
  mockPrisma.tour.update.mockResolvedValue({ id: 't1', agencyId: 'ag-1', agency: AGENCY });
  const res = await request(app).post('/agency/tours/t1/submit').set(owner);
  expect(res.status).toBe(200);
  expect(mockTrackOnce).toHaveBeenCalledWith('first_tour_published', { agencyId: 'ag-1', userId: 'acc-owner', props: { via: 'agency' } });

  mockPrisma.tour.findUnique.mockResolvedValue({ id: 't2', agencyId: 'ag-1', badge: 'Latest', agency: AGENCY });
  mockPrisma.tour.update.mockResolvedValue({ id: 't2', agencyId: 'ag-1', agency: AGENCY });
  const adminRes = await request(app).patch('/admin/tours/t2/approve').set('x-admin-key', process.env.ADMIN_SECRET_KEY).send({});
  expect(adminRes.status).toBe(200);
  expect(mockTrackOnce).toHaveBeenCalledWith('first_tour_published', { agencyId: 'ag-1', props: { via: 'admin' } });
});

test('lead_created — qo‘lda lid (manba bilan)', async () => {
  mockPrisma.tourBooking.create.mockResolvedValue({ id: 'b1', agencyId: 'ag-1', source: 'instagram', customerName: 'Ali' });
  const res = await request(app).post('/agency/leads').set(owner).send({ customerName: 'Ali Valiyev', source: 'instagram' });
  expect(res.status).toBe(201);
  expect(mockTrack).toHaveBeenCalledWith('lead_created', { agencyId: 'ag-1', userId: 'acc-owner', props: { source: 'instagram' } });
});

test('lead_won — bosqich "won"ga o‘tganda', async () => {
  mockPrisma.tourBooking.findFirst.mockResolvedValue({ id: 'b1', agencyId: 'ag-1', pipelineStage: 'quoted', status: 'pending' });
  const updated = { id: 'b1', agencyId: 'ag-1', pipelineStage: 'won', status: 'confirmed', totalEstimate: 1200, currency: 'USD', agency: AGENCY };
  mockPrisma.tourBooking.update.mockResolvedValue(updated);
  const res = await request(app).patch('/agency/bookings/b1/stage').set(owner).send({ stage: 'won' });
  expect(res.status).toBe(200);
  expect(mockTrackLeadWon).toHaveBeenCalledWith(updated, { userId: 'acc-owner' });
});

test('offer_sent va offer_opened (faqat birinchi ochilish)', async () => {
  mockPrisma.tourPresentation.create.mockResolvedValue({ id: 'p1', token: 'tok', title: 'Taklif', status: 'sent', openCount: 0, createdAt: new Date() });
  const res = await request(app).post('/agency/presentations').set(owner).send({ title: 'Dubay 5 kun' });
  expect(res.status).toBe(201);
  expect(mockTrack).toHaveBeenCalledWith('offer_sent', { agencyId: 'ag-1', userId: 'acc-owner' });

  mockPrisma.tourPresentation.findUnique.mockResolvedValueOnce({ id: 'p1', status: 'sent', firstOpenedAt: null, title: 'T', agency: { id: 'ag-1' } });
  await request(app).post('/p/tok/open');
  mockPrisma.tourPresentation.findUnique.mockResolvedValueOnce({ id: 'p1', status: 'viewed', firstOpenedAt: new Date(), title: 'T', agency: { id: 'ag-1' } });
  await request(app).post('/p/tok/open');
  expect(eventNames().filter((n) => n === 'offer_opened')).toHaveLength(1);
  expect(mockTrack).toHaveBeenCalledWith('offer_opened', { agencyId: 'ag-1' });
});

test('checkout_started va subscription_paid (CLICK complete muvaffaqiyatli)', async () => {
  mockPrisma.tariff.findUnique.mockResolvedValue({ id: 't-pro', slug: 'pro', name: 'Pro', active: true, priceMonthlyUzs: 199000 });
  const res = await request(app).post('/agency/payments/checkout').set(owner).send({ tariffSlug: 'pro', months: 1 });
  expect(res.status).toBe(200);
  expect(mockTrack).toHaveBeenCalledWith('checkout_started', { agencyId: 'ag-1', userId: 'acc-owner', props: { plan: 'pro', months: 1 } });

  // CLICK Complete: prepared tranzaksiya → paid.
  const tx = { id: 'tx1', merchantTransId: 'TA1', agencyId: 'ag-1', tariffId: 't-pro', tariffSlug: 'pro', amount: 199000, months: 1, state: 'prepared', prepareId: 555 };
  mockPrisma.clickTransaction.findUnique.mockResolvedValue(tx);
  mockPrisma.clickTransaction.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.tourAgency.findUnique.mockResolvedValue({ id: 'ag-1', subscriptionUntil: null });
  const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');
  const b = {
    click_trans_id: '5001', service_id: '777', click_paydoc_id: '9001', merchant_trans_id: 'TA1',
    merchant_prepare_id: '555', amount: '199000.00', action: '1', error: '0', error_note: 'Success', sign_time: '2026-11-22 10:01:00',
  };
  b.sign_string = md5(`${b.click_trans_id}${b.service_id}test-click-secret${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`);
  const done = await request(app).post('/click/complete').type('form').send(b);
  expect(done.body.error).toBe(0);
  expect(mockTrack).toHaveBeenCalledWith('subscription_paid', { agencyId: 'ag-1', props: { plan: 'pro', months: 1 } });
});

test('CLICK complete xato bo‘lsa subscription_paid yozilmaydi', async () => {
  mockPrisma.clickTransaction.findUnique.mockResolvedValue({ id: 'tx1', merchantTransId: 'TA1', agencyId: 'ag-1', amount: 199000, state: 'prepared', prepareId: 555 });
  const res = await request(app).post('/click/complete').type('form').send({
    click_trans_id: '5001', service_id: '777', merchant_trans_id: 'TA1', merchant_prepare_id: '555', amount: '199000.00',
    action: '1', error: '0', sign_time: 'x', sign_string: 'bad',
  });
  expect(res.body.error).toBe(-1);
  expect(eventNames()).not.toContain('subscription_paid');
});
