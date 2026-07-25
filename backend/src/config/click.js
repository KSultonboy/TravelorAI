/**
 * CLICK (SHOP API) sozlamalari — kalitlar .env'dan o'qiladi.
 *
 * Shartnoma tuzilgach CLICK quyidagilarni beradi:
 *   CLICK_SERVICE_ID       — xizmat ID
 *   CLICK_MERCHANT_ID      — savdogar ID
 *   CLICK_SECRET_KEY       — imzo (sign_string) uchun maxfiy kalit
 *   CLICK_MERCHANT_USER_ID — (ixtiyoriy) Merchant API uchun
 *
 * Kalitlar bo'lmasa — to'lov tugmasi o'chirilgan holatda qoladi, boshqa hech
 * narsa buzilmaydi (isConfigured() = false).
 */

const SERVICE_ID = String(process.env.CLICK_SERVICE_ID || '').trim();
const MERCHANT_ID = String(process.env.CLICK_MERCHANT_ID || '').trim();
const SECRET_KEY = String(process.env.CLICK_SECRET_KEY || '').trim();
const MERCHANT_USER_ID = String(process.env.CLICK_MERCHANT_USER_ID || '').trim();

/** CLICK to'lov sahifasi (redirect) manzili. */
const PAY_URL = 'https://my.click.uz/services/pay';

/** To'lov havolasini yasash (va kabinetdagi tugma) uchun — hammasi kerak. */
function isConfigured() {
  return Boolean(SERVICE_ID && MERCHANT_ID && SECRET_KEY);
}

/**
 * Prepare/Complete callback'lari uchun — imzoni tekshirishga faqat
 * service_id va secret_key kerak (merchant_id imzoda ishlatilmaydi).
 * Shu bo'linish tufayli callback'larni tugmani ochmasdan sinash mumkin.
 */
function isCallbackConfigured() {
  return Boolean(SERVICE_ID && SECRET_KEY);
}

/**
 * To'lov havolasini yasaydi.
 * @param {{ merchantTransId: string, amount: number, returnUrl?: string }} p
 */
function buildPayUrl({ merchantTransId, amount, returnUrl }) {
  const q = new URLSearchParams({
    service_id: SERVICE_ID,
    merchant_id: MERCHANT_ID,
    // CLICK summani N.NN formatida kutadi
    amount: Number(amount).toFixed(2),
    transaction_param: String(merchantTransId),
  });
  if (MERCHANT_USER_ID) q.set('merchant_user_id', MERCHANT_USER_ID);
  if (returnUrl) q.set('return_url', returnUrl);
  return `${PAY_URL}?${q.toString()}`;
}

module.exports = {
  SERVICE_ID, MERCHANT_ID, SECRET_KEY, MERCHANT_USER_ID, PAY_URL,
  isConfigured, isCallbackConfigured, buildPayUrl,
};
