"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Minus, Phone, Plus } from "lucide-react";
import { useAuth } from "./useAuth";
import { getAttribution } from "@/lib/attribution";

const SERVICE_FEE = 0.05;

export default function BookingPanel({
  tourSlug,
  basePrice,
  currency = "USD",
  priceLabel,
}: {
  tourSlug: string;
  basePrice: number;
  currency?: string;
  priceLabel: string;
}) {
  const { user, loading } = useAuth();
  const [travelers, setTravelers] = useState(2);
  const [date, setDate] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const { subtotal, fee, total } = useMemo(() => {
    const sub = basePrice * travelers;
    const f = Math.round(sub * SERVICE_FEE);
    return { subtotal: sub, fee: f, total: sub + f };
  }, [basePrice, travelers]);

  const money = (v: number) => (basePrice > 0 ? `${v.toLocaleString("uz-UZ")} ${currency}` : "—");

  async function book() {
    if (!user) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/backend/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ tourSlug, customerName: user.fullName || user.name, customerEmail: user.email, customerPhone: phone.trim(), travelers, travelDate: date || "", source: "web", ...getAttribution() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok || j?.success) { setOk(true); return; }
      setErr(j?.message || "Bron yuborilmadi. Keyinroq urinib ko‘ring.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="mkt-book">
      <div className="mkt-book__price"><b>{priceLabel}</b><span>kishi boshiga</span></div>

      {ok ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div className="mkt-vcard__icon" style={{ margin: "0 auto", background: "#e9f9f1", color: "var(--success)" }}><CheckCircle2 size={22} /></div>
          <h3 style={{ margin: "10px 0 4px" }}>Bron so‘rovi yuborildi!</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "0 0 14px" }}>Agentligi tez orada siz bilan bog‘lanadi.</p>
          <a className="btn btn--navy btn--md btn--block" href="/my-trips">Bronlarimni ko‘rish</a>
        </div>
      ) : (
        <>
          <div className="mkt-field"><label>Sayohat sanasi</label><div className="mkt-input"><CalendarDays size={16} /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div></div>

          <div className="mkt-field">
            <label>Sayohatchilar</label>
            <div className="mkt-stepper">
              <button type="button" aria-label="Kamaytirish" onClick={() => setTravelers((n) => Math.max(1, n - 1))}><Minus size={16} /></button>
              <span>{travelers} kishi</span>
              <button type="button" aria-label="Ko‘paytirish" onClick={() => setTravelers((n) => Math.min(20, n + 1))}><Plus size={16} /></button>
            </div>
          </div>

          {user ? (
            <div className="mkt-field"><label>Telefon</label><div className="mkt-input"><Phone size={16} /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 .." /></div></div>
          ) : null}

          <div className="mkt-book__rows">
            <div><span>{money(basePrice)} × {travelers}</span><span>{money(subtotal)}</span></div>
            <div><span>Xizmat haqi (5%)</span><span>{money(fee)}</span></div>
            <div className="mkt-book__total"><span>Jami</span><span>{money(total)}</span></div>
          </div>

          {err ? <div className="mkt-alert mkt-alert--error" style={{ marginBottom: 10 }}>{err}</div> : null}

          {loading ? (
            <button className="btn btn--gold btn--lg btn--block" disabled>Yuklanmoqda...</button>
          ) : user ? (
            <button className="btn btn--gold btn--lg btn--block" onClick={book} disabled={busy}>{busy ? "Yuborilmoqda..." : "Hozir bron qilish"}</button>
          ) : (
            <a className="btn btn--gold btn--lg btn--block" href={`/signin?next=/tours/${encodeURIComponent(tourSlug)}`}>Kirib bron qiling</a>
          )}
          <p className="mkt-book__note">Bron so‘rovi tasdiqlangan agentligiga yuboriladi. Yakuniy narx agentligi bilan kelishiladi.</p>
        </>
      )}
    </aside>
  );
}
