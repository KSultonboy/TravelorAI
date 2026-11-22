import type { Metadata } from "next";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import ContactForm from "@/components/marketing/ContactForm";
import { CONTACT, LEGAL_ENTITY } from "@/lib/legalEntity";

export const metadata: Metadata = {
  title: "Aloqa",
  description: "TravelorAI bilan bog'laning — telefon, email, Telegram yoki xabar formasi orqali.",
  alternates: { canonical: "/contact" },
};

const HERO = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1920&q=70";

// Barcha aloqa ma'lumotlari yagona manbadan — lib/legalEntity.ts (soxta
// "+998 90 000 00 00" o'rniga haqiqiy raqam va yuridik manzil).
const telegramHandle = "@" + CONTACT.telegram.replace(/^https?:\/\/t\.me\//i, "");
const CHANNELS = [
  { icon: Phone, title: "Telefon", value: CONTACT.phone, href: `tel:${CONTACT.phoneHref}` },
  { icon: Mail, title: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: Send, title: "Telegram", value: telegramHandle, href: CONTACT.telegram },
  ...(LEGAL_ENTITY.address
    ? [{
        icon: MapPin,
        title: "Yuridik manzil",
        value: LEGAL_ENTITY.address,
        href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LEGAL_ENTITY.address)}`,
      }]
    : []),
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Aloqa"
        title="Biz bilan bog'laning"
        subtitle="Savol, taklif yoki hamkorlik bo'yicha murojaat qiling — jamoamiz tez orada javob beradi."
        image={HERO}
      />
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-contact-grid">
            <Reveal>
              <span className="mkt-eyebrow">Aloqa kanallari</span>
              <h2 className="mkt-h2" style={{ marginBottom: 22 }}>To'g'ridan-to'g'ri bog'laning</h2>
              <div className="mkt-channels">
                {CHANNELS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <a key={c.title} className="mkt-channel" href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                      <span className="mkt-channel__icon"><Icon size={20} /></span>
                      <span><b>{c.title}</b><span>{c.value}</span></span>
                    </a>
                  );
                })}
              </div>
              {LEGAL_ENTITY.legalName ? (
                <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 18 }}>
                  {LEGAL_ENTITY.legalName}{LEGAL_ENTITY.stir ? ` · STIR ${LEGAL_ENTITY.stir}` : ""}
                </p>
              ) : null}
            </Reveal>
            <Reveal delay={120}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
