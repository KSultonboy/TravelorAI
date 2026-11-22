const jwt = require('jsonwebtoken');
const { getSecret, acceptLegacyTokens } = require('../config/env');

// Foydalanuvchi (marketplace) tokenlari. Agency tokenlaridan `aud` + `typ` bilan
// ajratiladi, shuning uchun bir realm tokeni boshqasida qabul qilinmaydi.
const ALGORITHM = 'HS256';
const USER_AUDIENCE = 'travelorai:user';
const USER_TOKEN_TYPE = 'user';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload = {}) {
  // aud/typ/exp chaqiruvchidan kelsa ham e'tiborga olinmaydi — ularni faqat shu yerda qo'yamiz.
  const { aud, typ, exp, iat, ...claims } = payload;
  return jwt.sign({ ...claims, typ: USER_TOKEN_TYPE }, getSecret('JWT_SECRET'), {
    algorithm: ALGORITHM,
    audience: USER_AUDIENCE,
    expiresIn: EXPIRES_IN,
  });
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, getSecret('JWT_SECRET'), { algorithms: [ALGORITHM] });
    if (!decoded || typeof decoded !== 'object' || !decoded.id) return null;

    // Eski (claim'siz) tokenlar: production foydalanuvchilarida 7 kunlik tokenlar bor.
    // Agency'ning eski tokeni (role: 'agency') bu yerda hech qachon qabul qilinmaydi.
    if (decoded.aud === undefined && decoded.typ === undefined) {
      return acceptLegacyTokens() && decoded.role !== 'agency' ? decoded : null;
    }

    if (decoded.aud !== USER_AUDIENCE || decoded.typ !== USER_TOKEN_TYPE) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken, USER_AUDIENCE, USER_TOKEN_TYPE, ALGORITHM };
