// Engagement A: har bir lid yaratish yo'li Telegram lid xabarnomasini chaqiradi
// (leadAlert.service mock — bu yerda faqat "chaqirildimi" tekshiriladi).
const crypto = require('crypto');

const AGENCY = {
  id: 'ag-1', slug: 'ag-1', name: 'Demo', city: 'Toshkent', active: true, approvalStatus: 'approved',
  ownerAccountId: 'acc-owner', tariff: null, tariffId: null, subscriptionUntil: null, trialEndsAt: null,
  telegramBotToken: '123:abc', telegramBotActive: true, notifyChatId: '999',
  instagramActive: true, instagramToken: 'enc', instagramUserId: 'ig-acc',
  whatsappActive: true, whatsappToken: 'enc', whatsappPhoneNumberId: 'pn-1',
};

const mockPrisma = {
  tourAgency: {
    findFirst: jest.fn(async ({ where }) => (where.ownerAccountId === 'acc-owner' || where.instagramActive || where.whatsappActive ? AGENCY : null)),
    findUnique: jest.fn(async () => AGENCY),
  },
  agencyMember: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  tour: {
    findFirst: jest.fn(async () => ({ id: 't1', title: 'Dubay 5 kun', agencyId: 'ag-1', priceMin: 100, priceCurrency: 'USD', responseTimeMinutes: 45, agency: AGENCY })),
    findMany: jest.fn(async () => []),
  },
  tourBooking: {
    findFirst: jest.fn(async () => null),
    findMany: jest.fn(async () => []),
    create: jest.fn(async ({ data }) => ({ id: 'b-new', ...data, tour: data.tourId ? { title: 'Dubay 5 kun' } : null, agency: { ...AGENCY, ownerAccount: null } })),
    update: jest.fn(async ({ data }) => ({ id: 'b-old', agencyId: 'ag-1', ...data })),
  },
  telegramMessage: { create: jest.fn(async () => ({})), findUnique: jest.fn(async () => null), updateMany: jest.fn() },
  leadActivity: { create: jest.fn(async () => ({})) },
  csvImportBatch: { create: jest.fn(async () => ({ id: 'batch-1' })), update: jest.fn(async () => ({})) },
  user: { findUnique: jest.fn(async () => null) },
  $transaction: jest.fn(async (fn) => fn(mockPrisma)),
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    if (req.headers['x-test-account'] !== 'owner') return res.status(401).json({ success: false });
    req.agencyAccount = { id: 'acc-owner', email: 'owner@example.com', status: 'approved' };
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/crmAutomation.service', () => ({
  OPEN_STAGES: ['new', 'contacted', 'quoted'],
  assignNextMember: jest.fn(async () => null),
  getSettings: jest.fn(async () => ({})),
  markFirstResponse: jest.fn(async () => ({})),
  runSlaMonitor: jest.fn(),
}));
jest.mock('../src/services/email.service', () => ({
  ...jest.requireActual('../src/services/email.service'),
  sendBookingLeadEmail: jest.fn(async () => ({})),
}));
jest.mock('../src/services/telegram.service', () => ({
  ...jest.requireActual('../src/services/telegram.service'),
  sendMessage: jest.fn(async () => ({})),
  answerCallbackQuery: jest.fn(async () => ({})),
}));
jest.mock('../src/services/instagram.service', () => ({
  verifySignature: jest.fn(() => true),
  decryptToken: jest.fn(() => 'token'),
  getSenderProfile: jest.fn(async () => ({ username: 'ali', name: 'Ali' })),
  sendMessage: jest.fn(async () => ({})),
}));
jest.mock('../src/services/whatsapp.service', () => ({
  verifySignature: jest.fn(() => true),
  decryptToken: jest.fn(() => 'token'),
  sendText: jest.fn(async () => ({})),
  isConfigured: jest.fn(() => true),
}));
jest.mock('../src/services/audit.service', () => ({ recordAudit: jest.fn(async () => ({})) }));
jest.mock('../src/services/webhookDelivery.service', () => ({ enqueueWebhookEvent: jest.fn(async () => ({})), runWebhookDeliveryWorker: jest.fn() }));
jest.mock('../src/services/leadAlert.service', () => {
  const actual = jest.requireActual('../src/services/leadAlert.service');
  return {
    ...actual,
    notifyNewLead: jest.fn(async () => ({ sent: true })),
    notifyLeadImport: jest.fn(async () => ({ sent: true })),
    handleLeadAcceptCallback: jest.fn(async () => false),
  };
});

const express = require('express');
const request = require('supertest');
const leadAlert = require('../src/services/leadAlert.service');
const tg = require('../src/services/telegram.service');

const app = express();
app.use(express.json());
app.use('/bookings', require('../src/routes/bookings.routes'));
app.use('/agency', require('../src/routes/agency.routes'));
app.use('/telegram', require('../src/routes/telegram.routes'));
app.use('/miniapp', require('../src/routes/miniapp.routes'));

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.get = () => undefined;
  return res;
}

function initData(botToken, user) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) });
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.tourBooking.findFirst.mockImplementation(async () => null);
});

