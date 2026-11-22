// Distribution: public storefront (/home/agencies/:slug/storefront), storefront
// «umumiy so'rov» broni, Telegram kanal ulash/joylash va taklif sahifasidagi to'lov havolasi.

/* ---------- Fixture'lar ---------- */
const AGENCIES = [
  {
    id: 'ag-a', slug: 'alfa-travel', name: 'Alfa Travel', city: 'Toshkent', description: 'Ichki turlar',
    specialty: 'Ichki', rating: 4.7, reviews: 12, phone: '+998901112233', telegram: '@alfa', website: null,
    imageUrl: null, active: true, approvalStatus: 'approved', ownerAccountId: 'acc-a',
    telegramBotToken: '111111:SECRET-BOT-TOKEN-AAAAAAAAAAAAAAAA', telegramBotActive: true, telegramBotUsername: 'alfa_bot',
    notifyChatId: null, tariff: null, tariffId: null, subscriptionUntil: null,
    telegramChannelId: null, telegramChannelTitle: null, telegramChannelUsername: null,
    paymentLinkUrl: null, paymentRequisitesText: null, adminNote: 'ichki izoh',
  },
  {
    id: 'ag-b', slug: 'beta-tour', name: 'Beta Tour', city: 'Samarqand', description: null, specialty: 'Xalqaro',
    rating: 4.1, reviews: 3, phone: null, telegram: null, website: null, imageUrl: null,
    active: true, approvalStatus: 'approved', ownerAccountId: 'acc-b',
    telegramBotToken: '222222:SECRET-BOT-TOKEN-BBBBBBBBBBBBBBBB', telegramBotActive: true,
    notifyChatId: null, tariff: null, tariffId: null, subscriptionUntil: null,
    telegramChannelId: '-1002222', telegramChannelTitle: 'Beta kanal', telegramChannelUsername: 'betakanal',
    paymentLinkUrl: null, paymentRequisitesText: null,
  },
  {
    id: 'ag-p', slug: 'pending-agency', name: 'Pending', city: 'Buxoro', specialty: 'x', active: true,
    approvalStatus: 'pending', ownerAccountId: 'acc-p', telegramBotToken: '333:SECRET', tariff: null,
  },
  {
    id: 'ag-off', slug: 'off-agency', name: 'Off', city: 'Xiva', specialty: 'x', active: false,
    approvalStatus: 'approved', ownerAccountId: 'acc-off', tariff: null,
  },
];
const OWNER_EMAIL = 'owner-secret@example.com';

const TOURS = [
  {
    id: 't-a1', slug: 'samarqand-2-kun', title: 'Samarqand <2 kun> & Buxoro', city: 'Samarqand', subtitle: 'Registon',
    description: 'Tavsif', duration: '2 kun', price: null, priceMin: 1250000, priceCurrency: 'UZS', rating: 4.8,
    badge: 'Latest', imageUrl: 'https://cdn.example.com/a1.jpg', highlights: ['Registon', 'Shohi Zinda'],
    priceIncludes: ['Gid'], priceExcludes: [], hotelIncluded: true, transferIncluded: true,
    agencyId: 'ag-a', active: true, approvalStatus: 'approved',
  },
  {
    id: 't-a2', slug: 'qoralama', title: 'Qoralama tur', city: 'Xiva', subtitle: 'x', duration: '1 kun',
    agencyId: 'ag-a', active: true, approvalStatus: 'draft', highlights: [], priceIncludes: [], priceExcludes: [],
  },
  {
    id: 't-a3', slug: 'nofaol', title: 'Nofaol tur', city: 'Xiva', subtitle: 'x', duration: '1 kun',
    agencyId: 'ag-a', active: false, approvalStatus: 'approved', highlights: [], priceIncludes: [], priceExcludes: [],
  },
  {
    id: 't-b1', slug: 'dubay-5-kun', title: 'Dubay', city: 'Dubay', subtitle: 'x', duration: '5 kun',
    imageUrl: 'data:image/png;base64,AAAA', agencyId: 'ag-b', active: true, approvalStatus: 'approved',
    highlights: [], priceIncludes: [], priceExcludes: [],
  },
  {
    id: 't-p1', slug: 'pending-tour', title: 'Pending tour', city: 'Buxoro', subtitle: 'x', duration: '1 kun',
    agencyId: 'ag-p', active: true, approvalStatus: 'approved', highlights: [], priceIncludes: [], priceExcludes: [],
  },
];

