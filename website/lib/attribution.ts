"use client";

// Lid manbasini saqlash: mijoz reklama havolasidan kelib, bir necha sahifa aylanib,
// keyin bron qoldirishi mumkin. Shuning uchun UTM birinchi kirishda saqlanadi va
// bron yuborilganda qo'shiladi.
//
// BIRINCHI TEGINISH qoidasi: mijozni birinchi olib kelgan kanal saqlanadi.
// Aks holda oxirgi havola hisobga olinib, haqiqiy manba yo'qolardi.

const KEY = "travelorai_attribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
};

type Stored = Attribution & { at: number };

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    const q = new URLSearchParams(window.location.search);
    const utmSource = (q.get("utm_source") || "").trim().slice(0, 80);
    const utmMedium = (q.get("utm_medium") || "").trim().slice(0, 80);
    const utmCampaign = (q.get("utm_campaign") || "").trim().slice(0, 120);

    const existing = read();
    // Manba allaqachon aniq — tegmaymiz (birinchi teginish)
    if (existing?.utmSource) return;

    let referrer = "";
    try {
      const ref = document.referrer || "";
      if (ref && new URL(ref).host !== window.location.host) referrer = ref.slice(0, 300);
    } catch {
      /* referrer noto'g'ri bo'lsa e'tiborsiz */
    }

    // Saqlashga arzigulik narsa yo'q
    if (!utmSource && !utmMedium && !utmCampaign && !referrer) return;

    localStorage.setItem(
      KEY,
      JSON.stringify({ at: Date.now(), utmSource, utmMedium, utmCampaign, referrer } satisfies Stored)
    );
  } catch {
    /* localStorage yopiq bo'lsa — manba yozilmaydi, bron baribir ishlaydi */
  }
}

export function getAttribution(): Attribution {
  const s = read();
  if (!s) return {};
  return {
    utmSource: s.utmSource || undefined,
    utmMedium: s.utmMedium || undefined,
    utmCampaign: s.utmCampaign || undefined,
    referrer: s.referrer || undefined,
  };
}
