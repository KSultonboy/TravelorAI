"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Building2, Check, ClipboardCheck, Loader2, RefreshCw, X } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import {
  adminApi,
  adminFormatDate,
  adminStatusLabel,
  type AdminApplication,
  type AdminTour,
} from "@/lib/admin/api";

type TabKey = "applications" | "tours";

function ReviewActions({
  busy,
  onApprove,
  onReject,
}: {
  busy: "" | "approve" | "reject";
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="admin-review-actions-v2">
      <input
        placeholder="Admin izohi (rad etishda tavsiya etiladi)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <button disabled={Boolean(busy)} onClick={() => onApprove(note)} type="button">
        {busy === "approve" ? <Loader2 className="admin-spin" size={15} /> : <Check size={15} />} Tasdiqlash
      </button>
      <button className="danger" disabled={Boolean(busy)} onClick={() => onReject(note)} type="button">
        {busy === "reject" ? <Loader2 className="admin-spin" size={15} /> : <X size={15} />} Rad etish
      </button>
    </div>
  );
}

function ModerationBoardInner() {
  const searchParams = useSearchParams();
  const initialTab: TabKey = searchParams.get("tab") === "tours" ? "tours" : "applications";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [busyKind, setBusyKind] = useState<"" | "approve" | "reject">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const [appsResult, toursResult] = await Promise.all([
      adminApi<{ items: AdminApplication[] }>("/agency-applications?status=pending"),
      adminApi<{ items: AdminTour[] }>("/tours?status=pending_review"),
    ]);
    if (appsResult.success) setApplications(appsResult.data.items || []);
    else setError(appsResult.message);
    if (toursResult.success) setTours(toursResult.data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function review(kind: "application" | "tour", id: string, action: "approve" | "reject", note: string) {
    setBusyId(id);
    setBusyKind(action);
    setError("");
    setMessage("");
    const base = kind === "application" ? "/agency-applications" : "/tours";
    const result = await adminApi(`${base}/${id}/${action}`, {
      method: "PATCH",
      body: JSON.stringify({ adminNote: note.trim() || undefined }),
    });
    if (result.success) {
      setMessage(action === "approve" ? "Tasdiqlandi ✓" : "Rad etildi");
      await loadAll();
    } else {
      setError(result.message);
    }
    setBusyId("");
    setBusyKind("");
  }

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Moderatsiya</p>
          <h1>Tasdiqlash navbati</h1>
          <p className="admin-muted">Yangi agentliklar va tourlar publicga chiqishidan oldin shu yerdan o&apos;tadi.</p>
        </div>
        <button className="admin-ghost-v2" disabled={loading} onClick={() => void loadAll()} type="button">
          {loading ? <Loader2 className="admin-spin" size={16} /> : <RefreshCw size={16} />} Yangilash
        </button>
      </header>

      <div className="admin-tabs-v2" role="tablist">
        <button
          aria-selected={tab === "applications"}
          className={tab === "applications" ? "is-active" : ""}
          onClick={() => setTab("applications")}
          role="tab"
          type="button"
        >
          <Building2 size={16} /> Agentlik arizalari <em>{applications.length}</em>
        </button>
        <button
          aria-selected={tab === "tours"}
          className={tab === "tours" ? "is-active" : ""}
          onClick={() => setTab("tours")}
          role="tab"
          type="button"
        >
          <ClipboardCheck size={16} /> Tourlar <em>{tours.length}</em>
        </button>
      </div>

      {message ? <div className="admin-alert admin-alert--success">{message}</div> : null}
      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      {loading ? (
        <div className="admin-loading">
          <Loader2 className="admin-spin" size={22} /> Yuklanmoqda…
        </div>
      ) : tab === "applications" ? (
        applications.length ? (
          <div className="admin-review-list">
            {applications.map((application) => (
              <article className="admin-review-card-v2" key={application.id}>
                <header>
                  <div>
                    <h4>{application.companyName}</h4>
                    <small>
                      {application.city}, {application.country} · {application.contactPerson} ·{" "}
                      {adminFormatDate(application.submittedAt)}
                    </small>
                  </div>
                  <span className="admin-chip admin-chip--pending">{adminStatusLabel(application.status)}</span>
                </header>
                <div className="admin-review-card-v2__meta">
                  <span>📞 {application.phone}</span>
                  <span>✉️ {application.email}</span>
                  {application.telegram ? <span>TG: {application.telegram}</span> : null}
                  {application.website ? <span>🌐 {application.website}</span> : null}
                  <span>Xizmatlar: {(application.serviceTypes || []).join(", ")}</span>
                </div>
                {application.description ? <p>{application.description}</p> : null}
                {application.imageUrl ? (
                  <Image
                    unoptimized
                    width={420}
                    height={240}
                    className="admin-review-card-v2__image"
                    src={publicImageSrc(application.imageUrl)}
                    alt={application.companyName}
                  />
                ) : null}
                <ReviewActions
                  busy={busyId === application.id ? busyKind : ""}
                  onApprove={(note) => void review("application", application.id, "approve", note)}
                  onReject={(note) => void review("application", application.id, "reject", note)}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty">Tasdiqlash kutayotgan ariza yo&apos;q. ✓</div>
        )
      ) : tours.length ? (
        <div className="admin-review-list">
          {tours.map((tour) => (
            <article className="admin-review-card-v2" key={tour.id}>
              <header>
                <div>
                  <h4>{tour.title}</h4>
                  <small>
                    {tour.agency?.name || "Agentliksiz"} · {tour.city} · {tour.duration}
                    {tour.price ? ` · ${tour.price}` : ""} · {adminFormatDate(tour.submittedAt)}
                  </small>
                </div>
                <span className="admin-chip admin-chip--pending">{adminStatusLabel(tour.approvalStatus)}</span>
              </header>
              {tour.imageUrl ? (
                <Image
                  unoptimized
                  width={420}
                  height={240}
                  className="admin-review-card-v2__image"
                  src={publicImageSrc(tour.imageUrl)}
                  alt={tour.title}
                />
              ) : null}
              {tour.description ? <p>{tour.description}</p> : null}
              {tour.highlights?.length ? (
                <div className="admin-review-card-v2__meta">
                  {tour.highlights.map((highlight) => (
                    <span key={highlight}>✦ {highlight}</span>
                  ))}
                </div>
              ) : null}
              <ReviewActions
                busy={busyId === tour.id ? busyKind : ""}
                onApprove={(note) => void review("tour", tour.id, "approve", note)}
                onReject={(note) => void review("tour", tour.id, "reject", note)}
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">Tekshiruv kutayotgan tour yo&apos;q. ✓</div>
      )}
    </>
  );
}

export default function ModerationBoard() {
  return (
    <Suspense fallback={<div className="admin-loading"><Loader2 className="admin-spin" size={22} /> Yuklanmoqda…</div>}>
      <ModerationBoardInner />
    </Suspense>
  );
}
