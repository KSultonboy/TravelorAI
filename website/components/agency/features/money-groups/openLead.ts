"use client";

import { useEffect, useRef } from "react";

// Dashboard'dagi «Qarzdorlik» kartasidan lid kartasini ochish: Leads bo'limi
// o'z ichki holatini (detailId) saqlaydi, shuning uchun so'rov oyna hodisasi
// orqali uzatiladi — KvCabinet'da qo'shimcha prop zanjiri kerak emas.
const OPEN_LEAD_EVENT = "travelorai:open-lead";

export function requestOpenLead(id: string) {
  if (typeof window === "undefined" || !id) return;
  // Leads bo'limi avval ko'rinishi uchun keyingi tick'da yuboramiz.
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_LEAD_EVENT, { detail: { id } })), 0);
}

/** Leads komponentida: `useOpenLeadRequest(setDetailId)`. */
export function useOpenLeadRequest(open: (id: string) => void) {
  const ref = useRef(open);
  useEffect(() => { ref.current = open; }, [open]);
  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) ref.current(id);
    };
    window.addEventListener(OPEN_LEAD_EVENT, handler);
    return () => window.removeEventListener(OPEN_LEAD_EVENT, handler);
  }, []);
}
