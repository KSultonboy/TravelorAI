const jwt = require('jsonwebtoken');

// Fail-closed: prod'da agency yoki umumiy JWT siri majburiy.
if (process.env.NODE_ENV === 'production' && !process.env.AGENCY_JWT_SECRET && !process.env.JWT_SECRET) {
  throw new Error('AGENCY_JWT_SECRET (or JWT_SECRET) is required in production');
}
const SECRET = process.env.AGENCY_JWT_SECRET || process.env.JWT_SECRET || 'travelorai_agency_dev_only_secret';
const EXPIRES_IN = process.env.AGENCY_JWT_EXPIRES_IN || '7d';

function signAgencyToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyAgencyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { signAgencyToken, verifyAgencyToken };
