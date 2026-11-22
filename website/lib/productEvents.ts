"use client";

// Brauzerdan yuboriladigan ommaviy voronka hodisalari (backend: POST /home/events).
// Faqat ikkita hodisa, har biri sessiyada BIR MARTA (sessionStorage). Shaxsiy
// ma'lumot yuborilmaydi — faqat UTM, sahifa yo'li va referrer domeni.
import { getAttribution } from "@/lib/attribution";

export type PublicProductEvent = "landing_view" | "agency_signup_started";

const KEY_PREFIX = "travelorai_evt_";

function utmProps(): Record<string, string> {
  const props: Record<string, string> = {};
  try {
    const q = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = (q.get(key) || "").trim().slice(0, 100);
      if (v) props[key] = v;
    }
    // URL'da bo'lmasa — birinchi teginish (localStorage) manbasi.
    if (!props.utm_source) {
      const a = getAttribution();
      if (a.utmSource) props.utm_source = a.utmSource;
      if (a.utmMedium && !props.utm_medium) props.utm_medium = a.utmMedium;
      if (a.utmCampaign && !props.utm_campaign) props.utm_campaign = a.utmCampaign;
    }
    props.path = window.location.pathname.slice(0, 100);
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.host !== window.location.host) props.referrer_host = ref.host.slice(0, 100);
  } catch {
    /* noto'g'ri URL/referrer — props qisman bo'ladi */
  }
  return props;
}

/** Sessiyada bir marta yuboradi; hech qachon xato tashlamaydi va UI'ni kutdirmaydi. */
export function trackPublicEventOnce(name: PublicProductEvent) {
  if (typeof window === "undefined") return;
  try {
    const key = KEY_PREFIX + name;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    return; // sessionStorage yopiq — takrorlanmasligiga kafolat yo'q, yubormaymiz
  }
  try {
    void fetch("/api/backend/home/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, props: utmProps() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
