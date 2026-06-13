const axios = require('axios');
const { logger } = require('../config/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Expo push token formati: ExponentPushToken[xxx] yoki ExpoPushToken[xxx]
function isValidExpoToken(token) {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token.trim());
}

/**
 * Bitta Expo push xabar yuboradi. Fire-and-forget — hech qachon throw qilmaydi,
 * shuning uchun asosiy oqim (booking status yangilash) hech qachon buzilmaydi.
 */
async function sendPushNotification({ to, title, body, data }) {
  if (!isValidExpoToken(to)) {
    return { sent: false, reason: 'invalid_or_missing_token' };
  }
  try {
    const response = await axios.post(
      EXPO_PUSH_URL,
      [{ to: to.trim(), title, body, sound: 'default', priority: 'high', channelId: 'default', data: data || {} }],
      { headers: { 'content-type': 'application/json' }, timeout: 8000 }
    );
    const ticket = response.data?.data?.[0] || response.data?.data;
    if (ticket?.status === 'error') {
      logger.warn('Push ticket error', { to, message: ticket.message, details: ticket.details });
      return { sent: false, reason: ticket.message };
    }
    return { sent: true };
  } catch (err) {
    logger.warn('Push send failed', { message: err.message });
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendPushNotification, isValidExpoToken };
