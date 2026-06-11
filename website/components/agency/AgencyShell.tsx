"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
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

export default function AgencyShell({ children }: { children: ReactNode }) {
  const { phase, me, bookings, logout } = useAgencySession();
  const pathname = usePathname() || "/agency";

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
            <span>TravelorAI Agency</span>
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
    <div className="agency-dashboard-shell">
      <aside className="agency-dashboard-sidebar">
        <div className="agency-dashboard-brand">
          <span><Sparkles size={18} /></span>
          <div>
            <b>TravelorAI</b>
            <small>Agency panel</small>
          </div>
        </div>
        <nav aria-label="Agency navigatsiyasi">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href) && (href !== "/agency/tours" || pathname !== "/agency/tours/new");
            return (
              <Link className={active ? "agency-nav-active" : ""} href={href} key={href}>
                <Icon size={17} /> {label}
                {href === "/agency/leads" && newLeads > 0 ? (
                  <span className="agency-nav-badge">{newLeads}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="agency-sidebar-footer">
          <small>{me?.agency?.name || me?.account.email}</small>
          <button onClick={() => void logout()} type="button">
            <LogOut size={16} /> Chiqish
          </button>
        </div>
      </aside>
      <div className="agency-dashboard-main">{children}</div>
    </div>
  );
}
