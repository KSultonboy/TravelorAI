const crypto = require('crypto');
const igCrypto = require('./instagram.service');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const APP_SECRET = () => process.env.WHATSAPP_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || '';
const VERIFY_TOKEN = () => process.env.WHATSAPP_VERIFY_TOKEN || '';

function isConfigured() {
  return Boolean(APP_SECRET() && VERIFY_TOKEN() && process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY);
}

async function graphFetch(path, token, options = {}) {
  const res = await fetch(`${GRAPH}/${String(path).replace(/^\//, '')}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `WhatsApp API ${res.status}`);
  return data;
}

async function verifyConnection(token, phoneNumberId) {
  return graphFetch(`${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`, token);
}

async function subscribeApp(token, wabaId) {
  return graphFetch(`${encodeURIComponent(wabaId)}/subscribed_apps`, token, { method: 'POST', body: '{}' });
}

async function listTemplates(token, wabaId) {
  return graphFetch(`${encodeURIComponent(wabaId)}/message_templates?fields=id,name,language,status,category,components&limit=200`, token);
}

async function sendText(token, phoneNumberId, to, text) {
  return graphFetch(`${encodeURIComponent(phoneNumberId)}/messages`, token, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: String(to), type: 'text', text: { preview_url: false, body: String(text).slice(0, 4096) } }),
  });
}

async function sendTemplate(token, phoneNumberId, to, templateName, language = 'uz') {
  return graphFetch(`${encodeURIComponent(phoneNumberId)}/messages`, token, {
    method: 'POST',
    body: JSON.stringify({ messaging_product: 'whatsapp', to: String(to), type: 'template', template: { name: String(templateName), language: { code: String(language || 'uz') } } }),
  });
}

function verifyChallenge(query) {
  if (query['hub.mode'] === 'subscribe' && VERIFY_TOKEN() && query['hub.verify_token'] === VERIFY_TOKEN()) return String(query['hub.challenge'] || '');
  return null;
}

function verifySignature(rawBody, signature) {
  if (!APP_SECRET() || !rawBody || !signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', APP_SECRET()).update(rawBody).digest('hex')}`;
  const a = Buffer.from(String(signature)); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  decryptToken: igCrypto.decryptToken,
  encryptToken: igCrypto.encryptToken,
  isConfigured,
  listTemplates,
  sendTemplate,
  sendText,
  subscribeApp,
  verifyChallenge,
  verifyConnection,
  verifySignature,
};
