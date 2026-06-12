"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  Inbox,
  Loader2,
  Map,
  MessageSquareText,
  RefreshCw,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { adminApi, type AdminApplication, type AdminBooking, type AdminTour } from "@/lib/admin/api";

type Stats = {
  totalPlaces?: number;
  totalUsers?: number;
  totalTrips?: number;
  totalFeedback?: number;
  quality?: {
    lowConfidence?: number;
    mediumConfidence?: number;
    highConfidence?: number;
  };
};

type Health = { status?: string; db?: string; cache?: string };

type CountByStatus = Record<string, number>;

function countStatuses(items: { status?: string; approvalStatus?: string }[]): CountByStatus {
  const map: CountByStatus = {};
  for (const item of items) {
    const key = item.approvalStatus || item.status || "unknown";
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [pendingApplications, setPendingApplications] = useState<AdminApplication[]>([]);
  const [tourCounts, setTourCounts] = useState<CountByStatus>({});
  const [leadCounts, setLeadCounts] = useState<CountByStatus>({});
  const [agencyTotals, setAgencyTotals] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const [statsResult, appsResult, toursResult, leadsResult, agenciesResult, healthResult] = await Promise.all([
      adminApi<Stats>("/stats"),
      adminApi<{ items: AdminApplication[] }>("/agency-applications?status=pending"),
      adminApi<{ items: AdminTour[] }>("/tours?status=all"),
      adminApi<{ items: AdminBooking[] }>("/bookings?status=all"),
      adminApi<{ items: { active?: boolean }[] }>("/agencies"),
      fetch("/api/agency-proxy/health", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
    ]);
    if (statsResult.success) setStats(statsResult.data);
    else setError(statsResult.message);
    if (appsResult.success) setPendingApplications(appsResult.data.items || []);
    if (toursResult.success) setTourCounts(countStatuses(toursResult.data.items || []));
    if (leadsResult.success) setLeadCounts(countStatuses(leadsResult.data.items || []));
    if (agenciesResult.success) {
      const items = agenciesResult.data.items || [];
      setAgencyTotals({ total: items.length, active: items.filter((agency) => agency.active).length });
    }
    if (healthResult) setHealth(healthResult);
    setUpdatedAt(new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const quality = stats?.quality || {};
  const healthOk = health?.status === "ok";
  const reviewTours = tourCounts.pending_review || 0;
  const pendingLeads = leadCounts.pending || 0;

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
      count: reviewTours,
      hint: "Publicga chiqishni kutmoqda",
    },
    {
      href: "/admin/leads",
      icon: Inbox,
      label: "Yangi leadlar",
      count: pendingLeads,
      hint: "Agentlik javobini kuzating",
    },
  ];

  return (
    <>
      <header className="admin-head-v2">
        <div>
          <p className="admin-eyebrow">Platforma boshqaruvi</p>
          <h1>Bugungi ish stoli</h1>
          <p className="admin-muted">
            Navbatlar va monitoring — bitta joyda.{updatedAt ? ` Yangilangan: ${updatedAt}` : ""}
          </p>
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

      <h3 className="admin-report-group">Tizim holati</h3>
      <section className="admin-stat-row">
        <div className={`admin-stat-v2 ${healthOk ? "" : "admin-stat-v2--bad"}`}>
          <Activity size={16} />
          <b>{health ? (healthOk ? "Ishlayapti" : "Muammo") : "—"}</b>
          <small>Backend API</small>
        </div>
        <div className={`admin-stat-v2 ${health?.db === "connected" ? "" : "admin-stat-v2--bad"}`}>
          <Database size={16} />
          <b>{health?.db === "connected" ? "Ulangan" : health?.db || "—"}</b>
          <small>Ma&apos;lumotlar bazasi</small>
        </div>
        <div className={`admin-stat-v2 ${health?.cache === "connected" ? "" : "admin-stat-v2--bad"}`}>
          <Zap size={16} />
          <b>{health?.cache === "connected" ? "Ulangan" : health?.cache || "—"}</b>
          <small>Kesh (Redis)</small>
        </div>
      </section>

      <h3 className="admin-report-group">Platforma</h3>
      <section className="admin-stat-row">
        <div className="admin-stat-v2">
          <Users size={16} />
          <b>{stats?.totalUsers ?? "—"}</b>
          <small>Foydalanuvchilar</small>
        </div>
        <div className="admin-stat-v2">
          <Map size={16} />
          <b>{stats?.totalTrips ?? "—"}</b>
          <small>AI safarlar</small>
        </div>
        <div className="admin-stat-v2">
          <Building2 size={16} />
          <b>{agencyTotals.active}/{agencyTotals.total}</b>
          <small>Faol agentliklar</small>
        </div>
        <div className="admin-stat-v2">
          <MessageSquareText size={16} />
          <b>{stats?.totalFeedback ?? "—"}</b>
          <small>Fikrlar</small>
        </div>
      </section>

      <h3 className="admin-report-group">Turlar</h3>
      <section className="admin-stat-row">
        <div className="admin-stat-v2">
          <CheckCircle2 size={16} />
          <b>{tourCounts.approved || 0}</b>
          <small>Tasdiqlangan</small>
        </div>
        <div className="admin-stat-v2">
          <Clock3 size={16} />
          <b>{reviewTours}</b>
          <small>Tekshiruvda</small>
        </div>
        <div className="admin-stat-v2">
          <ClipboardCheck size={16} />
          <b>{tourCounts.draft || 0}</b>
          <small>Qoralama</small>
        </div>
        <div className="admin-stat-v2">
          <XCircle size={16} />
          <b>{tourCounts.rejected || 0}</b>
          <small>Rad etilgan</small>
        </div>
      </section>

      <h3 className="admin-report-group">Leadlar</h3>
      <section className="admin-stat-row">
        <div className={`admin-stat-v2${pendingLeads ? " admin-stat-v2--warn" : ""}`}>
          <Clock3 size={16} />
          <b>{pendingLeads}</b>
          <small>Javob kutmoqda</small>
        </div>
        <div className="admin-stat-v2">
          <Inbox size={16} />
          <b>{leadCounts.confirmed || 0}</b>
          <small>Qabul qilingan</small>
        </div>
        <div className="admin-stat-v2">
          <CheckCircle2 size={16} />
          <b>{leadCounts.completed || 0}</b>
          <small>Yakunlangan</small>
        </div>
        <div className="admin-stat-v2">
          <XCircle size={16} />
          <b>{(leadCounts.rejected || 0) + (leadCounts.cancelled || 0)}</b>
          <small>Rad/bekor</small>
        </div>
      </section>

      <h3 className="admin-report-group">Kontent sifati (POI: {stats?.totalPlaces ?? "—"} ta)</h3>
      <section className="admin-stat-row">
        <div className="admin-stat-v2">
          <BarChart3 size={16} />
          <b>{quality.highConfidence ?? "—"}</b>
          <small>Yuqori ishonch</small>
        </div>
        <div className="admin-stat-v2">
          <BarChart3 size={16} />
          <b>{quality.mediumConfidence ?? "—"}</b>
          <small>O&apos;rta ishonch</small>
        </div>
        <div className={`admin-stat-v2${quality.lowConfidence ? " admin-stat-v2--warn" : ""}`}>
          <BarChart3 size={16} />
          <b>{quality.lowConfidence ?? "—"}</b>
          <small>Past ishonch</small>
        </div>
      </section>

      <section className="admin-panel" style={{ marginTop: 22 }}>
        <div className="admin-panel__head">
          <h3>Tezkor havolalar</h3>
        </div>
        <div className="admin-quick-links">
          <Link href="/admin/moderation">Moderatsiya navbati</Link>
          <Link href="/admin/leads">Barcha leadlar</Link>
          <Link href="/admin/agencies">Agentliklar ro&apos;yxati</Link>
          <Link href="/admin/places">Joylar (POI)</Link>
          <Link href="/admin/stories">Sayohatchi fikrlari</Link>
          <Link href="/admin/hero">Hero slidelar</Link>
        </div>
      </section>
    </>
  );
}
