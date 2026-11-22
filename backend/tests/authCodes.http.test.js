// OTP kodlari: kriptografik generatsiya, 5 urinish limiti, parol tiklash va devCode siyosati.
const mockPrisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  authCode: { findFirst: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  agencyAccount: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  agencyAuthCode: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const authService = require('../src/services/auth.service');
const { verifyToken } = require('../src/utils/jwt');

const sha = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const future = () => new Date(Date.now() + 5 * 60 * 1000);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', require('../src/routes/auth.routes'));
  app.use('/agency', require('../src/routes/agency.routes'));
  return app;
}
const app = buildApp();

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ALLOW_DEV_CODES;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  mockPrisma.authCode.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.agencyAuthCode.updateMany.mockResolvedValue({ count: 1 });
});

describe('generateNumericCode', () => {
  test('crypto.randomInt(100000, 1000000) dan foydalanadi', () => {
    const spy = jest.spyOn(crypto, 'randomInt');
    const code = authService.generateNumericCode();
    expect(spy).toHaveBeenCalledWith(100000, 1000000);
    expect(code).toMatch(/^\d{6}$/);
    spy.mockRestore();
  });
});

describe('consumeCodeRecord — urinishlar limiti', () => {
  const delegate = () => ({ findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) });

  test('noto‘g‘ri kod urinishni oshiradi va qolganini qaytaradi', async () => {
    const d = delegate();
    d.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: future(), attempts: 1 });
    await expect(authService.consumeCodeRecord(d, { userId: 'u' }, '000000')).rejects.toMatchObject({
      message: 'CODE_INVALID',
      attemptsRemaining: 3,
    });
    expect(d.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', usedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  });

  test('5-noto‘g‘ri urinishda kod bekor qilinadi', async () => {
    const d = delegate();
    d.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: future(), attempts: 4 });
    await expect(authService.consumeCodeRecord(d, {}, '000000')).rejects.toMatchObject({ message: 'CODE_TOO_MANY_ATTEMPTS' });
    expect(d.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'c1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  test('limit tugagach TO‘G‘RI kod ham qabul qilinmaydi', async () => {
    const d = delegate();
    d.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: future(), attempts: 5 });
    await expect(authService.consumeCodeRecord(d, {}, '123456')).rejects.toMatchObject({ message: 'CODE_TOO_MANY_ATTEMPTS' });
  });

  test('parallel so‘rovlar atomar band qilishdan o‘tolmasa rad etiladi', async () => {
    const d = delegate();
    d.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: future(), attempts: 3 });
    d.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(authService.consumeCodeRecord(d, {}, '123456')).rejects.toMatchObject({ message: 'CODE_TOO_MANY_ATTEMPTS' });
  });

  test('to‘g‘ri kod ishlatilgan deb belgilanadi', async () => {
    const d = delegate();
    d.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: future(), attempts: 0 });
    await expect(authService.consumeCodeRecord(d, {}, '123456')).resolves.toMatchObject({ id: 'c1' });
  });
});

describe('POST /auth/verify-email (HTTP)', () => {
  test('5-noto‘g‘ri urinishdan keyin 400 + requiresNewCode, token yo‘q', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.uz', password: 'h', emailVerified: false, blocked: false });
    mockPrisma.authCode.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('111111'), expiresAt: future(), attempts: 4 });

    const res = await request(app).post('/auth/verify-email').send({ email: 'a@x.uz', code: '222222' });

    expect(res.status).toBe(400);
    expect(res.body.requiresNewCode).toBe(true);
    expect(res.body.data).toBeUndefined();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe('POST /auth/reset-password', () => {
  test('tokenVersion oshiriladi; mobil ilova uchun yangi token (tv bilan) qaytariladi', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.uz', password: 'old', emailVerified: true, blocked: false });
    mockPrisma.authCode.findFirst.mockResolvedValue({ id: 'c1', codeHash: sha('123456'), expiresAt: future(), attempts: 0 });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'a@x.uz', name: 'A', emailVerified: true, tokenVersion: 3 });

    const res = await request(app).post('/auth/reset-password').send({ email: 'a@x.uz', code: '123456', newPassword: 'newpassword1' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
    expect(verifyToken(res.body.data.token)).toMatchObject({ id: 'u1', tv: 3 });
  });

  test('bloklangan foydalanuvchiga parol tiklash yo‘q', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.uz', blocked: true });
    const res = await request(app).post('/auth/reset-password').send({ email: 'a@x.uz', code: '123456', newPassword: 'newpassword1' });
    expect(res.status).toBe(403);
    expect(mockPrisma.authCode.findFirst).not.toHaveBeenCalled();
  });
});

