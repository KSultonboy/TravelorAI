import type { Metadata } from "next";
import { Suspense } from "react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import PremiumClient from "@/components/marketing/PremiumClient";

export const metadata: Metadata = {
  title: "Premium",
  description:
    "TravelorAI Premium — bitta obuna, mobil ilova va saytda birga ishlaydi. To'lov CLICK orqali.",
  alternates: { canonical: "/premium" },
};

export const revalidate = 0;

const HERO = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=70";

export default function PremiumPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Sayohatchilar uchun"
        title="TravelorAI Premium"
        subtitle="Bitta obuna — ilovada ham, saytda ham. Ilovada to'lasangiz saytda ko'rinadi, saytda to'lasangiz ilovada."
        image={HERO}
      />
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Suspense fallback={null}>
            <PremiumClient />
          </Suspense>
        </div>
      </section>
    </MarketingShell>
  );
}
