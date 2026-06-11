"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Inbox,
  Loader2,
  Map,
  RefreshCw,
  Users,
} from "lucide-react";
import { adminApi, type AdminApplication, type AdminBooking, type AdminTour } from "@/lib/admin/api";

type Stats = {
  totals?: { places?: number; users?: number; trips?: number; feedback?: number };
  [key: string]: unknown;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingApplications, setPendingApplications] = useState<AdminApplication[]>([]);
  const [reviewTours, setReviewTours] = useState<AdminTour[]>([]);
  const [pendingLeads, setPendingLeads] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const [statsResult, appsResult, toursResult, leadsResult] = await Promise.all([
      adminApi<Stats>("/stats"),
      adminApi<{ items: AdminApplication[] }>("/agency-applications?status=pending"),
      adminApi<{ items: AdminTour[] }>("/tours?status=pending_review"),
      adminApi<{ items: AdminBooking[] }>("/bookings?status=pending"),
    ]);
    if (statsResult.success) setStats(statsResult.data);
    if (appsResult.success) setPendingApplications(appsResult.data.items || []);
    if (toursResult.success) setReviewTours(toursResult.data.items || []);
    if (leadsResult.success) setPendingLeads(leadsResult.data.items || []);
    if (!statsResult.success && !appsResult.success) setError("Ma'lumotlarni yuklab bo'lmadi");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totals = (stats?.totals || {}) as { places?: number; users?: number; trips?: number; feedback?: number };

  const queues = [
    {
      href: "/admin/moderation",
      icon: Building2,
      label: "Agentlik arizalari",
      count: pendingApplications.length,
      hint: "Tasdiqlash kutilmoqda",
    },
    {
      href: "/admin/moderation?tab=tours",
      icon: ClipboardCheck,
      label: "Tour tekshiruvi",
      count: reviewTours.length,
      hint: "Publicga chiqishni kutmoqda",
    },
    {
      href: "/admin/leads",
      icon: Inbox,
      label: "Yangi leadlar",
      count: pendingLeads.length,
      hint: "Agentlik javobini kuzating",
    },
  ];

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Platforma boshqaruvi</p>
          <h1>Bugungi ish stoli</h1>
          <p className="admin-muted">Avval navbatlar — keyin kontent. Hammasi bitta joydan.</p>
        </div>
        <button className="admin-ghost-v2" disabled={loading} onClick={() => void loadAll()} type="button">
          {loading ? <Loader2 className="admin-spin" size={16} /> : <RefreshCw size={16} />} Yangilash
        </button>
      </header>

      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}

      <section className="admin-queue-grid">
        {queues.map(({ href, icon: Icon, label, count, hint }) => (
          <Link className={`admin-queue-card${count ? " admin-queue-card--alert" : ""}`} href={href} key={label}>
            <span className="admin-queue-card__icon"><Icon size={19} /></span>
            <b>{loading ? "…" : count}</b>
            <strong>{label}</strong>
            <small>{count ? hint : "Navbat bo'sh"}</small>
            <em><ArrowRight size={15} /></em>
          </Link>
        ))}
      </section>

      <section className="admin-stat-row">
        <div className="admin-stat-v2">
          <Users size={16} />
          <b>{totals.users ?? "—"}</b>
          <small>Foydalanuvchilar</small>
        </div>
        <div className="admin-stat-v2">
          <Map size={16} />
          <b>{totals.trips ?? "—"}</b>
          <small>AI safarlar</small>
        </div>
        <div className="admin-stat-v2">
          <ClipboardCheck size={16} />
          <b>{totals.places ?? "—"}</b>
          <small>Joylar (POI)</small>
        </div>
        <div className="admin-stat-v2">
          <Inbox size={16} />
          <b>{totals.feedback ?? "—"}</b>
          <small>Fikrlar</small>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel__head">
          <h3>Tezkor havolalar</h3>
        </div>
        <div className="admin-quick-links">
          <Link href="/admin/moderation">Moderatsiya navbati</Link>
          <Link href="/admin/leads">Barcha leadlar</Link>
          <Link href="/admin/agencies">Agentliklar ro&apos;yxati</Link>
          <Link href="/admin/content">Landing kontent boshqaruvi</Link>
          <Link href="/admin/hero">Hero slidelar</Link>
        </div>
      </section>
    </>
  );
}
