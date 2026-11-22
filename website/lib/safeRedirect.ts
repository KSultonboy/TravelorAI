/**
 * `?next=` kabi qaytish manzillarini tekshiradi — faqat O'Z saytimizdagi
 * nisbiy yo'l (`/tours/...`). `//evil.com`, `/\evil.com`, `https://...`,
 * `javascript:...` va boshqarish belgilari rad etiladi (open redirect / XSS).
 */
const SAFE_PATH = /^\/(?!\/|\\)/;
const BASE = "https://travelorai.invalid";

export function safeNextPath(value: unknown, fallback = "/my-trips"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 1024) return fallback;
  if (!SAFE_PATH.test(raw)) return fallback;
  // Boshqarish belgilari (tab/newline brauzer tomonidan olib tashlanadi va
  // "/\t/evil.com" → "//evil.com" bo'lib qoladi) va teskari slash — rad.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
