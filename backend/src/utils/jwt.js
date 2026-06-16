const jwt = require('jsonwebtoken');

// Fail-closed: prod'da JWT_SECRET majburiy. Aks holda ma'lum zaxira sir token soxtalashtirishga yo'l ochardi.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const SECRET = process.env.JWT_SECRET || 'travelorai_dev_only_secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
