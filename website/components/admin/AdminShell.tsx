"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Building2, ClipboardList, CreditCard, LayoutDashboard, LogOut, Menu, MessageSquareWarning,
  PackageSearch, Search, TrendingUp, Users, Wallet,
} from "lucide-react";
import { adminLogout, fetchMe, type AdminUser } from "@/lib/adminApi";

const NAV = [
  { href: "/admin", label: "Boshqaruv", icon: LayoutDashboard, exact: true },
  { href: "/admin/partners", label: "Hamkorlar", icon: Building2 },
  { href: "/admin/billing", label: "To'lovlar & obuna", icon: Wallet },
  { href: "/admin/tariffs", label: "Tariflar", icon: CreditCard },
  { href: "/admin/listings", label: "Turlar (listing)", icon: PackageSearch },
  { href: "/admin/bookings", label: "Bronlar", icon: ClipboardList },
  { href: "/admin/reports", label: "Hisobotlar", icon: TrendingUp },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { href: "/admin/feedback", label: "Fikr & shikoyat", icon: MessageSquareWarning },
];

const TITLES: Record<string, string> = {
  "/admin": "Boshqaruv paneli", "/admin/partners": "Hamkorlar", "/admin/partners/new": "Yangi hamkor",
  "/admin/billing": "To'lovlar & obuna", "/admin/tariffs": "Tariflar",
  "/admin/listings": "Turlar (listing)", "/admin/bookings": "Bronlar", "/admin/reports": "Hisobotlar",
  "/admin/users": "Foydalanuvchilar", "/admin/feedback": "Fikr & shikoyat",
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => { fetchMe().then((d) => setUser(d.user)).catch(() => {}); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  function signOut() { void adminLogout().finally(() => router.replace("/admin/login")); }
  const title = TITLES[pathname] || "Admin";
  const isActive = (item: (typeof NAV)[number]) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <div className="adm-app">
      <div className={`adm-side__backdrop ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`adm-side ${open ? "is-open" : ""}`}>
        <div className="adm-side__brand">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#fff", fontWeight: 800, fontSize: "1.15rem" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1a6b3c,#0f5132)", display: "grid", placeItems: "center" }}>
              <LayoutDashboard size={17} />
            </span>
            Travelor<span style={{ color: "var(--gold-2)" }}>AI</span>
          </span>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", marginTop: 4, letterSpacing: "0.08em" }}>ADMIN PANEL</div>
        </div>
        <nav className="adm-side__nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`adm-nav-item ${isActive(item) ? "is-active" : ""}`}>
                <Icon size={18} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="adm-side__user">
          <span className="adm-side__avatar">{(user?.name || "A").charAt(0).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <b>{user?.name || "Admin"}</b>
            <small>{user?.email || ""}</small>
          </div>
        </div>
        <button className="adm-btn adm-btn--danger adm-signout" onClick={signOut} type="button"><LogOut size={16} /> Chiqish</button>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button className="adm-burger" type="button" aria-label="Menyu" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <div className="adm-top__title">{title}</div>
          <div className="adm-top__search"><Search size={16} /><input placeholder="Qidirish (bo‘lim ichida)" aria-label="Qidirish" disabled /></div>
          <span className="adm-top__bell"><Bell size={17} /></span>
          <span className="adm-side__avatar" style={{ width: 38, height: 38 }}>{(user?.name || "A").charAt(0).toUpperCase()}</span>
        </header>
        <div className="adm-content">{children}</div>
      </div>
    </div>
  );
}
