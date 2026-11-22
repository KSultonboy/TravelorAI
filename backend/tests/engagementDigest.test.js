// Engagement C: haftalik hisobot hisobi (fixture), dushanba 09:00 jadvali,
// "sog'indik" xabari, sozlamalar API (rol + tenant izolyatsiyasi) va sinov limiti.
const DAY = 86400000;
const MONDAY = new Date('2026-12-14T04:30:00Z'); // dushanba 09:30 Toshkent
const at = (daysAgo, hours = 0) => new Date(MONDAY.getTime() - daysAgo * DAY - hours * 3600000);

const AGENCY = {
  id: 'ag-1', slug: 'ag-1', name: 'Demo Tur', city: 'Toshkent', active: true, approvalStatus: 'approved',
  ownerAccountId: 'acc-owner', tariff: null, tariffId: null, subscriptionUntil: null, trialEndsAt: null,
  telegramBotToken: '111:aaa', telegramBotActive: true, notifyChatId: '1001',
};
const OTHER = { ...AGENCY, id: 'ag-2', ownerAccountId: 'acc-other', notifyChatId: '2002' };

const mockPrisma = {
  tourAgency: {
    findFirst: jest.fn(async ({ where }) => (where.ownerAccountId === 'acc-owner' ? AGENCY : where.ownerAccountId === 'acc-other' ? OTHER : null)),
    findMany: jest.fn(async () => []),
  },
  agencyMember: {
    findFirst: jest.fn(async ({ where }) => {
      const role = { 'acc-manager': 'manager', 'acc-agent': 'agent' }[where.accountId];
      return role ? { role, agency: AGENCY } : null;
    }),
  },
  agencyCrmSettings: {
    upsert: jest.fn(async ({ create, update }) => ({ agencyId: create.agencyId, leadAlertsEnabled: true, weeklyDigestEnabled: true, ...update })),
    updateMany: jest.fn(async () => ({ count: 1 })),
  },
  tourBooking: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
  crmTask: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
  financeTransaction: { findMany: jest.fn(async () => []) },
  leadActivity: { findFirst: jest.fn(async () => null) },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    const id = { owner: 'acc-owner', manager: 'acc-manager', agent: 'acc-agent', other: 'acc-other' }[req.headers['x-test-account']];
    if (!id) return res.status(401).json({ success: false });
    req.agencyAccount = { id, email: `${id}@example.com`, status: 'approved' };
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/telegram.service', () => ({
  ...jest.requireActual('../src/services/telegram.service'),
  sendMessage: jest.fn(async () => ({})),
}));

const express = require('express');
const request = require('supertest');
const tg = require('../src/services/telegram.service');
const digest = require('../src/services/weeklyDigest.service');

// ── Fixture: oxirgi 7 kun ──
const FIXTURE = {
  bookings: [
    { createdAt: at(1), firstResponseAt: at(1, -0.25), source: 'telegram', pipelineStage: 'contacted', currency: 'USD' }, // 15 daq
    { createdAt: at(2), firstResponseAt: at(2, -1), source: 'instagram', pipelineStage: 'won', confirmedAt: at(1), totalEstimate: 1200, currency: 'USD' }, // 60 daq
    { createdAt: at(3), firstResponseAt: at(3, -0.5), source: 'telegram', pipelineStage: 'new', currency: 'USD' }, // 30 daq
    { createdAt: at(3), firstResponseAt: null, source: 'web', pipelineStage: 'new', currency: 'USD' }, // javobsiz > 24 soat
    { createdAt: at(0, 2), firstResponseAt: null, source: 'web', pipelineStage: 'new', currency: 'USD' }, // javobsiz, lekin 2 soat
    { createdAt: at(20), firstResponseAt: at(20), source: 'csv', pipelineStage: 'completed', completedAt: at(2), paidAmount: 800, currency: 'USD' }, // eski lid, shu hafta yopildi
    { createdAt: at(20), firstResponseAt: null, source: 'web', pipelineStage: 'new', archived: true, currency: 'USD' }, // arxiv — hisoblanmaydi
    { createdAt: at(10), firstResponseAt: null, source: 'web', pipelineStage: 'lost', currency: 'USD' },
  ],
  tasks: [
    { dueAt: at(1), completedAt: null },
    { dueAt: at(3), completedAt: null },
    { dueAt: at(1), completedAt: at(0) },
    { dueAt: new Date(MONDAY.getTime() + DAY), completedAt: null },
  ],
  transactions: [
    { direction: 'income', status: 'paid', amount: 15000000, currency: 'UZS', paidAt: at(2) },
    { direction: 'income', status: 'paid', amount: 500, currency: 'USD', paidAt: at(4) },
    { direction: 'income', status: 'paid', amount: 999, currency: 'USD', paidAt: at(9) }, // davrdan tashqari
  ],
};

