import MarketingShell from "./MarketingShell";
import PageHero from "./PageHero";
import Reveal from "./Reveal";

export type LegalSection = { heading: string; body: string[] };

const HERO = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=70";

export default function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <MarketingShell>
      <PageHero eyebrow="Huquqiy" title={title} subtitle={`Oxirgi yangilanish: ${updated}`} image={HERO} />
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-prose">
            <p>{intro}</p>
            {sections.map((s) => (
              <div key={s.heading}>
                <h2>{s.heading}</h2>
                {s.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
