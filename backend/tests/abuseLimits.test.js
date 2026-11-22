// Suiiste'mol cheklovlari: landing reyting hodisalari, Yandex proksi limiti va
// kesh, AI kunlik limiti / timeout, planner hajmi, bulutli OCR roziligi.
const mockPrisma = {
  landingInteraction: { create: jest.fn(async () => ({})) },
  tourAgency: { findFirst: jest.fn(async () => ({ id: 'ag1' })) },
  travelerStory: { findFirst: jest.fn(async () => ({ id: 's1' })) },
  poi: { findUnique: jest.fn(async () => ({ id: 'p1' })) },
  leadFile: { findFirst: jest.fn(), update: jest.fn(async () => ({})) },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');

beforeEach(() => jest.clearAllMocks());

describe('POST /home/interactions', () => {
  const home = require('../src/controllers/home.controller');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/home', require('../src/routes/home.routes'));
  beforeEach(() => home.resetInteractionLimiters());

  test('noma’lum tur yoki hodisa 400', async () => {
    const bad = await request(app).post('/home/interactions').send({ entityType: 'user', entityId: 'x1', eventType: 'click' });
    expect(bad.status).toBe(400);
    const badEvent = await request(app).post('/home/interactions').send({ entityType: 'agency', entityId: 'x1', eventType: 'super_boost' });
    expect(badEvent.status).toBe(400);
    expect(mockPrisma.landingInteraction.create).not.toHaveBeenCalled();
  });

  test('noto‘g‘ri entityId va katta metadata 400', async () => {
    const badId = await request(app).post('/home/interactions').send({ entityType: 'agency', entityId: '../../x', eventType: 'click' });
    expect(badId.status).toBe(400);
    const big = await request(app).post('/home/interactions').send({ entityType: 'agency', entityId: 'ag1', eventType: 'click', metadata: { blob: 'x'.repeat(5000) } });
    expect(big.status).toBe(400);
    expect(mockPrisma.landingInteraction.create).not.toHaveBeenCalled();
  });

  test('bir IP bir nishonni cheksiz ko‘tara olmaydi', async () => {
    const body = { entityType: 'agency', entityId: 'ag1', eventType: 'trip_add' };
    const results = [];
    for (let i = 0; i < 8; i += 1) results.push((await request(app).post('/home/interactions').send(body)).body.data);
    expect(results.filter((r) => r.stored === true)).toHaveLength(5);
    expect(results.at(-1)).toEqual(expect.objectContaining({ stored: false, throttled: true }));
    expect(mockPrisma.landingInteraction.create).toHaveBeenCalledTimes(5);
  });

  test('mavjud bo‘lmagan nishon saqlanmaydi', async () => {
    mockPrisma.tourAgency.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post('/home/interactions').send({ entityType: 'agency', entityId: 'ghost', eventType: 'click' });
    expect(res.status).toBe(202);
    expect(res.body.data.stored).toBe(false);
    expect(mockPrisma.landingInteraction.create).not.toHaveBeenCalled();
  });
});

describe('Yandex proksi', () => {
  test('per-IP limiter oshganda 429', async () => {
    const { createYandexProxyLimiter } = require('../src/middleware/yandexProxyLimit.middleware');
    const app = express();
    app.get('/y', createYandexProxyLimiter({ max: 2, windowMs: 60000 }), (req, res) => res.json({ ok: true }));
    expect((await request(app).get('/y')).status).toBe(200);
    expect((await request(app).get('/y')).status).toBe(200);
    const third = await request(app).get('/y');
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
  });

  test('LRU kesh va bir xil so‘rovlarni birlashtirish', async () => {
    const { createCachedFetcher, TtlLruCache } = require('../src/services/memoryCache.service');
    const run = createCachedFetcher({ max: 2, ttlMs: 60000 });
    const loader = jest.fn(async () => ({ items: [1] }));
    await Promise.all([run('a', loader), run('a', loader)]);
    await run('a', loader);
    expect(loader).toHaveBeenCalledTimes(1);

    const lru = new TtlLruCache({ max: 2, ttlMs: 60000 });
    lru.set('x', 1); lru.set('y', 2); lru.get('x'); lru.set('z', 3);
    expect(lru.has('y')).toBe(false);
    expect(lru.has('x')).toBe(true);
  });

  test('suggest kaliti koordinatani yaxlitlaydi', () => {
    const { cacheKeyFor } = require('../src/services/yandexPlaces.service');
    expect(cacheKeyFor('reverse', { lat: '41.3110811', lng: 69.27970001 }))
      .toBe(cacheKeyFor('reverse', { lat: 41.31108, lng: '69.2797' }));
  });
});

describe('AI xizmati', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL };
    jest.resetModules();
  });

  test('standart model claude-haiku-5-5, timeout 20s, maxRetries 1', () => {
    jest.isolateModules(() => {
      delete process.env.ANTHROPIC_MODEL;
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const ai = require('../src/services/ai.service');
      expect(ai.MODEL).toBe('claude-haiku-5-5');
      const client = ai._getClient();
      expect(client.timeout).toBe(20000);
      expect(client.maxRetries).toBe(1);
    });
  });

  test('ANTHROPIC_MODEL env bilan almashtiriladi', () => {
    jest.isolateModules(() => {
      process.env.ANTHROPIC_MODEL = 'claude-opus-5-5';
      expect(require('../src/services/ai.service').MODEL).toBe('claude-opus-5-5');
    });
  });

  test('agentlik kunlik limiti (AI_DAILY_LIMIT_PER_AGENCY)', () => {
    jest.isolateModules(() => {
      process.env.AI_DAILY_LIMIT_PER_AGENCY = '2';
      const ai = require('../src/services/ai.service');
      ai.consumeAgencyQuota('ag1');
      ai.consumeAgencyQuota('ag1');
      expect(() => ai.consumeAgencyQuota('ag1')).toThrow(expect.objectContaining({ code: 'AI_QUOTA_EXCEEDED' }));
      expect(() => ai.consumeAgencyQuota('ag2')).not.toThrow();
      expect(ai.getAgencyUsage('ag1')).toEqual({ used: 2, limit: 2, remaining: 0 });
    });
  });

  test('limit standart 50', () => {
    jest.isolateModules(() => {
      delete process.env.AI_DAILY_LIMIT_PER_AGENCY;
      expect(require('../src/services/ai.service').getAgencyUsage('x').limit).toBe(50);
    });
  });
});

