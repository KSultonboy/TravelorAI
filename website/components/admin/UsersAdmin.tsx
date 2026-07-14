"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  ChevronLeft,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  lastName?: string | null;
  email: string;
  avatarUrl?: string | null;
  blocked: boolean;
  createdAt: string;
  tripCount: number;
  status: "active" | "blocked";
};

type UsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

type ResetResponse = {
  message: string;
  email: string;
  delivery?: string;
  devCode?: string;
};

async function getJson<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    const raw = await response.text();
    const payload = raw ? (JSON.parse(raw) as { success?: boolean; message?: string; data?: T }) : {};
    if (!response.ok || !payload.success) {
      return { ok: false, message: payload.message || `${response.status} xatolik` };
    }
    return { ok: true, data: payload.data as T };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Tarmoq xatoligi" };
  }
}

async function sendJson<T>(
  path: string,
  method: "POST" | "PATCH",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    const payload = raw ? (JSON.parse(raw) as { success?: boolean; message?: string; data?: T }) : {};
    if (!response.ok || !payload.success) {
      return { ok: false, message: payload.message || `${response.status} xatolik` };
    }
    return { ok: true, data: payload.data as T };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Tarmoq xatoligi" };
  }
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("uz-UZ");
}

function displayName(user: AdminUser) {
  return [user.name, user.lastName].filter(Boolean).join(" ").trim() || user.name || "-";
}

export default function UsersAdmin({ username }: { username: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = useCallback(async (term: string) => {
    setLoading(true);
    setError("");
    const query = term.trim() ? `?search=${encodeURIComponent(term.trim())}&limit=50` : "?limit=50";
    const result = await getJson<UsersResponse>(`/api/admin-proxy/admin/users${query}`);
    if (result.ok) {
      setUsers(result.data.items || []);
      setTotal(result.data.total || 0);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers("");
  }, [loadUsers]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadUsers(search);
  }

  async function sendReset(user: AdminUser) {
    setBusyId(user.id);
    setError("");
    setMessage("");
    const result = await sendJson<ResetResponse>(
      `/api/admin-proxy/admin/users/${encodeURIComponent(user.id)}/send-password-reset`,
      "POST"
    );
    if (result.ok) {
      const devHint = result.data.devCode ? ` (dev kod: ${result.data.devCode})` : "";
      setMessage(`${result.data.message}${devHint}`);
    } else {
      setError(result.message);
    }
    setBusyId(null);
  }

  async function toggleBlock(user: AdminUser) {
    setBusyId(user.id);
    setError("");
    setMessage("");
    const result = await sendJson<{ id: string; blocked: boolean; status: string }>(
      `/api/admin-proxy/admin/users/${encodeURIComponent(user.id)}/block`,
      "PATCH",
      { blocked: !user.blocked }
    );
    if (result.ok) {
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, blocked: result.data.blocked, status: result.data.blocked ? "blocked" : "active" }
            : item
        )
      );
      setMessage(result.data.blocked ? `${displayName(user)} bloklandi.` : `${displayName(user)} blokdan chiqarildi.`);
    } else {
      setError(result.message);
    }
    setBusyId(null);
  }

  async function handleLogout() {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-aside">
        <div>
          <div className="admin-brand">
            <span className="admin-brand__mark">
              <Sparkles size={18} />
            </span>
            <span>TravelorAI</span>
            <small>Admin</small>
          </div>
          <nav className="admin-sidebar-nav">
            <div className="admin-sidebar-group is-open">
              <div className="admin-sidebar-group__items">
                <Link href="/admin/content">
                  <ChevronLeft size={15} /> Content boshqaruvi
                </Link>
                <button className="active" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  <Users size={15} /> Foydalanuvchilar
                  <em>{total}</em>
                </button>
              </div>
            </div>
          </nav>
        </div>
        <button className="admin-logout" onClick={handleLogout} type="button">
          <LogOut size={17} />
          Chiqish
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Kirish: {username}</p>
            <h1>Foydalanuvchilar</h1>
            <p>Foydalanuvchilarni qidiring, parolni tiklash kodini ularning emailiga yuboring yoki hisobni bloklang.</p>
          </div>
          <button className="admin-secondary" onClick={() => loadUsers(search)} type="button">
            <RefreshCw size={17} />
            Yangilash
          </button>
        </header>

        {(message || error) && (
          <div className={error ? "admin-alert admin-alert--error" : "admin-alert admin-alert--success"}>
            {error || message}
          </div>
        )}

        <div className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-eyebrow">Ro&apos;yxat</p>
              <h2>{total} ta foydalanuvchi</h2>
            </div>
          </div>

          <form className="admin-form__row" onSubmit={handleSearch}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ism yoki email bo'yicha qidirish..."
            />
            <button className="admin-secondary" type="submit">
              <Search size={16} /> Qidirish
            </button>
          </form>

          {loading ? (
            <div className="admin-loading admin-loading--page">
              <Loader2 className="admin-spin" size={22} />
              Foydalanuvchilar yuklanmoqda...
            </div>
          ) : (
            <div className="admin-review-list">
              {users.length === 0 ? <div className="admin-empty">Foydalanuvchi topilmadi.</div> : null}
              {users.map((user) => (
                <article className="admin-review-card" key={user.id}>
                  <div>
                    <span className="admin-status-pill">{user.status === "blocked" ? "Bloklangan" : "Faol"}</span>
                    <h3>{displayName(user)}</h3>
                    <p>{user.email}</p>
                    <small>
                      {user.tripCount} ta sayohat | Ro&apos;yxatdan o&apos;tgan: {formatDate(user.createdAt)}
                    </small>
                  </div>
                  <div className="admin-review-actions">
                    <button disabled={busyId === user.id} onClick={() => sendReset(user)} type="button">
                      <KeyRound size={16} /> Parol tiklash yuborish
                    </button>
                    <button className={user.blocked ? "" : "danger"} disabled={busyId === user.id} onClick={() => toggleBlock(user)} type="button">
                      {user.blocked ? <ShieldCheck size={16} /> : <Ban size={16} />}
                      {user.blocked ? "Blokdan chiqarish" : "Bloklash"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
