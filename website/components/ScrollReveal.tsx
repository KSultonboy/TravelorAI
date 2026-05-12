"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-visible", "visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -72px 0px" }
    );

    document
      .querySelectorAll(".lp-reveal, .lp-reveal-left, .lp-reveal-right, .reveal, .reveal-left, .reveal-right")
      .forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return null;
}
