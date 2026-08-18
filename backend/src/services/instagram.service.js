const crypto = require('crypto');

/**
 * Instagram API with Instagram Login.
 *
 * MUHIM: bu Facebook Page talab qilmaydi — agentlik shunchaki o'z Instagram
 * biznes (yoki creator) akkaunti bilan kiradi. Eski "Instagram API with
 * Facebook Login" varianti Page talab qilardi, biz undan foydalanmaymiz.
 *
 * Yangi npm paket qo'shilmagan: hamma narsa native fetch + crypto ustida
 * (backend overlay `npm install` qilmaydi — [[prod-backend-image-overlay]]).
 */

const GRAPH = 'https://graph.instagram.com';
const GRAPH_VERSION = 'v23.0';

const APP_ID = () => process.env.INSTAGRAM_APP_ID || '';
const APP_SECRET = () => process.env.INSTAGRAM_APP_SECRET || '';
const VERIFY_TOKEN = () => process.env.INSTAGRAM_VERIFY_TOKEN || '';
const TOKEN_KEY = () => process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '';

/** Sozlangan bo'lsagina UI «Ulash» tugmasini ko'rsatadi. */
function isConfigured() {
  return Boolean(APP_ID() && APP_SECRET() && VERIFY_TOKEN() && TOKEN_KEY());
}

function tokenKey() {
  const raw = TOKEN_KEY();
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY 32 baytli base64 yoki 64 belgili hex bo‘lishi kerak');
  return decoded;
}

/** Access token DB'da faqat AES-256-GCM ko'rinishida saqlanadi. */
function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  return ['enc:v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptToken(value) {
  const raw = String(value || '');
  // Oldin ulangan akkaunt bo'lsa bir marta o'qib, keyingi refreshda shifrlanadi.
  if (!raw.startsWith('enc:v1.')) return raw;
  const [, ivRaw, tagRaw, encryptedRaw] = raw.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Instagram token formati yaroqsiz');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
}

/** OAuth'dan keyin Meta shu manzilga qaytaradi — Meta konsolida AYNAN shu yozilishi kerak. */
function redirectUri() {
  const base = (process.env.PUBLIC_API_URL || 'https://travelorai.com/api/v1').replace(/\/$/, '');
  return `${base}/instagram/callback`;
}