describe('lid xabarnomasi — har bir yaratish yo‘li', () => {
  test('public booking (sayt/mobil) → notifyNewLead, manba normallashtiriladi', async () => {
    const res = await request(app).post('/bookings').send({ tourId: 't1', customerName: 'Ali Valiyev', customerPhone: '+998901234567', travelers: 2, source: 'web' });
    expect(res.status).toBe(201);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledTimes(1);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-new', agencyId: 'ag-1' }), { source: 'web' });
  });

  test('bron javobi xabarnoma tugashini kutmaydi (fire-and-forget)', async () => {
    leadAlert.notifyNewLead.mockImplementationOnce(() => new Promise(() => {})); // hech qachon tugamaydi
    const res = await request(app).post('/bookings').send({ tourId: 't1', customerName: 'Ali Valiyev', customerPhone: '+998901234567' });
    expect(res.status).toBe(201);
  });

  test('qo‘lda lid (CRM) → source manual', async () => {
    const res = await request(app).post('/agency/leads').set('x-test-account', 'owner').send({ customerName: 'Vali', customerPhone: '+998900000000' });
    expect(res.status).toBe(201);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'ag-1', customerName: 'Vali' }), { source: 'manual' });
  });

  test('CSV import → qator emas, bitta jamlovchi xabar', async () => {
    const csv = 'Mijoz ismi,Telefon\nAli,+998901111111\nVali,+998902222222\nSoli,+998903333333';
    const res = await request(app).post('/agency/crm/import/csv/commit').set('x-test-account', 'owner').send({ csv, fileName: 'lidlar.csv' });
    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(3);
    expect(leadAlert.notifyNewLead).not.toHaveBeenCalled();
    expect(leadAlert.notifyLeadImport).toHaveBeenCalledTimes(1);
    expect(leadAlert.notifyLeadImport).toHaveBeenCalledWith('ag-1', { count: 3, fileName: 'lidlar.csv', source: 'csv' });
  });

  test('Telegram bot — yangi chat lid bo‘lsa xabar, mavjud chat bo‘lsa yo‘q', async () => {
    const secret = tg.webhookSecret(AGENCY.telegramBotToken);
    const body = { message: { chat: { id: 555 }, from: { first_name: 'Aziz' }, text: 'Salom' } };
    const res = await request(app).post('/telegram/webhook/ag-1').set('x-telegram-bot-api-secret-token', secret).send(body);
    expect(res.status).toBe(200);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ telegramChatId: '555', source: 'telegram' }), { source: 'telegram' });

    jest.clearAllMocks();
    mockPrisma.tourBooking.findFirst.mockImplementation(async () => ({ id: 'b-old', agencyId: 'ag-1', telegramChatId: '555', leadTour: 'x' }));
    await request(app).post('/telegram/webhook/ag-1').set('x-telegram-bot-api-secret-token', secret).send(body);
    expect(leadAlert.notifyNewLead).not.toHaveBeenCalled();
  });

  test('Telegram mini ilova — yangi so‘rov → source miniapp', async () => {
    const res = await request(app).post('/miniapp/request').send({
      agency: 'ag-1', tourId: 't1', note: 'Oilaviy',
      initData: initData(AGENCY.telegramBotToken, { id: 777, first_name: 'Dilnoza' }),
    });
    expect(res.status).toBe(200);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b-new', agencyId: 'ag-1', tour: { title: 'Dubay 5 kun' } }),
      { source: 'miniapp' },
    );
  });

  test('Instagram Direct — yangi suhbat → source instagram', async () => {
    const instagram = require('../src/controllers/instagram.controller');
    const req = {
      rawBody: Buffer.from('{}'), get: () => 'sha256=x',
      body: { object: 'instagram', entry: [{ id: 'ig-acc', messaging: [{ sender: { id: 'igsid-1' }, recipient: { id: 'ig-acc' }, message: { mid: 'm1', text: 'Narxi qancha?' } }] }] },
    };
    const res = mockRes();
    await instagram.webhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ instagramUserId: 'igsid-1', source: 'instagram' }), { source: 'instagram' });
  });

  test('WhatsApp — yangi suhbat → source whatsapp', async () => {
    const whatsapp = require('../src/controllers/whatsapp.controller');
    const req = {
      rawBody: Buffer.from('{}'), get: () => 'sha256=x',
      body: { entry: [{ changes: [{ value: { metadata: { phone_number_id: 'pn-1' }, contacts: [{ wa_id: '998901234567', profile: { name: 'Sardor' } }], messages: [{ from: '998901234567', id: 'wamid.1', type: 'text', text: { body: 'Salom' } }] } }] }] },
    };
    const res = mockRes();
    await whatsapp.webhook(req, res);
    expect(res.statusCode).toBe(200);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ whatsappWaId: '998901234567', source: 'whatsapp' }), { source: 'whatsapp' });
  });

  test('Public API lid → source api', async () => {
    const publicApi = require('../src/controllers/publicApi.controller');
    mockPrisma.tourBooking.create.mockImplementationOnce(async ({ data }) => ({ id: 'b-api', customerName: data.customerName, source: 'api' }));
    const req = { agency: { id: 'ag-1' }, publicApiKey: { keyPrefix: 'tk_x' }, originalUrl: '/public/leads', body: { customerName: 'API mijoz', customerPhone: '+998901234567' } };
    const res = mockRes();
    await publicApi.createLead(req, res);
    expect(res.statusCode).toBe(201);
    expect(leadAlert.notifyNewLead).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-api', agencyId: 'ag-1' }), { source: 'api' });
  });
});
