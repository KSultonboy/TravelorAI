const jwt = require('jsonwebtoken');

const SECRET = process.env.AGENCY_JWT_SECRET || process.env.JWT_SECRET || 'travelorai_agency_secret';
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
