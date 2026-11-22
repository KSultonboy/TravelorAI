"use client";

// Sotuv kanallari (distribution) holati — bitta joyda yuklanadi va Sozlamalar
// bo'limi hamda har bir tur kartasidagi «Kanalga joylash» tugmasi bilan bo'lishiladi
// (har karta alohida so'rov yubormasin).
import { useEffect, useSyncExternalStore } from "react";
import { agencyApi } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";

export type DistributionChannel = { id: string; title?: string | null; username?: string | null };

export type DistributionSettings = {
  slug: string;
  storefrontUrl: string;
  botConnected: boolean;
  botUsername?: string | null;
  channel: DistributionChannel | null;
  payment: { url: string | null; requisites: string | null; allowlist: string[] };
  canManage: boolean;
  canPost: boolean;
  telegramCapability: boolean;
};

export type ChannelPostInfo = { tourId: string; lastPostedAt: string | null; count: number };

type State = {
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  settings: DistributionSettings | null;
  posts: Record<string, ChannelPostInfo>;
};

let state: State = { status: "idle", error: "", settings: null, posts: {} };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let ownerKey = "";

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const SERVER_STATE: State = { status: "idle", error: "", settings: null, posts: {} };
const getServerSnapshot = () => SERVER_STATE;

export function reloadDistribution(): Promise<void> {
  if (inflight) return inflight;
  emit({ status: state.settings ? state.status : "loading" });
  const startedFor = ownerKey;
  inflight = (async () => {
    const [settings, posts] = await Promise.all([
      agencyApi<DistributionSettings>("/distribution"),
      agencyApi<{ items: ChannelPostInfo[] }>("/distribution/channel-posts"),
    ]);
    if (startedFor !== ownerKey) return; // shu orada boshqa hisobga o'tildi
    const map: Record<string, ChannelPostInfo> = {};
    if (posts.success) for (const p of posts.data.items || []) map[p.tourId] = p;
    if (settings.success) emit({ status: "ready", error: "", settings: settings.data, posts: map });
    else emit({ status: "error", error: settings.message || "Sozlamalarni yuklab bo‘lmadi.", posts: map });
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function patchDistribution(patch: Partial<DistributionSettings>) {
  if (!state.settings) return;
  emit({ settings: { ...state.settings, ...patch } });
}

export function markTourPosted(tourId: string, postedAt: string) {
  const prev = state.posts[tourId];
  emit({ posts: { ...state.posts, [tourId]: { tourId, lastPostedAt: postedAt, count: (prev?.count || 0) + 1 } } });
}

export function useDistribution() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { me } = useAgencySession();
  const key = me?.agency?.id || "";
  useEffect(() => {
    if (!key) return;
    // Boshqa agentlik hisobiga kirilsa — eski agentlik ma'lumoti ko'rinmasin.
    if (key !== ownerKey) {
      ownerKey = key;
      inflight = null;
      emit({ status: "idle", error: "", settings: null, posts: {} });
    }
    if (state.status === "idle") void reloadDistribution();
  }, [key]);
  return snap;
}
