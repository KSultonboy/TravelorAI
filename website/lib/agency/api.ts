import type { ApiResponse } from "./types";

// Barcha so'rovlar cookie-sessiya bilan agency-proxy orqali backendga boradi.
export async function agencyApi<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");

  try {
    const response = await fetch(`/api/agency-proxy/agency${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return { success: false, message: "Server bilan aloqa uzildi. Internetni tekshirib qayta urining." };
  }
}

export function statusLabel(status?: string) {
  const map: Record<string, string> = {
    draft: "Qoralama",
    pending: "Admin tekshiruvida",
    pending_review: "Tekshiruv kutilmoqda",
    confirmed: "Qabul qilingan",
    cancelled: "Bekor qilingan",
    completed: "Yakunlangan",
    approved: "Tasdiqlangan",
    rejected: "Rad etilgan",
  };
  return map[status || ""] || status || "Noma'lum";
}

export function formatMoney(value?: number | null) {
  if (!value) return "$0";
  return `$${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.getDate()}-${UZ_MONTHS[date.getMonth()]}, ${date.getFullYear()}-yil`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()}-${UZ_MONTHS[date.getMonth()]}, ${hh}:${mm}`;
}

export function remainingTime(deadline?: string | null) {
  if (!deadline) return null;
  const distance = new Date(deadline).getTime() - Date.now();
  if (distance <= 0) return "Muddat tugagan";
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  const seconds = Math.floor((distance % 60_000) / 1000);
  return `${hours ? `${hours} soat ` : ""}${minutes} daqiqa ${seconds} soniya`;
}

// Backend EMAIL_VERIFICATION_TTL_MINUTES=10 bilan mos
export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

export function codeCountdown(expiresAt: number | null) {
  if (!expiresAt) return null;
  const distance = expiresAt - Date.now();
  if (distance <= 0) return "expired";
  const minutes = Math.floor(distance / 60_000);
  const seconds = Math.floor((distance % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Yuborish tez bo'lishi uchun katta rasmlar client tomonda siqiladi (max 1280px, JPEG 0.82)
export function readImage(file: File | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type.startsWith("image/")) return reject(new Error("Faqat rasm fayli tanlang"));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Rasm 8 MB dan oshmasligi kerak"));

    // Kichik fayllarni asl holicha o'qiymiz (PNG shaffofligi saqlanadi)
    if (file.size <= 300 * 1024) {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi"));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      try {
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas mavjud emas");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Rasmni qayta ishlab bo‘lmadi"));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Rasmni o‘qib bo‘lmadi"));
    };
    image.src = objectUrl;
  });
}

// "1-kun: Registon | 2-kun: Shohizinda" yoki har qatorda bitta kun formatini qabul qiladi
export function parseItinerary(text: string): { day: number; title: string }[] | undefined {
  const lines = text
    .split(/\n|\|/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!lines.length) return undefined;
  return lines.map((line, index) => {
    const match = line.match(/^(\d+)\s*[-.:)]?\s*(?:kun\s*[:.-]?\s*)?(.*)$/i);
    if (match && match[2]) return { day: Number(match[1]), title: match[2].trim() };
    return { day: index + 1, title: line };
  });
}

export function itineraryToText(itinerary: unknown): string {
  if (!Array.isArray(itinerary)) return "";
  return itinerary
    .map((item) => {
      if (item && typeof item === "object" && "title" in item) {
        const day = "day" in item ? (item as { day?: number }).day : undefined;
        return `${day ?? ""}${day ? "-kun: " : ""}${(item as { title?: string }).title || ""}`.trim();
      }
      return String(item ?? "");
    })
    .filter(Boolean)
    .join("\n");
}
