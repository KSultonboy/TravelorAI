"use client";

import { useEffect } from "react";

/**
 * Hero fon rasmiga scroll-parallax beradi (kuchli, kinematik his).
 * prefers-reduced-motion bo'lsa — hech narsa qilmaydi.
 * Hero yo'q sahifalarda jim turadi.
 */
export default function ScrollFx() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const bg = document.querySelector<HTMLElement>(".mkt-hero__bg");
    const content = document.querySelector<HTMLElement>(".mkt-hero__content");
    if (!bg && !content) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (y > window.innerHeight * 1.2) return; // faqat hero ko'rinishida
        if (bg) bg.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
        if (content) content.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (bg) bg.style.transform = "";
      if (content) content.style.transform = "";
    };
  }, []);

  return null;
}
