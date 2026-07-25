// Admin panel API klienti — cookie-asosli sessiya (System A).
// Login  → /api/admin-auth/login  {username,password}'ni ADMIN_USERNAME/ADMIN_PASSWORD bilan tekshiradi,
//          httpOnly HMAC cookie (travelorai_admin_session) o'rnatadi.
// Data   → /api/admin-proxy/*  cookie'ni tekshiradi va backend /admin/* ga x-admin-key inject qiladi.
// localStorage token / Bearer YO'Q — hammasi cookie orqali.

const BASE = "/api/admin-proxy";

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  let json: any = null;
  try { json = await res.json(); } catch { /* bo'sh */ }

  if (!res.ok || json?.success === false) {
    const msg = json?.message || `Xatolik (${res.status})`;
    throw new ApiError(msg, res.status, json);
  }
  return (json?.data ?? json) as T;
}

// ---- Auth (cookie sessiya) ----
export async function adminLogin(username: string, password: string) {
  const res = await fetch("/api/admin-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
    credentials: "same-origin",
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* bo'sh */ }
  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.message || `Kirib bo'lmadi (${res.status})`, res.status, json);
  }
  return (json?.data ?? {}) as { username: string };
}

export async function adminLogout() {
  try {
    await fetch("/api/admin-auth/logout", { method: "POST", credentials: "same-origin" });
  } catch { /* e'tiborsiz */ }
}

export async function fetchMe(): Promise<{ user: AdminUser }> {
  const res = await fetch("/api/admin-auth/session", { cache: "no-store", credentials: "same-origin" });
  let json: any = null;
  try { json = await res.json(); } catch { /* bo'sh */ }
  const authed = Boolean(json?.data?.authenticated);
  const username: string = json?.data?.username || "";
  if (!authed) throw new ApiError("Sessiya topilmadi", 401, json);
  return { user: { name: username || "Admin", username, role: "admin" } };
}

export type AdminUser = { id?: string; name: string; username?: string; email?: string; role?: string };
