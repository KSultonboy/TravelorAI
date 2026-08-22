const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const { prisma } = require('../config/database');
const { encryptSecret, decryptSecret } = require('./dataEncryption.service');

const WEBHOOK_EVENTS = [
  '*', 'webhook.test', 'lead.created', 'lead.updated', 'lead.stage_changed',
  'task.created', 'finance.updated', 'document.updated', 'automation.updated', 'agency.updated',
];

function newWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString('base64url')}`;
}

function signWebhookPayload(secret, timestamp, body) {
  return `v1=${crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

function normalizeEvents(events) {
  return [...new Set((Array.isArray(events) ? events : []).filter((event) => WEBHOOK_EVENTS.includes(event)))];
}

function validateWebhookUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new Error('Webhook URL yaroqsiz'); }
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('Production webhook faqat HTTPS bo‘lishi kerak');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Webhook URL yaroqsiz');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::1') throw new Error('Ichki webhook manzili taqiqlangan');
  return url.toString();
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const p = address.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254)
      || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)
      || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
  }
  if (net.isIPv6(address)) {
    const a = address.toLowerCase();
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb');
  }
  return true;
}

async function assertPublicDestination(rawUrl) {
  const url = new URL(rawUrl);
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((row) => isPrivateIp(row.address))) throw new Error('Webhook ichki yoki private tarmoq manziliga yo‘naltirilgan');
}

async function createWebhookEndpoint({ agencyId, name, url, events, maxAttempts = 6, createdByAccountId }) {
  const cleanEvents = normalizeEvents(events);
  if (!cleanEvents.length) throw new Error('Kamida bitta webhook event tanlang');
  const secret = newWebhookSecret();
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      agencyId,
      name: String(name || '').trim().slice(0, 100),
      url: validateWebhookUrl(url),
      events: cleanEvents,
      maxAttempts: Math.min(10, Math.max(1, Number(maxAttempts) || 6)),
      secretEncrypted: encryptSecret(secret),
      secretPrefix: secret.slice(0, 12),
      createdByAccountId: createdByAccountId || null,
    },
  });
  return { endpoint, secret };
}

async function rotateWebhookSecret(endpointId, agencyId) {
  const secret = newWebhookSecret();
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: endpointId, agencyId },
    data: { secretEncrypted: encryptSecret(secret), secretPrefix: secret.slice(0, 12) },
  });
  return { endpoint, secret };
}

async function enqueueWebhookEvent({ agencyId, type, entityType, entityId, payload }) {
  if (!agencyId || !type) return null;
  return prisma.$transaction(async (tx) => {
    const event = await tx.webhookEvent.create({
      data: { agencyId, type, entityType: entityType || null, entityId: entityId || null, payload: payload || {} },
    });
    const endpoints = await tx.webhookEndpoint.findMany({ where: { agencyId, active: true } });
    const matching = endpoints.filter((endpoint) => endpoint.events.includes('*') || endpoint.events.includes(type));
    if (matching.length) {
      await tx.webhookDelivery.createMany({
        data: matching.map((endpoint) => ({ endpointId: endpoint.id, eventId: event.id, maxAttempts: endpoint.maxAttempts })),
        skipDuplicates: true,
      });
    }
    return event;
  });
}

function retryDelayMs(attempt) {
  const minutes = [1, 5, 15, 60, 360, 1440][Math.max(0, attempt - 1)] || 1440;
  return minutes * 60 * 1000;
}

