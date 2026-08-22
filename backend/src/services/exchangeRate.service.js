const CBU_ENDPOINT = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json';
const CACHE_TTL_MS = 30 * 60 * 1000;
const SUPPORTED_CODES = new Set(['USD', 'EUR', 'RUB', 'GBP', 'CNY', 'JPY', 'KZT', 'TRY', 'AED']);
const cache = new Map();

function cleanDate(value) {
  if (!value) return null;
  const date = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Kurs sanasi YYYY-MM-DD ko‘rinishida bo‘lishi kerak');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Kurs sanasi noto‘g‘ri');
  return date;
}

function numeric(value) {
  const result = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(result) ? result : 0;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) throw new Error('Markaziy bank javobi noto‘g‘ri');
  const rates = rows
    .filter((row) => SUPPORTED_CODES.has(String(row.Ccy || '').toUpperCase()))
    .map((row) => {
      const nominal = Math.max(1, numeric(row.Nominal));
      const rate = numeric(row.Rate);
      return {
        code: String(row.Ccy).toUpperCase(),
        name: String(row.CcyNm_UZ || row.CcyNm_EN || row.Ccy || ''),
        nominal,
        rate,
        unitRateUzs: rate / nominal,
        difference: numeric(row.Diff),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  if (!rates.length) throw new Error('Markaziy bank kurslari topilmadi');
  return { effectiveDate: String(rows[0]?.Date || ''), rates };
}

async function getExchangeRates({ date, force = false } = {}) {
  const clean = cleanDate(date);
  const key = clean || 'current';
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return { ...cached.payload, cached: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = clean ? `${CBU_ENDPOINT}/all/${clean}/` : `${CBU_ENDPOINT}/`;
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'TravelorAI/1.0' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Markaziy bank HTTP ${response.status}`);
    const normalized = normalizeRows(await response.json());
    const payload = { source: 'O‘zbekiston Respublikasi Markaziy banki', baseCurrency: 'UZS', requestedDate: clean, fetchedAt: new Date().toISOString(), ...normalized, cached: false };
    cache.set(key, { cachedAt: Date.now(), payload });
    return payload;
  } catch (err) {
    if (cached) return { ...cached.payload, cached: true, stale: true };
    if (err?.name === 'AbortError') throw new Error('Markaziy bank javob bermadi');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { cleanDate, getExchangeRates, normalizeRows };
