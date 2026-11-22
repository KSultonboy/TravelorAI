"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, MessageSquare, Minus, Phone, Plus, User } from "lucide-react";
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

/**
 * O'zbekiston raqamini +998XXXXXXXXX ko'rinishiga keltiradi.
 * "+998 90 123 45 67", "998901234567", "90 123 45 67" — hammasi qabul qilinadi.
 * Noto'g'ri bo'lsa — null.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const full = digits.length === 9 ? `998${digits}` : digits;
  if (!/^998\d{9}$/.test(full)) return null;
  return `+${full}`;
}

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
  const ids = useId();
  const [travelers, setTravelers] = useState(2);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const subtotal = useMemo(() => basePrice * travelers, [basePrice, travelers]);

  // toLocaleString("uz-UZ") server (Node ICU) va brauzerda turlicha chiqib, hydration
  // xatosiga (React #418) olib kelardi — formatni qo'lda, deterministik qilamiz.
  const money = (v: number) => (basePrice > 0 ? `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${currency}` : "—");

  /**
   * Bron so'rovi. Mahsulot qoidasi: mehmon ham ism + telefon bilan bron qila
   * oladi (majburiy login yo'q). Backend: POST /api/v1/bookings (optionalAuth) —
   * customerName + (customerEmail yoki customerPhone) talab qilinadi.
   */
  async function book(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setErr("");

    const customerName = user ? (user.fullName || user.name || name).trim() : name.trim();
    if (customerName.length < 2) { setErr("Ismingizni kiriting (kamida 2 ta harf)."); return; }

    let customerPhone = "";
    if (phone.trim()) {
      const normalized = normalizeUzPhone(phone);
      if (!normalized) { setErr("Telefon raqami +998 XX XXX XX XX ko‘rinishida bo‘lsin."); return; }
      customerPhone = normalized;
    } else if (!user) {
      setErr("Agentlik siz bilan bog‘lanishi uchun telefon raqamingizni kiriting.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/backend/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourSlug,
          customerName,
          ...(user?.email ? { customerEmail: user.email } : {}),
          customerPhone,
          travelers,
          travelDate: date || "",
          message: message.trim().slice(0, 1200),
          source: "web",
          ...getAttribution(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.success !== false) { setOk(true); return; }
      setErr(j?.message || "Bron yuborilmadi. Keyinroq urinib ko‘ring.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="mkt-book" aria-label="Bron qilish">
      <div className="mkt-book__price"><b>{priceLabel}</b><span>kishi boshiga</span></div>

      {ok ? (
        <div style={{ textAlign: "center", padding: "10px 0" }} role="status">
          <div className="mkt-vcard__icon" style={{ margin: "0 auto", background: "#e9f9f1", color: "var(--success)" }}><CheckCircle2 size={22} /></div>
          <h3 style={{ margin: "10px 0 4px" }}>Bron so‘rovi yuborildi!</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "0 0 14px" }}>
            Agentlik tez orada {user ? "siz bilan" : "ko‘rsatgan raqamingiz orqali"} bog‘lanadi.
          </p>
          {user ? (
            <a className="btn btn--navy btn--md btn--block" href="/my-trips">Bronlarimni ko‘rish</a>
          ) : (
            <Link className="btn btn--navy btn--md btn--block" href="/tours">Boshqa turlarni ko‘rish</Link>
          )}
        </div>
      ) : (
        <form onSubmit={book} noValidate>
          {!loading && !user ? (
            <div className="mkt-field">
              <label htmlFor={`${ids}-name`}>Ismingiz *</label>
              <div className="mkt-input">
                <User size={16} aria-hidden="true" />
                <input id={`${ids}-name`} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism familiya" required minLength={2} maxLength={120} />
              </div>
            </div>
          ) : null}

          <div className="mkt-field">
            <label htmlFor={`${ids}-phone`}>Telefon{!user ? " *" : ""}</label>
            <div className="mkt-input">
              <Phone size={16} aria-hidden="true" />
              <input
                id={`${ids}-phone`}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                required={!user}
                maxLength={20}
              />
            </div>
          </div>

          <div className="mkt-field">
            <label htmlFor={`${ids}-date`}>Sayohat sanasi</label>
            <div className="mkt-input">
              <CalendarDays size={16} aria-hidden="true" />
              <input id={`${ids}-date`} type="date" lang="uz" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <small style={{ color: "var(--subtle)", fontSize: "0.78rem" }}>
              {date ? `Tanlandi: ${uzDate(date)}` : "Kun · oy · yil — taxminiy sanani tanlang"}
            </small>
          </div>

          <div className="mkt-field">
            <span id={`${ids}-trav`} style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--ink)" }}>Sayohatchilar</span>
            <div className="mkt-stepper" role="group" aria-labelledby={`${ids}-trav`}>
              <button type="button" aria-label="Kamaytirish" onClick={() => setTravelers((n) => Math.max(1, n - 1))}><Minus size={16} /></button>
              <span aria-live="polite">{travelers} kishi</span>
              <button type="button" aria-label="Ko‘paytirish" onClick={() => setTravelers((n) => Math.min(20, n + 1))}><Plus size={16} /></button>
            </div>
          </div>

          <div className="mkt-field">
            <label htmlFor={`${ids}-msg`}>Izoh (ixtiyoriy)</label>
            <div className="mkt-input">
              <MessageSquare size={16} aria-hidden="true" />
              <input id={`${ids}-msg`} name="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Savol yoki istaklaringiz" maxLength={1200} />
            </div>
          </div>

          {/* Bizda turist uchun xizmat haqi YO'Q — bron so'rovi bepul.
              Yakuniy narxni agentlik belgilaydi, shuning uchun "Jami" emas,
              "Taxminiy summa" deb ko'rsatamiz. */}
          <div className="mkt-book__rows">
            <div><span>{money(basePrice)} × {travelers} kishi</span><span>{money(subtotal)}</span></div>
            <div className="mkt-book__total"><span>Taxminiy summa</span><span>{money(subtotal)}</span></div>
          </div>

          {err ? <div className="mkt-alert mkt-alert--error" role="alert" style={{ marginBottom: 10 }}>{err}</div> : null}

          {loading ? (
            <button type="button" className="btn btn--gold btn--lg btn--block" disabled>Yuklanmoqda...</button>
          ) : (
            <button type="submit" className="btn btn--gold btn--lg btn--block" disabled={busy}>{busy ? "Yuborilmoqda..." : "Bron so‘rovini yuborish"}</button>
          )}
          {!loading && !user ? (
            <p className="mkt-book__note" style={{ marginBottom: 4 }}>
              Ro‘yxatdan o‘tish shart emas. Hisobingiz bormi?{" "}
              <a href={`/signin?next=${encodeURIComponent(`/tours/${tourSlug}`)}`} style={{ color: "var(--primary)", fontWeight: 700 }}>Kiring</a>
              {" "}— bronlaringizni bir joyda kuzatasiz.
            </p>
          ) : null}
          <p className="mkt-book__note">
            Bron so‘rovi <b>bepul</b> — hech qanday to‘lov olinmaydi. So‘rov tasdiqlangan agentlikka yuboriladi,
            yakuniy narx va shartlar agentlik bilan kelishiladi.
          </p>
        </form>
      )}
    </aside>
  );
}