async function deliverWebhook(delivery, { allowPrivate = false, fetchImpl = fetch } = {}) {
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id: delivery.id, status: { in: ['pending', 'retry'] }, nextAttemptAt: { lte: new Date() } },
    data: { status: 'sending', attempt: { increment: 1 }, error: null },
  });
  if (!claimed.count) return { skipped: true };
  const current = await prisma.webhookDelivery.findUnique({
    where: { id: delivery.id }, include: { endpoint: true, event: true },
  });
  if (!current?.endpoint.active) {
    await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'dead', error: 'Webhook endpoint o‘chirilgan' } });
    return { dead: true };
  }

  const envelope = {
    id: current.event.id,
    event: current.event.type,
    createdAt: current.event.createdAt.toISOString(),
    agencyId: current.event.agencyId,
    data: current.event.payload,
  };
  const body = JSON.stringify(envelope);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signWebhookPayload(decryptSecret(current.endpoint.secretEncrypted), timestamp, body);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    if (!allowPrivate) await assertPublicDestination(current.endpoint.url);
    const response = await fetchImpl(current.endpoint.url, {
      method: 'POST', body, signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'TravelorAI-Webhooks/1.0',
        'x-travelorai-event': current.event.type,
        'x-travelorai-delivery': current.id,
        'x-travelorai-timestamp': timestamp,
        'x-travelorai-signature': signature,
      },
      redirect: 'error',
    });
    const responseBody = (await response.text().catch(() => '')).slice(0, 2000);
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { responseStatus: response.status, responseBody });
    await prisma.$transaction([
      prisma.webhookDelivery.update({ where: { id: current.id }, data: { status: 'success', responseStatus: response.status, responseBody, durationMs: Date.now() - startedAt, deliveredAt: new Date(), error: null } }),
      prisma.webhookEndpoint.update({ where: { id: current.endpointId }, data: { lastSuccessAt: new Date() } }),
    ]);
    return { success: true, status: response.status };
  } catch (err) {
    const dead = current.attempt >= current.maxAttempts;
    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: current.id },
        data: {
          status: dead ? 'dead' : 'retry',
          responseStatus: err.responseStatus || null,
          responseBody: err.responseBody || null,
          error: String(err.name === 'AbortError' ? 'Webhook timeout (10s)' : err.message || err).slice(0, 1000),
          durationMs: Date.now() - startedAt,
          nextAttemptAt: dead ? current.nextAttemptAt : new Date(Date.now() + retryDelayMs(current.attempt)),
        },
      }),
      prisma.webhookEndpoint.update({ where: { id: current.endpointId }, data: { lastFailureAt: new Date() } }),
    ]);
    return { success: false, dead, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function runWebhookDeliveryWorker({ agencyId, deliveryId, allowPrivate = false, fetchImpl } = {}) {
  const rows = await prisma.webhookDelivery.findMany({
    where: {
      ...(deliveryId ? { id: deliveryId } : {}),
      status: { in: ['pending', 'retry'] }, nextAttemptAt: { lte: new Date() },
      ...(agencyId ? { endpoint: { agencyId } } : {}),
    },
    orderBy: { nextAttemptAt: 'asc' }, take: deliveryId ? 1 : 50,
  });
  const results = [];
  for (const row of rows) results.push(await deliverWebhook(row, { allowPrivate, fetchImpl }));
  return { processed: rows.length, success: results.filter((row) => row.success).length, dead: results.filter((row) => row.dead).length };
}

async function retryWebhookDelivery(id, agencyId) {
  const found = await prisma.webhookDelivery.findFirst({ where: { id, endpoint: { agencyId } } });
  if (!found) throw new Error('Webhook delivery topilmadi');
  return prisma.webhookDelivery.update({
    where: { id }, data: { status: 'pending', attempt: 0, nextAttemptAt: new Date(), error: null, responseStatus: null, responseBody: null, deliveredAt: null },
  });
}

function inferWebhookEvent(path = '', method = '') {
  const clean = String(path).split('?')[0];
  if (/\/bookings\/[^/]+\/stage/.test(clean)) return 'lead.stage_changed';
  if (clean.includes('/leads') && method === 'POST') return 'lead.created';
  if (clean.includes('/bookings')) return method === 'POST' ? 'lead.created' : 'lead.updated';
  if (clean.includes('/tasks') && method === 'POST') return 'task.created';
  if (clean.includes('/finance')) return 'finance.updated';
  if (clean.includes('/business-documents') || clean.includes('/documents')) return 'document.updated';
  if (clean.includes('/automation')) return 'automation.updated';
  return 'agency.updated';
}

module.exports = {
  WEBHOOK_EVENTS, newWebhookSecret, signWebhookPayload, normalizeEvents, validateWebhookUrl,
  isPrivateIp, createWebhookEndpoint, rotateWebhookSecret, enqueueWebhookEvent,
  deliverWebhook, runWebhookDeliveryWorker, retryWebhookDelivery, inferWebhookEvent,
};
