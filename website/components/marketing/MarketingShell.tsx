import type { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

/** Barcha marketing sahifalari uchun umumiy o'rash: .mkt scope + header + footer */
export default function MarketingShell({
  children,
  transparentHeader = false,
}: {
  children: ReactNode;
  transparentHeader?: boolean;
}) {
  return (
    <div className="mkt">
      <SiteHeader transparentOverHero={transparentHeader} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
