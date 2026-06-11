"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Boshqaruv", icon: LayoutDashboard, exact: true },
  { href: "/admin/moderation", label: "Moderatsiya", icon: ClipboardCheck, exact: false },
  { href: "/admin/leads", label: "Leadlar", icon: Inbox, exact: false },
  { href: "/admin/agencies", label: "Agentliklar", icon: Building2, exact: false },
  { href: "/admin/content", label: "Landing kontent", icon: LayoutTemplate, exact: false },
  { href: "/admin/hero", label: "Hero slides", icon: ImageIcon, exact: false },
];

const COLLAPSE_KEY = "travelorai_admin_sidebar_collapsed";

export default function AdminShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();
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

  async function logout() {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className={`admin-shell admin-shell--v2${collapsed ? " is-collapsed" : ""}`}>
      <aside className="admin-aside">
        <div>
          <div className="admin-aside-top">
            <div className="admin-brand">
              <span className="admin-brand__mark">
                <Sparkles size={18} />
              </span>
              <span className="admin-nav-label">TravelorAI</span>
              <small className="admin-nav-label">Admin</small>
            </div>
            <button
              aria-label={collapsed ? "Menyuni ochish" : "Menyuni yig'ish"}
              className="admin-collapse-btn"
              onClick={toggleCollapsed}
              title={collapsed ? "Menyuni ochish" : "Menyuni yig'ish"}
              type="button"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          <nav className="admin-nav-v2" aria-label="Admin navigatsiyasi">
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link className={active ? "is-active" : ""} href={href} key={href} title={label}>
                  <Icon size={17} /> <span className="admin-nav-label">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="admin-aside-footer">
          <small className="admin-nav-label">{username}</small>
          <button className="admin-logout" onClick={() => void logout()} title="Chiqish" type="button">
            <LogOut size={17} /> <span className="admin-nav-label">Chiqish</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
