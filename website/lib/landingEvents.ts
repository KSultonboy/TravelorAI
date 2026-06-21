"use client";

type LandingEntityType = "place" | "agency" | "story";
type LandingEventType =
  | "view"
  | "click"
  | "search"
  | "open"
  | "direction_click"
  | "wishlist_add"
  | "trip_add"
  | "booking_click"
  | "agency_click"
  | "story_view";

type LandingEventPayload = {
  entityType: LandingEntityType;
  entityId: string;
  eventType: LandingEventType;
  metadata?: Record<string, unknown>;
};

const SESSION_KEY = "travelorai_landing_session";

function apiBase() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:4000/api/v1";
  }
  return "/api/v1";
}

function randomId() {
  if (typeof window !== "undefined" && window.crypto) {
    if (typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    return `landing_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  return `landing_${Date.now()}`;
}

function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = randomId();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return null;
  }
}

export function trackLandingEvent(payload: LandingEventPayload) {
  if (!payload.entityId) return;

  const body = JSON.stringify({
    ...payload,
    sessionId: getSessionId(),
    source: "website_landing",
  });

  try {
    void fetch(`${apiBase()}/home/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never block landing page navigation.
  }
}
