// HTTP darajasidagi regressiya testlari: yo'l + middleware + controller birga tekshiriladi,
// chunki bu xatolar aynan yo'lda himoya yo'qligidan kelib chiqqan edi.
process.env.ADMIN_SECRET_KEY = 'test-admin-key';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  authCode: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  poi: { create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  tourBooking: { findMany: jest.fn(), updateMany: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');
const { signToken } = require('../src/utils/jwt');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', require('../src/routes/auth.routes'));
  app.use('/poi', require('../src/routes/poi.routes'));
  app.use('/bookings', require('../src/routes/bookings.routes'));
  return app;
}

const app = buildApp();

beforeEach(() => jest.clearAllMocks());

describe('POST /auth/verify-email', () => {
  test('tasdiqlangan akkauntga kodsiz token bermaydi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'victim@example.com', password: 'hash', emailVerified: true, blocked: false,
    });

    const res = await request(app).post('/auth/verify-email').send({ email: 'victim@example.com', code: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();
    expect(res.body.data).toBeUndefined();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test('bloklangan, tasdiqlanmagan akkauntga token bermaydi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2', email: 'blocked@example.com', password: 'hash', emailVerified: false, blocked: true,
    });

    const res = await request(app).post('/auth/verify-email').send({ email: 'blocked@example.com', code: '123456' });

    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('/poi yozish yo‘llari', () => {
  const writes = [
    ['post', '/poi', { name: 'x' }],
    ['post', '/poi/bulk', { items: [] }],
    ['put', '/poi/abc', { name: 'x' }],
    ['delete', '/poi/abc', undefined],
  ];

  test.each(writes)('%s %s admin kalitisiz 403 qaytaradi', async (method, path, body) => {
    const res = await request(app)[method](path).send(body);

    expect(res.status).toBe(403);
    expect(mockPrisma.poi.create).not.toHaveBeenCalled();
    expect(mockPrisma.poi.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.poi.update).not.toHaveBeenCalled();
    expect(mockPrisma.poi.delete).not.toHaveBeenCalled();
  });

  test.each(writes)('%s %s noto‘g‘ri kalit bilan 403 qaytaradi', async (method, path, body) => {
    const res = await request(app)[method](path).set('x-admin-key', 'wrong').send(body);

    expect(res.status).toBe(403);
  });

  test('to‘g‘ri admin kaliti himoyadan o‘tadi', async () => {
    mockPrisma.poi.findUnique.mockResolvedValue({ id: 'abc' });
    mockPrisma.poi.delete.mockResolvedValue({ id: 'abc' });

    const res = await request(app).delete('/poi/abc').set('x-admin-key', 'test-admin-key');

    expect(res.status).toBe(200);
    expect(mockPrisma.poi.delete).toHaveBeenCalledWith({ where: { id: 'abc' } });
  });
});

describe('GET /bookings/mine', () => {
  test('tokensiz email parametri bilan bronlarni bermaydi', async () => {
    const res = await request(app).get('/bookings/mine').query({ email: 'victim@example.com' });

    expect(res.status).toBe(401);
    expect(mockPrisma.tourBooking.findMany).not.toHaveBeenCalled();
  });

  test('token bilan faqat o‘z bronlarini qaytaradi, email parametri e’tiborga olinmaydi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'me@example.com', emailVerified: true });
    mockPrisma.tourBooking.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.tourBooking.findMany.mockResolvedValue([]);
    const token = signToken({ id: 'me', email: 'me@example.com' });

    const res = await request(app)
      .get('/bookings/mine')
      .query({ email: 'victim@example.com' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.tourBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'me' } })
    );
    expect(mockPrisma.tourBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: null, customerEmail: 'me@example.com' } })
    );
  });

  test('email tasdiqlanmagan bo‘lsa mehmon bronlari biriktirilmaydi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'me@example.com', emailVerified: false });
    mockPrisma.tourBooking.findMany.mockResolvedValue([]);
    const token = signToken({ id: 'me', email: 'me@example.com' });

    const res = await request(app).get('/bookings/mine').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.tourBooking.updateMany).not.toHaveBeenCalled();
  });
});
