/**
 * Admin login sozlamalari — FAQAT environment'dan. Hech qanday standart
 * (admin/admin123, "change_me" va h.k.) qiymat yo'q.
 *
 * Production'da quyidagilar bajarilmasa admin login 503 qaytaradi:
 *   ADMIN_USERNAME        — kamida 12 belgi
 *   ADMIN_PASSWORD        — kamida 12 belgi
 *   ADMIN_SESSION_SECRET  — kamida 32 belgi
 * va hech biri ma'lum standart/namuna qiymatga teng bo'lmasligi kerak.
 */

const KNOWN_DEFAULTS = new Set(
  [
    "admin",
    "admin123",
    "administrator",
    "password",
    "password123",
    "changeme",
    "change_me",
    "change-me",
    "secret",
    "travelorai",
    "travelorai_admin",
    "travelorai_admin_session_change_me",
    "dev-admin-session-secret",
  ].map((value) => value.toLowerCase())
);

export const ADMIN_MIN_USERNAME = 12;
export const ADMIN_MIN_PASSWORD = 12;
export const ADMIN_MIN_SESSION_SECRET = 32;

function isWeak(value: string | undefined, minLength: number) {
  const v = (value || "").trim();
  if (!v) return true;
  if (v.length < minLength) return true;
  const lower = v.toLowerCase();
  if (KNOWN_DEFAULTS.has(lower)) return true;
  if (lower.includes("change_me") || lower.includes("changeme")) return true;
  return false;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Session imzolash kaliti yaroqlimi (prod qoidalari bo'yicha). */
export function isSessionSecretValid(secret: string | undefined) {
  return !isWeak(secret, ADMIN_MIN_SESSION_SECRET);
}

export type AdminCredentials = { username: string; password: string };

/**
 * Login uchun sozlangan login/parol. Sozlanmagan yoki zaif bo'lsa — null
 * (route 503 qaytaradi). Dev muhitida uzunlik talabi yumshoq, lekin
 * standart qiymatlar baribir qabul qilinmaydi.
 */
export function getAdminCredentials(): AdminCredentials | null {
  const username = (process.env.ADMIN_USERNAME || "").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.ADMIN_SESSION_SECRET || "";

  if (isProduction()) {
    if (isWeak(username, ADMIN_MIN_USERNAME)) return null;
    if (isWeak(password, ADMIN_MIN_PASSWORD)) return null;
    if (!isSessionSecretValid(secret)) return null;
    return { username, password };
  }

  // Dev: bo'sh yoki ma'lum standart qiymat — baribir yo'q.
  if (isWeak(username, 1) || isWeak(password, 1)) return null;
  return { username, password };
}
