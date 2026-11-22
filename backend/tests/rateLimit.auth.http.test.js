// Auth endpointlari uchun alohida limitlar (IP + email va faqat IP), user va agency.
const mockPrisma = {
  user: { findUnique: jest.fn() },
  agencyAccount: { findUnique: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', require('../src/routes/auth.routes'));
  app.use('/agency', require('../src/routes/agency.routes'));
  return app;
}

// Limiterlar modul darajasida (xotirada) — testlar bir-biriga ta'sir qilmasligi
// uchun har testda boshqa email ishlatiladi.
const app = buildApp();
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.agencyAccount.findUnique.mockResolvedValue(null);
});

async function hit(path, body, times) {
  const statuses = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await request(app).post(path).send(body)).status);
  }
  return statuses;
}

test('user login: bitta email uchun 10 urinishdan keyin 429', async () => {
  const statuses = await hit('/auth/login', { email: 'Victim@X.uz ', password: 'x' }, 11);
  expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
  expect(statuses[10]).toBe(429);

  // Boshqa email (normalizatsiyadan keyin farqli) alohida hisoblanadi.
  const other = await request(app).post('/auth/login').send({ email: 'other@x.uz', password: 'x' });
  expect(other.status).toBe(401);
});

test('user login: email katta-kichik harf/probel bilan aylanib o‘tib bo‘lmaydi', async () => {
  await hit('/auth/login', { email: 'victim2@x.uz', password: 'x' }, 10);
  const res = await request(app).post('/auth/login').send({ email: '  VICTIM2@x.uz', password: 'x' });
  expect(res.status).toBe(429);
});

test('user verify-email: 10 urinishdan keyin 429', async () => {
  const statuses = await hit('/auth/verify-email', { email: 'a@x.uz', code: '123456' }, 11);
  expect(statuses[10]).toBe(429);
});

test('user forgot-password: 3 so‘rovdan keyin 429', async () => {
  const statuses = await hit('/auth/forgot-password', { email: 'a@x.uz' }, 4);
  expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
  expect(statuses[3]).toBe(429);
});

test('user register: 5 so‘rovdan keyin 429', async () => {
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'u', email: 'a@x.uz', password: 'h', emailVerified: true });
  const statuses = await hit('/auth/register', { name: 'Ali', email: 'a@x.uz', password: 'password1' }, 6);
  expect(statuses[5]).toBe(429);
});

test('agency login: 10 urinishdan keyin 429 (user limitidan alohida)', async () => {
  const statuses = await hit('/agency/auth/login', { email: 'ag@x.uz', password: 'x' }, 11);
  expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
  expect(statuses[10]).toBe(429);

  const userRes = await request(app).post('/auth/login').send({ email: 'ag@x.uz', password: 'x' });
  expect(userRes.status).toBe(401);
});

test('agency reset-password: 10 urinishdan keyin 429', async () => {
  const statuses = await hit('/agency/auth/reset-password', { email: 'ag@x.uz', code: '123456', newPassword: 'password12' }, 11);
  expect(statuses[10]).toBe(429);
});
