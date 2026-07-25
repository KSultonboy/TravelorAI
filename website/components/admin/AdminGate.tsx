"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/adminApi";
import { Spinner } from "./ui";

export default function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok">("checking");

  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((d) => {
        if (!alive) return;
        if (d.user?.role === "admin") setState("ok");
        else router.replace("/admin/login");
      })
      .catch(() => router.replace("/admin/login"));
    return () => { alive = false; };
  }, [router]);

  if (state === "checking") {
    return <div className="adm" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--canvas)" }}><Spinner /></div>;
  }
  return <>{children}</>;
}
