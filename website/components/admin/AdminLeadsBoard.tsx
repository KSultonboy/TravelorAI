"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, RefreshCw } from "lucide-react";
import { adminApi, adminFormatDate, adminStatusLabel, type AdminBooking } from "@/lib/admin/api";

const STATUS_FILTERS = [
  { key: "pending", label: "Yangi" },
  { key: "confirmed", label: "Qabul qilingan" },
  { key: "completed", label: "Yakunlangan" },
  { key: "rejected", label: "Rad etilgan" },
  { key: "cancelled", label: "Bekor qilingan" },
  { key: "all", label: "Barchasi" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

const OVERRIDE_ACTIONS: { status: string; label: string }[] = [
  { status: "confirmed", label: "Qabul qilindi deb belgilash" },
  { status: "completed", label: "Yakunlash" },
  { status: "cancelled", label: "Bekor qilish" },
];

export default function AdminLeadsBoard() {
  const [status, setStatus] = useState<StatusKey>("pending");
  const [items, setItems] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (nextStatus: StatusKey) => {
    setLoading(true);
    setError("");
    const result = await adminApi<{ items: AdminBooking[] }>(`/bookings?status=${nextStatus}`);
    if (result.success) setItems(result.data.items || []);
    else setError(result.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  async function override(id: string, nextStatus: string) {
    setBusyId(id);
    setError("");
    const result = await adminApi(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, adminNote: "Admin tomonidan yangilandi" }),
    });
    if (result.success) await load(status);
    else setError(result.message);
    setBusyId("");
  }

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Lead nazorati</p>
          <h1>Mijoz so&apos;rovlari</h1>
          <p className="admin-muted">
            Barcha agentliklarga kelgan leadlar. Agentlik javob bermasa, admin holatni o&apos;zi yangilashi mumkin.
          </p>
        </div>
        <button className="admin-ghost-v2" disabled={loading} onClick={() => void load(status)} type="button">
          {loading ? <Loader2 className="admin-spin" size={16} /> : <RefreshCw size={16} />} Yangilash
        </button>
      </header>

      <div className="admin-tabs-v2" role="tablist">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            aria-selected={status === key}
            className={status === key ? "is-active" : ""}
            key={key}
            onClick={() => setStatus(key)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      {loading ? (
        <div className="admin-loading">
          <Loader2 className="admin-spin" size={22} /> Yuklanmoqda…
        </div>
      ) : items.length ? (
        <div className="admin-lead-table">
          {items.map((booking) => (
            <article className="admin-lead-row" key={booking.id}>
              <div className="admin-lead-row__main">
                <b>{booking.customerName}</b>
                <small>
                  {booking.tour?.title || "Tour ko'rsatilmagan"} · {booking.agency?.name || "Agentliksiz"} ·{" "}
                  {adminFormatDate(booking.createdAt)}
                </small>
                <div className="admin-lead-row__contacts">
                  {booking.customerPhone ? <span>📞 {booking.customerPhone}</span> : null}
                  {booking.customerEmail ? <span>✉️ {booking.customerEmail}</span> : null}
                  <span>👥 {booking.travelers}</span>
                </div>
                {booking.message ? <p>{booking.message}</p> : null}
                {booking.agencyNote ? <small className="admin-lead-row__note">Agentlik izohi: {booking.agencyNote}</small> : null}
              </div>
              <div className="admin-lead-row__side">
                <span className={`admin-chip admin-chip--${booking.status}`}>{adminStatusLabel(booking.status)}</span>
                {booking.status === "pending" || booking.status === "confirmed" ? (
                  <div className="admin-lead-row__actions">
                    {OVERRIDE_ACTIONS.filter(({ status: target }) =>
                      booking.status === "pending" ? true : target !== "confirmed"
                    ).map(({ status: target, label }) => (
                      <button
                        disabled={busyId === booking.id}
                        key={target}
                        onClick={() => void override(booking.id, target)}
                        type="button"
                      >
                        {busyId === booking.id ? <Loader2 className="admin-spin" size={13} /> : null} {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <Inbox size={22} /> Bu holatda lead yo&apos;q.
        </div>
      )}
    </>
  );
}
