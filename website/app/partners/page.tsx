import type { Metadata } from "next";
import { BarChart3, Globe2, ShieldCheck, Wallet } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import PartnerForm from "@/components/marketing/PartnerForm";

export const metadata: Metadata = {
  title: "Hamkorlar uchun",
  description: "Turagentligi sifatida TravelorAI platformasiga qo'shiling — yangi mijozlar, raqamli kanal va shaffof bozor. Hoziroq ariza qoldiring.",
  alternates: { canonical: "/partners" },
};

const HERO = "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1920&q=70";

const BENEFITS = [
  { icon: Globe2, title: "Yangi mijoz oqimi", text: "Minglab faol sayohatchilar sizning turlaringizni TravelorAI orqali topadi." },
  { icon: BarChart3, title: "Raqamli kanal", text: "Turlaringizni qo'shing, bron va so'rovlarni bitta paneldan boshqaring." },
  { icon: ShieldCheck, title: "Ishonch belgisi", text: "Tasdiqlangan hamkor sifatida reyting va sharhlar bilan ishonch qozoning." },
  { icon: Wallet, title: "Shaffof bozor", text: "Komissiyasiz model — mijoz siz bilan to'g'ridan-to'g'ri bog'lanadi." },
];

const STEPS = [
  { n: 1, title: "Ariza qoldiring", text: "Biznes ma'lumotlari bilan ro'yxatdan o'ting." },
  { n: 2, title: "Tasdiqlash", text: "Email tasdiqlanadi, admin arizangizni ko'rib chiqadi." },
  { n: 3, title: "Turlarni qo'shing", text: "Portal orqali turlar, narx va paketlarni joylang." },
  { n: 4, title: "Mijoz qabul qiling", text: "So'rovlarni qabul qiling va sayohatchilar bilan ishlang." },
];

export default function PartnersPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Hamkorlar uchun"
        title="Turagentligingizni raqamlashtiring"
        subtitle="TravelorAI tasdiqlangan turagentliklarini sayohatchilar bilan bog'laydi. Yangi mijozlar, kuchli brend va oson boshqaruv — bir platformada."
        image={HERO}
      />

      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head mkt-section__head--center">
            <span className="mkt-eyebrow">Nega TravelorAI hamkori</span>
            <h2 className="mkt-h2">Biznesingizni o'stiring</h2>
          </Reveal>
          <div className="mkt-vgrid">
            {BENEFITS.map((b, i) => {
              const Icon = b.icon;
              return (
                <Reveal key={b.title} delay={i * 80} as="article" className="mkt-vcard">
                  <span className="mkt-vcard__icon"><Icon size={24} /></span>
                  <h3>{b.title}</h3>
                  <p>{b.text}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--soft">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head">
            <span className="mkt-eyebrow">Qanday ishlaydi</span>
            <h2 className="mkt-h2">4 ta oddiy qadam</h2>
          </Reveal>
          <div className="mkt-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80} as="div" className="mkt-step">
                <span className="mkt-step__n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-contact-grid">
            <Reveal>
              <span className="mkt-eyebrow">Boshlang</span>
              <h2 className="mkt-h2" style={{ marginBottom: 14 }}>Hoziroq ariza qoldiring</h2>
              <p className="mkt-lead">Ariza yuborilgach, emailingizga tasdiqlash kodi keladi. Hisob tasdiqlanib, admin ko'rib chiqqach, agentlik portaliga to'liq kirish ochiladi.</p>
            </Reveal>
            <Reveal delay={120}>
              <PartnerForm />
            </Reveal>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
