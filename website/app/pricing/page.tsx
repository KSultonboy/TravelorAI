import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import { fetchTariffs, type PublicTariff } from "@/lib/marketingApi";

export const metadata: Metadata = {
  title: "Tariflar",
  description:
    "TravelorAI CRM tariflari — Boshlang'ich, Pro va Premium. Narxlar O'zbekiston so'mida, to'lov CLICK yoki Payme orqali.",
  alternates: { canonical: "/pricing" },
};

export const revalidate = 0;

const HERO = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1920&q=70";

/** Tavsif va tartib — bazadagi tarif slug'iga bog'lanadi. */
const META: Record<string, { desc: string; best?: boolean }> = {
  starter: { desc: "Yangi boshlagan agentliklar uchun — asosiy CRM va marketplace lidlari." },
  pro: { desc: "O'sib borayotgan agentliklar uchun — Telegram bot, hisobotlar va dinamik takliflar.", best: true },
  business: { desc: "Jamoa bilan ishlaydigan agentliklar uchun — rollar, integratsiyalar va AI." },
  enterprise: { desc: "Yirik tarmoqlar uchun — maxsus integratsiya va shartlar." },
};

/** Backend javob bermasa ham sahifa TO'LIQ ko'rinishi kerak (CLICK tekshiradi). */
const FALLBACK: PublicTariff[] = [
  { slug: "starter", name: "Boshlang'ich", priceMonthly: 9, priceMonthlyUzs: 99000, sortOrder: 1,
    features: ["Marketplace lidlari", "Sotuv voronkasi", "Mijozlar bazasi", "Turlar katalogi", "To'lovlar hisobi"] },
  { slug: "pro", name: "Pro", priceMonthly: 29, priceMonthlyUzs: 299000, sortOrder: 2,
    features: ["Boshlang'ichdagi hammasi", "Telegram bot va avtomatik xabarlar", "Dinamik takliflar", "Hisobotlar va analitika", "Qo'lda lid qo'shish"] },
  { slug: "business", name: "Premium", priceMonthly: 59, priceMonthlyUzs: 599000, sortOrder: 3,
    features: ["Pro'dagi hammasi", "Jamoa va rollar", "Integratsiyalar", "AI yordamchi", "Ustuvor qo'llab-quvvatlash"] },
];

const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default async function PricingPage() {
  const fetched = await fetchTariffs();
  // Enterprise (narxi kelishiladi) kartalar qatorida ko'rsatilmaydi — pastda alohida.
  const all = fetched.length ? fetched : FALLBACK;
  const plans = all.filter((t) => t.slug !== "enterprise" && t.priceMonthlyUzs > 0);
  const list = plans.length ? plans : FALLBACK;

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Agentliklar uchun"
        title="Tariflar"
        subtitle="Bir oylik obuna — hech qanday yashirin to'lov yo'q. Istalgan vaqtda tarifni o'zgartirasiz."
        image={HERO}
      />

      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal>
            <div className="mkt-plans">
              {list.map((t) => {
                const meta = META[t.slug] || { desc: "" };
                const feats = t.features?.length ? t.features : FALLBACK.find((f) => f.slug === t.slug)?.features || [];
                return (
                  <div key={t.slug} className={`mkt-plan${meta.best ? " mkt-plan--best" : ""}`}>
                    {meta.best ? <span className="mkt-plan__tag">Eng ko&apos;p tanlanadi</span> : null}
                    <div className="mkt-plan__name">{t.name}</div>
                    {meta.desc ? <p className="mkt-plan__desc">{meta.desc}</p> : null}

                    <div className="mkt-plan__price">
                      <b>{som(t.priceMonthlyUzs)}</b>
                      <span>so&apos;m / oy</span>
                    </div>
                    <p className="mkt-plan__usd">QQS bilan · istalgan vaqtda bekor qilasiz</p>

                    <ul className="mkt-plan__list">
                      {feats.map((f) => (
                        <li key={f}><Check size={16} /> <span>{f}</span></li>
                      ))}
                    </ul>

                    <Link
                      href="/partners"
                      className={`btn ${meta.best ? "btn--gold" : "btn--navy"} btn--md btn--block`}
                    >
                      Boshlash
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="mkt-pay-note">
              <span>To&apos;lov usullari: <strong>CLICK</strong> · <strong>Payme</strong> · bank o&apos;tkazmasi</span>
              <span>·</span>
              <span>Barcha narxlar QQS bilan, O&apos;zbekiston so&apos;mida</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section mkt-section--soft">
        <div className="mkt-wrap">
          <Reveal className="mkt-prose">
            <h2>Enterprise — yirik tarmoqlar uchun</h2>
            <p>
              Bir nechta filial, maxsus integratsiyalar yoki alohida shartlar kerak bo&apos;lsa — narx va imkoniyatlar
              individual kelishiladi. <Link href="/contact">Bizga murojaat qiling</Link>.
            </p>

            <h2>Ko&apos;p beriladigan savollar</h2>
            <p>
              <b>Obuna qanday faollashadi?</b> To&apos;lov o&apos;tgan zahoti agentlik kabinetida obuna avtomatik
              faollashadi — kutish kerak emas.
            </p>
            <p>
              <b>Obuna tugasa ma&apos;lumotlarim o&apos;chadimi?</b> Yo&apos;q. Kabinet &laquo;faqat o&apos;qish&raquo;
              rejimiga o&apos;tadi: barcha ma&apos;lumot joyida qoladi, yangi yozuv kiritish cheklanadi.
              To&apos;lovdan keyin hammasi tiklanadi.
            </p>
            <p>
              <b>Tarifni o&apos;zgartirsam bo&apos;ladimi?</b> Ha, istalgan vaqtda. Qolgan kunlar hisobga olinadi.
            </p>
            <p>
              <b>Pul qaytariladimi?</b> Xato to&apos;lov to&apos;liq qaytariladi. Boshqa holatlar{" "}
              <Link href="/offer">ommaviy oferta</Link>ning 6-bandida batafsil yozilgan.
            </p>
            <p>
              To&apos;liq shartlar: <Link href="/offer">Ommaviy oferta</Link> ·{" "}
              <Link href="/terms">Foydalanish shartlari</Link> · <Link href="/privacy">Maxfiylik siyosati</Link>
            </p>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
