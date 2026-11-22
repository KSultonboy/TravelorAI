// Sozlamalar ichidagi aniq bo'limni (masalan «Obuna va to'lov») boshqa joydan
// ochish uchun kichik hodisa ko'prigi. Settings komponenti useSettingsTabRequest
// bilan tinglaydi; banner esa requestSettingsTab("plan") chaqiradi.
import { useEffect } from "react";

const EVENT = "travelorai:settings-tab";

export function requestSettingsTab(tab: string) {
  if (typeof window === "undefined") return;
  // Navigatsiya (go("settings")) render bo'lgandan keyin yuboramiz.
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT, { detail: { tab } })), 0);
}

export function useSettingsTabRequest(setTab: (tab: string) => void) {
  useEffect(() => {
    const onRequest = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab) setTab(tab);
    };
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, [setTab]);
}
