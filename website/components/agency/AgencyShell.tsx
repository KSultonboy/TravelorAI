"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useAgencySession } from "@/lib/agency/session";
import AuthScreen from "./AuthScreen";
import OnboardingScreen from "./OnboardingScreen";

const NAV_ITEMS = [
  { href: "/agency", label: "Boshqaruv", icon: LayoutDashboard, exact: true },
  { href: "/agency/pipeline", label: "Pipeline", icon: KanbanSquare, exact: false },
  { href: "/agency/customers", label: "Mijozlar", icon: Users, exact: false },
  { href: "/agency/tasks", label: "Vazifalar", icon: ListTodo, exact: false },
  { href: "/agency/tours", label: "Tourlarim", icon: ListChecks, exact: false },
  { href: "/agency/tours/new", label: "Tour qo'shish", icon: Plus, exact: true },
  { href: "/agency/profile", label: "Profil", icon: Pencil, exact: true },
];

const COLLAPSE_KEY = "travelorai_agency_sidebar_collapsed";

const CONFETTI_COLORS = ["#087a56", "#4fd1a5", "#f2c14e", "#e2574c", "#2c7be5", "#9b5de5"];

type ConfettiPiece = {
  id: number;
  side: "left" | "right";
  tx: number;
  ty: number;
  rot: number;
  delay: number;
  dur: number;
  color: string;
};

function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, id) => {
    const side: "left" | "right" = id % 2 === 0 ? "left" : "right";
    const spread = 120 + Math.random() * 480;
    return {
      id,
      side,
      tx: side === "left" ? spread : -spread,
      ty: -(260 + Math.random() * 480),
      rot: (Math.random() - 0.5) * 720,
      delay: Math.random() * 0.45,
      dur: 1.4 + Math.random() * 1.1,
      color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
    };
  });
}

export default function AgencyShell({ children }: { children: ReactNode }) {
  const { phase, me, bookings, logout } = useAgencySession();
  const pathname = usePathname() || "/agency";
  const [collapsed, setCollapsed] = useState(false);
  const [welcome, setWelcome] = useState<"" | "show" | "leaving">("");
  const prevPhase = useRef<typeof phase | null>(null);
  const confetti = useMemo(() => makeConfetti(70), []);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  // Onboarding -> approved: tabriklash sahnasi, so'ng kabinet
  useEffect(() => {
    const previous = prevPhase.current;
    prevPhase.current = phase;
    if (previous === "onboarding" && phase === "approved") {
      setWelcome("show");
      const leaveTimer = window.setTimeout(() => setWelcome("leaving"), 2900);
      const endTimer = window.setTimeout(() => setWelcome(""), 3600);
      return () => {
        window.clearTimeout(leaveTimer);
        window.clearTimeout(endTimer);
      };
    }
  }, [phase]);

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
      {welcome ? (
        <div aria-hidden className={`agency-welcome${welcome === "leaving" ? " agency-welcome--leaving" : ""}`}>
          {confetti.map((piece) => (
            <i
              className={`agency-confetti agency-confetti--${piece.side}`}
              key={piece.id}
              style={{
                ["--tx" as string]: `${piece.tx}px`,
                ["--ty" as string]: `${piece.ty}px`,
                ["--rot" as string]: `${piece.rot}deg`,
                ["--delay" as string]: `${piece.delay}s`,
                ["--dur" as string]: `${piece.dur}s`,
                background: piece.color,
              }}
            />
          ))}
          <div className="agency-welcome__card">
            <span>🎉</span>
            <h2>Xush kelibsiz!</h2>
            <p>{me?.agency?.name || "Agentligingiz"} tasdiqlandi — kabinet ochilmoqda…</p>
          </div>
        </div>
      ) : null}
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
                {href === "/agency/pipeline" && newLeads > 0 ? (
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
