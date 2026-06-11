"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  ListChecks,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatMoney, statusLabel } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import LeadCard from "./LeadCard";

export default function AgencyDashboard() {
  const { me, tours, bookings, bookingStats } = useAgencySession();

  const pendingLeads = bookings.filter((booking) => booking.status === "pending");
  const approvedTours = tours.filter((tour) => tour.approvalStatus === "approved" && tour.active);
  const reviewTours = tours.filter((tour) => tour.approvalStatus === "pending_review");
  const draftTours = tours.filter((tour) => tour.approvalStatus === "draft");
  const rejectedTours = tours.filter((tour) => tour.approvalStatus === "rejected");

  return (
    <>
      <header className="agency-dashboard-topbar">
        <div>
          <p className="agency-eyebrow">Agency boshqaruvi</p>
          <h2>{me?.agency?.name || "Agency dashboard"}</h2>
          <p className="agency-muted">
            {me?.agency?.city || "Global"} · {me?.agency?.specialty || "Tours"}
          </p>
        </div>
        <Link className="agency-cta" href="/agency/tours/new">
          + Yangi tour
        </Link>
      </header>

      <section className="agency-stat-grid">
        <div className={`agency-stat-card${pendingLeads.length ? " agency-stat-card--alert" : ""}`}>
          <span><Clock3 size={18} /></span>
          <b>{pendingLeads.length}</b>
          <small>Javob kutayotgan lead</small>
        </div>
        <div className="agency-stat-card">
          <span><Users size={18} /></span>
          <b>{bookingStats?.customers ?? bookings.length}</b>
          <small>Jami mijozlar</small>
        </div>
        <div className="agency-stat-card">
          <span><CheckCircle2 size={18} /></span>
          <b>{bookingStats?.completed ?? 0}</b>
          <small>Yakunlangan safarlar</small>
        </div>
        <div className="agency-stat-card">
          <span><TrendingUp size={18} /></span>
          <b>{formatMoney(bookingStats?.revenue)}</b>
          <small>Taxminiy aylanma</small>
        </div>
      </section>

      <section className="agency-dashboard-section">
        <header className="agency-section-head">
          <div>
            <h3><CalendarDays size={18} /> Yangi leadlar</h3>
            <p className="agency-muted">Birinchi navbatda javob berilishi kerak bo&apos;lganlar.</p>
          </div>
          <Link className="agency-link" href="/agency/leads">
            Barchasi <ArrowRight size={15} />
          </Link>
        </header>
        {pendingLeads.length ? (
          <div className="agency-lead-list">
            {pendingLeads.slice(0, 3).map((booking) => (
              <LeadCard booking={booking} key={booking.id} />
            ))}
          </div>
        ) : (
          <div className="agency-empty-state agency-empty-state--slim">
            <BadgeCheck size={22} />
            <p>Barcha leadlarga javob berilgan. 👏</p>
          </div>
        )}
      </section>

      <section className="agency-dashboard-section">
        <header className="agency-section-head">
          <div>
            <h3><ListChecks size={18} /> Tourlar holati</h3>
            <p className="agency-muted">Publicda faqat tasdiqlangan tourlar ko&apos;rinadi.</p>
          </div>
          <Link className="agency-link" href="/agency/tours">
            Boshqarish <ArrowRight size={15} />
          </Link>
        </header>
        <div className="agency-tour-status-grid">
          <div className="agency-tour-status">
            <Eye size={16} />
            <b>{approvedTours.length}</b>
            <small>{statusLabel("approved")}</small>
          </div>
          <div className="agency-tour-status">
            <Clock3 size={16} />
            <b>{reviewTours.length}</b>
            <small>{statusLabel("pending_review")}</small>
          </div>
          <div className="agency-tour-status">
            <ListChecks size={16} />
            <b>{draftTours.length}</b>
            <small>{statusLabel("draft")}</small>
          </div>
          <div className="agency-tour-status">
            <Clock3 size={16} />
            <b>{rejectedTours.length}</b>
            <small>{statusLabel("rejected")}</small>
          </div>
        </div>
      </section>
    </>
  );
}
