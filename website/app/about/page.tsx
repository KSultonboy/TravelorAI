import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import CountUp from "@/components/marketing/CountUp";

export const metadata: Metadata = {
  title: "Biz haqimizda",
  description: "TravelorAI — chiqish, ichki va kirish turizmini bitta AI platformada birlashtirayotgan O'zbekiston startapi. Bizning missiya va rivojlanish rejasi.",
  alternates: { canonical: "/about" },
};

const HERO = "https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=70";

const VALUES = [
  { icon: ShieldCheck, title: "Ishonch", text: "Faqat tasdiqlangan agentliklar, shaffof narx va halol reyting." },
  { icon: Sparkles, title: "Innovatsiya", text: "Sun'iy intellekt har bir sayohatchiga shaxsiy yondashuvni ta'minlaydi." },
  { icon: HeartHandshake, title: "Mahalliylik", text: "O'zbekiston turagentliklari va mintaqalari rivoji biz uchun ustuvor." },
];

const ROADMAP = [
  { tag: "Hozir", cls: "mkt-road--now", title: "Chiqish turizmi", text: "AI tur paketlari bilan o'zbek aholisini chet elga uyushgan sayohatlarga yuborishni raqamlashtiramiz." },
  { tag: "Keyingi", cls: "", title: "Ichki turizm", text: "Sayohatchilarni AI marshrutlar va tasdiqlangan joylar bilan O'zbekistonda uzoqroq ushlab qolamiz." },
  { tag: "Kelajak", cls: "mkt-road--soon", title: "Kirish turizmi", text: "Ko'p tilli AI-gid va integratsiyalar orqali chet elliklarni O'zbekistonga jalb qilamiz." },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Biz haqimizda"
        title="O'zbekiston turizmini raqamlashtirayapmiz"
        subtitle="TravelorAI — chiqish, ichki va kirish turizmini bitta sun'iy intellekt platformasiga birlashtiruvchi mahalliy startap. Maqsadimiz — sayohatni har bir kishi uchun oson, ishonchli va aqlli qilish."
        image={HERO}
      />

      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head">
            <span className="mkt-eyebrow">Missiyamiz</span>
            <h2 className="mkt-h2">Sayohatni hamma uchun ochiq qilish</h2>
            <p className="mkt-lead">Biz texnologiya, tasdiqlangan hamkorlar va shaffof ma'lumot orqali turizm bozorini soddalashtiramiz — sayohatchiga vaqt, agentligiga yangi mijozlar, mamlakatga esa daromad olib kelamiz.</p>
          </Reveal>
          <div className="mkt-stats" style={{ marginTop: 12 }}>
            <Reveal as="div" className="mkt-stat"><div className="mkt-stat__num"><CountUp to={13} suffix="+" /></div><div className="mkt-stat__label">Yo'nalishlar</div></Reveal>
            <Reveal as="div" delay={80} className="mkt-stat"><div className="mkt-stat__num"><CountUp to={120} suffix="+" /></div><div className="mkt-stat__label">Sayohat turlari</div></Reveal>
            <Reveal as="div" delay={160} className="mkt-stat"><div className="mkt-stat__num"><CountUp to={5000} suffix="+" /></div><div className="mkt-stat__label">Sayohatchi</div></Reveal>
            <Reveal as="div" delay={240} className="mkt-stat"><div className="mkt-stat__num">24/7</div><div className="mkt-stat__label">Yordam</div></Reveal>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--soft">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head mkt-section__head--center">
            <span className="mkt-eyebrow">Qadriyatlarimiz</span>
            <h2 className="mkt-h2">Biz nimaga ishonamiz</h2>
          </Reveal>
          <div className="mkt-values">
            {VALUES.map((v, i) => {
              const Icon = v.icon;
              return (
                <Reveal key={v.title} delay={i * 90} as="article" className="mkt-vcard">
                  <span className="mkt-vcard__icon"><Icon size={24} /></span>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head">
            <span className="mkt-eyebrow"><Globe2 size={14} /> Rivojlanish rejasi</span>
            <h2 className="mkt-h2">Uch turizm — bosqichma-bosqich</h2>
            <p className="mkt-lead">Biz chiqish turizmidan boshlaymiz, so'ng ichki turizmni mustahkamlaymiz va kirish turizmiga o'tamiz.</p>
          </Reveal>
          <div className="mkt-roadmap">
            {ROADMAP.map((r, i) => (
              <Reveal key={r.title} delay={i * 100} as="div" className={`mkt-road ${r.cls}`}>
                <span className="mkt-road__tag">{r.tag}</span>
                <h3 style={{ margin: "8px 0 8px", fontSize: "1.2rem", fontWeight: 800 }}>{r.title}</h3>
                <p style={{ color: "var(--muted)", lineHeight: 1.65, margin: 0, fontSize: "0.92rem" }}>{r.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ marginTop: 36 }}>
            <Link className="btn btn--gold btn--lg" href="/partners">Hamkor bo'lish <ArrowRight size={18} /></Link>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
