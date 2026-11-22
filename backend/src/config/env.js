// Muhit o'zgaruvchilarini (env) yagona joyda tekshirish.
//
// Production'da (NODE_ENV=production) maxfiy kalitlar yo'q, qisqa yoki ma'lum
// "standart" qiymatga teng bo'lsa server ISHGA TUSHMAYDI (fail-closed).
// Development/test'da esa faqat shu fayldagi dev-zaxira qiymatlari ishlatiladi va
// ogohlantirish yoziladi. Boshqa hech bir faylda maxfiy kalit literali bo'lmasligi kerak.
const { z } = require('zod');

const MIN_SECRET_LENGTH = 32;

// Hech qachon production'da qabul qilinmaydigan qiymatlar (eski kod va .env.example'dan).
const KNOWN_WEAK_SECRETS = new Set(
  [
    'travelorai_secret',
    'travelorai_agency_secret',
    'change_me',
    'changeme',
    'change-me',
    'change_me_to_random_long_secret',
    'change_me_to_random_long_agency_secret',
    'secret',
    'jwt_secret',
    'admin',
    'password',
    'test-admin-key',
  ].map((value) => value.toLowerCase())
);

// FAQAT development/test uchun. Production'da bu qiymatlar hech qachon ishlatilmaydi.
const DEV_FALLBACKS = Object.freeze({
  JWT_SECRET: 'dev-only-user-jwt-secret--not-for-production-use',
  AGENCY_JWT_SECRET: 'dev-only-agency-jwt-secret--not-for-production-use',
  // Lokal admin panel odatda shu qiymat bilan ishlaydi (eski server.js xatti-harakati).
  ADMIN_SECRET_KEY: 'change_me',
  DATABASE_URL: 'postgresql://travelorai:travelorai_pass@localhost:5435/travelorai_db',
  REDIS_URL: 'redis://localhost:6381',
});

const REQUIRED_SECRETS = ['JWT_SECRET', 'AGENCY_JWT_SECRET', 'ADMIN_SECRET_KEY'];

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production';
}

function isWeakSecret(value) {
  return KNOWN_WEAK_SECRETS.has(String(value || '').trim().toLowerCase());
}

const strongSecret = (name) =>
  z
    .string({ required_error: `${name} o'rnatilmagan`, invalid_type_error: `${name} o'rnatilmagan` })
    .min(MIN_SECRET_LENGTH, `${name} kamida ${MIN_SECRET_LENGTH} belgidan iborat bo'lishi kerak`)
    .refine((value) => !isWeakSecret(value), `${name} ma'lum standart qiymatga teng — yangi tasodifiy qiymat qo'ying`);

const productionSchema = z
  .object({
    NODE_ENV: z.literal('production'),
    JWT_SECRET: strongSecret('JWT_SECRET'),
    AGENCY_JWT_SECRET: strongSecret('AGENCY_JWT_SECRET'),
    ADMIN_SECRET_KEY: strongSecret('ADMIN_SECRET_KEY'),
    DATABASE_URL: z.string({ required_error: "DATABASE_URL o'rnatilmagan" }).min(1, "DATABASE_URL o'rnatilmagan"),
  })
  .passthrough()
  .refine((env) => env.JWT_SECRET !== env.AGENCY_JWT_SECRET, {
    message: 'AGENCY_JWT_SECRET JWT_SECRET bilan bir xil bo‘lmasligi kerak (user va agency tokenlari ajralishi uchun)',
    path: ['AGENCY_JWT_SECRET'],
  });

function blankToUndefined(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    out[key] = typeof value === 'string' && value.trim() === '' ? undefined : value;
  }
  return out;
}

function googleClientIdsConfigured(env = process.env) {
  return getGoogleClientIds(env).length > 0;
}

