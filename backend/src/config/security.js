const INSECURE_SECRET_VALUES = new Set([
  'change_me',
  'change_me_to_random_long_secret',
  'change_me_to_random_long_agency_secret',
  'travelorai_secret',
  'travelorai_agency_secret',
  'travelorai_admin_session_change_me',
  'dev-admin-session-secret',
]);

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getSecret(name, developmentFallback) {
  const value = String(process.env[name] || '').trim();
  if (value && (!isProduction() || !INSECURE_SECRET_VALUES.has(value))) {
    return value;
  }

  if (!isProduction() && developmentFallback) {
    return developmentFallback;
  }

  throw new Error(`${name} must be set to a strong, non-default value`);
}

function validateProductionSecurityConfig() {
  if (!isProduction()) return;

  getSecret('JWT_SECRET');
  getSecret('AGENCY_JWT_SECRET');
  getSecret('ADMIN_SECRET_KEY');

  const origins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) {
    throw new Error('ALLOWED_ORIGINS must contain explicit production origins');
  }
}

module.exports = {
  getSecret,
  validateProductionSecurityConfig,
};
