"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminGate from "@/components/admin/AdminGate";
import AdminShell from "@/components/admin/AdminShell";
import "../../styles/admin.scss";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Login sahifasi gate/shell'siz.
  if (pathname === "/admin/login") {
    return <div className="adm">{children}</div>;
  }

  return (
    <div className="adm">
      <AdminGate>
        <AdminShell>{children}</AdminShell>
      </AdminGate>
    </div>
  );
}
