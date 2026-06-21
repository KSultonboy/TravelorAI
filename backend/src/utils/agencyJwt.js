const jwt = require('jsonwebtoken');
const { getSecret } = require('../config/security');

const EXPIRES_IN = process.env.AGENCY_JWT_EXPIRES_IN || '7d';

function getAgencySecret() {
  if (process.env.AGENCY_JWT_SECRET) {
    return getSecret('AGENCY_JWT_SECRET', 'travelorai_agency_secret');
  }
  if (process.env.JWT_SECRET) {
    return getSecret('JWT_SECRET', 'travelorai_secret');
  }
  return getSecret('AGENCY_JWT_SECRET', 'travelorai_agency_secret');
}

function signAgencyToken(payload) {
  return jwt.sign(payload, getAgencySecret(), { expiresIn: EXPIRES_IN });
}

function verifyAgencyToken(token) {
  try {
    return jwt.verify(token, getAgencySecret());
  } catch {
    return null;
  }
}

module.exports = { signAgencyToken, verifyAgencyToken };
