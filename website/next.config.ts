import type { NextConfig } from "next";
import path from "path";

// Content-Security-Policy (nonce bilan) proxy.ts'da o'rnatiladi — bu yerda
// faqat statik xavfsizlik sarlavhalari.
const COMMON_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // 1 yil. includeSubDomains/preload ataylab qo'yilmadi: barcha subdomenlar
  // HTTPS'da ekani tasdiqlangach qo'shish mumkin (preload qaytarib bo'lmaydi).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Monorepo: Turbopack Next.js paketini to'g'ri topsin
  outputFileTracingRoot: path.join(__dirname, "../"),
  experimental: {
    // Admin paneldan base64 rasm yuborilganda request body kesilib qolmasin
    proxyClientMaxBodySize: "16mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: COMMON_SECURITY_HEADERS,
      },
      {
        // Telegram Mini App (/tg/*) Telegram Web ichida iframe'da ochiladi —
        // unga X-Frame-Options qo'yilmaydi (CSP frame-ancestors ruxsat beradi).
        source: "/:path((?!tg$|tg/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};

export default nextConfig;
