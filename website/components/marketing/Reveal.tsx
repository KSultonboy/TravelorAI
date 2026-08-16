"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode, type Ref } from "react";

type RevealProps = {
  children: ReactNode;
  /** Kechikish (ms) — staggered ketma-ketlik uchun */
  delay?: number;
  /** Boshlang'ich siljish yo'nalishi */
  from?: "up" | "down" | "left" | "right" | "none" | "scale" | "blur";
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span";
  style?: CSSProperties;
};

/**
 * On-scroll fade + slide reveal.
 * MUHIM: IntersectionObserver ishlamasa ham (crawler/headless), ~2.5s dan keyin
 * majburiy ko'rinadi — hech bir bo'lim bo'sh chiqmaydi.
 */
export default function Reveal({
  children,
  delay = 0,
  from = "up",
  className = "",
  as = "div",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const node = ref.current;
    let fired = false;
    const reveal = () => {
      if (fired) return;
      fired = true;
      setShown(true);
    };

    // Reduced motion — darrov ko'rsatamiz.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    let observer: IntersectionObserver | null = null;
    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) reveal();
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      observer.observe(node);
    } else {
      reveal();
    }

    // Fallback timer — IO ishlamasa ham ~2.5s da ko'rinadi.
    const timer = window.setTimeout(reveal, 2500);

    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [shown]);

  const Tag = (as || "div") as ElementType;

  return (
    <Tag
      ref={ref as Ref<HTMLElement>}
      className={`reveal ${shown ? "reveal--in" : ""} reveal--${from} ${className}`}
      style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </Tag>
  );
}
