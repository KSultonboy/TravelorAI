import type { Metadata } from "next";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import CatalogClient from "@/components/marketing/CatalogClient";
import { fetchAllTours, fetchHeroImage } from "@/lib/marketingApi";
import { publicImageSrc } from "@/lib/imageUrls";

export const metadata: Metadata = {
  title: "Turlar",
  description:
    "Tasdiqlangan agentliklarning sayohat turlari. Yo‘nalish va shahar bo‘yicha filtrlang, reyting yoki narx bo‘yicha saralang — bron qilish uchun hisobingizga kiring.",
  alternates: { canonical: "/tours" },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string | string[]; q?: string | string[] }>;
}) {
  const [params, tours, heroImg] = await Promise.all([
    searchParams,
    fetchAllTours(),
    fetchHeroImage(),
  ]);
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || "";
  const region = first(params.region).slice(0, 60);
  // ?q= — Google sitelinks qidiruv qutisi (layout JSON-LD SearchAction) shu parametrni yuboradi.
  const q = first(params.q).slice(0, 120);

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Tasdiqlangan agentlik turlari"
        title="Sayohat turlari"
        subtitle="Rasm, narx, agentlik va javob muddati shaffof. Ko‘rib chiqing — bron qilmoqchi bo‘lsangiz hisobingizga kirishingiz so‘raladi."
        image={heroImg ? publicImageSrc(heroImg) : ""}
      />
      <CatalogClient tours={tours} initialRegion={region} initialQuery={q} />
    </MarketingShell>
  );
}