function getGoogleClientIds(env = process.env) {
  return Array.from(
    new Set(
      [
        ...String(env.GOOGLE_CLIENT_IDS || '').split(','),
        env.GOOGLE_ANDROID_CLIENT_ID,
        env.GOOGLE_ANDROID_CLIENT_ID_DEBUG,
        env.GOOGLE_ANDROID_CLIENT_ID_RELEASE,
        env.GOOGLE_WEB_CLIENT_ID_DEBUG,
        env.GOOGLE_WEB_CLIENT_ID,
        env.GOOGLE_WEB_CLIENT_ID_RELEASE,
        env.GOOGLE_IOS_CLIENT_ID_DEBUG,
        env.GOOGLE_IOS_CLIENT_ID,
        env.GOOGLE_IOS_CLIENT_ID_RELEASE,
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
}

// Pure tekshiruv: { ok, errors[], warnings[] }. process.env'ni o'zgartirmaydi.
function validateEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const clean = blankToUndefined(env);

  if (isProduction(clean)) {
    const result = productionSchema.safeParse(clean);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(issue.message);
    }
    if (!googleClientIdsConfigured(clean)) {
      warnings.push("Google client ID'lari o'rnatilmagan — Google orqali kirish 503 qaytaradi.");
    }
    if (clean.ALLOW_DEV_CODES === 'true') {
      warnings.push("ALLOW_DEV_CODES=true production'da e'tiborga olinmaydi.");
    }
  } else {
    for (const name of REQUIRED_SECRETS) {
      const value = clean[name];
      if (!value) {
        warnings.push(`${name} o'rnatilmagan — dev-zaxira qiymat ishlatiladi (production'da ruxsat yo'q).`);
      } else if (value.length < MIN_SECRET_LENGTH || isWeakSecret(value)) {
        warnings.push(`${name} zaif — production'da server ishga tushmaydi.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// server.js boshida chaqiriladi: dev'da zaxira qiymatlarni qo'yadi, production'da
// noto'g'ri konfiguratsiyada jarayonni aniq xabar bilan to'xtatadi.
function bootstrapEnv({ exit = (code) => process.exit(code), log = console } = {}) {
  const result = validateEnv(process.env);
  for (const warning of result.warnings) log.warn(`[env] ${warning}`);

  if (!isProduction()) {
    for (const [key, value] of Object.entries(DEV_FALLBACKS)) {
      if (!process.env[key] || !String(process.env[key]).trim()) process.env[key] = value;
    }
  }

  if (!result.ok) {
    log.error(
      `[env] Production konfiguratsiyasi noto'g'ri, server ishga tushirilmaydi:\n  - ${result.errors.join('\n  - ')}`
    );
    exit(1);
  }
  return result;
}

// Har chaqiruvda process.env'dan o'qiladi (testlar va kech yuklangan .env uchun).
// Production'da noto'g'ri qiymat bo'lsa XATO tashlaydi — hech qachon zaxiraga tushmaydi.
function getSecret(name) {
  if (!REQUIRED_SECRETS.includes(name)) throw new Error(`Noma'lum maxfiy kalit: ${name}`);
  const value = String(process.env[name] || '').trim();

  if (isProduction()) {
    if (!value || value.length < MIN_SECRET_LENGTH || isWeakSecret(value)) {
      const err = new Error(`${name} production uchun yaroqsiz`);
      err.code = 'ENV_SECRET_INVALID';
      throw err;
    }
    return value;
  }

  return value || DEV_FALLBACKS[name];
}

// devCode (emailga ketgan kod) API javobida faqat aniq ruxsat berilganda va
// production BO'LMAGANDA qaytariladi.
function allowDevCodes() {
  return process.env.ALLOW_DEV_CODES === 'true' && !isProduction();
}

// Tranzitsiya: audience/type claim'siz eski tokenlar qabul qilinadimi (standart: ha).
// Barcha 7 kunlik eski tokenlar tugagach AUTH_ACCEPT_LEGACY_TOKENS=false qo'yish mumkin.
function acceptLegacyTokens() {
  return process.env.AUTH_ACCEPT_LEGACY_TOKENS !== 'false';
}

// Yangi agentliklar uchun bepul sinov muddati (kun). Noto'g'ri qiymat → 14.
const trialDaysSchema = z.coerce.number().int().min(1).max(365);
function trialDays(env = process.env) {
  const parsed = trialDaysSchema.safeParse(blankToUndefined({ v: env.TRIAL_DAYS }).v ?? 14);
  return parsed.success ? parsed.data : 14;
}

module.exports = {
  trialDays,
  MIN_SECRET_LENGTH,
  KNOWN_WEAK_SECRETS,
  DEV_FALLBACKS,
  REQUIRED_SECRETS,
  isProduction,
  isWeakSecret,
  validateEnv,
  bootstrapEnv,
  getSecret,
  allowDevCodes,
  acceptLegacyTokens,
  getGoogleClientIds,
  googleClientIdsConfigured,
};
