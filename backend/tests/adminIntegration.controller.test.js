describe('admin API-only integration provisioning', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('tenant va kalit yaratadi, lekin CRM account/kabinet yaratmaydi', async () => {
    const prisma = {
      tourAgency: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'agency-api-1', name: 'External Travel', accessMode: 'api_only' }),
        delete: jest.fn(),
      },
    };
    const createApiKey = jest.fn().mockResolvedValue({ apiKey: { id: 'key-1' }, rawKey: 'tai_live_secret' });
    jest.doMock('../src/config/database', () => ({ prisma }));
    jest.doMock('../src/services/publicApiKey.service', () => ({
      API_SCOPES: ['leads:read', 'leads:write'],
      normalizeScopes: (items) => items.filter((item) => ['leads:read', 'leads:write'].includes(item)),
      createApiKey,
    }));
    jest.doMock('../src/services/webhookDelivery.service', () => ({
      WEBHOOK_EVENTS: ['webhook.test'],
      createWebhookEndpoint: jest.fn(), enqueueWebhookEvent: jest.fn(),
      runWebhookDeliveryWorker: jest.fn(), retryWebhookDelivery: jest.fn(),
    }));

    const controller = require('../src/controllers/adminIntegration.controller');
    const req = { body: { name: 'External Travel', city: 'Toshkent', scopes: ['leads:read'] } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await controller.create(req, res);

    expect(prisma.tourAgency.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      accessMode: 'api_only', ownerAccountId: null, subscriptionStatus: 'active',
    }) }));
    expect(createApiKey).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'agency-api-1', scopes: ['leads:read'] }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ cabinetCreated: false, rawKey: 'tai_live_secret' }) }));
    expect(prisma).not.toHaveProperty('agencyAccount');
  });
});
