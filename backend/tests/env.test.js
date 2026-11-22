// Fail-closed konfiguratsiya: production'da zaif/yo'q sirlar bilan server ishga tushmaydi.
const env = require('../src/config/env');

const STRONG_A = 'a'.repeat(40);
const STRONG_B = 'b'.repeat(48);
const STRONG_C = 'c'.repeat(32);

const prodEnv = (overrides = {}) => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://x',
  JWT_SECRET: STRONG_A,
  AGENCY_JWT_SECRET: STRONG_B,
  ADMIN_SECRET_KEY: STRONG_C,
  GOOGLE_CLIENT_IDS: 'id.apps.googleusercontent.com',
  ...overrides,
});

describe('validateEnv (production)', () => {
  test('kuchli sirlar bilan o‘tadi', () => {
    expect(env.validateEnv(prodEnv())).toMatchObject({ ok: true, errors: [] });
  });

  test.each([
    ['yo‘q', { JWT_SECRET: undefined }],
    ['bo‘sh', { AGENCY_JWT_SECRET: '' }],
    ['qisqa', { ADMIN_SECRET_KEY: 'short-key' }],
    ['ma’lum standart', { ADMIN_SECRET_KEY: 'change_me' }],
    ['eski hard-coded', { JWT_SECRET: 'travelorai_secret' }],
    ['user == agency', { AGENCY_JWT_SECRET: STRONG_A }],
  ])('%s sir bilan xato', (_label, overrides) => {
    const result = env.validateEnv(prodEnv(overrides));
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('Google client ID yo‘q bo‘lsa ogohlantirish', () => {
    const result = env.validateEnv(prodEnv({ GOOGLE_CLIENT_IDS: '' }));
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/Google/);
  });
});

describe('validateEnv (development)', () => {
  test('sirlar yo‘q bo‘lsa xato emas, faqat ogohlantirish', () => {
    const result = env.validateEnv({ NODE_ENV: 'development' });
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBe(3);
  });
});

describe('bootstrapEnv', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  test('production’da zaif sir bilan exit(1) chaqiriladi', () => {
    process.env = { ...saved, ...prodEnv({ JWT_SECRET: 'change_me' }) };
    const exit = jest.fn();
    const log = { warn: jest.fn(), error: jest.fn() };
    env.bootstrapEnv({ exit, log });
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.error.mock.calls[0][0]).toMatch(/JWT_SECRET/);
    // Sirning qiymati logga chiqmaydi.
    expect(log.error.mock.calls[0][0]).not.toMatch(/change_me/);
  });

  test('development’da dev-zaxiralar qo‘yiladi, exit yo‘q', () => {
    process.env = { ...saved, NODE_ENV: 'development' };
    delete process.env.JWT_SECRET;
    const exit = jest.fn();
    env.bootstrapEnv({ exit, log: { warn: jest.fn(), error: jest.fn() } });
    expect(exit).not.toHaveBeenCalled();
    expect(process.env.JWT_SECRET).toBe(env.DEV_FALLBACKS.JWT_SECRET);
  });
});

describe('getSecret', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  test('production’da zaxiraga tushmaydi — xato tashlaydi', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => env.getSecret('JWT_SECRET')).toThrow(/production/);
    process.env.JWT_SECRET = 'travelorai_secret';
    expect(() => env.getSecret('JWT_SECRET')).toThrow();
  });

  test('test/dev’da dev-zaxira qaytaradi', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.AGENCY_JWT_SECRET;
    expect(env.getSecret('AGENCY_JWT_SECRET')).toBe(env.DEV_FALLBACKS.AGENCY_JWT_SECRET);
  });
});
