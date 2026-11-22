// Ixtiyoriy Umami analitikasi — FAQAT ommaviy marketing sahifalarida.
// Ikkala env ham berilganda yoqiladi (sukut bo'yicha o'chiq):
//   NEXT_PUBLIC_UMAMI_SCRIPT_URL  — masalan https://umami.example.com/script.js
//   NEXT_PUBLIC_UMAMI_WEBSITE_ID  — Umami sayt UUID'i
// proxy.ts (CSP) va app/layout.tsx shu moduldan foydalanadi.

export type UmamiConfig = { src: string; websiteId: string; origin: string };

export function umamiConfig(): UmamiConfig | null {
  const src = (process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || "").trim();
  const websiteId = (process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "").trim();
  if (!src || !websiteId) return null;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^[A-Za-z0-9-]{8,64}$/.test(websiteId)) return null;
    return { src: url.toString(), websiteId, origin: url.origin };
  } catch {
    return null;
  }
}

// Shaxsiy/ish kabinetlari va mijozga yuborilgan shaxsiy sahifalar hech qachon kuzatilmaydi.
const PRIVATE_PREFIXES = ["/agency", "/admin", "/p", "/tg", "/api", "/account", "/my-trips", "/reset-password", "/auth"];

export function isPublicMarketingPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || "/").toLowerCase();
  return !PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
