"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ClipboardList, PackageSearch, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatCard, Spinner, Toast } from "@/components/admin/ui";

type Counts = { users: number; partners: number; pending: number; tours: number; bookings: number };

export default function AdminDashboard() {
  const [c, setC] = useState<Counts | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [apps, tours, bookings, users] = await Promise.all([
          api<{ items: { status: string }[]; total: number }>("/admin/agency-applications"),
          api<{ total: number }>("/admin/tours?status=all"),
          api<{ total: number }>("/admin/bookings"),
          api<{ total: number }>("/admin/users"),
        ]);
        setC({
          users: users.total || 0,
          partners: apps.total || 0,
          pending: (apps.items || []).filter((a) => a.status === "pending").length,
          tours: tours.total || 0,
          bookings: bookings.total || 0,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Yuklab bo‘lmadi");
      }
    })();
  }, []);

  if (err) return <Toast message={err} />;
  if (!c) return <Spinner />;

  const links = [
    { href: "/admin/partners", label: "Hamkorlar", icon: Building2, hint: `${c.pending} ariza kutilmoqda` },
    { href: "/admin/listings", label: "Turlar", icon: PackageSearch, hint: `${c.tours} ta tur` },
    { href: "/admin/bookings", label: "Bronlar", icon: ClipboardList, hint: `${c.bookings} ta bron` },
    { href: "/admin/reports", label: "Hisobotlar", icon: TrendingUp, hint: "Daromad va statistika" },
  ];

  return (
    <>
      <h1 className="adm-h1">Boshqaruv paneli</h1>
      <p className="adm-sub">Platforma holati bir qarashda — foydalanuvchilar, hamkorlar, turlar va bronlar.</p>

      <div className="adm-stats">
        <StatCard icon={<Users size={20} />} num={c.users} label="Foydalanuvchilar" />
        <StatCard icon={<Building2 size={20} />} num={c.partners} label="Hamkorlar" />
        <StatCard icon={<PackageSearch size={20} />} num={c.tours} label="Turlar" />
        <StatCard icon={<ClipboardList size={20} />} num={c.bookings} label="Bronlar" />
        <StatCard icon={<Building2 size={20} />} num={c.pending} label="Kutilayotgan arizalar" />
      </div>

      <h2 className="adm-section-title">Tezkor havolalar</h2>
      <div className="adm-grid adm-grid--2">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="adm-card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}>
              <span className="adm-stat__icon"><Icon size={20} /></span>
              <div><b style={{ display: "block" }}>{l.label}</b><span style={{ color: "var(--muted)", fontSize: "0.86rem" }}>{l.hint}</span></div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
