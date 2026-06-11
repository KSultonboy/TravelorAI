"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  Users,
  X,
} from "lucide-react";
import { agencyApi, formatDateTime, remainingTime, statusLabel } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { BookingItem, BookingStats, BookingStatusAction } from "@/lib/agency/types";

export default function LeadCard({ booking }: { booking: BookingItem }) {
  const { refreshBookings, refresh } = useAgencySession();
  const [busy, setBusy] = useState<"" | BookingStatusAction>("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState("");

  const isPending = booking.status === "pending";
  const deadline = isPending ? remainingTime(booking.responseDeadlineAt) : null;

  async function updateStatus(status: BookingStatusAction) {
    setBusy(status);
    setError("");
    const result = await agencyApi<{ booking: BookingItem; stats?: BookingStats }>(`/bookings/${booking.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(note.trim() ? { agencyNote: note.trim() } : {}) }),
    });
    if (result.success) {
      await refreshBookings();
      await refresh(true);
    } else {
      setError(result.message);
    }
    setBusy("");
  }

  return (
    <article className={`agency-lead-card agency-lead-card--${booking.status}`}>
      <header>
        <div>
          <h4>{booking.customerName}</h4>
          <small>
            {booking.tour?.title || "Tour ko'rsatilmagan"}
            {booking.tour?.city ? ` · ${booking.tour.city}` : ""}
          </small>
        </div>
        <span className={`agency-status-chip agency-status-chip--${booking.status}`}>{statusLabel(booking.status)}</span>
      </header>

      <div className="agency-lead-card__meta">
        {booking.customerPhone ? (
          <a href={`tel:${booking.customerPhone}`}>
            <Phone size={14} /> {booking.customerPhone}
          </a>
        ) : null}
        {booking.customerEmail ? (
          <a href={`mailto:${booking.customerEmail}`}>
            <Mail size={14} /> {booking.customerEmail}
          </a>
        ) : null}
        <span>
          <Users size={14} /> {booking.travelers} kishi
        </span>
        {booking.travelDate ? (
          <span>
            <CalendarDays size={14} /> {formatDateTime(booking.travelDate)}
          </span>
        ) : null}
        <span>
          <Clock3 size={14} /> Kelgan: {formatDateTime(booking.createdAt)}
        </span>
      </div>

      {booking.message ? (
        <p className="agency-lead-card__message">
          <MessageSquareText size={14} /> {booking.message}
        </p>
      ) : null}

      {booking.agencyNote ? <p className="agency-lead-card__note">Izohingiz: {booking.agencyNote}</p> : null}
      {isPending && deadline ? (
        <p className={`agency-countdown${deadline === "Muddat tugagan" ? " agency-countdown--late" : ""}`}>
          <Clock3 size={14} /> Javob muddati: {deadline}
        </p>
      ) : null}
      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

      {isPending ? (
        <>
          {showNote ? (
            <textarea
              className="agency-lead-card__note-input"
              placeholder="Mijozga/o'zingizga izoh (ixtiyoriy)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          ) : null}
          <div className="agency-lead-card__actions">
            <button disabled={Boolean(busy)} onClick={() => updateStatus("confirmed")} type="button">
              {busy === "confirmed" ? <Loader2 className="agency-spin" size={15} /> : <Check size={15} />} Qabul qilish
            </button>
            <button
              className="agency-lead-card__reject"
              disabled={Boolean(busy)}
              onClick={() => updateStatus("rejected")}
              type="button"
            >
              {busy === "rejected" ? <Loader2 className="agency-spin" size={15} /> : <X size={15} />} Rad etish
            </button>
            <button className="agency-lead-card__ghost" onClick={() => setShowNote((value) => !value)} type="button">
              <MessageSquareText size={15} /> Izoh
            </button>
          </div>
        </>
      ) : booking.status === "confirmed" ? (
        <div className="agency-lead-card__actions">
          <button disabled={Boolean(busy)} onClick={() => updateStatus("completed")} type="button">
            {busy === "completed" ? <Loader2 className="agency-spin" size={15} /> : <Check size={15} />} Yakunlash
          </button>
          <button
            className="agency-lead-card__reject"
            disabled={Boolean(busy)}
            onClick={() => updateStatus("cancelled")}
            type="button"
          >
            {busy === "cancelled" ? <Loader2 className="agency-spin" size={15} /> : <X size={15} />} Bekor qilish
          </button>
        </div>
      ) : null}
    </article>
  );
}
