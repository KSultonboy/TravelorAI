const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
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

// ── SSRF himoyasi ─────────────────────────────────────────────────────────────
// Agentlik kiritgan URL'ga server nomidan so'rov yuboriladi, shuning uchun ichki
// tarmoq, loopback, link-local va bulut metadata manzillari (169.254.169.254,
// fd00:ec2::254, 100.100.100.200 ...) bloklanadi. IPv4-mapped / NAT64 / 6to4
// IPv6 ko'rinishidagi IPv4 manzillar avval IPv4'ga normallashtiriladi.

const BLOCKED_V4 = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([net4, prefix]) => BLOCKED_V4.addSubnet(net4, prefix, 'ipv4'));

const BLOCKED_V6 = new net.BlockList();
[
  ['::', 128], ['::1', 128], ['100::', 64], ['2001::', 23], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
].forEach(([net6, prefix]) => BLOCKED_V6.addSubnet(net6, prefix, 'ipv6'));

function parseIPv6Groups(input) {
  let s = String(input).toLowerCase();
  const dotted = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    if (!net.isIPv4(dotted[2])) return null;
    const p = dotted[2].split('.').map(Number);
    s = `${dotted[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail].map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  if (groups.length !== 8 || groups.some((g) => !Number.isFinite(g))) return null;
  return groups;
}

function v4FromGroups(hi, lo) {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
}

/**
 * IP manzilni tekshirish uchun kanonik ko'rinishga keltiradi.
 * IPv6 ichiga joylangan IPv4 (::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::/96, 2002::/16)
 * IPv4 sifatida qaytadi — aks holda ::ffff:127.0.0.1 kabi manzil filtrdan o'tib ketadi.
 */
function normalizeIp(address) {
  let raw = String(address || '').trim();
  if (raw.startsWith('[') && raw.endsWith(']')) raw = raw.slice(1, -1);
  raw = raw.split('%')[0]; // fe80::1%eth0
  if (net.isIPv4(raw)) return { address: raw, family: 4 };
  if (!net.isIPv6(raw)) return null;
  const g = parseIPv6Groups(raw);
  if (!g) return null;
  const zero = (from, to) => g.slice(from, to).every((x) => x === 0);
  // ::ffff:a.b.c.d (IPv4-mapped)
  if (zero(0, 5) && g[5] === 0xffff) return { address: v4FromGroups(g[6], g[7]), family: 4 };
  // ::ffff:0:a.b.c.d (IPv4-translated)
  if (zero(0, 4) && g[4] === 0xffff && g[5] === 0) return { address: v4FromGroups(g[6], g[7]), family: 4 };
  // ::a.b.c.d (eskirgan IPv4-compatible); :: va ::1 IPv6 bo'lib qoladi
  if (zero(0, 6) && (g[6] !== 0 || g[7] > 1)) return { address: v4FromGroups(g[6], g[7]), family: 4 };
  // 64:ff9b::/96 (NAT64)
  if (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 6)) return { address: v4FromGroups(g[6], g[7]), family: 4 };
  // 2002::/16 (6to4) — ichidagi IPv4
  if (g[0] === 0x2002) return { address: v4FromGroups(g[1], g[2]), family: 4 };
  return { address: g.map((x) => x.toString(16)).join(':'), family: 6 };
}

function isPrivateIp(address) {
  const ip = normalizeIp(address);
  if (!ip) return true; // tanib bo'lmagan manzil — xavfsiz tomonga
  return ip.family === 4 ? BLOCKED_V4.check(ip.address, 'ipv4') : BLOCKED_V6.check(ip.address, 'ipv6');
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function validateWebhookUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new Error('Webhook URL yaroqsiz'); }
  if (url.protocol !== 'https:' && isProduction()) throw new Error('Production webhook faqat HTTPS bo‘lishi kerak');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Webhook URL yaroqsiz');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Ichki webhook manzili taqiqlangan');
  }
  if (net.isIP(host) && isPrivateIp(host)) throw new Error('Ichki webhook manzili taqiqlangan');
  return url.toString();
}

/**
 * Manzilni BIR MARTA resolve qiladi, hamma javoblarni tekshiradi va so'rov
 * yuboriladigan IP'ni qaytaradi. So'rov aynan shu IP'ga ulanadi (pin) —
 * DNS rebinding (tekshiruvda public, ulanishda 127.0.0.1) ishlamaydi.
 */
async function resolvePublicDestination(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && isProduction()) throw new Error('Production webhook faqat HTTPS bo‘lishi kerak');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Webhook ichki yoki private tarmoq manziliga yo‘naltirilgan');
    return { address: host, family: net.isIP(host) };
  }
  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((row) => isPrivateIp(row.address))) {
    throw new Error('Webhook ichki yoki private tarmoq manziliga yo‘naltirilgan');
  }
  return { address: addresses[0].address, family: addresses[0].family || net.isIP(addresses[0].address) };
}

// Backward-compat nomi (eski chaqiruvlar uchun).
async function assertPublicDestination(rawUrl) {
  await resolvePublicDestination(rawUrl);
}

/**
 * Oldindan tekshirilgan IP'ga POST yuboradi. Host sarlavhasi va TLS SNI asl
 * domen bilan qoladi (sertifikat tekshiruvi buzilmaydi), lekin TCP ulanish
 * faqat `pinned.address`ga ochiladi. Redirect kuzatilmaydi, javob tanasi
 * O'QILMAYDI — faqat status kodi olinadi.
 */
function postToPinnedAddress(rawUrl, pinned, { headers, body, timeoutMs = 10000 }) {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const client = url.protocol === 'https:' ? https : http;
    const options = {
      method: 'POST',
      protocol: url.protocol,
      hostname: host,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      headers: { ...headers, 'content-length': Buffer.byteLength(body) },
      agent: false,
    };
    if (url.protocol === 'https:' && !net.isIP(host)) options.servername = host;
    if (pinned) {
      options.lookup = (_hostname, lookupOptions, callback) => {
        const cb = typeof lookupOptions === 'function' ? lookupOptions : callback;
        if (lookupOptions && lookupOptions.all) return cb(null, [{ address: pinned.address, family: pinned.family }]);
        return cb(null, pinned.address, pinned.family);
      };
    }
    const req = client.request(options, (res) => {
      const status = res.statusCode;
      res.destroy(); // tanani o'qimaymiz
      resolve({ status });
    });
    req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('Webhook timeout (10s)'), { name: 'AbortError' })));
    req.on('error', reject);
    req.end(body);
  });
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

// transport(url, pinnedAddress, { headers, body, timeoutMs }) -> { status } — testlarda almashtiriladi.
// allowPrivate faqat lokal smoke skriptlari uchun; productionda e'tiborga olinmaydi.
async function deliverWebhook(delivery, { allowPrivate = false, transport = postToPinnedAddress } = {}) {
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
  const skipVetting = allowPrivate && !isProduction();
  try {
    const pinned = skipVetting ? null : await resolvePublicDestination(current.endpoint.url);
    const response = await transport(current.endpoint.url, pinned, {
      body,
      timeoutMs: 10000,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'TravelorAI-Webhooks/1.0',
        'x-travelorai-event': current.event.type,
        'x-travelorai-delivery': current.id,
        'x-travelorai-timestamp': timestamp,
        'x-travelorai-signature': signature,
      },
    });
    const status = Number(response && response.status) || 0;
    if (status >= 300 && status < 400) throw Object.assign(new Error(`Webhook redirect taqiqlangan (HTTP ${status})`), { responseStatus: status });
    if (status < 200 || status >= 300) throw Object.assign(new Error(`HTTP ${status}`), { responseStatus: status });
    // Javob tanasi saqlanmaydi (faqat status) — begona server ma'lumoti bazaga tushmasin.
    await prisma.$transaction([
      prisma.webhookDelivery.update({ where: { id: current.id }, data: { status: 'success', responseStatus: status, responseBody: null, durationMs: Date.now() - startedAt, deliveredAt: new Date(), error: null } }),
      prisma.webhookEndpoint.update({ where: { id: current.endpointId }, data: { lastSuccessAt: new Date() } }),
    ]);
    return { success: true, status };
  } catch (err) {
    const dead = current.attempt >= current.maxAttempts;
    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: current.id },
        data: {
          status: dead ? 'dead' : 'retry',
          responseStatus: err.responseStatus || null,
          responseBody: null,
          error: String(err.name === 'AbortError' ? 'Webhook timeout (10s)' : err.message || err).slice(0, 1000),
          durationMs: Date.now() - startedAt,
          nextAttemptAt: dead ? current.nextAttemptAt : new Date(Date.now() + retryDelayMs(current.attempt)),
        },
      }),
      prisma.webhookEndpoint.update({ where: { id: current.endpointId }, data: { lastFailureAt: new Date() } }),
    ]);
    return { success: false, dead, error: err.message };
  }
}

async function runWebhookDeliveryWorker({ agencyId, deliveryId, allowPrivate = false, transport } = {}) {
  const rows = await prisma.webhookDelivery.findMany({
    where: {
      ...(deliveryId ? { id: deliveryId } : {}),
      status: { in: ['pending', 'retry'] }, nextAttemptAt: { lte: new Date() },
      ...(agencyId ? { endpoint: { agencyId } } : {}),
    },
    orderBy: { nextAttemptAt: 'asc' }, take: deliveryId ? 1 : 50,
  });
  const results = [];
  for (const row of rows) results.push(await deliverWebhook(row, { allowPrivate, ...(transport ? { transport } : {}) }));
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
  isPrivateIp, normalizeIp, resolvePublicDestination, assertPublicDestination, postToPinnedAddress, createWebhookEndpoint, rotateWebhookSecret, enqueueWebhookEvent,
  deliverWebhook, runWebhookDeliveryWorker, retryWebhookDelivery, inferWebhookEvent,
};
