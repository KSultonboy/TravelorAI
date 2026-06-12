"use client";

export type AdminApiResponse<T> = { success: true; data: T } | { success: false; message: string };

// Admin so'rovlari admin-proxy orqali (cookie sessiya + x-admin-key server tomonda)
export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<AdminApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");

  try {
    const response = await fetch(`/api/admin-proxy/admin${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (payload && typeof payload === "object" && "success" in payload) return payload as AdminApiResponse<T>;
    if (response.ok) return { success: true, data: payload as T };
    return { success: false, message: `So'rov xatosi (HTTP ${response.status})` };
  } catch {
    return { success: false, message: "Server bilan aloqa uzildi" };
  }
}

export type AdminApplication = {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  website?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  serviceTypes: string[];
  description: string;
  imageUrl?: string | null;
  status: string;
  adminNote?: string | null;
  submittedAt?: string | null;
  account?: { email: string } | null;
};

export type AdminTour = {
  id: string;
  title: string;
  city: string;
  subtitle?: string | null;
  duration: string;
  price?: string | null;
  priceMin?: number | null;
  priceCurrency?: string | null;
  priceBasis?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  highlights?: string[];
  departureCity?: string | null;
  destinationCountry?: string | null;
  nights?: number | null;
  hotelName?: string | null;
  hotelCategory?: string | null;
  hotelLocation?: string | null;
  roomType?: string | null;
  mealPlan?: string | null;
  mealPlanLabel?: string | null;
  availabilityStatus?: string | null;
  flightSeatStatus?: string | null;
  instantConfirmation?: boolean;
  promo?: boolean;
  priceIncludes?: string[];
  priceExcludes?: string[];
  approvalStatus: string;
  active: boolean;
  adminNote?: string | null;
  submittedAt?: string | null;
  agency?: { id: string; name: string; city?: string | null } | null;
};

export type AdminBooking = {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  travelers: number;
  travelDate?: string | null;
  message?: string | null;
  status: string;
  agencyNote?: string | null;
  adminNote?: string | null;
  createdAt?: string | null;
  tour?: { id: string; title: string; city?: string | null } | null;
  agency?: { id: string; name: string } | null;
};

export type AdminAgency = {
  id: string;
  name: string;
  slug?: string;
  city?: string | null;
  specialty?: string | null;
  phone?: string | null;
  telegram?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  active: boolean;
  approvalStatus: string;
  tourCount?: number;
};

export function adminStatusLabel(status?: string) {
  const map: Record<string, string> = {
    draft: "Qoralama",
    pending: "Kutilmoqda",
    pending_review: "Tekshiruvda",
    confirmed: "Qabul qilingan",
    cancelled: "Bekor qilingan",
    completed: "Yakunlangan",
    approved: "Tasdiqlangan",
    rejected: "Rad etilgan",
  };
  return map[status || ""] || status || "Noma'lum";
}

export function adminFormatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
