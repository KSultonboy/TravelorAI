"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, MapPinned, Pencil, Plus, Send } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import { agencyApi, formatDate, statusLabel } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { Tour } from "@/lib/agency/types";

export default function ToursList() {
  const { tours, refreshTours, refresh } = useAgencySession();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submitTour(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    const result = await agencyApi<Tour>(`/tours/${id}/submit`, { method: "POST" });
    if (result.success) {
      setMessage("Tour admin tekshiruvi uchun yuborildi.");
      await refreshTours();
      await refresh(true);
    } else {
      setError(result.message);
    }
    setBusyId("");
  }

  return (
    <section className="agency-dashboard-section">
      <header className="agency-section-head">
        <div>
          <p className="agency-eyebrow">Tour katalogi</p>
          <h2>Mening tourlarim</h2>
          <p className="agency-muted">Qoralama → tekshiruv → public. Rad etilganini tahrirlab qayta yuboring.</p>
        </div>
        <Link className="agency-cta" href="/agency/tours/new">
          <Plus size={16} /> Yangi tour
        </Link>
      </header>

      {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}
      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

      {tours.length ? (
        <div className="agency-tour-list">
          {tours.map((tour) => (
            <article className="agency-tour-card" key={tour.id}>
              {tour.imageUrl ? (
                <Image
                  unoptimized
                  width={280}
                  height={170}
                  src={publicImageSrc(tour.imageUrl)}
                  alt={tour.title}
                />
              ) : (
                <div className="agency-tour-card__placeholder">
                  <MapPinned size={22} />
                </div>
              )}
              <div className="agency-tour-card__body">
                <header>
                  <div>
                    <h4>{tour.title}</h4>
                    <small>
                      {tour.city} · {tour.duration}
                      {tour.price ? ` · ${tour.price}` : ""}
                    </small>
                  </div>
                  <span className={`agency-status-chip agency-status-chip--${tour.approvalStatus}`}>
                    {statusLabel(tour.approvalStatus)}
                  </span>
                </header>
                {tour.adminNote ? <p className="agency-admin-note">Admin izohi: {tour.adminNote}</p> : null}
                <footer>
                  <small>Yangilangan: {formatDate(tour.updatedAt)}</small>
                  <div className="agency-tour-actions">
                    <Link className="agency-ghost-button" href={`/agency/tours/${tour.id}`}>
                      <Pencil size={15} /> Tahrirlash
                    </Link>
                    {tour.approvalStatus === "draft" || tour.approvalStatus === "rejected" ? (
                      <button disabled={busyId === tour.id} onClick={() => submitTour(tour.id)} type="button">
                        {busyId === tour.id ? <Loader2 className="agency-spin" size={15} /> : <Send size={15} />} Reviewga yuborish
                      </button>
                    ) : null}
                  </div>
                </footer>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="agency-empty-state">
          <MapPinned size={28} />
          <p>Hali tour qo&apos;shilmagan. Birinchi tourni yarating — admin tasdig&apos;idan keyin u mobil ilova va webda chiqadi.</p>
          <Link className="agency-cta" href="/agency/tours/new">
            <Plus size={16} /> Birinchi tourni yaratish
          </Link>
        </div>
      )}
    </section>
  );
}
