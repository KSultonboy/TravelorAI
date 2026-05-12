"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
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
  const topAgencies = agencies.slice(0, 6);
  const storyItems = stories.slice(0, 3);

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

  if (topAgencies.length === 0 && storyItems.length === 0) return null;

  return (
    <>
      {topAgencies.length > 0 ? (
        <section className="trusted">
          <div className="lp-wrap lp-reveal">
            <h2>Trusted by Top Agencies</h2>
            <p>Backenddagi aktiv agency reytinglari asosida ko&apos;rsatiladi.</p>
            <div className="agency-row">
              {topAgencies.map((agency) => (
                <button
                  key={agency.id || agency.slug || agency.name}
                  type="button"
                  title={agency.specialty || agency.city}
                  onClick={() =>
                    trackLandingEvent({
                      entityType: "agency",
                      entityId: agency.id,
                      eventType: "agency_click",
                      metadata: { slug: agency.slug, section: "trusted_agencies" },
                    })
                  }
                >
                  {agency.name}
                </button>
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
                  <button type="button" aria-label="Previous story">
                    <ArrowLeft size={16} />
                  </button>
                  <button type="button" aria-label="Next story">
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <div className="story-grid">
                {storyItems.map((story) => (
                  <article
                    className="story-card"
                    key={story.id || story.slug || story.authorName}
                    onClick={() =>
                      trackLandingEvent({
                        entityType: "story",
                        entityId: story.id,
                        eventType: "click",
                        metadata: { slug: story.slug, section: "traveler_stories" },
                      })
                    }
                  >
                    <div className="stars" aria-label="5 stars">
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
