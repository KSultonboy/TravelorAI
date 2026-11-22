// GET /home/tours/:idOrSlug — bitta public tur; ro'yxat bilan bir xil shakl va filtr.
const AGENCY = { id: 'ag1', slug: 'demo', name: 'Demo', city: 'Toshkent', rating: 4.8, phone: '+998', telegram: null, website: null, imageUrl: null, active: true, approvalStatus: 'approved' };
const TOUR = {
  id: 'tour-id-1', slug: 'samarqand-2-kun', title: 'Samarqand', city: 'Samarqand', subtitle: 'Registon', description: 'Tavsif',
  duration: '2 kun', price: "1 250 000 so'm", priceMin: 1250000, priceCurrency: 'UZS', rating: 4.8, badge: 'Popular',
  highlights: ['Registon'], priceIncludes: [], priceExcludes: [], agencyId: 'ag1', agency: AGENCY, active: true, approvalStatus: 'approved',
};

const mockPrisma = {
  tour: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};
jest.mock('../src/config/database', () => ({ prisma: mockPrisma }));

const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());
app.use('/home', require('../src/routes/home.routes'));

const PUBLIC_FILTER = expect.objectContaining({
  active: true,
  approvalStatus: 'approved',
  agencyId: { not: null },
  AND: [{ agency: { is: { active: true, approvalStatus: 'approved' } } }],
});

beforeEach(() => jest.clearAllMocks());

test('slug bo‘yicha topadi va ro‘yxatdagi bilan bir xil shaklda qaytaradi', async () => {
  mockPrisma.tour.findFirst.mockResolvedValueOnce(TOUR);
  mockPrisma.tour.findMany.mockResolvedValueOnce([TOUR]);
  mockPrisma.tour.count.mockResolvedValueOnce(1);

  const one = await request(app).get('/home/tours/samarqand-2-kun');
  const list = await request(app).get('/home/tours');

  expect(one.status).toBe(200);
  expect(one.body.data).toEqual(list.body.data.items[0]);
  expect(mockPrisma.tour.findFirst).toHaveBeenCalledTimes(1);
  expect(mockPrisma.tour.findFirst.mock.calls[0][0].where.slug).toBe('samarqand-2-kun');
  expect(mockPrisma.tour.findFirst.mock.calls[0][0].where).toEqual(PUBLIC_FILTER);
});

test('slug topilmasa id bo‘yicha qidiradi (shu filtr bilan)', async () => {
  mockPrisma.tour.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(TOUR);

  const res = await request(app).get('/home/tours/tour-id-1');

  expect(res.status).toBe(200);
  expect(res.body.data.id).toBe('tour-id-1');
  expect(res.body.data.agency).toEqual(expect.objectContaining({ id: 'ag1', name: 'Demo' }));
  const second = mockPrisma.tour.findFirst.mock.calls[1][0].where;
  expect(second.id).toBe('tour-id-1');
  expect(second).toEqual(PUBLIC_FILTER);
});

test('topilmasa (yoki agentlik tasdiqlanmagan) — 404 o‘zbekcha xabar bilan', async () => {
  mockPrisma.tour.findFirst.mockResolvedValue(null);

  const res = await request(app).get('/home/tours/yoq-tur');

  expect(res.status).toBe(404);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/Tur topilmadi/);
});
