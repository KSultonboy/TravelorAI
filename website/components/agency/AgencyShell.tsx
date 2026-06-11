"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { useAgencySession } from "@/lib/agency/session";
import AuthScreen from "./AuthScreen";
import OnboardingScreen from "./OnboardingScreen";

const NAV_ITEMS = [
  { href: "/agency", label: "Boshqaruv", icon: LayoutDashboard, exact: true },
  { href: "/agency/leads", label: "Leadlar", icon: CalendarDays, exact: false },
  { href: "/agency/tours", label: "Tourlarim", icon: ListChecks, exact: false },
  { href: "/agency/tours/new", label: "Tour qo'shish", icon: Plus, exact: true },
  { href: "/agency/profile", label: "Profil", icon: Pencil, exact: true },
];

const COLLAPSE_KEY = "travelorai_agency_sidebar_collapsed";

export default function AgencyShell({ children }: { children: ReactNode }) {
  const { phase, me, bookings, logout } = useAgencySession();
  const pathname = usePathname() || "/agency";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      window.localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      return !value;
    });
  }

  if (phase === "loading") {
    return (
      <div className="agency-screen agency-screen--center">
        <Loader2 className="agency-spin" size={28} />
        <p>Yuklanmoqda…</p>
      </div>
    );
  }

  if (phase === "guest") {
    return <AuthScreen />;
  }

  if (phase === "onboarding") {
    return (
      <div className="agency-shell agency-shell--single">
        <div className="agency-onboarding-topbar">
          <div className="agency-brand agency-brand--inline">
            <span><Sparkles size={18} /></span>
            TravelorAI Agency
          </div>
          <button onClick={() => void logout()} type="button">
            <LogOut size={16} /> Chiqish
          </button>
        </div>
        <OnboardingScreen />
      </div>
    );
  }

  const newLeads = bookings.filter((booking) => booking.status === "pending").length;

  return (
    <div className={`agency-dashboard-shell${collapsed ? " is-collapsed" : ""}`}>
      <aside className="agency-dashboard-sidebar">
        <div className="agency-sidebar-top">
          <div className="agency-dashboard-brand">
            <span><Sparkles size={18} /></span>
            <div className="agency-nav-label">
              <b>TravelorAI</b>
              <small>Agency panel</small>
            </div>
          </div>
          <button
            aria-label={collapsed ? "Menyuni ochish" : "Menyuni yig'ish"}
            className="agency-collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? "Menyuni ochish" : "Menyuni yig'ish"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav aria-label="Agency navigatsiyasi">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href) && (href !== "/agency/tours" || pathname !== "/agency/tours/new");
            return (
              <Link className={active ? "agency-nav-active" : ""} href={href} key={href} title={label}>
                <Icon size={17} /> <span className="agency-nav-label">{label}</span>
                {href === "/agency/leads" && newLeads > 0 ? (
                  <span className="agency-nav-badge">{newLeads}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="agency-sidebar-footer">
          <small className="agency-nav-label">{me?.agency?.name || me?.account.email}</small>
          <button onClick={() => void logout()} title="Chiqish" type="button">
            <LogOut size={16} /> <span className="agency-nav-label">Chiqish</span>
          </button>
        </div>
      </aside>
      <div className="agency-dashboard-main">{children}</div>
    </div>
  );
}