describe('computeDigest (fixture)', () => {
  test('lidlar manba bo‘yicha, mediana, bitimlar, tushum, vazifalar, maslahat', () => {
    const d = digest.computeDigest({ ...FIXTURE, now: MONDAY });
    expect(d.newLeads).toBe(5);
    expect(d.bySource).toEqual({ telegram: 2, instagram: 1, web: 2 });
    expect(d.medianFirstResponseMinutes).toBe(30); // [15, 30, 60]
    expect(d.respondedLeads).toBe(3);
    expect(d.wonDeals).toBe(2);
    expect(d.revenue).toEqual({ UZS: 15000000, USD: 500 });
    expect(d.overdueTasks).toBe(2);
    expect(d.unanswered24h).toBe(1);
    expect(d.tip).toContain('1 ta lid 24 soatdan beri javobsiz');
  });

  test('moliya yozuvlari bo‘lmasa tushum yopilgan bitimlardan', () => {
    const d = digest.computeDigest({ ...FIXTURE, transactions: [], now: MONDAY });
    expect(d.revenue).toEqual({ USD: 2000 });
  });

  test('bo‘sh hafta — maslahat yangi lid haqida', () => {
    const d = digest.computeDigest({ bookings: [], tasks: [], transactions: [], now: MONDAY });
    expect(d).toEqual(expect.objectContaining({ newLeads: 0, medianFirstResponseMinutes: null, wonDeals: 0, revenue: {}, overdueTasks: 0 }));
    expect(d.tip).toContain('yangi lid kelmadi');
  });

  test('matn formati', () => {
    const text = digest.formatDigest('Demo Tur', digest.computeDigest({ ...FIXTURE, now: MONDAY }));
    expect(text).toContain('Haftalik hisobot · Demo Tur');
    expect(text).toContain('Yangi lidlar: 5');
    expect(text).toContain('Telegram bot: 2');
    expect(text).toContain('Birinchi javob (mediana): 30 daq.');
    expect(text).toContain('Yopilgan bitimlar: 2');
    expect(text).toContain('15 000 000 UZS');
    expect(text).toContain('Muddati o‘tgan vazifalar: 2');
    expect(digest.formatMinutes(135)).toBe('2 soat 15 daq.');
  });
});

describe('runWeeklyDigests', () => {
  const row = (settings) => ({ id: 'ag-1', name: 'Demo Tur', notifyChatId: '1001', telegramBotToken: '111:aaa', crmSettings: settings });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.agencyCrmSettings.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.tourBooking.findFirst.mockResolvedValue({ createdAt: at(1) }); // faol
    mockPrisma.tourBooking.findMany.mockResolvedValue(FIXTURE.bookings);
  });

  test('dushanba 09:00 dan oldin / boshqa kunda ishlamaydi', async () => {
    expect((await digest.runWeeklyDigests(new Date('2026-12-14T03:30:00Z'))).skipped).toBe('not_time'); // 08:30
    expect((await digest.runWeeklyDigests(new Date('2026-12-15T05:00:00Z'))).skipped).toBe('not_time'); // seshanba
    expect(mockPrisma.tourAgency.findMany).not.toHaveBeenCalled();
  });

  test('yoqilgan agentlikka yuboradi va haftasiga bir marta (claim)', async () => {
    mockPrisma.tourAgency.findMany.mockResolvedValue([row({ weeklyDigestEnabled: true, weeklyDigestLastSentAt: null, digestIdleNotifiedAt: null })]);
    expect(await digest.runWeeklyDigests(MONDAY)).toEqual({ sent: 1, idle: 0 });
    expect(tg.sendMessage).toHaveBeenCalledWith('111:aaa', '1001', expect.stringContaining('Haftalik hisobot'), expect.any(Object));
    expect(mockPrisma.agencyCrmSettings.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ agencyId: 'ag-1' }),
      data: { weeklyDigestLastSentAt: MONDAY, digestIdleNotifiedAt: null },
    }));

    mockPrisma.agencyCrmSettings.updateMany.mockResolvedValue({ count: 0 }); // boshqa nusxa allaqachon oldi
    expect(await digest.runWeeklyDigests(MONDAY)).toEqual({ sent: 0, idle: 0 });
    expect(tg.sendMessage).toHaveBeenCalledTimes(1);
  });

  test('o‘chirilgan yoki shu hafta yuborilgan bo‘lsa — o‘tkazib yuboriladi', async () => {
    mockPrisma.tourAgency.findMany.mockResolvedValue([
      row({ weeklyDigestEnabled: false }),
      row({ weeklyDigestEnabled: true, weeklyDigestLastSentAt: at(0, 1) }),
    ]);
    expect(await digest.runWeeklyDigests(MONDAY)).toEqual({ sent: 0, idle: 0 });
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  test('2+ hafta faolsiz: bitta "sog‘indik", keyin jim', async () => {
    mockPrisma.tourBooking.findFirst.mockResolvedValue({ createdAt: at(20) });
    mockPrisma.tourAgency.findMany.mockResolvedValue([row({ weeklyDigestEnabled: true, weeklyDigestLastSentAt: at(7), digestIdleNotifiedAt: null })]);
    expect(await digest.runWeeklyDigests(MONDAY)).toEqual({ sent: 0, idle: 1 });
    expect(tg.sendMessage.mock.calls[0][2]).toContain('sog‘indik');

    jest.clearAllMocks();
    mockPrisma.tourBooking.findFirst.mockResolvedValue({ createdAt: at(27) });
    mockPrisma.tourAgency.findMany.mockResolvedValue([row({ weeklyDigestEnabled: true, weeklyDigestLastSentAt: at(7), digestIdleNotifiedAt: at(7) })]);
    expect(await digest.runWeeklyDigests(MONDAY)).toEqual({ sent: 0, idle: 0 });
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });
});

