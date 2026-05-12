"use client";

import type { LucideIcon } from "lucide-react";
import { Briefcase, MessageSquareText, Plane } from "lucide-react";

type Step = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const STEPS: Step[] = [
  {
    icon: MessageSquareText,
    title: "1. Tell us your dream",
    desc: "Enter your destination, dates, preferences, and travel style so AI can begin.",
  },
  {
    icon: Briefcase,
    title: "2. AI crafts itinerary",
    desc: "Our algorithm instantly generates a personal plan with places, hotels and time.",
  },
  {
    icon: Plane,
    title: "3. Pack & Go",
    desc: "Review, save, and follow your bookings directly from your trip plan.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section section--soft">
      <div className="lp-wrap">
        <div className="section-head lp-reveal" style={{ justifyContent: "center", textAlign: "center" }}>
          <div>
            <h2>How TravelorAI Works</h2>
            <p>Your perfect trip, generated in three simple steps using advanced AI travel intelligence.</p>
          </div>
        </div>

        <div className="steps-grid">
          {STEPS.map((step) => {
            const Icon = step.icon;

            return (
              <article className="step-card lp-reveal" key={step.title}>
                <div className="step-card__icon">
                  <Icon size={22} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
