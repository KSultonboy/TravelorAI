"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Plane, Users } from "lucide-react";

type Booking = {
  id: string;
  status: string;
  travelers?: number;
  totalEstimate?: number;
  currency?: string;
  travelDate?: string | null;
  createdAt?: string;
  tour?: { title?: string; city?: string } | null;
  agency?: { name?: string } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Kutilmoqda", cls: "is-pending" },
  confirmed: { label: "Tasdiqlangan", cls: "is-confirmed" },
  cancelled: { label: "Bekor qilingan", cls: "is-cancelled" },
  rejected: { label: "Rad etilgan", cls: "is-cancelled" },
  completed: { label: "Yakunlangan", cls: "is-completed" },
};

function money(v?: number, c = "USD") {
  if (!v) return "—";
  return `${v.toLocaleString("uz-UZ")} ${c}`;
}
function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" }); } catch { return d; }
}

export default function MyTripsClient() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // /auth/me: live backend endpoint (401 for guests). Switch to /auth/session
        // once the backend deploy includes it.
        const me = await fetch("/api/backend/auth/me", { cache: "no-store" });
        if (!me.ok) {
          if (alive) { setAuthed(false); window.location.href = "/signin?next=/my-trips"; }
          return;
        }
        if (alive) setAuthed(true);
        const res = await fetch("/api/backend/bookings/mine", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const items = json?.data?.items ?? json?.items ?? [];
        if (alive) setBookings(Array.isArray(items) ? items : []);
      } catch {
        if (alive) setBookings([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (authed === false) return null;

  if (loading) {
    return (
      <div className="mkt-trips">
        {[0, 1, 2].map((i) => (
          <div key={i} className="mkt-trip">
            <div className="mkt-skel" style={{ height: 22, width: "55%" }} />
            <div className="mkt-skel" style={{ height: 14, width: "80%", marginTop: 12 }} />
            <div className="mkt-skel" style={{ height: 14, width: "40%", marginTop: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="mkt-vcard" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
        <div className="mkt-vcard__icon" style={{ margin: "0 auto" }}><Plane size={24} /></div>
        <h3 style={{ marginTop: 0 }}>Hali bronlar yo‘q</h3>
        <p style={{ color: "var(--muted)" }}>Tasdiqlangan agentlik turlarini ko‘rib chiqing va birinchi sayohatingizni bron qiling.</p>
        <Link className="btn btn--gold btn--md" href="/tours">Turlarni ko‘rish</Link>
      </div>
    );
  }

  return (
    <div className="mkt-trips">
      {bookings.map((b) => {
        const st = STATUS[b.status] || { label: b.status, cls: "is-pending" };
        const active = b.status === "pending" || b.status === "confirmed";
        return (
          <div key={b.id} className="mkt-trip">
            <div className="mkt-trip__head">
              <h3>{b.tour?.title || "Sayohat"}</h3>
              <span className={`mkt-trip__badge ${st.cls}`}>{st.label}</span>
            </div>
            <div className="mkt-trip__meta">
              <span><MapPin size={14} /> {b.tour?.city || "—"}{b.agency?.name ? ` · ${b.agency.name}` : ""}</span>
              <span><CalendarDays size={14} /> {fmt(b.travelDate || b.createdAt)}</span>
              <span><Users size={14} /> {b.travelers || 1} kishi</span>
            </div>
            <div className="mkt-trip__foot">
              <strong>{money(b.totalEstimate, b.currency)}</strong>
              {active ? (
                <Link className="btn btn--ghost btn--md" href="/contact">Bekor qilish — support</Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
