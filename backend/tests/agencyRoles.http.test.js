// Agentlik CRM yo'llarida server tomonidagi rol va tasdiq tekshiruvi (audit: "rollar
// serverda tekshirilmaydi"), hamda Telegram chat tarixi / webhook sirining regressiyasi.
const crypto = require('crypto');

const ACCOUNTS = {
  owner: { id: 'acc-owner', email: 'owner@example.com', status: 'approved' },
  manager: { id: 'acc-manager', email: 'manager@example.com', status: 'approved' },
  agent: { id: 'acc-agent', email: 'agent@example.com', status: 'approved' },
  accountant: { id: 'acc-accountant', email: 'accountant@example.com', status: 'approved' },
  rejectedOwner: { id: 'acc-rejected', email: 'rejected@example.com', status: 'rejected' },
  inactiveOwner: { id: 'acc-inactive', email: 'inactive@example.com', status: 'approved' },
};

const APPROVED_AGENCY = {
  id: 'ag-1', slug: 'ag-1', name: 'Demo', city: 'Toshkent', active: true, approvalStatus: 'approved',
  ownerAccountId: 'acc-owner', tariff: null, tariffId: null, subscriptionUntil: null,
  telegramBotToken: '123:abc', telegramBotActive: true,
};
const REJECTED_AGENCY = { ...APPROVED_AGENCY, id: 'ag-2', ownerAccountId: 'acc-rejected', active: false, approvalStatus: 'rejected', adminNote: 'Hujjatlar to‘liq emas' };
const INACTIVE_AGENCY = { ...APPROVED_AGENCY, id: 'ag-3', ownerAccountId: 'acc-inactive', active: false };

const mockPrisma = {
  tourAgency: {
    findFirst: jest.fn(async ({ where }) => {
      if (where.ownerAccountId === 'acc-owner') return APPROVED_AGENCY;
      if (where.ownerAccountId === 'acc-rejected') return REJECTED_AGENCY;
      if (where.ownerAccountId === 'acc-inactive') return INACTIVE_AGENCY;
      return null;
    }),
    findUnique: jest.fn(),
    update: jest.fn(async ({ data }) => ({ ...APPROVED_AGENCY, ...data })),
  },
  agencyMember: {
    findFirst: jest.fn(async ({ where }) => {
      const role = { 'acc-manager': 'manager', 'acc-agent': 'agent', 'acc-accountant': 'accountant' }[where.accountId];
      return role ? { role, agency: APPROVED_AGENCY } : null;
    }),
  },
  tourBooking: { findFirst: jest.fn(), findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []), count: jest.fn(async () => 0) },
  telegramMessage: { findMany: jest.fn(async () => []), create: jest.fn() },
  leadFile: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  financeTransaction: { create: jest.fn() },
  tariff: { findMany: jest.fn(async () => []) },
  clickTransaction: { findMany: jest.fn(async () => []) },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

// Token tekshiruvi boshqa testlarda qoplangan — bu yerda akkaunt sarlavhadan olinadi.
jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    const account = ACCOUNTS[req.headers['x-test-account']];
    if (!account) return res.status(401).json({ success: false });
    req.agencyAccount = account;
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/telegram.service', () => {
  const actual = jest.requireActual('../src/services/telegram.service');
  return { ...actual, deleteWebhook: jest.fn(async () => ({})), sendMessage: jest.fn(async () => ({})) };
});

const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());
app.use('/agency', require('../src/routes/agency.routes'));
app.use('/telegram', require('../src/routes/telegram.routes'));

const as = (who) => ({ 'x-test-account': who });

beforeEach(() => jest.clearAllMocks());

