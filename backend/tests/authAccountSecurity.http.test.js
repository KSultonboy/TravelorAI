// Master parol olib tashlangani, Google pre-hijack himoyasi, email almashtirish
// (kod YANGI manzilga) va agency parol almashtirishda joriy parol talabi.
const mockPrisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  authCode: { findFirst: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
  agencyAccount: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  agencyAuthCode: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('axios');
jest.mock('../src/services/email.service', () => ({
  sendVerificationCodeEmail: jest.fn().mockResolvedValue({ delivery: 'log' }),
  sendEmailChangeCodeEmail: jest.fn().mockResolvedValue({ delivery: 'log' }),
  sendPasswordResetCodeEmail: jest.fn().mockResolvedValue({ delivery: 'log' }),
  sendAccountDeleteCodeEmail: jest.fn().mockResolvedValue({ delivery: 'log' }),
  sendAgencyPasswordResetLinkEmail: jest.fn().mockResolvedValue({ delivery: 'log' }),
  sendEmailChangedNoticeEmail: jest.fn().mockResolvedValue([]),
}));

const bcrypt = require('bcryptjs');
const axios = require('axios');
const express = require('express');
const request = require('supertest');
const emailService = require('../src/services/email.service');
const { signToken } = require('../src/utils/jwt');
const { signAgencyToken } = require('../src/utils/agencyJwt');

const GOOGLE_CLIENT = 'test-client.apps.googleusercontent.com';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', require('../src/routes/auth.routes'));
  // Agency auth handlerlari — to'g'ridan-to'g'ri (agencyPlan/role middleware'lari bu testga aloqasiz).
  const agency = require('../src/controllers/agency.controller');
  const { agencyAuthMiddleware } = require('../src/middleware/agencyAuth.middleware');
  app.post('/agency/auth/login', agency.login);
  app.post('/agency/auth/google', agency.googleAuth);
  app.post('/agency/auth/change-password', agencyAuthMiddleware, agency.changePassword);
  app.post('/agency/auth/email-change/request', agencyAuthMiddleware, agency.requestEmailChange);
  return app;
}
const app = buildApp();

let passwordHash;
beforeAll(async () => {
  passwordHash = await bcrypt.hash('correct-password', 4);
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_CLIENT_IDS = GOOGLE_CLIENT;
  axios.get.mockResolvedValue({
    data: { aud: GOOGLE_CLIENT, sub: 'g-123', email: 'victim@gmail.com', email_verified: 'true', name: 'Victim' },
  });
});

afterAll(() => {
  delete process.env.GOOGLE_CLIENT_IDS;
  delete process.env.OWNER_MASTER_PASSWORD_HASH;
});

describe('Agency login: master parol olib tashlandi', () => {
  test('OWNER_MASTER_PASSWORD_HASH o‘rnatilgan bo‘lsa ham master parol kiritmaydi', async () => {
    process.env.OWNER_MASTER_PASSWORD_HASH = await bcrypt.hash('master-pass', 4);
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({
      id: 'a1', email: 'ag@x.uz', passwordHash, emailVerified: true, status: 'approved', failedLoginAttempts: 0,
    });
    mockPrisma.agencyAccount.update.mockResolvedValue({});

    const res = await request(app).post('/agency/auth/login').send({ email: 'ag@x.uz', password: 'master-pass' });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
  });
});

describe('Google pre-hijack himoyasi', () => {
  test('user: tasdiqlanmagan lokal akkaunt paroli o‘chiriladi', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1', email: 'victim@gmail.com', password: 'attacker-hash', emailVerified: false, blocked: false, name: 'Attacker',
    });
    mockPrisma.user.update.mockImplementation(async ({ data }) => ({ id: 'u1', email: 'victim@gmail.com', ...data, tokenVersion: 1 }));

    const res = await request(app).post('/auth/google').send({ idToken: 'google-id-token-value' });

    expect(res.status).toBe(200);
    const data = mockPrisma.user.update.mock.calls[0][0].data;
    expect(data.password).toBeNull();
    expect(data.authProvider).toBe('GOOGLE');
    expect(data.tokenVersion).toEqual({ increment: 1 });
  });

  test('user: tasdiqlangan lokal akkaunt paroli saqlanadi', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1', email: 'victim@gmail.com', password: 'own-hash', emailVerified: true, blocked: false, name: 'V', authProvider: 'LOCAL',
    });
    mockPrisma.user.update.mockImplementation(async ({ data }) => ({ id: 'u1', email: 'victim@gmail.com', ...data }));

    await request(app).post('/auth/google').send({ idToken: 'google-id-token-value' });

    expect(mockPrisma.user.update.mock.calls[0][0].data).not.toHaveProperty('password');
  });

  test('agency: tasdiqlanmagan akkaunt parol hash’i almashtiriladi', async () => {
    mockPrisma.agencyAccount.findFirst.mockResolvedValue({
      id: 'a1', email: 'victim@gmail.com', passwordHash, emailVerified: false, status: 'pending',
    });
    mockPrisma.agencyAccount.update.mockImplementation(async ({ data }) => ({ id: 'a1', email: 'victim@gmail.com', status: 'pending', ...data, tokenVersion: 1 }));

    const res = await request(app).post('/agency/auth/google').send({ idToken: 'google-id-token-value' });

    expect(res.status).toBe(200);
    const data = mockPrisma.agencyAccount.update.mock.calls[0][0].data;
    expect(data.passwordHash).toEqual(expect.any(String));
    expect(await bcrypt.compare('correct-password', data.passwordHash)).toBe(false);
    expect(data.tokenVersion).toEqual({ increment: 1 });
  });

  test('client ID sozlanmagan bo‘lsa Google login 503 (audience tekshiruvi o‘tkazib yuborilmaydi)', async () => {
    delete process.env.GOOGLE_CLIENT_IDS;
    const userRes = await request(app).post('/auth/google').send({ idToken: 'google-id-token-value' });
    const agencyRes = await request(app).post('/agency/auth/google').send({ idToken: 'google-id-token-value' });
    expect(userRes.status).toBe(503);
    expect(agencyRes.status).toBe(503);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('boshqa client uchun chiqarilgan token rad etiladi', async () => {
    axios.get.mockResolvedValue({ data: { aud: 'other-app', sub: 'g', email: 'x@gmail.com', email_verified: true } });
    const res = await request(app).post('/auth/google').send({ idToken: 'google-id-token-value' });
    expect(res.status).toBe(401);
    expect(res.body.allowedAudiences).toBeUndefined();
  });
});

