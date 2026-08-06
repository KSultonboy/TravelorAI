import type { Metadata } from "next";
import { Suspense } from "react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PaymentReturnClient from "@/components/marketing/PaymentReturnClient";

export const metadata: Metadata = {
  title: "To'lov holati",
  description: "CLICK to'lovi holati.",
  robots: { index: false, follow: false },
};

export const revalidate = 0;

export default function PaymentReturnPage() {
  return (
    <MarketingShell>
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Suspense fallback={null}>
            <PaymentReturnClient />
          </Suspense>
        </div>
      </section>
    </MarketingShell>
  );
}
