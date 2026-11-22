"use client";

import { useId, useState } from "react";
import { CalendarDays, CheckCircle2, MapPinned, MessageSquare, Minus, Phone, Plus, User } from "lucide-react";
import { getAttribution } from "@/lib/attribution";
import { normalizeUzPhone } from "../BookingPanel";

type TourOption = { id: string; slug?: string | null; title: string };

type Attribution = { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string };

/**
 * Storefront manbasi: URL'dagi utm_* va ref birinchi o'rinda (mijoz aynan shu
 * havola — Instagram bio / Telegram kanal — orqali keldi). URL'da bo'lmasa —
 * saytning umumiy "birinchi teginish" atributsiyasi (lib/attribution).
 */
function readAttribution(): Attribution {
  const stored = getAttribution();
  try {
    const q = new URLSearchParams(window.location.search);
    const pick = (key: string, max: number) => (q.get(key) || "").trim().slice(0, max) || undefined;
    const utmSource = pick("utm_source", 80);
    const utmMedium = pick("utm_medium", 80);
    const utmCampaign = pick("utm_campaign", 120);
    const ref = pick("ref", 300);
    if (utmSource || utmMedium || utmCampaign || ref) {
      return { utmSource, utmMedium, utmCampaign, referrer: ref || stored.referrer };
    }
  } catch {
    /* URL o'qilmasa — saqlangan manba */
  }
  return stored;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function StorefrontLeadForm({
  agencyId,
  agencyName,
  tours,
  initialTourId = "",
}: {
  agencyId: string;
  agencyName: string;
  tours: TourOption[];
  /** Telegram kanal tugmasi utm_campaign=<tur-slug> bilan keladi — o'sha tur oldindan tanlanadi. */
  initialTourId?: string;
}) {
  const ids = useId();
  const [tourId, setTourId] = useState(initialTourId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    const customerName = name.trim();
    if (customerName.length < 2) { setErr("Ismingizni kiriting (kamida 2 ta harf)."); return; }
    const customerPhone = normalizeUzPhone(phone);
    if (!customerPhone) { setErr("Telefon raqami +998 XX XXX XX XX ko‘rinishida bo‘lsin."); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/backend/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId,
          ...(tourId ? { tourId } : {}),
          customerName,
          customerPhone,
          travelers,
          travelDate: date || "",
          message: message.trim().slice(0, 1200),
          source: "storefront",
          ...readAttribution(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.success !== false) { setOk(true); return; }
      setErr(j?.message || "So‘rov yuborilmadi. Keyinroq urinib ko‘ring.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="mkt-book sf-form sf-form--done" role="status">
        <span className="sf-form__ok"><CheckCircle2 size={24} /></span>
        <h3>So‘rovingiz yuborildi!</h3>
        <p>{agencyName} tez orada ko‘rsatgan raqamingiz orqali bog‘lanadi.</p>
      </div>
    );
  }

  return (
    <form className="mkt-book sf-form" onSubmit={submit} noValidate>
      <h3 className="sf-form__title">So‘rov qoldiring</h3>
      <p className="sf-form__sub">Ro‘yxatdan o‘tish shart emas — ism va telefon yetarli.</p>

      <div className="mkt-field">
        <label htmlFor={`${ids}-tour`}>Qaysi tur qiziqtiradi?</label>
        <div className="mkt-input">
          <MapPinned size={16} aria-hidden="true" />
          <select id={`${ids}-tour`} value={tourId} onChange={(e) => setTourId(e.target.value)}>
            <option value="">Umumiy so‘rov — maslahat kerak</option>
            {tours.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      </div>

      <div className="mkt-field">
        <label htmlFor={`${ids}-name`}>Ismingiz *</label>
        <div className="mkt-input">
          <User size={16} aria-hidden="true" />
          <input id={`${ids}-name`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism familiya" required minLength={2} maxLength={120} />
        </div>
      </div>

      <div className="mkt-field">
        <label htmlFor={`${ids}-phone`}>Telefon *</label>
        <div className="mkt-input">
          <Phone size={16} aria-hidden="true" />
          <input id={`${ids}-phone`} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required maxLength={20} />
        </div>
      </div>

      <div className="sf-form__row">
        <div className="mkt-field">
          <label htmlFor={`${ids}-date`}>Taxminiy sana</label>
          <div className="mkt-input">
            <CalendarDays size={16} aria-hidden="true" />
            <input id={`${ids}-date`} type="date" lang="uz" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="mkt-field">
          <span id={`${ids}-trav`} className="sf-form__label">Necha kishi</span>
          <div className="mkt-stepper" role="group" aria-labelledby={`${ids}-trav`}>
            <button type="button" aria-label="Kamaytirish" onClick={() => setTravelers((n) => Math.max(1, n - 1))}><Minus size={16} /></button>
            <span aria-live="polite">{travelers}</span>
            <button type="button" aria-label="Ko‘paytirish" onClick={() => setTravelers((n) => Math.min(50, n + 1))}><Plus size={16} /></button>
          </div>
        </div>
      </div>

      <div className="mkt-field">
        <label htmlFor={`${ids}-msg`}>Izoh (ixtiyoriy)</label>
        <div className="mkt-input">
          <MessageSquare size={16} aria-hidden="true" />
          <input id={`${ids}-msg`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Yo‘nalish, byudjet yoki savolingiz" maxLength={1200} />
        </div>
      </div>

      {err ? <div className="mkt-alert mkt-alert--error" role="alert" style={{ marginBottom: 10 }}>{err}</div> : null}
      <button type="submit" className="btn btn--gold btn--lg btn--block" disabled={busy}>
        {busy ? "Yuborilmoqda..." : "So‘rov yuborish"}
      </button>
      <p className="sf-form__note">So‘rov bepul. Narx va shartlarni {agencyName} siz bilan kelishadi.</p>
    </form>
  );
}
