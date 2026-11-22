// ProductEvent track(): allowlist, PII tozalash, hajm cheklovi va "hech qachon throw qilmaydi".
const mockPrisma = {
  productEvent: { create: jest.fn(), findFirst: jest.fn() },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));
jest.mock('../src/config/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const events = require('../src/services/productEvents.service');

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.productEvent.create.mockResolvedValue({ id: 'e1' });
  mockPrisma.productEvent.findFirst.mockResolvedValue(null);
});

const createdData = () => mockPrisma.productEvent.create.mock.calls[0][0].data;

describe('track — allowlist va PII', () => {
  test('ruxsat etilmagan props kalitlari tashlanadi', async () => {
    const ok = await events.track('lead_created', {
      agencyId: 'ag1',
      userId: 'acc1',
      props: { source: 'telegram', customerName: 'Ali Valiyev', email: 'a@b.uz', phone: '+998901234567' },
    });
    expect(ok).toBe(true);
    expect(createdData()).toEqual({ name: 'lead_created', agencyId: 'ag1', userId: 'acc1', props: { source: 'telegram' } });
  });

  test('ruxsat etilgan kalitdagi email/telefonga o‘xshash qiymat ham yozilmaydi', async () => {
    await events.track('landing_view', {
      props: { utm_source: 'someone@mail.uz', utm_medium: '+998 90 123 45 67', utm_campaign: 'spring', path: '/' },
    });
    expect(createdData().props).toEqual({ utm_campaign: 'spring', path: '/' });
  });

  test('obyekt/massiv qiymatlar va bo‘sh props yozilmaydi', async () => {
    await events.track('checkout_started', { agencyId: 'ag1', props: { plan: { nested: true }, months: [1] } });
    expect(createdData().props).toBeUndefined();
  });

  test('props bo‘lmaydigan hodisada hamma narsa tashlanadi', async () => {
    await events.track('agency_approved', { agencyId: 'ag1', props: { note: 'x' } });
    expect(createdData().props).toBeUndefined();
  });

  test('noma’lum hodisa yozilmaydi', async () => {
    await expect(events.track('totally_unknown', { agencyId: 'ag1' })).resolves.toBe(false);
    expect(mockPrisma.productEvent.create).not.toHaveBeenCalled();
  });

  test('props 2 KB dan oshmaydi', () => {
    const big = 'x'.repeat(120);
    const props = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'path', 'referrer_host'].map((k) => [k, big]));
    const clean = events.sanitizeProps('landing_view', props);
    expect(Buffer.byteLength(JSON.stringify(clean), 'utf8')).toBeLessThanOrEqual(events.MAX_PROPS_BYTES);
    // Har bir satr 120 belgigacha qisqartiriladi.
    expect(events.sanitizeProps('landing_view', { path: 'y'.repeat(5000) }).path).toHaveLength(120);
  });
});

describe('track — hech qachon throw qilmaydi', () => {
  test('DB xatosi false qaytaradi', async () => {
    mockPrisma.productEvent.create.mockRejectedValue(new Error('relation "ProductEvent" does not exist'));
    await expect(events.track('offer_sent', { agencyId: 'ag1' })).resolves.toBe(false);
  });

  test('sinxron xato ham ushlanadi', async () => {
    mockPrisma.productEvent.create.mockImplementation(() => { throw new Error('boom'); });
    await expect(events.track('offer_sent', { agencyId: 'ag1' })).resolves.toBe(false);
  });

  test('g‘alati argumentlar bilan ham yiqilmaydi', async () => {
    expect(() => events.track()).not.toThrow();
    expect(() => events.track('lead_created', null)).not.toThrow();
    await expect(events.track('lead_created', { props: 'not-an-object' })).resolves.toBe(true);
  });

  test('model yo‘q (eski client) — jimgina false', async () => {
    const saved = mockPrisma.productEvent;
    delete mockPrisma.productEvent;
    try {
      await expect(events.track('offer_sent', { agencyId: 'ag1' })).resolves.toBe(false);
      await expect(events.trackOnce('first_tour_published', { agencyId: 'ag1' })).resolves.toBe(false);
    } finally {
      mockPrisma.productEvent = saved;
    }
  });
});

describe('trackOnce va yordamchilar', () => {
  test('birinchi marta yoziladi, keyin yo‘q', async () => {
    await expect(events.trackOnce('first_tour_published', { agencyId: 'ag1', props: { via: 'agency' } })).resolves.toBe(true);
    mockPrisma.productEvent.findFirst.mockResolvedValue({ id: 'old' });
    await expect(events.trackOnce('first_tour_published', { agencyId: 'ag1' })).resolves.toBe(false);
    expect(mockPrisma.productEvent.create).toHaveBeenCalledTimes(1);
  });

  test('trackOnce findFirst xatosida ham throw qilmaydi', async () => {
    mockPrisma.productEvent.findFirst.mockRejectedValue(new Error('db down'));
    await expect(events.trackOnce('first_tour_published', { agencyId: 'ag1' })).resolves.toBe(false);
  });

  test('amountBucket aniq summani yashiradi', () => {
    expect(events.amountBucket(null)).toBe('none');
    expect(events.amountBucket(0)).toBe('none');
    expect(events.amountBucket(450)).toBe('1-999');
    expect(events.amountBucket(1500)).toBe('1k-10k');
    expect(events.amountBucket(12_000_000)).toBe('10m+');
  });

  test('trackLeadWon faqat oraliq va valyutani yozadi', async () => {
    await events.trackLeadWon({ agencyId: 'ag1', totalEstimate: 2400, currency: 'USD', customerName: 'Ali' }, { userId: 'acc1' });
    expect(createdData()).toEqual({ name: 'lead_won', agencyId: 'ag1', userId: 'acc1', props: { amount_bucket: '1k-10k', currency: 'USD' } });
  });
});
