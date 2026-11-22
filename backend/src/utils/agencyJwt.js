const jwt = require('jsonwebtoken');
const { getSecret, acceptLegacyTokens } = require('../config/env');

// Agency portal tokenlari. Foydalanuvchi tokenlaridan `aud` + `typ` bilan ajratiladi.
const ALGORITHM = 'HS256';
const AGENCY_AUDIENCE = 'travelorai:agency';
const AGENCY_TOKEN_TYPE = 'agency';
const EXPIRES_IN = process.env.AGENCY_JWT_EXPIRES_IN || '7d';

function signAgencyToken(payload = {}) {
  const { aud, typ, exp, iat, ...claims } = payload;
  return jwt.sign({ role: 'agency', ...claims, typ: AGENCY_TOKEN_TYPE }, getSecret('AGENCY_JWT_SECRET'), {
    algorithm: ALGORITHM,
    audience: AGENCY_AUDIENCE,
    expiresIn: EXPIRES_IN,
  });
}

function verifyAgencyToken(token) {
  try {
    const decoded = jwt.verify(token, getSecret('AGENCY_JWT_SECRET'), { algorithms: [ALGORITHM] });
    if (!decoded || typeof decoded !== 'object' || !decoded.id) return null;

    // Eski agency tokenlari doim role: 'agency' bilan imzolangan. Claim'siz va
    // role'siz token (masalan, eski user tokeni) agency realmida qabul qilinmaydi.
    if (decoded.aud === undefined && decoded.typ === undefined) {
      return acceptLegacyTokens() && decoded.role === 'agency' ? decoded : null;
    }

    if (decoded.aud !== AGENCY_AUDIENCE || decoded.typ !== AGENCY_TOKEN_TYPE) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { signAgencyToken, verifyAgencyToken, AGENCY_AUDIENCE, AGENCY_TOKEN_TYPE, ALGORITHM };
