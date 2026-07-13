import type { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import WishlistProvider from "./WishlistProvider";
import ScrollFx from "./ScrollFx";

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
      <ScrollFx />
      <WishlistProvider>
        <SiteHeader transparentOverHero={transparentHeader} />
        <main>{children}</main>
        <SiteFooter />
      </WishlistProvider>
    </div>
  );
}
