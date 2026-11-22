// Anthropic API — AI yordamchilar uchun yagona kirish nuqtasi.
// Kalit yoki kutubxona bo'lmasa xizmat jimgina o'chiq turadi (UI tugmani yashiradi).
//
// MUHIM: prod deploy overlay'i package.json'ni nusxalaydi, lekin `npm install`
// QILMAYDI. Shuning uchun SDK'ni fayl boshida require QILMAYMIZ — aks holda
// kutubxona o'rnatilmagan image'da backend umuman ko'tarilmaydi va deploy
// rollback bo'ladi (2026-07-20 da aynan shunday bo'lgan).

// Qisqa izoh va OCR uchun arzon model yetarli; ANTHROPIC_MODEL bilan almashtiriladi.
const DEFAULT_MODEL = 'claude-haiku-5-5';
const MODEL = String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1;

let Anthropic = null;
let sdkChecked = false;

function loadSdk() {
  if (!sdkChecked) {
    sdkChecked = true;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    } catch {
      Anthropic = null;
    }
  }
  return Anthropic;
}

let client = null;
function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const Sdk = loadSdk();
  if (!Sdk) return null;
  // Aniq timeout va retry: bitta so'rov eng yomon holatda ~40 s (20 s × 2 urinish).
  if (!client) client = new Sdk({ apiKey: key, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
  return client;
}

// Kalit HAM, kutubxona HAM bo'lsagina "sozlangan" hisoblanadi.
function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY && !!loadSdk();
}

/* ─────────────────────── agentlik bo'yicha kunlik limit ─────────────────────── */
// Jarayon ichidagi hisoblagich (UTC kun bo'yicha). Bitta backend instansiyasi
// uchun yetarli; restartda nolga tushadi — bu xarajatni cheklash uchun, billing emas.
const usage = new Map(); // `${agencyId}|${YYYY-MM-DD}` -> count

function dailyLimit() {
  const value = Number(process.env.AI_DAILY_LIMIT_PER_AGENCY);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 50;
}

function dayKey(agencyId, now = new Date()) {
  return `${agencyId}|${now.toISOString().slice(0, 10)}`;
}

function pruneUsage(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  for (const key of usage.keys()) if (!key.endsWith(`|${today}`)) usage.delete(key);
}

function getAgencyUsage(agencyId) {
  const used = usage.get(dayKey(agencyId)) || 0;
  const limit = dailyLimit();
  return { used, limit, remaining: Math.max(0, limit - used) };
}

// Chaqiruvdan OLDIN band qilinadi — parallel so'rovlar limitdan oshib ketmasin.
function consumeAgencyQuota(agencyId) {
  if (!agencyId) return;
  pruneUsage();
  const key = dayKey(agencyId);
  const used = usage.get(key) || 0;
  if (used >= dailyLimit()) {
    const err = new Error(`AI kunlik limiti tugadi (${dailyLimit()} ta so‘rov). Ertaga qayta urinib ko‘ring.`);
    err.code = 'AI_QUOTA_EXCEEDED';
    err.status = 429;
    throw err;
  }
  usage.set(key, used + 1);
}

function resetAiUsage() {
  usage.clear();
}

/* ─────────────────────────────── so'rovlar ─────────────────────────────── */

function notConfiguredError() {
  const err = new Error(
    loadSdk()
      ? 'AI hali sozlanmagan (ANTHROPIC_API_KEY yo‘q)'
      : 'AI kutubxonasi image‘da o‘rnatilmagan (@anthropic-ai/sdk)'
  );
  err.code = 'AI_NOT_CONFIGURED';
  return err;
}

// Qisqa vazifalar (izoh, OCR) — chuqur fikrlash kerak emas. Effort faqat uni
// qo'llab-quvvatlaydigan 5-avlod modellariga yuboriladi.
function requestOptions() {
  return /^claude-(haiku|sonnet|opus|fable|mythos)-5/.test(MODEL) ? { output_config: { effort: 'low' } } : {};
}

function textOf(res) {
  return (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function usageOf(res) {
  return { input: res.usage?.input_tokens || 0, output: res.usage?.output_tokens || 0 };
}

/**
 * Matn generatsiyasi. Qisqa javoblar uchun — streaming kerak emas.
 * `agencyId` berilsa kunlik limit tekshiriladi.
 */
async function generate({ system, prompt, maxTokens = 1500, agencyId }) {
  const anthropic = getClient();
  if (!anthropic) throw notConfiguredError();
  consumeAgencyQuota(agencyId);

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    ...requestOptions(),
  });

  return { text: textOf(res), usage: usageOf(res) };
}

async function generateVision({ system, prompt, mediaType, data, maxTokens = 2000, agencyId }) {
  const anthropic = getClient();
  if (!anthropic) throw notConfiguredError();
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!allowed.has(mediaType)) throw new Error('OCR uchun JPG, PNG yoki WEBP kerak');
  consumeAgencyQuota(agencyId);
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: prompt },
    ] }],
    ...requestOptions(),
  });
  return { text: textOf(res), usage: usageOf(res) };
}

module.exports = {
  generate,
  generateVision,
  isConfigured,
  consumeAgencyQuota,
  getAgencyUsage,
  resetAiUsage,
  MODEL,
  DEFAULT_MODEL,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
  _getClient: getClient,
};
