"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";

export type LandingHeroSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  actionUrl?: string | null;
  sortOrder?: number;
};

export default function Hero({ slides = [] }: { slides?: LandingHeroSlide[] }) {
  const heroSlides = slides.filter((slide) => slide.imageUrl);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = heroSlides.length > 0 ? activeIndex % heroSlides.length : 0;
  const activeSlide = heroSlides[safeActiveIndex] || null;

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroSlides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  return (
    <section className="hero-stage">
      <div className="lp-wrap">
        <div className="hero-card lp-reveal">
          <div className="hero-card__bg" aria-hidden="true">
            {heroSlides.map((slide, index) => (
              <img
                className={index === safeActiveIndex ? "active" : ""}
                key={slide.id}
                src={slide.imageUrl}
                alt=""
              />
            ))}
          </div>

          <div className="hero-card__content">
            <div className="hero-copy" key={activeSlide?.id || "empty"}>
              <div className="hero-kicker">AI powered travel</div>
              <h1 className="hero-title">{activeSlide?.title || "TravelorAI"}</h1>
              <p className="hero-lead">
                {activeSlide?.subtitle || "Hero slaydlar admin paneldan boshqariladi."}
              </p>
            </div>
          </div>

          {heroSlides.length > 1 ? (
            <div className="hero-slide-rail" aria-label="Hero image sequence">
              {heroSlides.slice(0, 6).map((slide, index) => (
                <button
                  className={index === safeActiveIndex ? "active" : ""}
                  key={slide.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  <img src={slide.imageUrl} alt={slide.title} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="hero-search" role="search">
            <div className="hero-search__item">
              <Search size={17} />
              Where do you want to go?
            </div>
            <div className="hero-search__item">
              <CalendarDays size={16} />
              Add dates
            </div>
            <div className="hero-search__item">
              <Users size={16} />
              Guests
            </div>
            <Link className="hero-search__button" href={activeSlide?.actionUrl || "#destinations"}>
              <MapPin size={16} />
              Explore
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
