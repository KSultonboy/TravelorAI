"use client";

/**
 * Yengil, event-driven bildirishnoma do'koni (localStorage).
 * Amallar sodir bo'lganda pushNotif chaqiriladi: yangi lid, bosqich o'zgarishi,
 * to'lov qabul qilinishi, tur qo'shilishi, bron tasdiqlanishi.
 * O'qilgan holati saqlanadi — "kv:notif" event orqali UI yangilanadi.
 */

export type KvNotif = {
  id: string;
  kind: "lead" | "stage" | "payment" | "tour" | "booking";
  stage?: string;
  title: string;
  sub?: string;
  ts: number;
  read: boolean;
};

const KEY = (a: string) => `kv_notifs_${a || "anon"}`;
const CAP = 60;

export function getNotifs(agencyId: string): KvNotif[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(agencyId));
    return raw ? (JSON.parse(raw) as KvNotif[]) : [];
  } catch {
    return [];
  }
}

function write(agencyId: string, list: KvNotif[]) {
  try {
    window.localStorage.setItem(KEY(agencyId), JSON.stringify(list.slice(0, CAP)));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("kv:notif"));
}

export function pushNotif(agencyId: string, n: Omit<KvNotif, "id" | "ts" | "read">) {
  if (typeof window === "undefined") return;
  const list = getNotifs(agencyId);
  list.unshift({
    ...n,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    read: false,
  });
  write(agencyId, list);
}

export function markRead(agencyId: string, id: string) {
  write(agencyId, getNotifs(agencyId).map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead(agencyId: string) {
  write(agencyId, getNotifs(agencyId).map((n) => ({ ...n, read: true })));
}

/** Do'kon bo'sh bo'lsa, mavjud lidlardan boshlang'ich feed'ni to'ldiradi (bir marta). */
export function seedNotifs(agencyId: string, seed: Omit<KvNotif, "id">[]) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(KEY(agencyId)) !== null) return;
  write(agencyId, seed.map((n, i) => ({ ...n, id: `seed-${i}` })));
}
