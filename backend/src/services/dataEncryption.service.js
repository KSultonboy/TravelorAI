const crypto = require('crypto');

function encryptionKey() {
  const raw = process.env.APP_DATA_ENCRYPTION_KEY || process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '';
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) {
    throw new Error('APP_DATA_ENCRYPTION_KEY yoki INSTAGRAM_TOKEN_ENCRYPTION_KEY 32 baytli bo‘lishi kerak');
  }
  return decoded;
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['enc:v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(value) {
  const raw = String(value || '');
  if (!raw.startsWith('enc:v1.')) throw new Error('Shifrlangan secret formati yaroqsiz');
  const [, ivRaw, tagRaw, encryptedRaw] = raw.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Shifrlangan secret formati yaroqsiz');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
