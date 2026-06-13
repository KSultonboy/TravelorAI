const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { logger } = require('../config/logger');

// Firebase Cloud Messaging HTTP v1 — to'g'ridan-to'g'ri (Expo push serverisiz).
// Service account JSON: FCM_SERVICE_ACCOUNT_PATH yoki /app/fcm-service-account.json.
const SA_PATH = process.env.FCM_SERVICE_ACCOUNT_PATH || `${process.cwd()}/fcm-service-account.json`;
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let serviceAccount = null;
let serviceAccountLoaded = false;
let cachedAccessToken = null;
let cachedTokenExpiry = 0;

function loadServiceAccount() {
  if (serviceAccountLoaded) return serviceAccount;
  serviceAccountLoaded = true;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  } catch {
    serviceAccount = null;
  }
  return serviceAccount;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Service account'dan OAuth2 access token (JWT bearer flow), ~55 daqiqa keshlanadi.
async function getAccessToken() {
  const sa = loadServiceAccount();
  if (!sa) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < cachedTokenExpiry - 60) return cachedAccessToken;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: FCM_SCOPE,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(sa.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const assertion = `${header}.${claims}.${signature}`;

  const response = await axios.post(
    sa.token_uri,
    new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    { headers: { 'content-type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
  );
  cachedAccessToken = response.data.access_token;
  cachedTokenExpiry = now + (response.data.expires_in || 3600);
  return cachedAccessToken;
}

function isValidPushToken(token) {
  return typeof token === 'string' && token.trim().length > 20;
}

/**
 * Bitta FCM push yuboradi. Fire-and-forget — hech qachon throw qilmaydi,
 * shuning uchun booking status yangilash hech qachon buzilmaydi.
 */
async function sendPushNotification({ to, title, body, data }) {
  if (!isValidPushToken(to)) return { sent: false, reason: 'invalid_or_missing_token' };
  const sa = loadServiceAccount();
  if (!sa) return { sent: false, reason: 'no_service_account' };

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return { sent: false, reason: 'no_access_token' };

    // FCM data qiymatlari faqat string bo'lishi kerak
    const stringData = {};
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) stringData[k] = String(v);
    }

    await axios.post(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        message: {
          token: to.trim(),
          notification: { title, body },
          data: stringData,
          android: { priority: 'high', notification: { sound: 'default', channel_id: 'default' } },
        },
      },
      { headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, timeout: 8000 }
    );
    return { sent: true };
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    logger.warn('FCM push failed', { reason: detail });
    return { sent: false, reason: detail };
  }
}

module.exports = { sendPushNotification, isValidPushToken };
