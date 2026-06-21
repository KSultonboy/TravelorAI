const jwt = require('jsonwebtoken');
const { getSecret } = require('../config/security');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, getSecret('JWT_SECRET', 'travelorai_secret'), { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret('JWT_SECRET', 'travelorai_secret'));
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
