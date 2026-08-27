const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { API_SCOPES, createApiKey, normalizeScopes } = require('../services/publicApiKey.service');
const {
  WEBHOOK_EVENTS, createWebhookEndpoint, enqueueWebhookEvent,
  runWebhookDeliveryWorker, retryWebhookDelivery,
} = require('../services/webhookDelivery.service');

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[ʻ'\u2018\u2019\u02BB]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

async function uniqueSlug(name) {
  const base = slugify(name) || `api-hamkor-${Date.now()}`;
  let slug = base;
  let index = 1;
  while (await prisma.tourAgency.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${index++}`;
  return slug;
}

function safeEndpoint(endpoint) {
  if (!endpoint) return endpoint;
  const { secretEncrypted, ...safe } = endpoint;
  return safe;
}

const keySelect = {
  id: true, name: true, keyPrefix: true, scopes: true, rateLimitPerMinute: true,
  lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
};

async function list(req, res) {
  try {
    const agencies = await prisma.tourAgency.findMany({
      where: { accessMode: 'api_only' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, city: true, phone: true, website: true,
        active: true, accessMode: true, createdAt: true, updatedAt: true,
        publicApiKeys: { orderBy: { createdAt: 'desc' }, select: keySelect },
        webhookEndpoints: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { deliveries: true } } } },
      },
    });
    const agencyIds = agencies.map((item) => item.id);
    const deliveries = agencyIds.length ? await prisma.webhookDelivery.findMany({
      where: { endpoint: { agencyId: { in: agencyIds } } }, orderBy: { createdAt: 'desc' }, take: 200,
      include: {
        endpoint: { select: { id: true, name: true, agencyId: true } },
        event: { select: { id: true, type: true, entityType: true, entityId: true, createdAt: true } },
      },
    }) : [];
    return success(res, {
      items: agencies.map((agency) => ({
        ...agency,
        webhookEndpoints: agency.webhookEndpoints.map(safeEndpoint),
        deliveries: deliveries.filter((delivery) => delivery.endpoint.agencyId === agency.id),
      })),
      metadata: { scopes: API_SCOPES, events: WEBHOOK_EVENTS, publicBaseUrl: 'https://travelorai.com/api/v1/public' },
    });
  } catch (err) { return error(res, err.message, 500); }
}

async function create(req, res) {
  let agency = null;
  try {
    const name = String(req.body?.name || '').trim();
    const city = String(req.body?.city || '').trim();
    const keyName = String(req.body?.keyName || 'Asosiy CRM kaliti').trim();
    const scopes = normalizeScopes(req.body?.scopes);
    if (!name || !city) return error(res, 'Hamkor nomi va shahar majburiy', 400);
    if (!scopes.length) return error(res, 'Kamida bitta API huquqi tanlang', 400);

    agency = await prisma.tourAgency.create({
      data: {
        slug: await uniqueSlug(name), name, city,
        specialty: String(req.body?.specialty || 'Tashqi CRM integratsiyasi').trim(),
        description: req.body?.description ? String(req.body.description).trim() : null,
        phone: req.body?.phone ? String(req.body.phone).trim() : null,
        website: req.body?.website ? String(req.body.website).trim() : null,
        accessMode: 'api_only', ownerAccountId: null, active: true,
        source: 'admin_api_integration', approvalStatus: 'approved', approvedAt: new Date(),
        subscriptionStatus: 'active', lastVerifiedAt: new Date(), confidenceScore: 1,
      },
    });
    const created = await createApiKey({
      agencyId: agency.id, name: keyName, scopes,
      rateLimitPerMinute: req.body?.rateLimitPerMinute, expiresAt: req.body?.expiresAt,
    });
    let webhook = null;
    if (String(req.body?.webhookUrl || '').trim()) {
      webhook = await createWebhookEndpoint({
        agencyId: agency.id,
        name: String(req.body?.webhookName || 'Asosiy webhook').trim(),
        url: req.body.webhookUrl,
        events: req.body?.events,
        maxAttempts: req.body?.maxAttempts,
      });
    }
    return success(res, {
      agency,
      apiKey: created.apiKey,
      rawKey: created.rawKey,
      webhook: webhook ? { endpoint: safeEndpoint(webhook.endpoint), secret: webhook.secret } : null,
      shownOnce: true,
      cabinetCreated: false,
    }, 201);
  } catch (err) {
    // Bir martalik provisioning yarim holatda qolmasin.
    if (agency?.id) await prisma.tourAgency.delete({ where: { id: agency.id } }).catch(() => {});
    return error(res, err.message, 400);
  }
}

async function createKey(req, res) {
  try {
    const agency = await prisma.tourAgency.findFirst({ where: { id: req.params.agencyId, accessMode: 'api_only' } });
    if (!agency) return error(res, 'API-only hamkor topilmadi', 404);
    const name = String(req.body?.name || '').trim();
    if (!name) return error(res, 'Kalit nomi majburiy', 400);
    const created = await createApiKey({ agencyId: agency.id, name, scopes: req.body?.scopes, rateLimitPerMinute: req.body?.rateLimitPerMinute, expiresAt: req.body?.expiresAt });
    return success(res, { apiKey: created.apiKey, rawKey: created.rawKey, shownOnce: true }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function revokeKey(req, res) {
  try {
    const result = await prisma.publicApiKey.updateMany({
      where: { id: req.params.id, agencyId: req.params.agencyId, agency: { accessMode: 'api_only' }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) return error(res, 'Faol API kalit topilmadi', 404);
    return success(res, { revoked: true });
  } catch (err) { return error(res, err.message, 400); }
}

async function createEndpoint(req, res) {
  try {
    const agency = await prisma.tourAgency.findFirst({ where: { id: req.params.agencyId, accessMode: 'api_only' } });
    if (!agency) return error(res, 'API-only hamkor topilmadi', 404);
    const name = String(req.body?.name || '').trim();
    if (!name) return error(res, 'Webhook nomi majburiy', 400);
    const created = await createWebhookEndpoint({ agencyId: agency.id, name, url: req.body?.url, events: req.body?.events, maxAttempts: req.body?.maxAttempts });
    return success(res, { endpoint: safeEndpoint(created.endpoint), secret: created.secret, shownOnce: true }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function testEndpoint(req, res) {
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, agencyId: req.params.agencyId, agency: { accessMode: 'api_only' }, active: true } });
    if (!endpoint) return error(res, 'Faol webhook topilmadi', 404);
    const event = await enqueueWebhookEvent({ agencyId: endpoint.agencyId, type: 'webhook.test', entityType: 'webhook', entityId: endpoint.id, payload: { message: 'TravelorAI webhook test', sentAt: new Date().toISOString() } });
    const delivery = await prisma.webhookDelivery.findUnique({ where: { endpointId_eventId: { endpointId: endpoint.id, eventId: event.id } } });
    if (!delivery) return error(res, 'Webhook test hodisasiga obuna qilinmagan', 400);
    await runWebhookDeliveryWorker({ agencyId: endpoint.agencyId, deliveryId: delivery.id });
    return success(res, { delivery: await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } }) });
  } catch (err) { return error(res, err.message, 400); }
}

async function retryDelivery(req, res) {
  try {
    const agency = await prisma.tourAgency.findFirst({ where: { id: req.params.agencyId, accessMode: 'api_only' } });
    if (!agency) return error(res, 'API-only hamkor topilmadi', 404);
    const delivery = await retryWebhookDelivery(req.params.id, agency.id);
    await runWebhookDeliveryWorker({ agencyId: agency.id, deliveryId: delivery.id });
    return success(res, { delivery: await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } }) });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { list, create, createKey, revokeKey, createEndpoint, testEndpoint, retryDelivery };
