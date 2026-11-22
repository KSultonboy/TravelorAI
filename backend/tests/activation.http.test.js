// Aktivatsiya ro'yxati (hisob + endpointlar) va kengaytirilgan modullar darvozasi (FEATURE_DISABLED).
const ACCOUNTS = {
  basic: { id: 'acc-basic', email: 'basic@example.com', status: 'approved' }, // advancedFeatures=false
  legacy: { id: 'acc-legacy', email: 'legacy@example.com', status: 'approved' }, // advancedFeatures=true
  other: { id: 'acc-other', email: 'other@example.com', status: 'approved' },
  agentOfBasic: { id: 'acc-agent', email: 'agent@example.com', status: 'approved' },
};

const BASE = {
  active: true, approvalStatus: 'approved', tariff: null, tariffId: null, subscriptionUntil: null,
  telegramBotToken: null, telegramBotActive: false, imageUrl: null, description: null, phone: null,
  activationDismissedAt: null,
};
const AGENCIES = {
  'acc-basic': { ...BASE, id: 'ag-basic', slug: 'ag-basic', name: 'Basic', ownerAccountId: 'acc-basic', advancedFeatures: false },
  'acc-legacy': { ...BASE, id: 'ag-legacy', slug: 'ag-legacy', name: 'Legacy', ownerAccountId: 'acc-legacy', advancedFeatures: true },
  'acc-other': { ...BASE, id: 'ag-other', slug: 'ag-other', name: 'Other', ownerAccountId: 'acc-other', advancedFeatures: true },
};

const counts = { tour: {}, tourBooking: {}, tourPresentation: {}, agencyMember: {} };
const countFor = (model) => jest.fn(async ({ where }) => counts[model][where.agencyId] || 0);

const mockPrisma = {
  tourAgency: {
    findFirst: jest.fn(async ({ where }) => AGENCIES[where.ownerAccountId] || null),
    findUnique: jest.fn(async () => null),
    update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  },
  agencyMember: {
    findFirst: jest.fn(async ({ where }) => (where.accountId === 'acc-agent' ? { role: 'agent', agency: AGENCIES['acc-basic'] } : null)),
    findMany: jest.fn(async () => []),
    count: countFor('agencyMember'),
  },
  tour: { count: countFor('tour') },
  tourBooking: { count: countFor('tourBooking'), findMany: jest.fn(async () => []) },
  tourPresentation: { count: countFor('tourPresentation') },
  // Darvozadan o'tgan (bayroq true) so'rovlar controller'gacha yetadi — bo'sh javoblar yetarli.
  automationRule: { findMany: jest.fn(async () => []) },
  automationRun: { findMany: jest.fn(async () => []) },
  publicApiKey: { findMany: jest.fn(async () => []) },
  webhookEndpoint: { findMany: jest.fn(async () => []) },
  webhookDelivery: { findMany: jest.fn(async () => []) },
  bankStatementImport: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
  bankStatementRow: { findMany: jest.fn(async () => []) },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    const account = ACCOUNTS[req.headers['x-test-account']];
    if (!account) return res.status(401).json({ success: false });
    req.agencyAccount = account;
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));

const express = require('express');
const request = require('supertest');
const { computeActivation } = require('../src/controllers/activation.controller');
const { advancedModuleFor } = require('../src/middleware/advancedFeatures.middleware');

const app = express();
app.use(express.json());
app.use('/agency', require('../src/routes/agency.routes'));

const as = (who) => ({ 'x-test-account': who });
const ALL_CAPS = { telegram: true, presentations: true, team: true };

beforeEach(() => {
  jest.clearAllMocks();
  for (const model of Object.keys(counts)) counts[model] = {};
  AGENCIES['acc-basic'].activationDismissedAt = null;
});

