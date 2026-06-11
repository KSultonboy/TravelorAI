"use client";

import { type ReactNode } from "react";
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

export default function AdminShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell admin-shell--v2">
      <aside className="admin-aside">
        <div>
          <div className="admin-brand">
            <span className="admin-brand__mark">
              <Sparkles size={18} />
            </span>
            <span>TravelorAI</span>
            <small>Admin</small>
          </div>
          <nav className="admin-nav-v2" aria-label="Admin navigatsiyasi">
            {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link className={active ? "is-active" : ""} href={href} key={href}>
                  <Icon size={17} /> {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="admin-aside-footer">
          <small>{username}</small>
          <button className="admin-logout" onClick={() => void logout()} type="button">
            <LogOut size={17} /> Chiqish
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
