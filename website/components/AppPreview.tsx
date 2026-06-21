"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarCheck2, MapPinned, Sparkles, Star, WalletCards } from "lucide-react";
import { trackLandingEvent } from "@/lib/landingEvents";

export type LandingAgency = {
  id: string;
  slug?: string;
  name: string;
  city?: string;
  specialty?: string;
  rating?: number | null;
  reviews?: number | null;
  rankingScore?: number | null;
};

export type LandingStory = {
  id: string;
  slug?: string;
  quote: string;
  authorName: string;
  authorRole: string;
  avatar?: string | null;
  avatarColor?: string | null;
  rating?: number | null;
  rankingScore?: number | null;
};

export default function AppPreview({
  agencies = [],
  stories = [],
}: {
  agencies?: LandingAgency[];
  stories?: LandingStory[];
}) {
  const topAgencies = useMemo(() => agencies.slice(0, 6), [agencies]);
  const storyItems = useMemo(() => stories.slice(0, 8), [stories]);
  const [storyPage, setStoryPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(storyItems.length / 3));
  const safeStoryPage = storyPage % pageCount;
  const visibleStories = storyItems.slice(safeStoryPage * 3, safeStoryPage * 3 + 3);

  useEffect(() => {
    topAgencies.forEach((agency) => {
      trackLandingEvent({
        entityType: "agency",
        entityId: agency.id,
        eventType: "view",
        metadata: { slug: agency.slug, section: "trusted_agencies" },
      });
    });

    storyItems.forEach((story) => {
      trackLandingEvent({
        entityType: "story",
        entityId: story.id,
        eventType: "story_view",
        metadata: { slug: story.slug, section: "traveler_stories" },
      });
    });
  }, [topAgencies, storyItems]);

  return (
    <>
      <section className="section product-showcase" aria-labelledby="product-showcase-title">
        <div className="lp-wrap">
          <div className="section-head section-head--center lp-reveal">
            <div>
              <p className="section-kicker">Everything in one place</p>
              <h2 id="product-showcase-title">From idea to itinerary</h2>
              <p>TravelorAI combines planning, discovery and trip management so every decision stays clear.</p>
            </div>
          </div>
          <div className="product-grid">
            {[
              { icon: Sparkles, title: "Personal AI plans", text: "Generate an itinerary around your budget, dates and interests." },
              { icon: MapPinned, title: "Verified discovery", text: "Explore places with useful context, ratings and route information." },
              { icon: CalendarCheck2, title: "Day-by-day control", text: "Edit activities, organize timing and keep the whole trip in one view." },
              { icon: WalletCards, title: "Budget visibility", text: "Track estimated costs and make choices that fit your travel style." },
            ].map(({ icon: Icon, title, text }) => (
              <article className="product-card lp-reveal" key={title}>
                <span><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {topAgencies.length > 0 ? (
        <section className="trusted">
          <div className="lp-wrap lp-reveal">
            <h2>Trusted by Top Agencies</h2>
            <p>Active travel partners ranked by quality, reviews and traveler signals.</p>
            <div className="agency-row">
              {topAgencies.map((agency) => (
                <span
                  key={agency.id || agency.slug || agency.name}
                  title={agency.specialty || agency.city}
                >
                  {agency.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {storyItems.length > 0 ? (
        <section id="stories" className="section">
          <div className="lp-wrap">
            <div className="stories-panel lp-reveal">
              <div className="stories-header">
                <div>
                  <h2>Traveler Stories</h2>
                  <p>Don&apos;t just take our word for it. See what our community has to say.</p>
                </div>
                <div className="story-actions">
                  <button
                    type="button"
                    aria-label="Previous stories"
                    disabled={pageCount <= 1}
                    onClick={() => setStoryPage((current) => (current - 1 + pageCount) % pageCount)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next stories"
                    disabled={pageCount <= 1}
                    onClick={() => setStoryPage((current) => (current + 1) % pageCount)}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <div className="story-grid">
                {visibleStories.map((story) => (
                  <article
                    className="story-card"
                    key={story.id || story.slug || story.authorName}
                  >
                    <div className="stars" aria-label={`${Math.max(1, Math.min(5, story.rating || 5))} stars`}>
                      {Array.from({ length: Math.max(1, Math.min(5, story.rating || 5)) }).map((_, index) => (
                        <Star key={index} size={13} fill="currentColor" />
                      ))}
                    </div>
                    <blockquote>&quot;{story.quote}&quot;</blockquote>
                    <div className="story-author">
                      <span
                        className="story-author__avatar"
                        style={{ "--avatar-bg": story.avatarColor || "#0c8b63" } as CSSProperties}
                      >
                        {story.avatar || story.authorName.charAt(0)}
                      </span>
                      <div>
                        <strong>{story.authorName}</strong>
                        <span>{story.authorRole}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
