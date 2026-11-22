"use client";

import { CreditCard, Landmark } from "lucide-react";
import "../../styles/presentation-payment.scss";

export type PresentationPaymentInfo = { url?: string | null; requisites?: string | null };

/** Backend allaqachon tekshiradi; bu yerda ham faqat https havola chiqariladi. */
function safeHttps(url?: string | null): string | null {
  const v = String(url || "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Taklif sahifasidagi agentlik to'lov havolasi va/yoki bank rekvizitlari.
 * «To‘lash» bosilganda `payment_clicked` hodisasi yoziladi (open/interest kabi),
 * havola esa yangi oynada ochiladi — to'lovni TravelorAI qabul qilmaydi.
 */
export default function PresentationPayment({ token, payment }: { token: string; payment: PresentationPaymentInfo }) {
  const url = safeHttps(payment.url);
  const requisites = String(payment.requisites || "").trim();
  if (!url && !requisites) return null;

  function track() {
    fetch(`/api/backend/p/${encodeURIComponent(token)}/payment-click`, { method: "POST", keepalive: true }).catch(() => {});
  }

  return (
    <section className="pres-pay" aria-label="To‘lov">
      {url ? (
        <div className="pres-pay__row">
          <a className="pres-pay__btn" href={url} target="_blank" rel="noopener noreferrer" onClick={track}>
            <CreditCard size={18} /> To‘lash
          </a>
          <small className="pres-pay__hint">To‘lov agentlikning o‘z to‘lov sahifasida amalga oshiriladi.</small>
        </div>
      ) : null}
      {requisites ? (
        <div className="pres-pay__req">
          <div className="pres-pay__req-title"><Landmark size={16} /> Bank rekvizitlari</div>
          <p>{requisites}</p>
        </div>
      ) : null}
    </section>
  );
}
