// Admin panel API client — JWT localStorage'da; /api/backend proxy Authorization'ni backendga uzatadi.

const TOKEN_KEY = "travelora_admin_token";
const BASE = "/api/backend";

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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") headers.set("Origin", window.location.origin);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  let json: any = null;
  try { json = await res.json(); } catch { /* bo'sh */ }

  if (!res.ok || json?.success === false) {
    const msg = json?.message || `Xatolik (${res.status})`;
    if (res.status === 401 || res.status === 403) clearToken();
    throw new ApiError(msg, res.status, json);
  }
  return (json?.data ?? json) as T;
}

// ---- Auth ----
export async function adminLogin(email: string, password: string) {
  return api<{ requiresEmailCode?: boolean; email?: string }>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
export async function adminVerify(email: string, code: string) {
  const data = await api<{ token: string; user: AdminUser }>("/auth/admin/login/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  if (data?.token) setToken(data.token);
  return data;
}
export async function fetchMe() {
  return api<{ user: AdminUser }>("/auth/me");
}

export type AdminUser = { id: string; name: string; email: string; role?: string };
