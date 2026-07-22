"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { agencyApi } from "./api";
import type { BookingItem, BookingStats, MeData, Tour } from "./types";

export type SessionPhase = "loading" | "guest" | "onboarding" | "approved";

type AgencySessionValue = {
  phase: SessionPhase;
  me: MeData | null;
  tours: Tour[];
  bookings: BookingItem[];
  bookingStats: BookingStats | null;
  /** Har soniyada yangilanadi — countdown'lar uchun */
  clock: number;
  refresh: (silent?: boolean) => Promise<void>;
  refreshBookings: () => Promise<void>;
  refreshTours: () => Promise<void>;
  logout: () => Promise<void>;
};

const AgencySessionContext = createContext<AgencySessionValue | null>(null);

export function AgencySessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>("loading");
  const [me, setMe] = useState<MeData | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingStats, setBookingStats] = useState<BookingStats | null>(null);
  const [clock, setClock] = useState(0);

  const refreshTours = useCallback(async () => {
    const result = await agencyApi<{ items: Tour[]; total: number }>("/tours");
    if (result.success) setTours(result.data.items);
  }, []);

  const refreshBookings = useCallback(async () => {
    const result = await agencyApi<{ items: BookingItem[]; total: number; stats?: BookingStats }>(
      "/bookings?status=all"
    );
    if (result.success) {
      setBookings(result.data.items);
      if (result.data.stats) setBookingStats(result.data.stats);
    }
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setPhase("loading");
      const result = await agencyApi<MeData>("/auth/me");
      if (!result.success) {
        setMe(null);
        setTours([]);
        setBookings([]);
        setBookingStats(null);
        setPhase("guest");
        return;
      }
      setMe(result.data);
      if (result.data.bookingStats) setBookingStats(result.data.bookingStats);
      if (result.data.account.status === "approved") {
        setPhase("approved");
        await Promise.all([refreshTours(), refreshBookings()]);
      } else {
        setPhase("onboarding");
      }
    },
    [refreshBookings, refreshTours]
  );

  const logout = useCallback(async () => {
    await agencyApi("/auth/logout", { method: "POST" });
    // MUHIM: state'ni o'zgartirmasdan darrov navigatsiya qilamiz. Aks holda
    // setPhase("guest") oraliq ekranni bir zumga chizadi ("miltillash"). Joriy
    // ekran /signin yuklanguncha turadi — hech qanday oraliq ko'rinmaydi.
    if (typeof window !== "undefined") {
      window.location.assign("/signin");
      return;
    }
    setMe(null);
    setTours([]);
    setBookings([]);
    setBookingStats(null);
    setPhase("guest");
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Yangi lidlar (Telegram, marketplace) avtomatik ko'rinishi uchun davriy yangilash
  useEffect(() => {
    if (phase !== "approved") return;
    const timer = window.setInterval(() => { void refreshBookings(); }, 20000);
    return () => window.clearInterval(timer);
  }, [phase, refreshBookings]);

  const value = useMemo(
    () => ({ phase, me, tours, bookings, bookingStats, clock, refresh, refreshBookings, refreshTours, logout }),
    [phase, me, tours, bookings, bookingStats, clock, refresh, refreshBookings, refreshTours, logout]
  );

  return <AgencySessionContext.Provider value={value}>{children}</AgencySessionContext.Provider>;
}

export function useAgencySession() {
  const context = useContext(AgencySessionContext);
  if (!context) throw new Error("useAgencySession faqat AgencySessionProvider ichida ishlatiladi");
  return context;
}