describe('/agency/engagement API', () => {
  const app = express();
  app.use(express.json());
  app.use('/agency', require('../src/routes/agency.routes'));
  const as = (who) => ({ 'x-test-account': who });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.agencyCrmSettings.updateMany.mockResolvedValue({ count: 1 });
  });

  test('egasi sozlamalarni ko‘radi va saqlaydi — faqat o‘z agentligi', async () => {
    const get = await request(app).get('/agency/engagement/settings').set(as('owner'));
    expect(get.status).toBe(200);
    expect(get.body.data).toEqual(expect.objectContaining({ leadAlertsEnabled: true, weeklyDigestEnabled: true, notifyConnected: true, digestTestsLeft: 3 }));

    const put = await request(app).put('/agency/engagement/settings').set(as('owner')).send({ leadAlertsEnabled: false, agencyId: 'ag-2' });
    expect(put.status).toBe(200);
    expect(put.body.data.leadAlertsEnabled).toBe(false);
    expect(mockPrisma.agencyCrmSettings.upsert).toHaveBeenLastCalledWith({
      where: { agencyId: 'ag-1' }, create: { agencyId: 'ag-1', leadAlertsEnabled: false }, update: { leadAlertsEnabled: false },
    });
  });

  test('B agentligi egasi faqat o‘zinikini o‘zgartiradi', async () => {
    await request(app).put('/agency/engagement/settings').set(as('other')).send({ weeklyDigestEnabled: false });
    expect(mockPrisma.agencyCrmSettings.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ where: { agencyId: 'ag-2' } }));
  });

  test('validatsiya: boolean bo‘lmasa yoki bo‘sh bo‘lsa 400', async () => {
    expect((await request(app).put('/agency/engagement/settings').set(as('owner')).send({ leadAlertsEnabled: 'yes' })).status).toBe(400);
    expect((await request(app).put('/agency/engagement/settings').set(as('owner')).send({})).status).toBe(400);
  });

  test('rollar: menejer ko‘radi, lekin o‘zgartira olmaydi; agent ko‘ra olmaydi; tokensiz 401', async () => {
    expect((await request(app).get('/agency/engagement/settings').set(as('manager'))).status).toBe(200);
    const put = await request(app).put('/agency/engagement/settings').set(as('manager')).send({ leadAlertsEnabled: false });
    expect(put.status).toBe(403);
    expect(put.body.code).toBe('OWNER_ONLY');
    const agent = await request(app).get('/agency/engagement/settings').set(as('agent'));
    expect(agent.status).toBe(403);
    expect(agent.body.code).toBe('ROLE_FORBIDDEN');
    expect((await request(app).post('/agency/engagement/digest/test').set(as('manager'))).status).toBe(403);
    expect((await request(app).get('/agency/engagement/settings')).status).toBe(401);
  });

  test('"Hozir yuborish (sinov)" — egasining xabarnoma chatiga', async () => {
    const res = await request(app).post('/agency/engagement/digest/test').set(as('owner'));
    expect(res.status).toBe(200);
    expect(tg.sendMessage).toHaveBeenCalledWith('111:aaa', '1001', expect.stringContaining('Haftalik hisobot (sinov)'), expect.any(Object));
    expect(mockPrisma.agencyCrmSettings.updateMany.mock.calls[0][0].where.agencyId).toBe('ag-1');
  });

  test('kuniga 3 martadan ko‘p — 429', async () => {
    mockPrisma.agencyCrmSettings.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app).post('/agency/engagement/digest/test').set(as('owner'));
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('DIGEST_TEST_LIMIT');
    expect(tg.sendMessage).not.toHaveBeenCalled();
  });

  test('xabarnoma chati ulanmagan — 400', async () => {
    mockPrisma.tourAgency.findFirst.mockResolvedValueOnce({ ...AGENCY, notifyChatId: null });
    const res = await request(app).post('/agency/engagement/digest/test').set(as('owner'));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOTIFY_CHAT_MISSING');
  });

  test('limit hisobi', () => {
    const today = new Date(MONDAY.getTime() + 5 * 3600000).toISOString().slice(0, 10);
    expect(digest.testsLeftToday({ digestTestDay: today, digestTestCount: 2 }, MONDAY)).toBe(1);
    expect(digest.testsLeftToday({ digestTestDay: '2000-01-01', digestTestCount: 3 }, MONDAY)).toBe(3);
  });
});
