import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy — har so'rovga yangi nonce.
 *
 * script-src: 'nonce-…' + 'strict-dynamic'. Next.js o'z skriptlariga nonce'ni
 * o'zi qo'yadi (CSP sarlavhasidan o'qiydi); bizning bundle yuklagan tashqi
 * skriptlar (Google Sign-In, CLICK SDK, Telegram WebApp) 'strict-dynamic'
 * orqali ruxsat oladi. Inline (nonce'siz) yoki begona skript BAJARILMAYDI.
 * Host ro'yxati faqat CSP2 brauzerlar uchun zaxira.
 *
 * style-src: 'unsafe-inline' — React `style={{…}}` atributlari, Leaflet va
 * Google Sign-In inline uslublari uchun majburiy (nonce atributlarni qamramaydi).
 *
 * Talab: barcha sahifalar dinamik render qilinadi (app/layout.tsx → connection()).
 */

const GOOGLE_ACCOUNTS = "https://accounts.google.com";
const CLICK = "https://my.click.uz";
const TELEGRAM_SCRIPT = "https://telegram.org";

function apiOrigin(): string {
  try {
    const raw = process.env.NEXT_PUBLIC_API_URL || "";
    return /^https?:\/\//i.test(raw) ? new URL(raw).origin : "";
  } catch {
    return "";
  }
}

function isTelegramMiniApp(pathname: string) {
  return pathname === "/tg" || pathname.startsWith("/tg/");
}

function buildCsp(nonce: string, pathname: string) {
  const isDev = process.env.NODE_ENV !== "production";
  const api = apiOrigin();

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      `${GOOGLE_ACCOUNTS}/gsi/client`,
      TELEGRAM_SCRIPT,
      CLICK,
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", `${GOOGLE_ACCOUNTS}/gsi/style`],
    // Tur/agentlik rasmlari istalgan HTTPS manbadan (agentlik yuklagan URL,
    // Unsplash, CARTO xarita plitkalari, Google avatar) keladi.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      GOOGLE_ACCOUNTS,
      CLICK,
      "https://*.click.uz",
      // Desktop ilova (Tauri v2) IPC kanali — CRM shu orqali open_external/save_download chaqiradi.
      "ipc:",
      "http://ipc.localhost",
      ...(api ? [api] : []),
      ...(isDev ? ["ws:", "http://localhost:4000"] : []),
    ],
    "frame-src": [
      "'self'",
      "blob:",
      "data:",
      GOOGLE_ACCOUNTS,
      "https://www.google.com",
      "https://maps.google.com",
      CLICK,
      "https://*.click.uz",
    ],
    "media-src": ["'self'", "blob:", "data:", "https:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", CLICK],
    // Telegram Mini App Telegram Web (web.telegram.org) ichida iframe'da ochiladi.
    "frame-ancestors": isTelegramMiniApp(pathname)
      ? ["'self'", "https://web.telegram.org", "https://*.telegram.org"]
      : ["'none'"],
  };

  const parts = Object.entries(directives).map(([key, values]) => `${key} ${values.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, request.nextUrl.pathname);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // API, statik fayllar, rasm optimizatsiyasi, metadata fayllari — CSP shart emas.
      source:
        "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image|desktop/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|html|json|exe|msi|zip|sig)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
