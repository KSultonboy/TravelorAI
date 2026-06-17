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
            <h2>Ommabop yo‘nalishlar</h2>
            <p>Tasdiqlangan sayohat ma’lumotlari va jamoa baholari asosida tanlangan eng yuqori reytingli joylar.</p>
          </div>
          <Link className="view-link" href="#how-it-works">
            Qanday ishlaydi
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
                  <p>{item.description || item.info || "Shaxsiy marshrutlar, tasdiqlangan joylar va mahalliy kontekst."}</p>
                  <div className="destination-card__meta">
                    <Star size={14} fill="currentColor" />
                    {item.rating ? `${item.rating.toFixed(1)} reyting` : "Tasdiqlangan"}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="landing-empty lp-reveal">
              <strong>Yangi yo‘nalishlar tez orada.</strong>
              <span>To‘plamimiz to‘ldirilayotgan bir paytda, istalgan shahar uchun AI sayohat rejasini mobil ilovada yarating.</span>
              <Link href="#how-it-works">TravelorAI qanday ishlashini ko‘ring <ArrowRight size={15} /></Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
