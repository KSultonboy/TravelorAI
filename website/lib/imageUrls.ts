const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function apiOrigin() {
  const configured = PUBLIC_API_URL.replace(/\/$/, "");
  if (/^https?:\/\//i.test(configured)) {
    return configured.replace(/\/api\/v1$/i, "");
  }

  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:4000";
  }

  return "";
}

export function publicImageSrc(src?: string | null) {
  const value = String(src || "").trim();
  if (!value) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${apiOrigin()}${value}`;
  return value;
}
