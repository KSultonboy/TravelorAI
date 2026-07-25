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
    title: "1. Orzuingizni ayting",
    desc: "Yo‘nalish, sanalar, afzalliklar va sayohat uslubingizni kiriting — AI shu asosda boshlaydi.",
  },
  {
    icon: Briefcase,
    title: "2. AI reja tuzadi",
    desc: "Algoritmimiz joylar, mehmonxonalar va vaqt bilan shaxsiy rejani bir zumda yaratadi.",
  },
  {
    icon: Plane,
    title: "3. Yig‘iling va jo‘nang",
    desc: "Rejangizni ko‘ring, saqlang va bronlaringizni to‘g‘ridan-to‘g‘ri kuzating.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section section--soft">
      <div className="lp-wrap">
        <div className="section-head lp-reveal" style={{ justifyContent: "center", textAlign: "center" }}>
          <div>
            <h2>TravelorAI qanday ishlaydi</h2>
            <p>Mukammal sayohatingiz — ilg‘or AI yordamida uchta oddiy qadamda tayyorlanadi.</p>
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
