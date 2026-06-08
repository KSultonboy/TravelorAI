"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";

export type LandingHeroSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  fallbackImageUrl?: string;
  actionUrl?: string | null;
  sortOrder?: number;
  imagePosition?: string;
};

const HERO_IMAGE_FALLBACK =
  "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201600%20900%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23091820%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%23196f62%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23d6b36a%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%221600%22%20height%3D%22900%22%20fill%3D%22url(%23g)%22%2F%3E%3Cpath%20d%3D%22M0%20715%20410%20405%20625%20625%20865%20365%201185%20700%201600%20480v420H0Z%22%20fill%3D%22%23081118%22%20opacity%3D%22.82%22%2F%3E%3Cpath%20d%3D%22M0%20795c240-80%20480-44%20720%2028%20235%2070%20520%2020%20880-105v182H0Z%22%20fill%3D%22%230f342d%22%20opacity%3D%22.9%22%2F%3E%3C%2Fsvg%3E";

export default function Hero({ slides = [] }: { slides?: LandingHeroSlide[] }) {
  const heroSlides = slides.filter((slide) => slide.imageUrl);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = heroSlides.length > 0 ? activeIndex % heroSlides.length : 0;
  const activeSlide = heroSlides[safeActiveIndex] || null;
  const actionHref = activeSlide?.actionUrl === "#destinations" ? "#features" : activeSlide?.actionUrl || "#features";

  useEffect(() => {
    if (heroSlides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroSlides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  return (
    <section id="home" className="hero-stage">
      <div className="lp-wrap">
        <div className="hero-card lp-reveal">
          <div
            className="hero-card__bg"
            style={{
              backgroundImage: `url("${publicImageSrc(activeSlide?.fallbackImageUrl) || HERO_IMAGE_FALLBACK}")`,
              backgroundPosition: activeSlide?.imagePosition || "center center",
            }}
            aria-hidden="true"
          >
            {heroSlides.map((slide, index) => (
              <img
                className={index === safeActiveIndex ? "active" : ""}
                key={slide.id}
                src={publicImageSrc(slide.imageUrl)}
                style={{ objectPosition: slide.imagePosition || "center center" }}
                onError={(event) => {
                  const fallback = publicImageSrc(slide.fallbackImageUrl) || HERO_IMAGE_FALLBACK;
                  if (event.currentTarget.src !== fallback) {
                    event.currentTarget.src = fallback;
                  }
                }}
                alt=""
              />
            ))}
          </div>

          <div className="hero-card__content">
            <div className="hero-copy" key={activeSlide?.id || "empty"}>
              <div className="hero-kicker">AI powered travel</div>
              <h1 className="hero-title">{activeSlide?.title || "Plan smarter. Travel better."}</h1>
              <p className="hero-lead">
                {activeSlide?.subtitle || "Create a personalized itinerary, discover verified places and organize every day of your trip in one app."}
              </p>
            </div>
          </div>

          <div className="hero-search" aria-label="TravelorAI benefits">
            <div className="hero-search__item">
              <Sparkles size={17} />
              AI itinerary
            </div>
            <div className="hero-search__item">
              <ShieldCheck size={16} />
              Verified places
            </div>
            <div className="hero-search__item">
              <MapPin size={16} />
              Smart routes
            </div>
            <Link className="hero-search__button" href={actionHref}>
              Explore platform
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
