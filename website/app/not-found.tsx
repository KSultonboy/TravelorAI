import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Sahifa topilmadi",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <MarketingShell>
      <section className="mkt-section" style={{ marginTop: 72, textAlign: "center" }}>
        <div className="mkt-wrap">
          <span className="mkt-eyebrow">404</span>
          <h1 className="mkt-h2" style={{ marginTop: 12 }}>Sahifa topilmadi</h1>
          <p className="mkt-lead" style={{ margin: "12px auto 28px" }}>
            Siz qidirgan sahifa mavjud emas, o‘chirilgan yoki manzili o‘zgargan bo‘lishi mumkin.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn--gold btn--lg" href="/tours">Turlarni ko‘rish</Link>
            <Link className="btn btn--navy btn--lg" href="/">Bosh sahifa</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
