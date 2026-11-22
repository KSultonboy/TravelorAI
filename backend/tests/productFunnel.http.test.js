// Ommaviy /home/events (validatsiya + IP limit), voronka matematikasi va admin endpointlari.
process.env.ADMIN_SECRET_KEY = 'test-admin-key-0123456789abcdef';

const mockPrisma = {
  productEvent: { create: jest.fn(async () => ({ id: 'e1' })), groupBy: jest.fn(), findMany: jest.fn() },
  tourAgency: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');
const { computeFunnel } = require('../src/services/productFunnel.service');
const { resetPublicEventLimiter } = require('../src/controllers/productEvents.controller');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/home', require('../src/routes/home.routes'));
app.use('/admin', require('../src/routes/admin.routes'));

const ADMIN = { 'x-admin-key': process.env.ADMIN_SECRET_KEY };
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  resetPublicEventLimiter();
});

describe('POST /home/events', () => {
  test('landing_view qabul qilinadi, faqat allowlist props yoziladi, anonim', async () => {
    const res = await request(app).post('/home/events').send({
      name: 'landing_view',
      props: { utm_source: 'instagram', utm_campaign: 'nov', email: 'x@y.uz', path: '/' },
    });
    expect(res.status).toBe(202);
    await flush();
    expect(mockPrisma.productEvent.create).toHaveBeenCalledWith({
      data: { name: 'landing_view', agencyId: null, userId: null, props: { utm_source: 'instagram', utm_campaign: 'nov', path: '/' } },
      select: { id: true },
    });
  });

  test.each([
    [{ name: 'agency_registered' }],
    [{ name: 'lead_created' }],
    [{ name: '' }],
    [{}],
    [{ name: 'landing_view', props: ['a'] }],
    [{ name: 'landing_view', props: 'utm' }],
  ])('server hodisasi yoki noto‘g‘ri tana rad etiladi: %j', async (body) => {
    const res = await request(app).post('/home/events').send(body);
    expect(res.status).toBe(400);
    await flush();
    expect(mockPrisma.productEvent.create).not.toHaveBeenCalled();
  });

  test('IP bo‘yicha limit: 20 tadan keyin 429, boshqa IP ta’sirlanmaydi', async () => {
    for (let i = 0; i < 20; i += 1) {
      const ok = await request(app).post('/home/events').set('X-Forwarded-For', '10.0.0.1').send({ name: 'agency_signup_started' });
      expect(ok.status).toBe(202);
    }
    const blocked = await request(app).post('/home/events').set('X-Forwarded-For', '10.0.0.1').send({ name: 'agency_signup_started' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    const other = await request(app).post('/home/events').set('X-Forwarded-For', '10.0.0.2').send({ name: 'landing_view' });
    expect(other.status).toBe(202);
  });
});

describe('computeFunnel', () => {
  const now = new Date('2026-11-30T12:00:00Z');
  const day = (n) => new Date(now.getTime() - n * 86400000);

  test('qadamlar, konversiya va bosh ko‘rsatkichlar', () => {
    const events = [
      { name: 'agency_registered', userId: 'u1', createdAt: day(20) },
      { name: 'agency_registered', userId: 'u2', createdAt: day(15) },
      { name: 'agency_registered', userId: 'u3', createdAt: day(3) },
      { name: 'agency_registered', userId: 'u4', createdAt: day(10) },
      { name: 'agency_email_verified', userId: 'u1', createdAt: day(20) },
      { name: 'agency_email_verified', userId: 'u2', createdAt: day(15) },
      { name: 'agency_email_verified', userId: 'u3', createdAt: day(3) },
      { name: 'agency_approved', userId: 'u2', agencyId: 'a2', createdAt: day(14) },
      // a1: lid 5-kuni (≤7) va to'lov 12-kuni (≤30)
      { name: 'lead_created', agencyId: 'a1', createdAt: day(15) },
      { name: 'lead_created', agencyId: 'a1', createdAt: day(14) },
      { name: 'subscription_paid', agencyId: 'a1', createdAt: day(8) },
      // a2: lid 10-kuni (>7) — hisoblanmaydi
      { name: 'lead_created', agencyId: 'a2', createdAt: day(5) },
      // u4 agentligi yo'q
    ];
    const result = computeFunnel({
      days: 30,
      now,
      counts: { landing_view: 200, agency_signup_started: 20, agency_registered: 4, agency_email_verified: 3, agency_approved: 1, lead_created: 3, subscription_paid: 1 },
      events,
      agencies: [{ id: 'a1', ownerAccountId: 'u1' }],
    });

    const step = (key) => result.steps.find((s) => s.key === key);
    expect(step('landing_view')).toMatchObject({ count: 200, unique: 200, conversionFromPrev: null });
    expect(step('agency_signup_started')).toMatchObject({ unique: 20, conversionFromPrev: 10 });
    expect(step('agency_registered')).toMatchObject({ count: 4, unique: 4, conversionFromPrev: 20 });
    expect(step('agency_email_verified')).toMatchObject({ unique: 3, conversionFromPrev: 75 });
    expect(step('lead_created')).toMatchObject({ count: 3, unique: 2 });
    expect(step('telegram_bot_connected')).toMatchObject({ count: 0, unique: 0 });
    expect(step('lead_created').conversionFromPrev).toBeNull(); // oldingi qadam 0
    expect(result.steps.map((s) => s.key)[0]).toBe('landing_view');
    expect(result.steps.map((s) => s.key).slice(-1)[0]).toBe('subscription_paid');

    expect(result.headline.firstLeadWithin7d).toEqual({ windowDays: 7, cohort: 4, matured: 3, converted: 1, pct: 25 });
    expect(result.headline.paidWithin30d).toEqual({ windowDays: 30, cohort: 4, matured: 0, converted: 1, pct: 25 });
  });

  test('bo‘sh ma’lumot — nol va null foizlar', () => {
    const result = computeFunnel({ days: 7, now, counts: {}, events: [], agencies: [] });
    expect(result.steps.every((s) => s.count === 0)).toBe(true);
    expect(result.headline.firstLeadWithin7d.pct).toBeNull();
  });
});

describe('admin endpointlari', () => {
  test('GET /admin/funnel admin kalitisiz 403', async () => {
    const res = await request(app).get('/admin/funnel');
    expect(res.status).toBe(403);
    expect(mockPrisma.productEvent.groupBy).not.toHaveBeenCalled();
  });

  test('GET /admin/funnel?days=30 hisob qaytaradi', async () => {
    mockPrisma.productEvent.groupBy.mockResolvedValue([{ name: 'agency_registered', _count: { _all: 1 } }]);
    mockPrisma.productEvent.findMany.mockResolvedValue([{ name: 'agency_registered', userId: 'u1', agencyId: null, createdAt: new Date() }]);
    mockPrisma.tourAgency.findMany.mockResolvedValue([{ id: 'a1', ownerAccountId: 'u1' }]);
    const res = await request(app).get('/admin/funnel?days=30').set(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.data.days).toBe(30);
    expect(res.body.data.steps).toHaveLength(14);
    expect(res.body.data.headline.firstLeadWithin7d.cohort).toBe(1);
    expect(mockPrisma.tourAgency.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerAccountId: { in: ['u1'] } } }));
  });

  test('days chegaralanadi (1..365)', async () => {
    mockPrisma.productEvent.groupBy.mockResolvedValue([]);
    mockPrisma.productEvent.findMany.mockResolvedValue([]);
    const res = await request(app).get('/admin/funnel?days=99999').set(ADMIN);
    expect(res.body.data.days).toBe(365);
  });

  test('PATCH advanced-features admin kalitisiz 403 (yangilanmaydi)', async () => {
    const res = await request(app).patch('/admin/agencies/ag1/advanced-features').send({ enabled: true });
    expect(res.status).toBe(403);
    const wrong = await request(app).patch('/admin/agencies/ag1/advanced-features').set('x-admin-key', 'nope').send({ enabled: true });
    expect(wrong.status).toBe(403);
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('PATCH advanced-features admin bilan yoqadi/o‘chiradi', async () => {
    mockPrisma.tourAgency.findUnique.mockResolvedValue({ id: 'ag1' });
    mockPrisma.tourAgency.update.mockResolvedValue({ id: 'ag1', name: 'Demo', advancedFeatures: true });
    const res = await request(app).patch('/admin/agencies/ag1/advanced-features').set(ADMIN).send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.data.advancedFeatures).toBe(true);
    expect(mockPrisma.tourAgency.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ag1' }, data: { advancedFeatures: true } }));
  });

  test('PATCH advanced-features validatsiya va 404', async () => {
    const bad = await request(app).patch('/admin/agencies/ag1/advanced-features').set(ADMIN).send({ enabled: 'yes' });
    expect(bad.status).toBe(400);
    mockPrisma.tourAgency.findUnique.mockResolvedValue(null);
    const missing = await request(app).patch('/admin/agencies/nope/advanced-features').set(ADMIN).send({ enabled: false });
    expect(missing.status).toBe(404);
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });
});
