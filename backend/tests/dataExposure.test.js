// Ma'lumot oshkor bo'lishi va katalog yaxlitligi: admin select whitelist'lari,
// audit/webhook payload'idan fayl tanalari, public turlar va mehmon bron.
const mockPrisma = {
  user: { findUnique: jest.fn() },
  tourAgency: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  agencyApplication: { findMany: jest.fn(async () => []) },
  tour: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), count: jest.fn(async () => 0) },
  tourBooking: { findMany: jest.fn(async () => []), create: jest.fn() },
  auditLog: { create: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');
const admin = require('../src/controllers/admin.controller');
const { sanitizeForAudit } = require('../src/services/audit.service');
const { publicTourWhere } = require('../src/controllers/home.controller');

const SECRET_FIELDS = ['telegramBotToken', 'instagramToken', 'whatsappToken', 'passwordHash', 'password'];

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function collectKeys(value, out = new Set()) {
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      out.add(key);
      collectKeys(item, out);
    }
  }
  return out;
}

beforeEach(() => jest.clearAllMocks());

describe('admin API select whitelist', () => {
  test('getAgencies tokenlarni so‘ramaydi', async () => {
    await admin.getAgencies({ query: {} }, mockRes());
    const args = mockPrisma.tourAgency.findMany.mock.calls[0][0];
    expect(args.include).toBeUndefined();
    const keys = collectKeys(args.select);
    for (const f of SECRET_FIELDS) expect(keys.has(f)).toBe(false);
    expect(args.select.name).toBe(true);
  });

  test('getUser parol xeshini so‘ramaydi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', blocked: false, _count: { trips: 0 } });
    await admin.getUser({ params: { id: 'u1' } }, mockRes());
    const args = mockPrisma.user.findUnique.mock.calls[0][0];
    expect(args.include).toBeUndefined();
    expect(args.select.password).toBeUndefined();
    expect(args.select.email).toBe(true);
  });

  test('getAgencyApplications akkaunt va agentlik maydonlarini cheklaydi', async () => {
    await admin.getAgencyApplications({ query: {} }, mockRes());
    const args = mockPrisma.agencyApplication.findMany.mock.calls[0][0];
    const keys = collectKeys(args.include);
    for (const f of SECRET_FIELDS) expect(keys.has(f)).toBe(false);
  });

  test('getAdminTours agentlik tokenlarini qaytarmaydi', async () => {
    await admin.getAdminTours({ query: {} }, mockRes());
    const args = mockPrisma.tour.findMany.mock.calls[0][0];
    expect(args.include.agency).not.toBe(true);
    const keys = collectKeys(args.include);
    for (const f of SECRET_FIELDS) expect(keys.has(f)).toBe(false);
  });
});

describe('audit / webhook payload', () => {
  test('pasport fayli (data URL) va base64 tanalar olib tashlanadi', () => {
    const big = `data:image/jpeg;base64,${'A'.repeat(5000)}`;
    const out = sanitizeForAudit({ name: 'pasport.jpg', dataUrl: big, nested: { image: big }, data: 'B'.repeat(500), note: 'ok' });
    expect(JSON.stringify(out)).not.toContain('AAAA');
    expect(JSON.stringify(out)).not.toContain('BBBB');
    expect(out.name).toBe('pasport.jpg');
    expect(out.note).toBe('ok');
    expect(out.dataUrl).toMatch(/fayl olib tashlandi/);
  });

  test('Buffer ham saqlanmaydi', () => {
    expect(sanitizeForAudit({ file: Buffer.alloc(300) }).file).toMatch(/fayl olib tashlandi/);
  });
});

describe('public turlar va mehmon bron', () => {
  test('publicTourWhere egasiz turlarni chiqarmaydi va agentlik tasdig‘ini talab qiladi', () => {
    const where = publicTourWhere();
    expect(where.agencyId).toEqual({ not: null });
    expect(JSON.stringify(where)).not.toContain('"agencyId":null');
    expect(where.AND).toContainEqual({ agency: { is: { active: true, approvalStatus: 'approved' } } });
  });

  test('POST /bookings egasiz yoki tasdiqlanmagan agentlik turini rad etadi', async () => {
    const app = express();
    app.use(express.json());
    app.use('/bookings', require('../src/routes/bookings.routes'));

    const res = await request(app).post('/bookings').send({
      tourSlug: 'samarqand-2-kun', customerName: 'Aziz Karimov', customerPhone: '+998901234567', travelers: 2,
    });

    expect(res.status).toBe(404);
    const where = mockPrisma.tour.findFirst.mock.calls[0][0].where;
    expect(where.agencyId).toEqual({ not: null });
    expect(where.agency).toEqual({ is: { active: true, approvalStatus: 'approved' } });
    expect(where.OR).toBeUndefined();
    expect(mockPrisma.tourBooking.create).not.toHaveBeenCalled();
  });
});
