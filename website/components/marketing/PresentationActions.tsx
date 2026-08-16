"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Heart, Loader2, Phone } from "lucide-react";

// Ochilishni FAQAT haqiqiy brauzer yozadi — link-preview botlari JS ishlatmaydi,
// shuning uchun "ko'rildi" statistikasi yolg'on bo'lmaydi.
export default function PresentationActions({
  token,
  interested: initialInterested,
  tel,
}: {
  token: string;
  interested: boolean;
  tel?: string | null;
}) {
  const [interested, setInterested] = useState(initialInterested);
  const [busy, setBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `pres-open:${token}`;
    try {
      if (sessionStorage.getItem(key)) return; // bir sessiyada bir marta
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage yopiq bo'lsa ham ochilishni yozamiz */
    }
    fetch(`/api/backend/p/${encodeURIComponent(token)}/open`, { method: "POST" }).catch(() => {});
  }, [token]);

  // Mobil panel: biroz aylantirgach chiqadi.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ...va asl CTA ekranga kirganda yashirinadi. Piksel taxmini emas —
  // haqiqiy elementni kuzatamiz, shunda sahifa uzunligi ahamiyatsiz bo'ladi.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), {
      rootMargin: "0px 0px -90px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function markInterest() {
    if (interested || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/backend/p/${encodeURIComponent(token)}/interest`, { method: "POST" });
      if (res.ok) setInterested(true);
    } catch {
      /* jimgina — bog'lanish tugmalari baribir ishlaydi */
    } finally {
      setBusy(false);
    }
  }

  const stickyOn = scrolled && !ctaVisible && !interested;

  return (
    <>
      <div ref={ctaRef}>
        {interested ? (
          <div className="pres-interest pres-interest--done">
            <Check size={19} />
            <span>Rahmat! Agentlik tez orada bog‘lanadi.</span>
          </div>
        ) : (
          <button type="button" className="pres-interest" onClick={markInterest} disabled={busy}>
            {busy ? <Loader2 size={19} className="pres-spin" /> : <Heart size={19} />}
            <span>Menga mos — bog‘laning</span>
          </button>
        )}
      </div>

      <div className={`pres-sticky${stickyOn ? " is-on" : ""}`} aria-hidden={!stickyOn}>
        <button
          type="button"
          className="pres-interest"
          onClick={markInterest}
          disabled={busy}
          tabIndex={stickyOn ? 0 : -1}
        >
          {busy ? <Loader2 size={18} className="pres-spin" /> : <Heart size={18} />}
          <span>Menga mos</span>
        </button>
        {tel ? (
          <a
            className="pres-btn pres-btn--call"
            href={tel}
            aria-label="Agentlikka qo‘ng‘iroq qilish"
            tabIndex={stickyOn ? 0 : -1}
          >
            <Phone size={18} />
          </a>
        ) : null}
      </div>
    </>
  );
}
