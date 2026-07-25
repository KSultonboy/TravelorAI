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
              <p className="section-kicker">Hammasi bir joyda</p>
              <h2 id="product-showcase-title">G‘oyadan rejagacha</h2>
              <p>TravelorAI rejalashtirish, kashf etish va sayohatni boshqarishni birlashtiradi — har bir qaror aniq qoladi.</p>
            </div>
          </div>
          <div className="product-grid">
            {[
              { icon: Sparkles, title: "Shaxsiy AI rejalar", text: "Byudjet, sanalar va qiziqishlaringizga mos reja yarating." },
              { icon: MapPinned, title: "Tasdiqlangan kashfiyot", text: "Joylarni foydali kontekst, reyting va marshrut ma’lumotlari bilan o‘rganing." },
              { icon: CalendarCheck2, title: "Kun bo‘yicha nazorat", text: "Faoliyatlarni tahrirlang, vaqtni tartibga soling va butun sayohatni bir ko‘rinishda saqlang." },
              { icon: WalletCards, title: "Byudjet shaffofligi", text: "Taxminiy xarajatlarni kuzating va uslubingizga mos tanlov qiling." },
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
            <h2>Yetakchi agentliklar ishonchida</h2>
            <p>Sifat, sharhlar va sayohatchilar baholari bo‘yicha saralangan faol hamkorlar.</p>
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
                  <h2>Sayohatchilar fikrlari</h2>
                  <p>Faqat bizning so‘zimizga ishonmang — jamoamiz nima deyishini ko‘ring.</p>
                </div>
                <div className="story-actions">
                  <button
                    type="button"
                    aria-label="Oldingi fikrlar"
                    disabled={pageCount <= 1}
                    onClick={() => setStoryPage((current) => (current - 1 + pageCount) % pageCount)}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Keyingi fikrlar"
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
