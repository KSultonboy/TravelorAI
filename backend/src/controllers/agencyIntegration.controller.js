const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { API_SCOPES, createApiKey, normalizeScopes } = require('../services/publicApiKey.service');
const {
  WEBHOOK_EVENTS, createWebhookEndpoint, rotateWebhookSecret, normalizeEvents,
  validateWebhookUrl, enqueueWebhookEvent, runWebhookDeliveryWorker, retryWebhookDelivery,
} = require('../services/webhookDelivery.service');

function publicEndpoint(endpoint) {
  const { secretEncrypted, ...safe } = endpoint;
  return safe;
}

async function list(req, res) {
  try {
    const agencyId = req.agency.id;
    const [apiKeys, endpoints, deliveries] = await Promise.all([
      prisma.publicApiKey.findMany({ where: { agencyId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimitPerMinute: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true } }),
      prisma.webhookEndpoint.findMany({ where: { agencyId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { deliveries: true } } } }),
      prisma.webhookDelivery.findMany({ where: { endpoint: { agencyId } }, orderBy: { createdAt: 'desc' }, take: 100, include: { endpoint: { select: { id: true, name: true } }, event: { select: { id: true, type: true, entityType: true, entityId: true, createdAt: true } } } }),
    ]);
    return success(res, { apiKeys, endpoints: endpoints.map(publicEndpoint), deliveries, metadata: { scopes: API_SCOPES, events: WEBHOOK_EVENTS, publicBaseUrl: 'https://travelorai.com/api/v1/public' } });
  } catch (err) { return error(res, err.message, 500); }
}

async function createKey(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return error(res, 'API kalit nomi talab qilinadi', 400);
    const scopes = normalizeScopes(req.body?.scopes);
    const expiresAt = req.body?.expiresAt || null;
    if (expiresAt && new Date(expiresAt) <= new Date()) return error(res, 'Kalit muddati kelajakda bo‘lishi kerak', 400);
    const created = await createApiKey({ agencyId: req.agency.id, name, scopes, rateLimitPerMinute: req.body?.rateLimitPerMinute, expiresAt, createdByAccountId: req.agencyAccount.id });
    return success(res, { apiKey: created.apiKey, rawKey: created.rawKey, shownOnce: true }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function revokeKey(req, res) {
  try {
    const found = await prisma.publicApiKey.findFirst({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!found) return error(res, 'API kalit topilmadi', 404);
    await prisma.publicApiKey.update({ where: { id: found.id }, data: { revokedAt: new Date() } });
    return success(res, { revoked: true });
  } catch (err) { return error(res, err.message, 400); }
}

async function createEndpoint(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return error(res, 'Webhook nomi talab qilinadi', 400);
    const created = await createWebhookEndpoint({ agencyId: req.agency.id, name, url: req.body?.url, events: req.body?.events, maxAttempts: req.body?.maxAttempts, createdByAccountId: req.agencyAccount.id });
    return success(res, { endpoint: publicEndpoint(created.endpoint), secret: created.secret, shownOnce: true }, 201);
  } catch (err) { return error(res, err.message, 400); }
}

async function updateEndpoint(req, res) {
  try {
    const found = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!found) return error(res, 'Webhook topilmadi', 404);
    const events = normalizeEvents(req.body?.events);
    if (!events.length) return error(res, 'Kamida bitta event tanlang', 400);
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: found.id },
      data: {
        name: String(req.body?.name || found.name).trim().slice(0, 100),
        url: validateWebhookUrl(req.body?.url || found.url), events,
        active: req.body?.active !== false,
        maxAttempts: Math.min(10, Math.max(1, Number(req.body?.maxAttempts) || found.maxAttempts)),
      },
    });
    return success(res, { endpoint: publicEndpoint(endpoint) });
  } catch (err) { return error(res, err.message, 400); }
}

async function removeEndpoint(req, res) {
  try {
    const result = await prisma.webhookEndpoint.deleteMany({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!result.count) return error(res, 'Webhook topilmadi', 404);
    return success(res, { deleted: true });
  } catch (err) { return error(res, err.message, 400); }
}

async function rotateSecret(req, res) {
  try {
    const found = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!found) return error(res, 'Webhook topilmadi', 404);
    const rotated = await rotateWebhookSecret(found.id, req.agency.id);
    return success(res, { endpoint: publicEndpoint(rotated.endpoint), secret: rotated.secret, shownOnce: true });
  } catch (err) { return error(res, err.message, 400); }
}

async function testEndpoint(req, res) {
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, agencyId: req.agency.id, active: true } });
    if (!endpoint) return error(res, 'Faol webhook topilmadi', 404);
    const event = await enqueueWebhookEvent({ agencyId: req.agency.id, type: 'webhook.test', entityType: 'webhook', entityId: endpoint.id, payload: { message: 'TravelorAI webhook test', sentAt: new Date().toISOString() } });
    const delivery = await prisma.webhookDelivery.findUnique({ where: { endpointId_eventId: { endpointId: endpoint.id, eventId: event.id } } });
    if (!delivery) return error(res, 'Endpoint webhook.test eventiga obuna qilinmagan', 400);
    const result = await runWebhookDeliveryWorker({ agencyId: req.agency.id, deliveryId: delivery.id });
    const updated = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
    return success(res, { result, delivery: updated });
  } catch (err) { return error(res, err.message, 400); }
}

async function retryDelivery(req, res) {
  try {
    const delivery = await retryWebhookDelivery(req.params.id, req.agency.id);
    const result = await runWebhookDeliveryWorker({ agencyId: req.agency.id, deliveryId: delivery.id });
    return success(res, { result, delivery: await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } }) });
  } catch (err) { return error(res, err.message, 400); }
}

module.exports = { list, createKey, revokeKey, createEndpoint, updateEndpoint, removeEndpoint, rotateSecret, testEndpoint, retryDelivery };