describe('computeActivation', () => {
  test('bo‘sh agentlik — 0%, keyingi qadam profil', () => {
    const r = computeActivation({ agency: AGENCIES['acc-basic'], caps: ALL_CAPS, facts: {} });
    expect(r.steps.map((s) => s.key)).toEqual(['profile', 'telegram', 'tour', 'lead', 'offer', 'team']);
    expect(r.percent).toBe(0);
    expect(r.total).toBe(6);
    expect(r.next).toEqual({ key: 'profile', section: 'settings', title: expect.any(String) });
    expect(r.complete).toBe(false);
  });

  test('profil faqat logo + tavsif + telefon bo‘lsa bajarilgan', () => {
    const partial = computeActivation({ agency: { ...BASE, imageUrl: '/u/logo.png', description: 'Tavsif', phone: '' }, caps: ALL_CAPS, facts: {} });
    expect(partial.steps[0].done).toBe(false);
    const full = computeActivation({ agency: { ...BASE, imageUrl: '/u/logo.png', description: 'Tavsif', phone: '+998901112233' }, caps: ALL_CAPS, facts: {} });
    expect(full.steps[0].done).toBe(true);
    expect(full.next.key).toBe('telegram');
  });

  test('haqiqiy faktlardan foiz va keyingi qadam', () => {
    const r = computeActivation({
      agency: { ...BASE, imageUrl: 'x', description: 'y', phone: 'z', telegramBotActive: true },
      caps: ALL_CAPS,
      facts: { publishedTours: 2, leads: 5, offers: 0, members: 0 },
    });
    expect(r.done).toBe(4);
    expect(r.percent).toBe(67);
    expect(r.next).toMatchObject({ key: 'offer', section: 'presentations' });
  });

  test('tarif jamoa/telegram/taklifni bermasa qadam o‘tkazib yuboriladi', () => {
    const r = computeActivation({
      agency: { ...BASE, imageUrl: 'x', description: 'y', phone: 'z' },
      caps: { telegram: false, presentations: false, team: false },
      facts: { publishedTours: 1, leads: 1 },
    });
    expect(r.steps.filter((s) => s.skipped).map((s) => s.key)).toEqual(['telegram', 'offer', 'team']);
    expect(r.total).toBe(3);
    expect(r.percent).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.next).toBeNull();
  });
});