describe('Email almashtirish: kod YANGI manzilga', () => {
  test('user: kod yangi emailga yuboriladi', async () => {
    const user = { id: 'u1', email: 'old@x.uz', password: passwordHash, name: 'U', emailChangeResendCount: 0, blocked: false, tokenVersion: 0 };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue(user);
    const token = signToken({ id: 'u1', email: 'old@x.uz' });

    const res = await request(app)
      .post('/auth/email-change/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new@x.uz', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(emailService.sendEmailChangeCodeEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@x.uz' }));
    expect(res.body.data.codeSentTo).toBe('new@x.uz');
  });

  test('user: parolsiz (Google) akkaunt eski token bilan emailni almashtira olmaydi', async () => {
    const user = { id: 'u1', email: 'old@x.uz', password: null, name: 'U', emailChangeResendCount: 0, blocked: false, tokenVersion: 0 };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const jwt = require('jsonwebtoken');
    const { getSecret } = require('../src/config/env');
    const oldToken = jwt.sign(
      { id: 'u1', typ: 'user', iat: Math.floor(Date.now() / 1000) - 3600 },
      getSecret('JWT_SECRET'),
      { audience: 'travelorai:user', expiresIn: '7d' }
    );

    const res = await request(app)
      .post('/auth/email-change/request')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ newEmail: 'new@x.uz' });

    expect(res.status).toBe(401);
    expect(res.body.requiresReauth).toBe(true);
    expect(emailService.sendEmailChangeCodeEmail).not.toHaveBeenCalled();
  });

  test('agency: joriy parolsiz so‘rov rad etiladi, parol bilan kod yangi emailga ketadi', async () => {
    const account = { id: 'a1', email: 'old@ag.uz', passwordHash, status: 'approved', tokenVersion: 0, pendingEmail: null };
    mockPrisma.agencyAccount.findUnique.mockResolvedValue(account);
    mockPrisma.agencyAccount.findFirst.mockResolvedValue(null);
    mockPrisma.agencyAccount.update.mockResolvedValue({ ...account, pendingEmail: 'new@ag.uz' });
    mockPrisma.agencyAuthCode.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.agencyAuthCode.create.mockResolvedValue({});
    const token = signAgencyToken({ id: 'a1', email: 'old@ag.uz' });

    const denied = await request(app)
      .post('/agency/auth/email-change/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new@ag.uz' });
    expect(denied.status).toBe(401);

    const ok = await request(app)
      .post('/agency/auth/email-change/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new@ag.uz', password: 'correct-password' });
    expect(ok.status).toBe(200);
    await new Promise((resolve) => setImmediate(resolve)); // email fonda yuboriladi
    expect(emailService.sendEmailChangeCodeEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@ag.uz' }));
  });
});

describe('Agency changePassword', () => {
  const base = { id: 'a1', email: 'ag@x.uz', status: 'approved', tokenVersion: 0 };

  test('joriy parolsiz rad etiladi', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ ...base, passwordHash, mustChangePassword: false });
    const token = signAgencyToken({ id: 'a1', email: 'ag@x.uz' });

    const res = await request(app)
      .post('/agency/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'brand-new-pass' });

    expect(res.status).toBe(401);
    expect(mockPrisma.agencyAccount.update).not.toHaveBeenCalled();
  });

  test('to‘g‘ri joriy parol bilan almashtiriladi va tokenVersion oshadi', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ ...base, passwordHash, mustChangePassword: false });
    mockPrisma.agencyAccount.update.mockResolvedValue({ ...base, tokenVersion: 1 });
    const token = signAgencyToken({ id: 'a1', email: 'ag@x.uz' });

    const res = await request(app)
      .post('/agency/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct-password', newPassword: 'brand-new-pass' });

    expect(res.status).toBe(200);
    expect(mockPrisma.agencyAccount.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  test('vaqtinchalik parol (mustChangePassword) bosqichida joriy parol so‘ralmaydi', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ ...base, passwordHash, mustChangePassword: true });
    mockPrisma.agencyAccount.update.mockResolvedValue({ ...base });
    const token = signAgencyToken({ id: 'a1', email: 'ag@x.uz' });

    const res = await request(app)
      .post('/agency/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'brand-new-pass' });

    expect(res.status).toBe(200);
  });
});
