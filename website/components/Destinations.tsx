"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
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

function destinationHref(item: LandingPlace) {
  const query = [item.name, item.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function Destinations({ places = [] }: { places?: LandingPlace[] }) {
  const items = useMemo(() => places.slice(0, 3), [places]);

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
            <p>Discover highly rated places selected from verified travel data and community signals.</p>
          </div>
          <Link className="view-link" href="#how-it-works">
            How it works
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="destination-cards">
          {items.length > 0 ? (
            items.map((item) => (
              <Link
                href={destinationHref(item)}
                target="_blank"
                rel="noopener noreferrer"
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
            <div className="landing-empty lp-reveal">
              <strong>New destinations are on the way.</strong>
              <span>Use the mobile app to create an AI trip for any city while our featured collection grows.</span>
              <Link href="#how-it-works">See how TravelorAI works <ArrowRight size={15} /></Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
