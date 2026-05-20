"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { trackLandingEvent } from "@/lib/landingEvents";
import { publicImageSrc } from "@/lib/imageUrls";

export type LandingPlace = {
  id: string;
  slug?: string;
  name: string;
  city: string;
  type?: string;
  imageUrl?: string | null;
  description?: string | null;
  info?: string | null;
  rating?: number | null;
  rankingScore?: number | null;
};

function imageValue(item: LandingPlace) {
  if (item.imageUrl) return `url("${publicImageSrc(item.imageUrl)}")`;
  return "linear-gradient(135deg, #0c8b63, #101217)";
}

export default function Destinations({ places = [] }: { places?: LandingPlace[] }) {
  const items = places.slice(0, 3);

  useEffect(() => {
    items.forEach((item) => {
      trackLandingEvent({
        entityType: "place",
        entityId: item.id,
        eventType: "view",
        metadata: { slug: item.slug, section: "trending_destinations" },
      });
    });
  }, [items]);

  return (
    <section id="features" className="section">
      <div className="lp-wrap">
        <div className="section-head lp-reveal">
          <div>
            <h2>Trending Destinations</h2>
            <p>Backenddan kelayotgan real joylar va user signallari asosida global mashhur nuqtalar.</p>
          </div>
          <Link className="view-link" href="#about">
            Learn more
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="destination-cards">
          {items.length > 0 ? (
            items.map((item) => (
              <Link
                href="#about"
                className="destination-card lp-reveal"
                key={item.id || item.slug || item.name}
                style={{ "--image": imageValue(item) } as CSSProperties}
                onClick={() =>
                  trackLandingEvent({
                    entityType: "place",
                    entityId: item.id,
                    eventType: "click",
                    metadata: { slug: item.slug, section: "trending_destinations" },
                  })
                }
              >
                <div className="destination-card__content">
                  <span className="destination-card__city">{item.city}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description || item.info || "Personalized routes, verified places and local context."}</p>
                  <div className="destination-card__meta">
                    <Star size={14} fill="currentColor" />
                    {item.rating ? `${item.rating.toFixed(1)} rating` : "Backend verified"}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="landing-empty lp-reveal">Featured destinations are being prepared.</div>
          )}
        </div>
      </div>
    </section>
  );
}
