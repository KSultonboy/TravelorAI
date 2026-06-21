const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-long-enough';
process.env.AGENCY_JWT_SECRET = 'test-agency-secret-long-enough';
process.env.ADMIN_SECRET_KEY = 'test-admin-secret-long-enough';

jest.mock('../src/config/database', () => ({
  prisma: {
    landingInteraction: {
      create: jest.fn().mockResolvedValue({ id: 'interaction-1' }),
    },
  },
}));

const app = require('../app');
const { prisma } = require('../src/config/database');

describe('security boundaries', () => {
  test('rejects unauthenticated POI writes', async () => {
    const response = await request(app)
      .post('/api/v1/poi')
      .send({ name: 'Unauthorized place' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('rejects booking history lookup without a bearer token', async () => {
    const response = await request(app)
      .get('/api/v1/bookings/mine')
      .query({ email: 'victim@example.com' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('does not trust a client-supplied interaction userId', async () => {
    const response = await request(app)
      .post('/api/v1/home/interactions')
      .send({
        entityType: 'place',
        entityId: 'place-1',
        eventType: 'view',
        userId: 'spoofed-user',
      });

    expect(response.status).toBe(200);
    expect(prisma.landingInteraction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null }),
    });
  });

  test('uses the authenticated identity for interactions', async () => {
    const token = jwt.sign({ id: 'real-user' }, process.env.JWT_SECRET);
    const response = await request(app)
      .post('/api/v1/home/interactions')
      .set('authorization', `Bearer ${token}`)
      .send({
        entityType: 'place',
        entityId: 'place-1',
        eventType: 'view',
        userId: 'spoofed-user',
      });

    expect(response.status).toBe(200);
    expect(prisma.landingInteraction.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ userId: 'real-user' }),
    });
  });
});