describe('GET/POST /agency/activation', () => {
  test('autentifikatsiyasiz 401', async () => {
    const res = await request(app).get('/agency/activation');
    expect(res.status).toBe(401);
  });

  test('faqat o‘z agentligining ma’lumotini hisoblaydi (tenant izolyatsiyasi)', async () => {
    counts.tourBooking['ag-other'] = 10;
    counts.tour['ag-other'] = 3;
    const res = await request(app).get('/agency/activation').set(as('basic'));
    expect(res.status).toBe(200);
    expect(res.body.data.steps.find((s) => s.key === 'lead').done).toBe(false);
    expect(res.body.data.steps.find((s) => s.key === 'tour').done).toBe(false);
    for (const model of ['tour', 'tourBooking', 'tourPresentation', 'agencyMember']) {
      for (const call of mockPrisma[model].count.mock.calls) expect(call[0].where.agencyId).toBe('ag-basic');
    }
  });

  test('100% bo‘lmasa yopib bo‘lmaydi (409)', async () => {
    const res = await request(app).post('/agency/activation/dismiss').set(as('basic'));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACTIVATION_INCOMPLETE');
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('100% bo‘lganda egasi yopadi — serverda saqlanadi', async () => {
    Object.assign(AGENCIES['acc-basic'], { imageUrl: 'x', description: 'y', phone: 'z', telegramBotActive: true });
    counts.tour['ag-basic'] = 1; counts.tourBooking['ag-basic'] = 1; counts.tourPresentation['ag-basic'] = 1; counts.agencyMember['ag-basic'] = 1;
    try {
      const res = await request(app).post('/agency/activation/dismiss').set(as('basic'));
      expect(res.status).toBe(200);
      expect(res.body.data.dismissed).toBe(true);
      expect(mockPrisma.tourAgency.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'ag-basic' }, data: { activationDismissedAt: expect.any(Date) },
      }));
    } finally {
      Object.assign(AGENCIES['acc-basic'], { imageUrl: null, description: null, phone: null, telegramBotActive: false });
    }
  });

  test('xodim (egasi emas) yopa olmaydi', async () => {
    const res = await request(app).post('/agency/activation/dismiss').set(as('agentOfBasic'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OWNER_ONLY');
  });
});

// Har bir yashirin modul yo'li: bayroq false → 403 FEATURE_DISABLED (controller'ga yetmaydi).
const HIDDEN_ROUTES = [
  ['get', '/agency/crm/integrations'],
  ['post', '/agency/crm/integrations/api-keys'],
  ['delete', '/agency/crm/integrations/api-keys/k1'],
  ['post', '/agency/crm/integrations/webhooks'],
  ['put', '/agency/crm/integrations/webhooks/w1'],
  ['delete', '/agency/crm/integrations/webhooks/w1'],
  ['post', '/agency/crm/integrations/webhooks/w1/rotate-secret'],
  ['post', '/agency/crm/integrations/webhooks/w1/test'],
  ['post', '/agency/crm/integrations/deliveries/d1/retry'],
  ['get', '/agency/crm/automation'],
  ['post', '/agency/crm/automation/rules'],
  ['put', '/agency/crm/automation/rules/r1'],
  ['delete', '/agency/crm/automation/rules/r1'],
  ['post', '/agency/crm/automation/rules/r1/run'],
  ['post', '/agency/crm/automation/runs/r1/retry'],
  ['get', '/agency/crm/finance/reconciliation'],
  ['post', '/agency/crm/finance/reconciliation/inspect'],
  ['post', '/agency/crm/finance/reconciliation/import'],
  ['post', '/agency/crm/finance/reconciliation/rows/r1/match'],
  ['post', '/agency/crm/finance/reconciliation/rows/r1/create'],
  ['patch', '/agency/crm/finance/reconciliation/rows/r1/ignore'],
  ['put', '/agency/crm/finance/commission-rules/m1'],
  ['put', '/agency/crm/payroll/m1'],
  ['post', '/agency/crm/branches'],
  ['patch', '/agency/crm/branches/b1'],
  ['put', '/agency/crm/branches/members/m1'],
  ['post', '/agency/crm/business-documents/d1/approval'],
  ['patch', '/agency/crm/business-documents/approvals/a1'],
  ['post', '/agency/crm/business-documents/d1/signature'],
  ['post', '/agency/crm/business-documents/signatures/s1/verify'],
  ['get', '/agency/whatsapp'],
  ['post', '/agency/whatsapp/connect'],
  ['post', '/agency/whatsapp/disconnect'],
  ['put', '/agency/whatsapp/welcome'],
  ['get', '/agency/whatsapp/templates'],
  ['post', '/agency/whatsapp/send'],
  ['post', '/agency/ai/presentation-note'],
  ['get', '/agency/CRM/Automation'], // Express registrga sezgir emas — darvoza ham
];

describe('kengaytirilgan modullar darvozasi', () => {
  test.each(HIDDEN_ROUTES)('advancedFeatures=false: %s %s → 403 FEATURE_DISABLED', async (method, path) => {
    const res = await request(app)[method](path).set(as('basic')).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FEATURE_DISABLED');
  });

  test.each(HIDDEN_ROUTES)('advancedFeatures=true: %s %s darvozadan o‘tadi', async (method, path) => {
    const res = await request(app)[method](path).set(as('legacy')).send({});
    expect(res.body.code).not.toBe('FEATURE_DISABLED');
  });

  test('xodim ham agentlik bayrog‘iga bo‘ysunadi', async () => {
    const res = await request(app).get('/agency/crm/automation').set(as('agentOfBasic'));
    expect(res.body.code).toBe('FEATURE_DISABLED');
  });

  test.each([
    ['get', '/agency/crm/finance'],
    ['get', '/agency/crm/business-documents'],
    ['get', '/agency/crm/business-documents/d1'],
    ['post', '/agency/crm/business-documents/d1/pdf'],
    ['get', '/agency/crm/executive-report'],
    ['get', '/agency/telegram'],
    ['get', '/agency/activation'],
  ])('oddiy modul %s %s yopilmaydi', async (method, path) => {
    const res = await request(app)[method](path).set(as('basic')).send({});
    expect(res.body.code).not.toBe('FEATURE_DISABLED');
  });

  test('advancedModuleFor yo‘l xaritasi', () => {
    expect(advancedModuleFor('/crm/business-documents/approvals')).toBeNull();
    expect(advancedModuleFor('/crm/business-documents/abc/pdf')).toBeNull();
    expect(advancedModuleFor('/crm/automationx')).toBeNull();
    expect(advancedModuleFor('/whatsapp')).toBe('whatsapp');
    expect(advancedModuleFor('/crm/finance/reconciliation/')).toBe('reconciliation');
  });
});
