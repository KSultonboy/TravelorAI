"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Minus, Phone, Plus } from "lucide-react";
import { useAuth } from "./useAuth";
import { getAttribution } from "@/lib/attribution";

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** Brauzer sana maydonini o'z tilida (mm/dd/yyyy) ko'rsatadi — tanlanganini
 *  o'zbekcha yozib beramiz, foydalanuvchi chalkashmasin. */
function uzDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d}-${UZ_MONTHS[m - 1]} ${y}`;
}
const todayIso = () => new Date().toISOString().slice(0, 10);

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

  const subtotal = useMemo(() => basePrice * travelers, [basePrice, travelers]);

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
          <div className="mkt-field">
            <label>Sayohat sanasi</label>
            <div className="mkt-input">
              <CalendarDays size={16} />
              <input type="date" lang="uz" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <small style={{ color: "var(--subtle)", fontSize: "0.78rem" }}>
              {date ? `Tanlandi: ${uzDate(date)}` : "Kun · oy · yil — taxminiy sanani tanlang"}
            </small>
          </div>

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

          {/* Bizda turist uchun xizmat haqi YO'Q — bron so'rovi bepul.
              Yakuniy narxni agentlik belgilaydi, shuning uchun "Jami" emas,
              "Taxminiy summa" deb ko'rsatamiz. */}
          <div className="mkt-book__rows">
            <div><span>{money(basePrice)} × {travelers} kishi</span><span>{money(subtotal)}</span></div>
            <div className="mkt-book__total"><span>Taxminiy summa</span><span>{money(subtotal)}</span></div>
          </div>

          {err ? <div className="mkt-alert mkt-alert--error" style={{ marginBottom: 10 }}>{err}</div> : null}

          {loading ? (
            <button className="btn btn--gold btn--lg btn--block" disabled>Yuklanmoqda...</button>
          ) : user ? (
            <button className="btn btn--gold btn--lg btn--block" onClick={book} disabled={busy}>{busy ? "Yuborilmoqda..." : "Hozir bron qilish"}</button>
          ) : (
            <a className="btn btn--gold btn--lg btn--block" href={`/signin?next=/tours/${encodeURIComponent(tourSlug)}`}>Kirib bron qiling</a>
          )}
          <p className="mkt-book__note">
            Bron so‘rovi <b>bepul</b> — hech qanday to‘lov olinmaydi. So‘rov tasdiqlangan agentlikka yuboriladi,
            yakuniy narx va shartlar agentlik bilan kelishiladi.
          </p>
        </>
      )}
    </aside>
  );
}
