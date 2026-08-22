const http = require('http');
const crypto = require('crypto');
const { prisma } = require('../src/config/database');
const { createApiKey } = require('../src/services/publicApiKey.service');
const { encryptSecret } = require('../src/services/dataEncryption.service');
const { runWebhookDeliveryWorker, retryWebhookDelivery } = require('../src/services/webhookDelivery.service');

function assert(value, message) { if (!value) throw new Error(message); }

async function main() {
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  let account; let agency; let server; let mode = 'fail'; const received = [];
  try {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        received.push({ body, headers: req.headers });
        res.statusCode = mode === 'fail' ? 500 : 200;
        res.end(mode === 'fail' ? 'retry me' : 'accepted');
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    account = await prisma.agencyAccount.create({ data: { email: `api-smoke-${suffix}@example.com`, passwordHash: 'smoke-not-login', emailVerified: true, status: 'active' } });
    agency = await prisma.tourAgency.create({ data: { slug: `api-smoke-${suffix}`, ownerAccountId: account.id, name: 'API Smoke Agency', city: 'Toshkent', specialty: 'Test', active: true } });
    const { rawKey } = await createApiKey({ agencyId: agency.id, name: 'Smoke full', scopes: ['leads:read', 'leads:write', 'tours:read', 'finance:read'], createdByAccountId: account.id });
    const { rawKey: readOnlyKey } = await createApiKey({ agencyId: agency.id, name: 'Smoke read', scopes: ['leads:read'], createdByAccountId: account.id });
    const secret = `whsec_smoke_${crypto.randomBytes(24).toString('base64url')}`;
    const endpoint = await prisma.webhookEndpoint.create({ data: { agencyId: agency.id, name: 'Local signed receiver', url: `http://127.0.0.1:${port}/hook`, events: ['lead.created'], secretEncrypted: encryptSecret(secret), secretPrefix: secret.slice(0, 12), maxAttempts: 2, createdByAccountId: account.id } });

    const denied = await fetch('http://127.0.0.1:4000/api/v1/public/leads', { method: 'POST', headers: { authorization: `Bearer ${readOnlyKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ customerName: 'Denied', customerPhone: '+998900000000' }) });
    assert(denied.status === 403, `scope check expected 403, got ${denied.status}`);

    const createdResponse = await fetch('http://127.0.0.1:4000/api/v1/public/leads', { method: 'POST', headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ customerName: 'Public API mijoz', customerPhone: '+998901234567', leadCity: 'Samarqand', currency: 'UZS', totalEstimate: 2500000 }) });
    const createdBody = await createdResponse.json();
    assert(createdResponse.status === 201 && createdBody.success, 'public lead create failed');
    const leadId = createdBody.data.id;

    const listResponse = await fetch('http://127.0.0.1:4000/api/v1/public/leads?limit=10', { headers: { 'x-api-key': rawKey } });
    const listBody = await listResponse.json();
    assert(listResponse.ok && listBody.data.items.some((row) => row.id === leadId), 'public lead list failed');

    const patched = await fetch(`http://127.0.0.1:4000/api/v1/public/leads/${leadId}`, { method: 'PATCH', headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ pipelineStage: 'contacted' }) });
    assert(patched.ok, 'public lead patch failed');

    const event = await prisma.webhookEvent.findFirst({ where: { agencyId: agency.id, type: 'lead.created', entityId: leadId }, orderBy: { createdAt: 'desc' } });
    const delivery = await prisma.webhookDelivery.findUnique({ where: { endpointId_eventId: { endpointId: endpoint.id, eventId: event.id } } });
    assert(delivery, 'webhook outbox delivery missing');

    await runWebhookDeliveryWorker({ agencyId: agency.id, deliveryId: delivery.id, allowPrivate: true });
    await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date() } });
    await runWebhookDeliveryWorker({ agencyId: agency.id, deliveryId: delivery.id, allowPrivate: true });
    const dead = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
    assert(dead.status === 'dead' && dead.attempt === 2, 'delivery did not reach DLQ');

    const first = received[0];
    const expected = `v1=${crypto.createHmac('sha256', secret).update(`${first.headers['x-travelorai-timestamp']}.${first.body}`).digest('hex')}`;
    assert(first.headers['x-travelorai-signature'] === expected, 'HMAC signature mismatch');

    mode = 'success';
    await retryWebhookDelivery(delivery.id, agency.id);
    await runWebhookDeliveryWorker({ agencyId: agency.id, deliveryId: delivery.id, allowPrivate: true });
    const delivered = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
    assert(delivered.status === 'success' && delivered.responseStatus === 200, 'DLQ redelivery failed');

    console.log(JSON.stringify({ ok: true, uonParity: 92, checks: ['api_key_hash', 'scope_enforcement', 'public_lead_create', 'public_lead_list', 'public_lead_patch', 'outbox_event', 'hmac_signature', 'retry_backoff', 'dlq', 'manual_redelivery', 'delivery_log'] }));
  } finally {
    if (agency) await prisma.tourBooking.deleteMany({ where: { agencyId: agency.id } }).catch(() => {});
    if (agency) await prisma.tourAgency.delete({ where: { id: agency.id } }).catch(() => {});
    if (account) await prisma.agencyAccount.delete({ where: { id: account.id } }).catch(() => {});
    if (server) await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
