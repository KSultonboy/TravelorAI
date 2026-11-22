// JWT: HS256 pinning, user/agency realm ajratilishi, eski tokenlar, tokenVersion
// bekor qilish va admin kalitini timing-safe taqqoslash.
const mockPrisma = {
  user: { findUnique: jest.fn() },
  agencyAccount: { findUnique: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { signToken, verifyToken } = require('../src/utils/jwt');
const { signAgencyToken, verifyAgencyToken } = require('../src/utils/agencyJwt');
const { authMiddleware } = require('../src/middleware/auth.middleware');
const { agencyAuthMiddleware } = require('../src/middleware/agencyAuth.middleware');
const { adminAuthMiddleware, safeEqual } = require('../src/middleware/adminAuth.middleware');
const { getSecret } = require('../src/config/env');

function buildApp() {
  const app = express();
  app.get('/user', authMiddleware, (req, res) => res.json({ id: req.user.id }));
  app.get('/agency', agencyAuthMiddleware, (req, res) => res.json({ id: req.agencyAccount.id }));
  app.get('/admin', adminAuthMiddleware, (req, res) => res.json({ ok: true }));
  return app;
}
const app = buildApp();

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  delete process.env.AGENCY_JWT_SECRET;
  delete process.env.AUTH_ACCEPT_LEGACY_TOKENS;
});

describe('realm ajratilishi', () => {
  test('user tokeni agency realmida qabul qilinmaydi (sirlar bir xil bo‘lsa ham)', () => {
    process.env.AGENCY_JWT_SECRET = getSecret('JWT_SECRET');
    const userToken = signToken({ id: 'u1', email: 'a@x.uz' });
    expect(verifyAgencyToken(userToken)).toBeNull();
  });

  test('agency tokeni user realmida qabul qilinmaydi (sirlar bir xil bo‘lsa ham)', () => {
    process.env.AGENCY_JWT_SECRET = getSecret('JWT_SECRET');
    const agencyToken = signAgencyToken({ id: 'a1', email: 'a@x.uz' });
    expect(verifyToken(agencyToken)).toBeNull();
  });

  test('eski claim’siz user tokeni o‘tish davrida qabul qilinadi, lekin agency realmida emas', () => {
    process.env.AGENCY_JWT_SECRET = getSecret('JWT_SECRET');
    const legacy = jwt.sign({ id: 'u1', email: 'a@x.uz' }, getSecret('JWT_SECRET'), { expiresIn: '7d' });
    expect(verifyToken(legacy)).toMatchObject({ id: 'u1' });
    expect(verifyAgencyToken(legacy)).toBeNull();
  });

  test('eski agency tokeni (role: agency) qabul qilinadi; AUTH_ACCEPT_LEGACY_TOKENS=false bo‘lsa yo‘q', () => {
    const legacy = jwt.sign({ id: 'a1', role: 'agency' }, getSecret('AGENCY_JWT_SECRET'), { expiresIn: '7d' });
    expect(verifyAgencyToken(legacy)).toMatchObject({ id: 'a1' });
    process.env.AUTH_ACCEPT_LEGACY_TOKENS = 'false';
    expect(verifyAgencyToken(legacy)).toBeNull();
  });
});

describe('algoritm pinning', () => {
  test('HS512 bilan imzolangan token rad etiladi', () => {
    const t = jwt.sign({ id: 'u1', typ: 'user' }, getSecret('JWT_SECRET'), { algorithm: 'HS512', audience: 'travelorai:user' });
    expect(verifyToken(t)).toBeNull();
  });

  test('alg=none token rad etiladi', () => {
    const t = jwt.sign({ id: 'u1', typ: 'user', aud: 'travelorai:user' }, null, { algorithm: 'none' });
    expect(verifyToken(t)).toBeNull();
  });

  test('yangi tokenlar HS256 + aud + typ bilan', () => {
    const decoded = jwt.decode(signToken({ id: 'u1' }), { complete: true });
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload).toMatchObject({ aud: 'travelorai:user', typ: 'user' });
  });
});

describe('tokenVersion bekor qilish (HTTP)', () => {
  test('user: tokenVersion oshgandan keyin eski token 401', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', blocked: false, tokenVersion: 1 });
    const stale = signToken({ id: 'u1', tv: 0 });
    const fresh = signToken({ id: 'u1', tv: 1 });

    expect((await request(app).get('/user').set('Authorization', `Bearer ${stale}`)).status).toBe(401);
    expect((await request(app).get('/user').set('Authorization', `Bearer ${fresh}`)).status).toBe(200);
  });

  test('user: bloklangan foydalanuvchi tokeni 403', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', blocked: true, tokenVersion: 0 });
    const res = await request(app).get('/user').set('Authorization', `Bearer ${signToken({ id: 'u1' })}`);
    expect(res.status).toBe(403);
  });

  test('agency: tokenVersion mos kelmasa 401', async () => {
    mockPrisma.agencyAccount.findUnique.mockResolvedValue({ id: 'a1', status: 'approved', tokenVersion: 2 });
    const res = await request(app).get('/agency').set('Authorization', `Bearer ${signAgencyToken({ id: 'a1', tv: 1 })}`);
    expect(res.status).toBe(401);
  });

  test('agency: DB xatosi jarayonni qulatmaydi — 503', async () => {
    mockPrisma.agencyAccount.findUnique.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/agency').set('Authorization', `Bearer ${signAgencyToken({ id: 'a1' })}`);
    expect(res.status).toBe(503);
  });

  test('user: DB xatosi — 503', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/user').set('Authorization', `Bearer ${signToken({ id: 'u1' })}`);
    expect(res.status).toBe(503);
  });
});

describe('admin kaliti', () => {
  test('safeEqual uzunligi farq qiluvchi qiymatlarda xato bermaydi', () => {
    expect(safeEqual('a', 'abcdef')).toBe(false);
    expect(safeEqual('same-key', 'same-key')).toBe(true);
  });

  test('noto‘g‘ri / yo‘q kalit 403, to‘g‘ri kalit 200', async () => {
    expect((await request(app).get('/admin')).status).toBe(403);
    expect((await request(app).get('/admin').set('x-admin-key', 'x')).status).toBe(403);
    const ok = await request(app).get('/admin').set('x-admin-key', getSecret('ADMIN_SECRET_KEY'));
    expect(ok.status).toBe(200);
  });
});