async function igFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = (data.error && (data.error.message || data.error.error_user_msg)) || `Instagram API ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ============ OAUTH ============ */

/**
 * Foydalanuvchi shu manzilga yuboriladi. `state` — imzolangan agentlik id'si:
 * callback auth header'siz keladi, shuning uchun kim ulanayotganini faqat
 * shu imzo isbotlaydi (CSRF himoyasi ham shu).
 */
function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: APP_ID(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: [
      'instagram_business_basic',
      'instagram_business_manage_messages',
    ].join(','),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/** State 10 daqiqa yashaydi; HMAC CSRF va agencyId almashtirishdan himoya qiladi. */
function signState(agencyId) {
  const body = Buffer.from(JSON.stringify({ agencyId: String(agencyId), exp: Date.now() + 10 * 60 * 1000, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  const mac = crypto.createHmac('sha256', APP_SECRET()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verifyState(state) {
  const raw = String(state || '');
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const given = raw.slice(dot + 1);
  const expected = crypto.createHmac('sha256', APP_SECRET()).update(body).digest('base64url');
  // timingSafeEqual faqat teng uzunlikda ishlaydi — avval uzunlikni tekshiramiz.
  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed.agencyId || !parsed.exp || Date.now() > Number(parsed.exp)) return null;
    return String(parsed.agencyId);
  } catch {
    return null;
  }
}

/** code → qisqa muddatli token (1 soat) + IG user id. */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: APP_ID(),
    client_secret: APP_SECRET(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
    code,
  });
  const data = await igFetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return { accessToken: data.access_token, userId: String(data.user_id || '') };
}

/** Qisqa token → 60 kunlik uzoq token. */
async function exchangeLongLived(shortToken) {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: APP_SECRET(),
    access_token: shortToken,
  });
  const data = await igFetch(`${GRAPH}/access_token?${params.toString()}`);
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in || 0) };
}

/**
 * Uzoq tokenni yangilaydi. Faqat kamida 24 soat ishlatilgan va hali tugamagan
 * token yangilanadi — tugab qolgan bo'lsa agentlik qaytadan ulashi kerak.
 */
async function refreshLongLived(longToken) {
  const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: longToken });
  const data = await igFetch(`${GRAPH}/refresh_access_token?${params.toString()}`);
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in || 0) };
}

/**
 * Webhook obunasi AKKAUNT darajasида.
 *
 * MUHIM: Meta konsolидаги ilova darajasidagi obuna (3-qadam, `messages`
 * maydoni) O'ZI YETARLI EMAS. Har bir ulangan akkaunt uchun alohida
 * `POST /me/subscribed_apps` chaqirilmаса, Direct xabarlar webhook'ga
 * UMUMAN kelmaydi — ulanish "muvaffaqiyatli" ko'rinadi, lekin lid tushmaydi.
 */
async function subscribeWebhooks(token) {
  const params = new URLSearchParams({ subscribed_fields: 'messages', access_token: token });
  return igFetch(`${GRAPH}/${GRAPH_VERSION}/me/subscribed_apps?${params.toString()}`, { method: 'POST' });
}

/* ============ PROFIL / XABAR ============ */

/**
 * DIQQAT: bu yerda IKKI xil id qaytadi va ular BOSHQA-BOSHQA:
 *   · `user_id` — IG professional akkaunt id'si (17841…), API chaqiruvlarida ishlatiladi
 *   · `id`      — app doirasidagi id (27841…)
 * Webhook `recipient.id`da qaysi biri kelishi hujjatlarда aniq emas, shuning
 * uchun ikkalasini ham saqlaymiz (qarang: controller webhook qidiruvi).
 */
async function getMe(token) {
  const params = new URLSearchParams({ fields: 'id,user_id,username,name', access_token: token });
  const data = await igFetch(`${GRAPH}/${GRAPH_VERSION}/me?${params.toString()}`);
  return {
    userId: String(data.user_id || ''),
    appScopedId: String(data.id || ''),
    username: data.username || '',
    name: data.name || '',
  };
}

/**
 * Yuboruvchi haqida bor-yo'g'i username va ism qaytadi (ruxsat etilgani shu).
 * Xato bo'lsa tashlamaydi — lid baribir yaratilishi kerak.
 */
async function getSenderProfile(token, igsid) {
  try {
    const params = new URLSearchParams({ fields: 'name,username', access_token: token });
    const data = await igFetch(`${GRAPH}/${GRAPH_VERSION}/${encodeURIComponent(igsid)}?${params.toString()}`);
    return { username: data.username || '', name: data.name || '' };
  } catch {
    return { username: '', name: '' };
  }
}

/**
 * Direct javob. DIQQAT: Instagram 24 soatlik oyna qo'yadi — mijoz oxirgi
 * xabaridan 24 soat o'tsa, javob 400 bilan rad etiladi. Controller shu xatoni
 * agentga tushunarli qilib ko'rsatadi.
 */
async function sendMessage(token, igUserId, recipientIgsid, text) {
  return igFetch(`${GRAPH}/${GRAPH_VERSION}/${encodeURIComponent(igUserId)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: String(recipientIgsid) },
      message: { text: String(text).slice(0, 1000) },
      access_token: token,
    }),
  });
}

/* ============ WEBHOOK ============ */

/** Meta webhook'ni birinchi marta ro'yxatdan o'tkazganda GET bilan tekshiradi. */
function verifyChallenge(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && VERIFY_TOKEN() && token === VERIFY_TOKEN()) return String(challenge || '');
  return null;
}

/**
 * X-Hub-Signature-256 — XOM body ustidan HMAC. JSON.parse qilib qayta
 * yig'ilgan matn imzoga MOS KELMAYDI (kalit tartibi/probel farq qiladi),
 * shuning uchun app.js xom nusxani req.rawBody'da saqlaydi.
 */
function verifySignature(rawBody, headerValue) {
  const secret = APP_SECRET();
  if (!secret || !rawBody || !headerValue) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(String(headerValue));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  redirectUri,
  authorizeUrl,
  signState,
  verifyState,
  exchangeCode,
  exchangeLongLived,
  refreshLongLived,
  subscribeWebhooks,
  getMe,
  getSenderProfile,
  sendMessage,
  verifyChallenge,
  verifySignature,
  encryptToken,
  decryptToken,
};