describe('POST /agency/auth/reset-password', () => {
  test('token qaytarmaydi va tokenVersion oshiradi', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ id: 'a1', email: 'ag@x.uz', status: 'approved' });
    mockPrisma.agencyAuthCode.findFirst.mockResolvedValue({ id: 'k1', codeHash: sha('654321'), expiresAt: future(), attempts: 0 });
    mockPrisma.agencyAccount.update.mockResolvedValue({ id: 'a1' });

    const res = await request(app).post('/agency/auth/reset-password').send({ email: 'ag@x.uz', code: '654321', newPassword: 'newpassword1' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
    expect(mockPrisma.agencyAccount.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });

  test('agency kodida ham 5 urinish limiti', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ id: 'a1', email: 'ag@x.uz', status: 'approved' });
    mockPrisma.agencyAuthCode.findFirst.mockResolvedValue({ id: 'k1', codeHash: sha('654321'), expiresAt: future(), attempts: 4 });

    const res = await request(app).post('/agency/auth/reset-password').send({ email: 'ag@x.uz', code: '000000', newPassword: 'newpassword1' });

    expect(res.status).toBe(400);
    expect(res.body.requiresNewCode).toBe(true);
    expect(mockPrisma.agencyAccount.update).not.toHaveBeenCalled();
  });
});

describe('POST /agency/auth/register — cooldown va devCode', () => {
  test('yaqinda kod yuborilgan bo‘lsa yangi kod yaratilmaydi', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ id: 'a1', email: 'new@x.uz', emailVerified: false, status: 'pending' });
    mockPrisma.agencyAuthCode.findFirst.mockResolvedValue({ id: 'k1', createdAt: new Date(Date.now() - 10_000) });

    const res = await request(app).post('/agency/auth/register').send({ email: 'new@x.uz', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.data.codeAlreadySent).toBe(true);
    expect(res.body.data.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockPrisma.agencyAuthCode.create).not.toHaveBeenCalled();
    expect(mockPrisma.agencyAccount.update).not.toHaveBeenCalled();
  });

  test('devCode ALLOW_DEV_CODES yoqilmaguncha qaytmaydi', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue(null);
    mockPrisma.agencyAccount.create.mockResolvedValue({ id: 'a2', email: 'b@x.uz', emailVerified: false, status: 'pending' });

    const res = await request(app).post('/agency/auth/register').send({ email: 'b@x.uz', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.data.delivery.devCode).toBeUndefined();
  });

  test('ALLOW_DEV_CODES=true (dev) bo‘lsa devCode qaytadi', async () => {
    process.env.ALLOW_DEV_CODES = 'true';
    mockPrisma.agencyAccount.findUnique.mockResolvedValue(null);
    mockPrisma.agencyAccount.create.mockResolvedValue({ id: 'a3', email: 'c@x.uz', emailVerified: false, status: 'pending' });

    const res = await request(app).post('/agency/auth/register').send({ email: 'c@x.uz', password: 'password123' });

    expect(res.body.data.delivery.devCode).toMatch(/^\d{6}$/);
  });

  test('production’da ALLOW_DEV_CODES=true bo‘lsa ham devCode yo‘q', () => {
    const { allowDevCodes } = require('../src/config/env');
    const prev = process.env.NODE_ENV;
    process.env.ALLOW_DEV_CODES = 'true';
    process.env.NODE_ENV = 'production';
    try {
      expect(allowDevCodes()).toBe(false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('500 javoblar', () => {
  test('Prisma xabari mijozga qaytmaydi, requestId beriladi', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Invalid `prisma.user.findUnique()` invocation: secret-internal'));
    const res = await request(app).post('/auth/login').send({ email: 'z@x.uz', password: 'whatever' });
    expect(res.status).toBe(500);
    expect(res.body.message).not.toMatch(/prisma/i);
    expect(res.body.requestId).toEqual(expect.any(String));
  });
});