const agencyById = (id) => AGENCIES.find((a) => a.id === id) || null;

// Prisma where'ining testlarda ishlatiladigan qismi: tenglik, {not}, {gte}, {is}, AND/OR.
function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'AND') return cond.every((c) => matches(row, c));
    if (key === 'OR') return cond.some((c) => matches(row, c));
    const value = row ? row[key] : undefined;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('is' in cond) return value ? matches(value, cond.is) : false;
      if ('not' in cond) return value !== cond.not && value !== undefined;
      if ('gte' in cond) return value >= cond.gte;
      return matches(value || {}, cond);
    }
    return value === cond;
  });
}
const withAgency = (t) => ({ ...t, agency: { ...agencyById(t.agencyId), ownerAccount: { email: OWNER_EMAIL } } });

let channelPosts = [];
const PRESENTATIONS = {
  tok_paid: { id: 'pr-1', token: 'tok_paid', title: 'Samarqand', customerName: 'Aziz', status: 'sent', paymentClickedAt: null, agencyId: 'ag-a' },
  tok_nopay: { id: 'pr-2', token: 'tok_nopay', title: 'Dubay', customerName: null, status: 'sent', paymentClickedAt: null, agencyId: 'ag-b' },
};

const mockPrisma = {
  tourAgency: {
    findFirst: jest.fn(async ({ where }) => AGENCIES.find((a) => matches(a, where)) || null),
    update: jest.fn(async ({ where, data }) => ({ ...agencyById(where.id), ...data })),
  },
  agencyMember: {
    findFirst: jest.fn(async ({ where }) => {
      const map = { 'acc-am': ['manager', 'ag-a'], 'acc-ag': ['agent', 'ag-a'], 'acc-ac': ['accountant', 'ag-a'] };
      const hit = map[where.accountId];
      return hit ? { role: hit[0], agency: agencyById(hit[1]) } : null;
    }),
    findMany: jest.fn(async () => []),
  },
  tour: {
    findMany: jest.fn(async ({ where, take }) => TOURS.map(withAgency).filter((t) => matches(t, where)).slice(0, take)),
    findFirst: jest.fn(async ({ where }) => TOURS.map(withAgency).find((t) => matches(t, where)) || null),
  },
  tourChannelPost: {
    findFirst: jest.fn(async ({ where }) => channelPosts.filter((p) => matches(p, where)).sort((a, b) => b.postedAt - a.postedAt)[0] || null),
    create: jest.fn(async ({ data }) => {
      const row = { id: `cp-${channelPosts.length + 1}`, postedAt: new Date(), ...data };
      channelPosts.push(row);
      return row;
    }),
    groupBy: jest.fn(async () => []),
  },
  tourBooking: {
    create: jest.fn(async ({ data }) => ({
      id: 'bk-1', ...data, createdAt: new Date(), updatedAt: new Date(),
      tour: data.tourId ? TOURS.find((t) => t.id === data.tourId) : null,
      agency: { ...agencyById(data.agencyId), ownerAccount: { email: OWNER_EMAIL } },
    })),
  },
  user: { findUnique: jest.fn(async () => null) },
  tourPresentation: {
    findUnique: jest.fn(async ({ where }) => {
      const p = PRESENTATIONS[where.token];
      return p ? { ...p, agency: agencyById(p.agencyId), tour: null } : null;
    }),
    update: jest.fn(async ({ data }) => data),
  },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const ACCOUNTS = {
  ownerA: { id: 'acc-a', email: 'a@example.com', status: 'approved' },
  managerA: { id: 'acc-am', email: 'am@example.com', status: 'approved' },
  agentA: { id: 'acc-ag', email: 'ag@example.com', status: 'approved' },
  ownerB: { id: 'acc-b', email: 'b@example.com', status: 'approved' },
};
jest.mock('../src/middleware/agencyAuth.middleware', () => ({
  agencyAuthMiddleware: (req, res, next) => {
    const account = ACCOUNTS[req.headers['x-test-account']];
    if (!account) return res.status(401).json({ success: false });
    req.agencyAccount = account;
    return next();
  },
}));
jest.mock('../src/middleware/agencyAudit.middleware', () => ({ agencyAuditMiddleware: (req, res, next) => next() }));
jest.mock('../src/services/crmAutomation.service', () => ({ assignNextMember: jest.fn(async () => null) }));
jest.mock('../src/services/email.service', () => ({ sendBookingLeadEmail: jest.fn(async () => ({})) }));
// Hamma tariflarda Telegram imkoniyati ochiq deb hisoblaymiz (tarif mantiqi boshqa testlarda).
jest.mock('../src/config/agencyPlans', () => {
  const actual = jest.requireActual('../src/config/agencyPlans');
  return {
    ...actual,
    resolveAccess: (agency, role) => ({ ...actual.resolveAccess(agency, role), readOnly: false, caps: { telegram: true, presentations: true } }),
  };
});
const mockTgCall = jest.fn();
jest.mock('../src/services/telegram.service', () => {
  const actual = jest.requireActual('../src/services/telegram.service');
  return { ...actual, tgCall: (...args) => mockTgCall(...args), sendMessage: jest.fn(async () => ({})) };
});

const express = require('express');
const request = require('supertest');
const dist = require('../src/services/distribution.service');
const { resetDistributionLimiters } = require('../src/controllers/agencyDistribution.controller');

const app = express();
app.use(express.json());
app.use('/api/v1', require('../src/routes/index'));
const as = (who) => ({ 'x-test-account': who });

beforeEach(() => {
  jest.clearAllMocks();
  mockTgCall.mockReset();
  channelPosts = [];
  resetDistributionLimiters();
  AGENCIES[0].telegramChannelId = null;
  AGENCIES[0].telegramChannelUsername = null;
  AGENCIES[0].paymentLinkUrl = null;
  AGENCIES[0].paymentRequisitesText = null;
});

/* ===================== Storefront ===================== */
describe('GET /home/agencies/:slug/storefront', () => {
  test('topiladi: agentlik profili + faqat faol, tasdiqlangan turlari', async () => {
    const res = await request(app).get('/api/v1/home/agencies/alfa-travel/storefront');
    expect(res.status).toBe(200);
    expect(res.body.data.agency).toEqual(expect.objectContaining({
      id: 'ag-a', slug: 'alfa-travel', name: 'Alfa Travel', verified: true, phone: '+998901112233', telegram: '@alfa',
    }));
    expect(res.body.data.tours.map((t) => t.id)).toEqual(['t-a1']);
    // /home/tours bilan bir xil tur shakli
    expect(res.body.data.tours[0]).toEqual(expect.objectContaining({ slug: 'samarqand-2-kun', priceMin: 1250000, agency: expect.objectContaining({ slug: 'alfa-travel' }) }));
    // so'rov public filtrdan o'tadi va aynan shu agentlik bilan cheklanadi
    const where = mockPrisma.tour.findMany.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining({ active: true, approvalStatus: 'approved', agencyId: 'ag-a' }));
    expect(where.AND).toContainEqual({ agency: { is: { active: true, approvalStatus: 'approved' } } });
  });

  test('maxfiy maydonlar sizib chiqmaydi (bot tokeni, egasi emaili, admin izohi)', async () => {
    const res = await request(app).get('/api/v1/home/agencies/alfa-travel/storefront');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('SECRET-BOT-TOKEN');
    expect(body).not.toContain(OWNER_EMAIL);
    expect(body).not.toContain('telegramBotToken');
    expect(body).not.toContain('ownerAccount');
    expect(body).not.toContain('ichki izoh');
    expect(body).not.toContain('paymentLinkUrl');
    const select = mockPrisma.tourAgency.findFirst.mock.calls[0][0].select;
    expect(select.telegramBotToken).toBeUndefined();
    expect(select.ownerAccountId).toBeUndefined();
  });

  test.each([
    ['noma‘lum', 'yoq-agentlik'],
    ['tasdiqlanmagan', 'pending-agency'],
    ['nofaol', 'off-agency'],
  ])('%s agentlik — 404', async (_label, slug) => {
    const res = await request(app).get(`/api/v1/home/agencies/${slug}/storefront`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockPrisma.tour.findMany).not.toHaveBeenCalled();
  });

  test('/home/agencies ro‘yxati buzilmagan (home.routes oldin ishlaydi)', async () => {
    mockPrisma.tourAgency.findMany = jest.fn(async () => []);
    mockPrisma.landingInteraction = { groupBy: jest.fn(async () => []) };
    const res = await request(app).get('/api/v1/home/agencies');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

/* ===================== Umumiy so'rov broni ===================== */
describe('POST /bookings — storefront umumiy so‘rovi (agencyId, tur yo‘q)', () => {
  const base = { customerName: 'Aziz Karimov', customerPhone: '+998901234567', travelers: 2, source: 'storefront' };

  test('faol agentlikka tursiz lid yaratiladi (UTM bilan)', async () => {
    const res = await request(app).post('/api/v1/bookings').send({
      ...base, agencyId: 'ag-a', utmSource: 'instagram', utmMedium: 'bio', utmCampaign: 'kuz', referrer: 'ref-123',
    });
    expect(res.status).toBe(201);
    const data = mockPrisma.tourBooking.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({
      tourId: null, agencyId: 'ag-a', source: 'storefront', utmSource: 'instagram', utmMedium: 'bio', utmCampaign: 'kuz',
      referrer: 'ref-123', totalEstimate: null, leadTour: 'Umumiy so‘rov',
    }));
    expect(mockPrisma.tourAgency.findFirst.mock.calls[0][0].where).toEqual({ id: 'ag-a', active: true, approvalStatus: 'approved' });
    expect(mockPrisma.tour.findFirst).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain(OWNER_EMAIL);
  });

  test.each([['tasdiqlanmagan', 'ag-p'], ['nofaol', 'ag-off'], ['noma‘lum', 'ag-x']])('%s agentlik — 404, lid yaratilmaydi', async (_l, agencyId) => {
    const res = await request(app).post('/api/v1/bookings').send({ ...base, agencyId });
    expect(res.status).toBe(404);
    expect(mockPrisma.tourBooking.create).not.toHaveBeenCalled();
  });

  test('tur boshqa agentlikniki bo‘lsa — 404 (agencyId bilan tur aralashtirib bo‘lmaydi)', async () => {
    const res = await request(app).post('/api/v1/bookings').send({ ...base, agencyId: 'ag-a', tourSlug: 'dubay-5-kun' });
    expect(res.status).toBe(404);
    expect(mockPrisma.tourBooking.create).not.toHaveBeenCalled();
  });

  test('tur shu agentlikniki bo‘lsa — oddiy bron', async () => {
    const res = await request(app).post('/api/v1/bookings').send({ ...base, agencyId: 'ag-a', tourSlug: 'samarqand-2-kun' });
    expect(res.status).toBe(201);
    expect(mockPrisma.tourBooking.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ tourId: 't-a1', agencyId: 'ag-a' }));
  });

  test('tur ham, agentlik ham yo‘q — 400', async () => {
    const res = await request(app).post('/api/v1/bookings').send(base);
    expect(res.status).toBe(400);
    expect(mockPrisma.tourBooking.create).not.toHaveBeenCalled();
  });
});

/* ===================== Telegram kanal ===================== */
function telegramOk({ chatType = 'channel', status = 'administrator', canPost = true } = {}) {
  mockTgCall.mockImplementation(async (token, method) => {
    if (method === 'getChat') return { id: -1001234567890, type: chatType, title: 'Alfa kanal', username: 'alfakanal' };
    if (method === 'getChatMember') return { status, can_post_messages: canPost };
    if (method === 'sendPhoto' || method === 'sendMessage') return { message_id: 77 };
    throw new Error(`kutilmagan ${method}`);
  });
}

describe('PUT /agency/distribution/channel', () => {
  test('egasi kanalni ulaydi: getChat + getChatMember tekshiriladi, faqat o‘z agentligi yangilanadi', async () => {
    telegramOk();
    const res = await request(app).put('/api/v1/agency/distribution/channel').set(as('ownerA')).send({ channel: 'https://t.me/alfakanal' });
    expect(res.status).toBe(200);
    expect(res.body.data.channel).toEqual({ id: '-1001234567890', title: 'Alfa kanal', username: 'alfakanal' });
    expect(mockTgCall).toHaveBeenCalledWith(AGENCIES[0].telegramBotToken, 'getChat', { chat_id: '@alfakanal' });
    expect(mockTgCall).toHaveBeenCalledWith(AGENCIES[0].telegramBotToken, 'getChatMember', { chat_id: -1001234567890, user_id: 111111 });
    expect(mockPrisma.tourAgency.update).toHaveBeenCalledWith({
      where: { id: 'ag-a' },
      data: { telegramChannelId: '-1001234567890', telegramChannelTitle: 'Alfa kanal', telegramChannelUsername: 'alfakanal' },
    });
    expect(JSON.stringify(res.body)).not.toContain('SECRET-BOT-TOKEN');
  });

  test('B agentlik egasi o‘z boti bilan tekshiradi va faqat B ni yangilaydi', async () => {
    telegramOk();
    const res = await request(app).put('/api/v1/agency/distribution/channel').set(as('ownerB')).send({ channel: '@alfakanal' });
    expect(res.status).toBe(200);
    expect(mockTgCall.mock.calls[0][0]).toBe(AGENCIES[1].telegramBotToken);
    expect(mockPrisma.tourAgency.update.mock.calls[0][0].where).toEqual({ id: 'ag-b' });
  });

  test.each(['managerA', 'agentA'])('%s — 403 (faqat egasi)', async (who) => {
    telegramOk();
    const res = await request(app).put('/api/v1/agency/distribution/channel').set(as(who)).send({ channel: '@alfakanal' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_FORBIDDEN');
    expect(mockTgCall).not.toHaveBeenCalled();
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('auth yo‘q — 401', async () => {
    const res = await request(app).put('/api/v1/agency/distribution/channel').send({ channel: '@x' });
    expect(res.status).toBe(401);
  });

  test.each([
    ['bot admin emas', { status: 'member', canPost: false }, 'BOT_CANNOT_POST'],
    ['admin, lekin post huquqi yo‘q', { status: 'administrator', canPost: false }, 'BOT_CANNOT_POST'],
    ['kanal emas (guruh)', { chatType: 'supergroup' }, 'NOT_A_CHANNEL'],
  ])('%s — 400', async (_l, opts, code) => {
    telegramOk(opts);
    const res = await request(app).put('/api/v1/agency/distribution/channel').set(as('ownerA')).send({ channel: '@alfakanal' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('kanal topilmasa (Telegram xatosi) — 400 CHANNEL_NOT_FOUND', async () => {
    mockTgCall.mockRejectedValue(new Error('Bad Request: chat not found'));
    const res = await request(app).put('/api/v1/agency/distribution/channel').set(as('ownerA')).send({ channel: '@yoqkanal' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CHANNEL_NOT_FOUND');
  });

  test('noto‘g‘ri kiritma — 400, Telegram chaqirilmaydi', async () => {
    const res = await request(app).put('/api/v1/agency/distribution/channel').set(as('ownerA')).send({ channel: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CHANNEL_INVALID');
    expect(mockTgCall).not.toHaveBeenCalled();
  });
});

describe('POST /agency/distribution/tours/:id/channel-post', () => {
  beforeEach(() => {
    AGENCIES[0].telegramChannelId = '-1001234567890';
    AGENCIES[0].telegramChannelUsername = 'alfakanal';
    telegramOk();
  });

  test('egasi joylaydi: rasm + HTML izoh + "Batafsil va bron" tugmasi, post yoziladi', async () => {
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ posted: true, withPhoto: true, messageId: '77', messageUrl: 'https://t.me/alfakanal/77' }));
    const [token, method, payload] = mockTgCall.mock.calls[0];
    expect(token).toBe(AGENCIES[0].telegramBotToken);
    expect(method).toBe('sendPhoto');
    expect(payload.chat_id).toBe('-1001234567890');
    expect(payload.photo).toBe('https://cdn.example.com/a1.jpg');
    expect(payload.parse_mode).toBe('HTML');
    expect(payload.caption).toContain('<b>Samarqand &lt;2 kun&gt; &amp; Buxoro</b>');
    expect(payload.caption).toContain('1 250 000 so‘m');
    expect(payload.caption.length).toBeLessThanOrEqual(1024);
    expect(payload.reply_markup.inline_keyboard[0][0]).toEqual({
      text: 'Batafsil va bron',
      url: 'https://travelorai.com/a/alfa-travel?utm_source=telegram&utm_medium=channel&utm_campaign=samarqand-2-kun',
    });
    expect(mockPrisma.tourChannelPost.create).toHaveBeenCalledWith({
      data: { agencyId: 'ag-a', tourId: 't-a1', channelId: '-1001234567890', messageId: '77', postedByAccountId: 'acc-a' },
    });
  });

  test('menejer ham joylay oladi; agent — 403', async () => {
    const ok = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('managerA')).send({});
    expect(ok.status).toBe(201);
    const denied = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('agentA')).send({});
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('ROLE_FORBIDDEN');
  });

  test('10 daqiqa ichida qayta joylash bloklanadi, force: true bilan ruxsat', async () => {
    const first = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('RECENTLY_POSTED');
    expect(second.body.lastPostedAt).toBeTruthy();
    const forced = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({ force: true });
    expect(forced.status).toBe(201);
    expect(mockPrisma.tourChannelPost.create).toHaveBeenCalledTimes(2);
  });

  test('11 daqiqa oldingi post bloklamaydi', async () => {
    channelPosts.push({ agencyId: 'ag-a', tourId: 't-a1', channelId: '-1001234567890', postedAt: new Date(Date.now() - 11 * 60 * 1000) });
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(201);
  });

  test('boshqa agentlik turi — 404 (tenant izolyatsiyasi)', async () => {
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-b1/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(404);
    expect(mockPrisma.tour.findFirst.mock.calls[0][0].where).toEqual({ id: 't-b1', agencyId: 'ag-a' });
    expect(mockTgCall).not.toHaveBeenCalled();
  });

  test('e‘lon qilinmagan tur — 400 TOUR_NOT_PUBLIC', async () => {
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-a2/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOUR_NOT_PUBLIC');
  });

  test('kanal ulanmagan — 400 CHANNEL_NOT_CONNECTED', async () => {
    AGENCIES[0].telegramChannelId = null;
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CHANNEL_NOT_CONNECTED');
  });

  test('rasm yuklanmasa matnli post (sendMessage) ga o‘tadi', async () => {
    mockTgCall.mockImplementation(async (token, method) => {
      if (method === 'sendPhoto') throw new Error('Bad Request: wrong file identifier/HTTP URL specified');
      if (method === 'sendMessage') return { message_id: 78 };
      throw new Error(method);
    });
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.withPhoto).toBe(false);
    const call = mockTgCall.mock.calls.find((c) => c[1] === 'sendMessage');
    expect(call[2].text).toContain('<b>Samarqand');
    expect(call[2].reply_markup.inline_keyboard[0][0].text).toBe('Batafsil va bron');
  });

  test('Telegram postni rad etsa — 502, post yozilmaydi', async () => {
    mockTgCall.mockRejectedValue(new Error('Forbidden: bot is not a member of the channel chat'));
    const res = await request(app).post('/api/v1/agency/distribution/tours/t-a1/channel-post').set(as('ownerA')).send({});
    expect(res.status).toBe(502);
    expect(mockPrisma.tourChannelPost.create).not.toHaveBeenCalled();
  });
});

/* ===================== Izoh (caption) ===================== */
describe('buildTourCaption', () => {
  test('HTML escape: teglar va & xavfsiz', () => {
    const caption = dist.buildTourCaption({ title: '<script>alert("x")</script> & co', city: 'A<b>', subtitle: '<i>yo</i>' });
    expect(caption).not.toContain('<script>');
    expect(caption).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
    expect(caption).toContain('📍 A&lt;b&gt;');
    // faqat bizning teglarimiz qoladi
    const tags = caption.match(/<\/?[a-z]+>/g) || [];
    expect(tags.every((t) => ['<b>', '</b>', '<i>', '</i>'].includes(t))).toBe(true);
  });

  test('juda uzun ma‘lumot ham 1024 belgidan oshmaydi', () => {
    const long = '&<>'.repeat(400);
    const caption = dist.buildTourCaption({
      title: long, subtitle: long, city: long, destinationCountry: long, duration: long, price: long,
      priceIncludes: [long, `${long}1`, `${long}2`, `${long}3`, `${long}4`, `${long}5`], highlights: [long],
    });
    expect(caption.length).toBeLessThanOrEqual(1024);
    expect(caption.startsWith('<b>')).toBe(true);
    // yarim entity qolmasin
    expect(caption).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
  });

  test('3-5 ta kiritilgan xizmat, narx so‘mda, davomiylik va shahar', () => {
    const caption = dist.buildTourCaption({
      title: 'Xiva', city: 'Xiva', duration: '3 kun', priceMin: 2500000, priceCurrency: 'UZS',
      hotelIncluded: true, flightIncluded: true, transferIncluded: true, insuranceIncluded: true,
      priceIncludes: ['Gid', 'Nonushta', 'Muzey'], highlights: ['Ichan qal‘a'],
    });
    expect(caption).toContain('2 500 000 so‘m');
    expect(caption).toContain('🗓 3 kun');
    expect(caption).toContain('📍 Xiva');
    expect((caption.match(/✅/g) || []).length).toBe(5);
  });

  test('narx formatlari', () => {
    expect(dist.formatTourPrice({ priceMin: 1250000, priceCurrency: 'UZS' })).toBe('1 250 000 so‘mdan');
    expect(dist.formatTourPrice({ priceMin: 1200, priceCurrency: 'USD' })).toBe('$1 200 dan');
    expect(dist.formatTourPrice({ price: "900 000 so'm" })).toBe('900 000 so‘m');
    expect(dist.formatTourPrice({})).toBe('Narx so‘rov bo‘yicha');
  });

  test('rasm: faqat ommaviy https (data:/http: — matnli post)', () => {
    expect(dist.publicPhotoUrl({ imageUrl: 'https://x.uz/a.jpg' })).toBe('https://x.uz/a.jpg');
    expect(dist.publicPhotoUrl({ imageUrl: '/uploads/a.jpg' })).toBe('https://travelorai.com/uploads/a.jpg');
    expect(dist.publicPhotoUrl({ imageUrl: 'http://x.uz/a.jpg' })).toBeNull();
    expect(dist.publicPhotoUrl({ imageUrl: 'data:image/png;base64,AAA' })).toBeNull();
    expect(dist.publicPhotoUrl({})).toBeNull();
  });

  test('kanal kiritmasi normallashtiriladi', () => {
    expect(dist.parseChannelInput('@kanal_uz')).toBe('@kanal_uz');
    expect(dist.parseChannelInput('https://t.me/kanal_uz/')).toBe('@kanal_uz');
    expect(dist.parseChannelInput('-1001234567890')).toBe('-1001234567890');
    expect(dist.parseChannelInput('a b')).toBeNull();
    expect(dist.parseChannelInput('')).toBeNull();
  });
});

/* ===================== To'lov havolasi ===================== */
describe('validatePaymentLink', () => {
  test.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'http://my.click.uz/pay',
    'data:text/html,<script>alert(1)</script>',
    'ftp://payme.uz/x',
    'https://my.click.uz.evil.com/pay',
    'https://evilpayme.uz/pay',
    'https://user:pass@payme.uz/x',
    'java\tscript:alert(1)',
    'https://payme.uz/ x',
    '//payme.uz/x',
  ])('rad etiladi: %s', (url) => {
    expect(dist.validatePaymentLink(url).ok).toBe(false);
    expect(dist.validatePaymentLink(url, { allowCustomHost: false }).ok).toBe(false);
  });

  test('500 belgidan uzun havola rad etiladi', () => {
    expect(dist.validatePaymentLink(`https://payme.uz/${'a'.repeat(500)}`).code).toBe('PAYMENT_URL_TOO_LONG');
  });

  test.each([
    'https://my.click.uz/services/pay?service_id=1',
    'https://click.uz/x',
    'https://payme.uz/abc',
    'https://checkout.paycom.uz/abc',
    'https://uzumbank.uz/pay',
    'https://pay.uzum.uz/x',
    'https://www.payme.uz/abc',
    'HTTPS://PAYME.UZ/abc',
  ])('ruxsat ro‘yxatida: %s', (url) => {
    expect(dist.validatePaymentLink(url).ok).toBe(true);
  });

  test('boshqa https xost faqat allowCustomHost bilan', () => {
    expect(dist.validatePaymentLink('https://agentlik.uz/tolov').code).toBe('PAYMENT_HOST_NOT_ALLOWED');
    expect(dist.validatePaymentLink('https://agentlik.uz/tolov', { allowCustomHost: true })).toEqual({ ok: true, value: 'https://agentlik.uz/tolov' });
    // allowCustomHost http/javascript'ni ochmaydi
    expect(dist.validatePaymentLink('http://agentlik.uz', { allowCustomHost: true }).ok).toBe(false);
    expect(dist.validatePaymentLink('javascript:alert(1)', { allowCustomHost: true }).ok).toBe(false);
  });

  test('bo‘sh qiymat — o‘chirish', () => {
    expect(dist.validatePaymentLink('')).toEqual({ ok: true, value: null });
    expect(dist.validatePaymentLink(null)).toEqual({ ok: true, value: null });
  });

  test('rekvizitlar: 500 belgigacha, boshqaruv belgilarisiz', () => {
    expect(dist.sanitizeRequisites('a'.repeat(501)).ok).toBe(false);
    expect(dist.sanitizeRequisites('Bank: X\r\nH/r: 2020\u0000').value).toBe('Bank: X\nH/r: 2020');
  });
});

describe('PUT /agency/distribution/payment', () => {
  test('egasi saqlaydi', async () => {
    const res = await request(app).put('/api/v1/agency/distribution/payment').set(as('ownerA'))
      .send({ paymentLinkUrl: 'https://my.click.uz/pay/1', paymentRequisitesText: 'H/r 2020 8000' });
    expect(res.status).toBe(200);
    expect(mockPrisma.tourAgency.update.mock.calls[0][0]).toEqual(expect.objectContaining({
      where: { id: 'ag-a' },
      data: { paymentLinkUrl: 'https://my.click.uz/pay/1', paymentRequisitesText: 'H/r 2020 8000' },
    }));
  });

  test.each(['managerA', 'agentA'])('%s — 403', async (who) => {
    const res = await request(app).put('/api/v1/agency/distribution/payment').set(as(who)).send({ paymentLinkUrl: 'https://payme.uz/x' });
    expect(res.status).toBe(403);
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test.each(['javascript:alert(1)', 'http://payme.uz/x', 'data:text/html,x', 'https://evil.com/x'])('yaroqsiz %s — 400', async (url) => {
    const res = await request(app).put('/api/v1/agency/distribution/payment').set(as('ownerA')).send({ paymentLinkUrl: url });
    expect(res.status).toBe(400);
    expect(mockPrisma.tourAgency.update).not.toHaveBeenCalled();
  });

  test('allowCustomHost bilan boshqa https sayt', async () => {
    const res = await request(app).put('/api/v1/agency/distribution/payment').set(as('ownerA'))
      .send({ paymentLinkUrl: 'https://agentlik.uz/tolov', allowCustomHost: true });
    expect(res.status).toBe(200);
  });
});

describe('GET /agency/distribution', () => {
  test('storefront havolasi va rollar; bot tokeni qaytmaydi', async () => {
    const res = await request(app).get('/api/v1/agency/distribution').set(as('managerA'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      slug: 'alfa-travel', storefrontUrl: 'https://travelorai.com/a/alfa-travel', canManage: false, canPost: true, botConnected: true,
    }));
    expect(JSON.stringify(res.body)).not.toContain('SECRET-BOT-TOKEN');
  });
});

/* ===================== Taklif sahifasi: payment_clicked ===================== */
describe('Taklif sahifasidagi to‘lov', () => {
  test('public taklif to‘lov ma‘lumotini qaytaradi, agency ichida esa sozlama maydonlari yo‘q', async () => {
    AGENCIES[0].paymentLinkUrl = 'https://payme.uz/abc';
    AGENCIES[0].paymentRequisitesText = 'H/r 2020';
    const res = await request(app).get('/api/v1/p/tok_paid');
    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual({ url: 'https://payme.uz/abc', requisites: 'H/r 2020' });
    expect(res.body.data.agency.paymentLinkUrl).toBeUndefined();
  });

  test('bazada yaroqsiz havola bo‘lsa — ko‘rsatilmaydi', async () => {
    AGENCIES[0].paymentLinkUrl = 'javascript:alert(1)';
    const res = await request(app).get('/api/v1/p/tok_paid');
    expect(res.body.data.payment).toBeNull();
  });

  test('POST /p/:token/payment-click hodisani yozadi', async () => {
    AGENCIES[0].paymentLinkUrl = 'https://payme.uz/abc';
    const res = await request(app).post('/api/v1/p/tok_paid/payment-click');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ recorded: true, event: 'payment_clicked' });
    expect(mockPrisma.tourPresentation.update).toHaveBeenCalledWith({
      where: { id: 'pr-1' },
      data: { paymentClickCount: { increment: 1 }, paymentClickedAt: expect.any(Date) },
    });
  });

  test('to‘lov sozlanmagan bo‘lsa yozilmaydi; noma‘lum token — 404', async () => {
    const none = await request(app).post('/api/v1/p/tok_nopay/payment-click');
    expect(none.body.data.recorded).toBe(false);
    const missing = await request(app).post('/api/v1/p/yoq/payment-click');
    expect(missing.status).toBe(404);
    expect(mockPrisma.tourPresentation.update).not.toHaveBeenCalled();
  });

  test('bir IP dan ko‘p bosish cheklanadi', async () => {
    AGENCIES[0].paymentLinkUrl = 'https://payme.uz/abc';
    for (let i = 0; i < 10; i += 1) await request(app).post('/api/v1/p/tok_paid/payment-click');
    const res = await request(app).post('/api/v1/p/tok_paid/payment-click');
    expect(res.status).toBe(202);
    expect(mockPrisma.tourPresentation.update).toHaveBeenCalledTimes(10);
  });
});