describe('planner', () => {
  test('poiContext va analysisContext hajmi cheklangan', () => {
    const { plannerSchema } = require('../src/schemas/planner.schema');
    const base = { budget: 1000000, duration: 3, travelers: 2, style: 'mid', interests: ['tarix'] };
    expect(plannerSchema.safeParse(base).success).toBe(true);
    const manyPois = Array.from({ length: 201 }, (_, i) => ({ name: `Joy ${i}` }));
    expect(plannerSchema.safeParse({ ...base, poiContext: manyPois }).success).toBe(false);
    expect(plannerSchema.safeParse({ ...base, analysisContext: { blob: 'x'.repeat(9000) } }).success).toBe(false);
    expect(plannerSchema.safeParse({ ...base, analysisContext: { estimatedTripCost: 900000 } }).success).toBe(true);
  });

  test('generatedFrom gemini_refinement’ni faqat Gemini ishlaganda ko‘rsatadi', async () => {
    jest.resetModules();
    const refine = jest.fn();
    jest.doMock('../src/services/geminiPlanner.service', () => ({ refineTripPlanWithGemini: refine }));
    jest.doMock('../src/config/database', () => ({
      prisma: {
        destination: { findMany: jest.fn(async () => []) },
        poi: { findMany: jest.fn(async () => []) },
        transportRoute: { findMany: jest.fn(async () => []) },
      },
    }));
    const { generateTripPlan } = require('../src/services/planner.service');
    const input = { budget: 2000000, duration: 2, travelers: 1, style: 'mid', interests: ['tarix'], city: 'Samarqand', departureCity: 'toshkent' };

    refine.mockResolvedValueOnce(null);
    const plain = await generateTripPlan(input);
    expect(plain.sourceSummary.generatedFrom).not.toContain('gemini_refinement');

    refine.mockImplementationOnce(async ({ basePlan }) => ({ ...basePlan, title: 'Yaxshilangan' }));
    const refined = await generateTripPlan(input);
    expect(refined.sourceSummary.generatedFrom).toContain('gemini_refinement');
    jest.dontMock('../src/services/geminiPlanner.service');
    jest.dontMock('../src/config/database');
  });
});

describe('pasport OCR', () => {
  const ORIGINAL = process.env.ALLOW_CLOUD_OCR;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ALLOW_CLOUD_OCR; else process.env.ALLOW_CLOUD_OCR = ORIGINAL;
    jest.resetModules();
  });

  test('mahalliy OCR ishlamasa, rozilik yo‘q bo‘lsa skan Anthropic’ka yuborilmaydi', async () => {
    jest.resetModules();
    const generateVision = jest.fn();
    jest.doMock('../src/services/ai.service', () => ({ generateVision, isConfigured: () => true }));
    jest.doMock('../src/services/passportOcr.service', () => ({
      extractPassportLocal: jest.fn(async () => { throw Object.assign(new Error('MRZ topilmadi'), { code: 'MRZ_NOT_FOUND' }); }),
    }));
    const prisma = {
      leadFile: {
        findFirst: jest.fn(async () => ({ id: 'f1', mimeType: 'image/jpeg', data: Buffer.from('img') })),
        update: jest.fn(async () => ({})),
      },
    };
    jest.doMock('../src/config/database', () => ({ prisma }));
    delete process.env.ALLOW_CLOUD_OCR;
    const leadFiles = require('../src/controllers/leadFiles.controller');
    expect(leadFiles.isCloudOcrAllowed()).toBe(false);

    const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
    const req = {
      params: { id: 'f1' },
      agencyAccount: { id: 'acc', status: 'approved' },
      agency: { id: 'ag1', active: true, approvalStatus: 'approved' },
    };
    await leadFiles.ocrPassport(req, res);

    expect(generateVision).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.leadFile.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ ocrStatus: 'failed' }) }));

    process.env.ALLOW_CLOUD_OCR = 'true';
    expect(leadFiles.isCloudOcrAllowed()).toBe(true);
    jest.dontMock('../src/services/ai.service');
    jest.dontMock('../src/services/passportOcr.service');
    jest.dontMock('../src/config/database');
  });
});
