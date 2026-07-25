"use client";

import { useEffect, useRef, useState } from "react";

export default function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const run = () => {
      if (done.current) return;
      done.current = true;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setVal(to);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * to));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const node = ref.current;
    let observer: IntersectionObserver | null = null;
    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) run(); });
      }, { threshold: 0.4 });
      observer.observe(node);
    }
    // Fallback — IO ishlamasa ham ~2.5s da to'liq son ko'rinadi.
    const timer = window.setTimeout(() => { if (!done.current) { done.current = true; setVal(to); } }, 2500);
    return () => { observer?.disconnect(); window.clearTimeout(timer); };
  }, [to, duration]);

  return <span ref={ref}>{val.toLocaleString("uz-UZ")}{suffix}</span>;
}
