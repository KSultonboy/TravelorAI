"use client";

import { formatDateTime } from "@/lib/agency/api";

/** «Takliflar» jadvali: mijoz taklif sahifasida «To‘lash» tugmasini bosgan (payment_clicked). */
export default function PaymentClickBadge({ p }: { p: { paymentClickedAt?: string | null; paymentClickCount?: number } }) {
  if (!p.paymentClickedAt) return null;
  const count = Number(p.paymentClickCount) || 0;
  return (
    <div style={{ marginTop: 4 }}>
      <span className="badge2 b-amber" title={`Oxirgi marta: ${formatDateTime(p.paymentClickedAt)}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        💳 To‘lash bosildi{count > 1 ? ` · ${count}×` : ""}
      </span>
    </div>
  );
}