describe('rol cheklovlari', () => {
  test.each([
    ['agent', 'post', '/agency/telegram/disconnect'],
    ['manager', 'post', '/agency/telegram/disconnect'],
    ['agent', 'post', '/agency/telegram/connect'],
    ['agent', 'post', '/agency/telegram/broadcast'],
    ['accountant', 'post', '/agency/telegram/broadcast'],
    ['agent', 'post', '/agency/crm/finance/transactions'],
    ['agent', 'get', '/agency/crm/finance'],
    ['manager', 'post', '/agency/crm/finance/accounts'],
    ['accountant', 'get', '/agency/files/f1'],
    ['accountant', 'get', '/agency/bookings/b1/files'],
    ['accountant', 'post', '/agency/bookings/b1/files'],
    ['agent', 'put', '/agency/crm/finance/commission-rules/m1'],
    ['manager', 'post', '/agency/team'],
    ['agent', 'post', '/agency/payments/checkout'],
    ['accountant', 'post', '/agency/tours'],
    ['accountant', 'patch', '/agency/bookings/b1'],
    ['accountant', 'patch', '/agency/bookings/b1/birthday'],
    ['accountant', 'put', '/agency/crm/bookings/b1/tags'],
    ['accountant', 'post', '/agency/crm/bookings/b1/activities'],
    ['accountant', 'patch', '/agency/crm/bookings/b1/assignee'],
  ])('%s: %s %s → 403 ROLE_FORBIDDEN', async (who, method, path) => {
    const res = await request(app)[method](path).set(as(who)).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_FORBIDDEN');
  });

  test('egasi botni uza oladi', async () => {
    const res = await request(app).post('/agency/telegram/disconnect').set(as('owner'));
    expect(res.status).toBe(200);
    expect(mockPrisma.tourAgency.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { telegramBotActive: false, telegramBotToken: null },
    }));
  });

  test('agent pasport faylini ko‘ra oladi (rol o‘tadi, fayl topilmasa 404)', async () => {
    const res = await request(app).get('/agency/files/f1').set(as('agent'));
    expect(res.status).toBe(404);
    expect(mockPrisma.leadFile.findFirst).toHaveBeenCalled();
  });
});

describe('agentlik tasdiqi', () => {
  test('rad etilgan agentlik CRM yo‘llaridan foydalana olmaydi', async () => {
    const res = await request(app).get('/agency/bookings').set(as('rejectedOwner'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AGENCY_REJECTED');
    expect(res.body.adminNote).toBe('Hujjatlar to‘liq emas');
    expect(mockPrisma.tourBooking.findMany).not.toHaveBeenCalled();
  });

  test('o‘chirilgan agentlik CRM yo‘llaridan foydalana olmaydi', async () => {
    const res = await request(app).get('/agency/telegram/messages?bookingId=b1').set(as('inactiveOwner'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AGENCY_INACTIVE');
  });

  test('rad etilgan agentlik profil/holat va billingni ko‘ra oladi', async () => {
    const profile = await request(app).get('/agency/profile').set(as('rejectedOwner'));
    expect(profile.status).toBe(200);
    expect(profile.body.data.status).toEqual(expect.objectContaining({ approved: false, approvalStatus: 'rejected', adminNote: 'Hujjatlar to‘liq emas' }));

    const plans = await request(app).get('/agency/payments/plans').set(as('rejectedOwner'));
    expect(plans.status).toBe(200);
    const history = await request(app).get('/agency/payments/history').set(as('rejectedOwner'));
    expect(history.status).toBe(200);
  });

  test('rad etilgan agentlik to‘lov boshlay olmaydi', async () => {
    const res = await request(app).post('/agency/payments/checkout').set(as('rejectedOwner')).send({ tariffSlug: 'pro' });
    expect(res.status).toBe(403);
  });
});

describe('Telegram', () => {
  test('GET /agency/telegram/messages 200 qaytaradi (avval ReferenceError → 500)', async () => {
    mockPrisma.tourBooking.findFirst.mockResolvedValue({ id: 'b1', agencyId: 'ag-1', telegramChatId: '42' });
    mockPrisma.telegramMessage.findMany.mockResolvedValue([{ id: 'm1', text: 'Salom' }]);
    const res = await request(app).get('/agency/telegram/messages').query({ bookingId: 'b1' }).set(as('agent'));
    expect(res.status).toBe(200);
    expect(res.body.data.messages).toHaveLength(1);
    expect(res.body.data.channel).toBe('telegram');
    expect(res.body.data.canReply).toBe(true);
  });

  test('webhook noto‘g‘ri yoki yo‘q sir bilan 403', async () => {
    mockPrisma.tourAgency.findUnique.mockResolvedValue(APPROVED_AGENCY);
    const missing = await request(app).post('/telegram/webhook/ag-1').send({});
    expect(missing.status).toBe(403);
    const wrong = await request(app).post('/telegram/webhook/ag-1').set('x-telegram-bot-api-secret-token', 'x'.repeat(48)).send({});
    expect(wrong.status).toBe(403);
  });

  test('webhook to‘g‘ri sir bilan qabul qilinadi', async () => {
    mockPrisma.tourAgency.findUnique.mockResolvedValue(APPROVED_AGENCY);
    const secret = crypto.createHash('sha256').update('123:abc').digest('hex').slice(0, 48);
    const res = await request(app).post('/telegram/webhook/ag-1').set('x-telegram-bot-api-secret-token', secret).send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
