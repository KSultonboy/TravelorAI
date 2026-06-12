"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import Image from "next/image";

type ApiResponse<T> = { success: true; data: T } | { success: false; message: string; code?: string };

type Account = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
  pendingEmail?: string | null;
  emailChangeResendCount?: number;
  emailChangeResendsRemaining?: number;
};

type AgencyApplication = {
  id: string;
  companyName: string;
  legalName?: string | null;
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
  documents?: unknown;
  status: string;
  adminNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
};

type Agency = {
  id: string;
  name: string;
  city: string;
  specialty: string;
  description?: string | null;
  phone?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  approvalStatus: string;
  tourCount?: number;
};

type Tour = {
  id: string;
  title: string;
  city: string;
  subtitle: string;
  description?: string | null;
  duration: string;
  responseTimeMinutes?: number;
  price?: string | null;
  priceMin?: number | null;
  priceCurrency?: string | null;
  priceBasis?: string | null;
  badge?: string | null;
  imageUrl?: string | null;
  itinerary?: unknown;
  highlights?: string[];
  departureCity?: string | null;
  destinationCountry?: string | null;
  tourGroup?: string | null;
  nights?: number | null;
  hotelIncluded?: boolean;
  hotelName?: string | null;
  hotelCategory?: string | null;
  hotelLocation?: string | null;
  roomType?: string | null;
  mealPlan?: string | null;
  mealPlanLabel?: string | null;
  childPolicy?: string | null;
  flightSeatStatus?: string | null;
  availabilityStatus?: string | null;
  instantConfirmation?: boolean;
  stopSale?: boolean;
  promo?: boolean;
  priceIncludes?: string[];
  priceExcludes?: string[];
  approvalStatus: string;
  active: boolean;
  adminNote?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  updatedAt?: string | null;
};

type BookingItem = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  travelers: number;
  travelDate?: string | null;
  message?: string | null;
  status: string;
  responseDeadlineAt?: string | null;
  totalEstimate?: number | null;
  currency: string;
  agencyNote?: string | null;
  adminNote?: string | null;
  createdAt?: string | null;
  tour?: {
    id: string;
    title: string;
    city: string;
    duration?: string | null;
    price?: string | null;
    priceMin?: number | null;
    imageUrl?: string | null;
  } | null;
};

type BookingStats = {
  revenue: number;
  bookings: number;
  pending: number;
  confirmed: number;
  rejected: number;
  cancelled: number;
  completed: number;
  customers: number;
  conversion: number;
};

type MeData = {
  account: Account;
  application: AgencyApplication | null;
  agency: Agency | null;
  stats: Record<string, number>;
  bookingStats?: BookingStats;
  supportEmail?: string;
};

type ApplicationForm = {
  companyName: string;
  legalName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  website: string;
  telegram: string;
  instagram: string;
  serviceTypes: string;
  description: string;
  documents: string;
  imageUrl: string;
};

type TourForm = {
  title: string;
  city: string;
  subtitle: string;
  duration: string;
  responseTimeMinutes: string;
  price: string;
  priceMin: string;
  priceCurrency: string;
  priceBasis: string;
  badge: string;
  imageUrl: string;
  highlights: string;
  itineraryText: string;
  description: string;
  departureCity: string;
  destinationCountry: string;
  tourGroup: string;
  nights: string;
  hotelIncluded: boolean;
  hotelName: string;
  hotelCategory: string;
  hotelLocation: string;
  roomType: string;
  mealPlan: string;
  mealPlanLabel: string;
  childPolicy: string;
  flightSeatStatus: string;
  availabilityStatus: string;
  instantConfirmation: boolean;
  stopSale: boolean;
  promo: boolean;
  priceIncludes: string;
  priceExcludes: string;
};

type ProfileForm = {
  name: string;
  city: string;
  specialty: string;
  description: string;
  phone: string;
  website: string;
  imageUrl: string;
};

const TOKEN_KEY = "travelorai_agency_token";
const MEAL_PLAN_OPTIONS = [
  { value: "", label: "Tanlanmagan", description: "Eski tourlarda bo'sh turishi mumkin" },
  { value: "RO", label: "RO — Room Only", description: "Faqat xona, ovqat yo'q" },
  { value: "BB", label: "BB — Bed & Breakfast", description: "Yotoq + nonushta" },
  { value: "HB", label: "HB — Half Board", description: "Nonushta + kechki ovqat" },
  { value: "FB", label: "FB — Full Board", description: "3 mahal ovqat" },
  { value: "AI", label: "AI — All Inclusive", description: "Ovqat + ichimlik + ayrim xizmatlar" },
  { value: "UAI", label: "UAI — Ultra All Inclusive", description: "Premium ichimlik va xizmatlar ham kiradi" },
  { value: "UALL", label: "UALL — Ultra All Inclusive", description: "UAI bilan bir xil, ayrim operatorlar shunday yozadi" },
  { value: "FBT", label: "FBT — Full Board Treatment", description: "Davolanish/sanatoriy tur paketlari uchun" },
];
const HOTEL_CATEGORY_OPTIONS = ["", "3*", "4*", "5*", "Boutique", "Apartment", "Villa"];
const ROOM_TYPE_OPTIONS = ["", "Single", "Double", "Twin", "Triple", "Family", "Suite"];
const CURRENCY_OPTIONS = ["", "USD", "UZS", "RUB", "EUR", "AED"];
const AVAILABILITY_OPTIONS = [
  { value: "", label: "To'ldirilmagan" },
  { value: "available", label: "Joy bor" },
  { value: "few_seats", label: "Kam joy qoldi" },
  { value: "on_request", label: "So'rov bo'yicha" },
  { value: "sold_out", label: "Joy yo'q" },
];
const FLIGHT_SEAT_OPTIONS = [
  { value: "", label: "To'ldirilmagan" },
  { value: "not_included", label: "Avia kiritilmagan" },
  { value: "available", label: "Avia joy bor" },
  { value: "few_seats", label: "Avia joy kam" },
  { value: "on_request", label: "Avia so'rov bo'yicha" },
  { value: "no_seats", label: "Avia joy yo'q" },
];
const REQUIRED_APPLICATION_FIELDS = new Set([
  "companyName",
  "contactPerson",
  "phone",
  "email",
  "city",
  "country",
  "serviceTypes",
]);

const emptyApplication: ApplicationForm = {
  companyName: "",
  legalName: "",
  contactPerson: "",
  phone: "",
  email: "",
  city: "",
  country: "Global",
  website: "",
  telegram: "",
  instagram: "",
  serviceTypes: "Tours, Local guide",
  description: "",
  documents: "",
  imageUrl: "",
};

const emptyTour: TourForm = {
  title: "",
  city: "",
  subtitle: "",
  duration: "",
  responseTimeMinutes: "45",
  price: "",
  priceMin: "",
  priceCurrency: "USD",
  priceBasis: "",
  badge: "Latest",
  imageUrl: "",
  highlights: "",
  itineraryText: "",
  description: "",
  departureCity: "",
  destinationCountry: "",
  tourGroup: "",
  nights: "",
  hotelIncluded: false,
  hotelName: "",
  hotelCategory: "",
  hotelLocation: "",
  roomType: "",
  mealPlan: "",
  mealPlanLabel: "",
  childPolicy: "",
  flightSeatStatus: "",
  availabilityStatus: "",
  instantConfirmation: false,
  stopSale: false,
  promo: false,
  priceIncludes: "",
  priceExcludes: "",
};

const emptyProfile: ProfileForm = {
  name: "",
  city: "",
  specialty: "",
  description: "",
  phone: "",
  website: "",
  imageUrl: "",
};

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(`/api/agency-proxy/agency${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  return response.json();
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    draft: "Qoralama",
    pending: "Admin tekshiruvi kutilmoqda",
    pending_review: "Tour tekshiruvi kutilmoqda",
    confirmed: "Tasdiqlangan",
    cancelled: "Bekor qilingan",
    completed: "Yakunlangan",
    approved: "Tasdiqlangan",
    rejected: "Rad etilgan",
  };
  return map[status || ""] || status || "Noma'lum";
}

function formatMoney(value: number) {
  if (!value) return "$0";
  return `$${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

function selectedMealLabel(code?: string) {
  return MEAL_PLAN_OPTIONS.find((item) => item.value === code)?.description || "";
}

function optionLabel(options: { value: string; label: string }[], value?: string | null) {
  return options.find((item) => item.value === value)?.label || "To'ldirilmagan";
}

function parseTextList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTextList(value?: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean).join("\n") : "";
}

function itineraryToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      return String(record.title || record.name || record.description || "").trim();
    })
    .filter(Boolean)
    .join("\n");
}

function tourToForm(tour: Tour): TourForm {
  return {
    ...emptyTour,
    title: tour.title || "",
    city: tour.city || "",
    subtitle: tour.subtitle || "",
    duration: tour.duration || "",
    responseTimeMinutes: String(tour.responseTimeMinutes || 45),
    price: tour.price || "",
    priceMin: tour.priceMin != null ? String(tour.priceMin) : "",
    priceCurrency: tour.priceCurrency || "USD",
    priceBasis: tour.priceBasis || "",
    badge: tour.badge || "Latest",
    imageUrl: tour.imageUrl || "",
    highlights: joinTextList(tour.highlights),
    itineraryText: itineraryToText(tour.itinerary),
    description: tour.description || "",
    departureCity: tour.departureCity || "",
    destinationCountry: tour.destinationCountry || "",
    tourGroup: tour.tourGroup || "",
    nights: tour.nights != null ? String(tour.nights) : "",
    hotelIncluded: Boolean(tour.hotelIncluded),
    hotelName: tour.hotelName || "",
    hotelCategory: tour.hotelCategory || "",
    hotelLocation: tour.hotelLocation || "",
    roomType: tour.roomType || "",
    mealPlan: tour.mealPlan || "",
    mealPlanLabel: tour.mealPlanLabel || selectedMealLabel(tour.mealPlan || ""),
    childPolicy: tour.childPolicy || "",
    flightSeatStatus: tour.flightSeatStatus || "",
    availabilityStatus: tour.availabilityStatus || "",
    instantConfirmation: Boolean(tour.instantConfirmation),
    stopSale: Boolean(tour.stopSale),
    promo: Boolean(tour.promo),
    priceIncludes: joinTextList(tour.priceIncludes),
    priceExcludes: joinTextList(tour.priceExcludes),
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Hali yo'q";
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function remainingTime(deadline?: string | null) {
  if (!deadline) return "Muddat belgilanmagan";
  const distance = new Date(deadline).getTime() - Date.now();
  if (distance <= 0) return "Javob muddati tugagan";
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  const seconds = Math.floor((distance % 60_000) / 1000);
  return `${hours ? `${hours} soat ` : ""}${minutes} daqiqa ${seconds} soniya`;
}

function readImage(file: File | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type.startsWith("image/")) return reject(new Error("Faqat rasm fayli tanlang"));
    if (file.size > 8 * 1024 * 1024) return reject(new Error("Rasm 8 MB dan oshmasligi kerak"));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi"));
    reader.readAsDataURL(file);
  });
}

function parseItinerary(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return undefined;
  return lines.map((line, index) => ({
    order: index + 1,
    title: line,
  }));
}

function fillApplicationForm(application: AgencyApplication | null, account?: Account): ApplicationForm {
  if (!application) {
    return { ...emptyApplication, email: account?.email || "" };
  }
  return {
    companyName: application.companyName || "",
    legalName: application.legalName || "",
    contactPerson: application.contactPerson || "",
    phone: application.phone || "",
    email: application.email || account?.email || "",
    city: application.city || "",
    country: application.country || "Global",
    website: application.website || "",
    telegram: application.telegram || "",
    instagram: application.instagram || "",
    serviceTypes: (application.serviceTypes || []).join(", "),
    description: application.description || "",
    documents: application.documents ? JSON.stringify(application.documents, null, 2) : "",
    imageUrl: application.imageUrl || "",
  };
}

function fillProfileForm(agency: Agency | null): ProfileForm {
  if (!agency) return emptyProfile;
  return {
    name: agency.name || "",
    city: agency.city || "",
    specialty: agency.specialty || "",
    description: agency.description || "",
    phone: agency.phone || "",
    website: agency.website || "",
    imageUrl: agency.imageUrl || "",
  };
}

export default function AgencyPortal() {
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [me, setMe] = useState<MeData | null>(null);
  const [applicationForm, setApplicationForm] = useState<ApplicationForm>(emptyApplication);
  const [tourForm, setTourForm] = useState<TourForm>(emptyTour);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [, setClockTick] = useState(0);
  const [tours, setTours] = useState<Tour[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadTours = useCallback(async (nextToken = token) => {
    if (!nextToken) return;
    const result = await api<{ items: Tour[]; total: number }>("/tours", {}, nextToken);
    if (result.success) setTours(result.data.items);
  }, [token]);

  const loadBookings = useCallback(async (nextToken = token) => {
    if (!nextToken) return;
    const result = await api<{ items: BookingItem[]; total: number; stats?: BookingStats }>("/bookings?status=all", {}, nextToken);
    if (result.success) {
      setBookings(result.data.items);
      if (result.data.stats) {
        setMe((current) => (current ? { ...current, bookingStats: result.data.stats } : current));
      }
    }
  }, [token]);

  const loadMe = useCallback(async (nextToken = token) => {
    if (!nextToken) return;
    const result = await api<MeData>("/auth/me", {}, nextToken);
    if (!result.success) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setMe(null);
      setError(result.message);
      return;
    }
    setMe(result.data);
    setApplicationForm(fillApplicationForm(result.data.application, result.data.account));
    setProfileForm(fillProfileForm(result.data.agency));
    if (result.data.account.status === "approved") {
      await Promise.all([loadTours(nextToken), loadBookings(nextToken)]);
    }
  }, [loadBookings, loadTours, token]);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      loadMe(saved);
    }
  }, [loadMe]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const result = await api<{ requiresVerification: boolean; delivery?: { devCode?: string } }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (!result.success) throw new Error(result.message);
        setMode("verify");
        setMessage(result.data.delivery?.devCode ? `Tasdiqlash kodi: ${result.data.delivery.devCode}` : "Tasdiqlash kodi emailingizga yuborildi.");
        return;
      }

      if (mode === "verify") {
        const result = await api<{ token: string; account: Account }>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ email, code }),
        });
        if (!result.success) throw new Error(result.message);
        localStorage.setItem(TOKEN_KEY, result.data.token);
        setToken(result.data.token);
        setMessage("Email tasdiqlandi. Endi agency arizasini to'ldiring.");
        await loadMe(result.data.token);
        return;
      }

      const result = await api<{ token: string; account: Account }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!result.success) {
        if (result.code === "EMAIL_NOT_VERIFIED") setMode("verify");
        throw new Error(result.message);
      }
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      await loadMe(result.data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  async function saveApplication(submit = false) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const documents = applicationForm.documents.trim()
        ? applicationForm.documents
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined;
      const payload = {
        ...applicationForm,
        serviceTypes: applicationForm.serviceTypes
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        documents,
      };
      const saveResult = await api<{ application: AgencyApplication }>("/application", {
        method: "PUT",
        body: JSON.stringify(payload),
      }, token);
      if (!saveResult.success) throw new Error(saveResult.message);

      if (submit) {
        const submitResult = await api<{ application: AgencyApplication }>("/application/submit", {
          method: "POST",
        }, token);
        if (!submitResult.success) throw new Error(submitResult.message);
      setMessage("Ariza admin tekshiruvi uchun yuborildi.");
      } else {
        setMessage("Ariza draft sifatida saqlandi.");
      }
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ariza saqlanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function chooseImage(file: File | null, target: "application" | "tour" | "profile") {
    setError("");
    try {
      const imageUrl = await readImage(file);
      if (target === "application") setApplicationForm((prev) => ({ ...prev, imageUrl }));
      if (target === "tour") setTourForm((prev) => ({ ...prev, imageUrl }));
      if (target === "profile") setProfileForm((prev) => ({ ...prev, imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasm tanlanmadi");
    }
  }

  async function saveProfile() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ agency: Agency }>("/profile", {
        method: "PUT",
        body: JSON.stringify(profileForm),
      }, token);
      if (!result.success) throw new Error(result.message);
      setMessage("Agentlik profili yangilandi.");
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil yangilanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function requestEmailChange() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ account: Account; message: string; delivery?: { devCode?: string } }>(
        "/auth/email-change/request",
        { method: "POST", body: JSON.stringify({ newEmail }) },
        token
      );
      if (!result.success) throw new Error(result.message);
      setMessage(result.data.delivery?.devCode ? `${result.data.message} Kod: ${result.data.delivery.devCode}` : result.data.message);
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email almashtirish boshlanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function resendEmailChange() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ account: Account; message: string; delivery?: { devCode?: string } }>(
        "/auth/email-change/resend",
        { method: "POST" },
        token
      );
      if (!result.success) throw new Error(result.message);
      setMessage(result.data.delivery?.devCode ? `${result.data.message} Kod: ${result.data.delivery.devCode}` : result.data.message);
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod qayta yuborilmadi");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEmailChange() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ token: string; account: Account; message: string }>(
        "/auth/email-change/confirm",
        { method: "POST", body: JSON.stringify({ code: emailChangeCode }) },
        token
      );
      if (!result.success) throw new Error(result.message);
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      setNewEmail("");
      setEmailChangeCode("");
      setMessage(result.data.message);
      await loadMe(result.data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod tasdiqlanmadi");
    } finally {
      setLoading(false);
    }
  }

  function resetTourEditor() {
    setEditingTourId(null);
    setTourForm(emptyTour);
  }

  function startEditTour(tour: Tour) {
    setEditingTourId(tour.id);
    setTourForm(tourToForm(tour));
    setError("");
    setMessage(`${tour.title} tahrirlash uchun formaga yuklandi.`);
    document.getElementById("agency-new-tour")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveTour(submit = false) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { itineraryText, ...baseTourForm } = tourForm;
      const mealPlanLabel = tourForm.mealPlan ? selectedMealLabel(tourForm.mealPlan) : "";
      const payload = {
        ...baseTourForm,
        priceMin: tourForm.priceMin ? Number(tourForm.priceMin) : undefined,
        nights: tourForm.nights ? Number(tourForm.nights) : undefined,
        responseTimeMinutes: Number(tourForm.responseTimeMinutes || 45),
        mealPlanLabel,
        highlights: parseTextList(tourForm.highlights),
        priceIncludes: parseTextList(tourForm.priceIncludes),
        priceExcludes: parseTextList(tourForm.priceExcludes),
        itinerary: parseItinerary(itineraryText),
      };
      const path = editingTourId ? `/tours/${editingTourId}` : "/tours";
      const createResult = await api<Tour>(path, {
        method: editingTourId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }, token);
      if (!createResult.success) throw new Error(createResult.message);

      if (submit) {
        const submitResult = await api<Tour>(`/tours/${createResult.data.id}/submit`, {
          method: "POST",
        }, token);
        if (!submitResult.success) throw new Error(submitResult.message);
      }

      const wasEditing = Boolean(editingTourId);
      resetTourEditor();
      setMessage(wasEditing
        ? "Tour yangilandi. Public tourlar o'zgargandan keyin admin reviewga qaytadi."
        : submit ? "Tour admin tekshiruvi uchun yuborildi." : "Tour qoralama sifatida saqlandi.");
      await loadTours();
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tour saqlanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function submitExistingTour(id: string) {
    setLoading(true);
    setError("");
    setMessage("");
    const result = await api<Tour>(`/tours/${id}/submit`, { method: "POST" }, token);
    if (result.success) {
      setMessage("Tour tekshiruv uchun yuborildi.");
      await loadTours();
      await loadMe();
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setTours([]);
    setBookings([]);
    setMode("login");
    setEmail("");
    setPassword("");
    setCode("");
    setNewEmail("");
    setEmailChangeCode("");
    setMessage("Agency hisobidan chiqildi.");
    setError("");
  }

  function renderEmailChangePanel() {
    if (!me) return null;

    return (
      <div className="agency-email-change">
        <div>
          <h4>Login emailini almashtirish</h4>
          <p>Hozirgi email: <b>{me.account.email}</b>. Tasdiqlash kodi aynan shu eski emailga yuboriladi.</p>
        </div>
        {!me.account.pendingEmail ? (
          <div className="agency-email-change__row">
            <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Yangi email" />
            <button disabled={loading || !newEmail.trim()} onClick={requestEmailChange} type="button"><Mail size={17} /> Kod yuborish</button>
          </div>
        ) : (
          <>
            <p>Yangi email: <b>{me.account.pendingEmail}</b></p>
            <div className="agency-email-change__row">
              <input inputMode="numeric" maxLength={6} value={emailChangeCode} onChange={(event) => setEmailChangeCode(event.target.value.replace(/\D/g, ""))} placeholder="6 xonali kod" />
              <button disabled={loading || emailChangeCode.length !== 6} onClick={confirmEmailChange} type="button"><BadgeCheck size={17} /> Tasdiqlash</button>
              <button disabled={loading || (me.account.emailChangeResendsRemaining || 0) <= 0} onClick={resendEmailChange} type="button">
                <RefreshCw size={17} /> Qayta yuborish ({me.account.emailChangeResendsRemaining ?? 3})
              </button>
            </div>
            {(me.account.emailChangeResendsRemaining || 0) <= 0 ? (
              <p className="agency-email-support">Kod yetib kelmasa support/adminga murojaat qiling: <a href={`mailto:${me.supportEmail || "support@travelorai.local"}`}>{me.supportEmail || "support@travelorai.local"}</a></p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  async function updateBookingStatus(id: string, status: "confirmed" | "rejected" | "cancelled" | "completed") {
    setLoading(true);
    setError("");
    setMessage("");
    const result = await api<{ booking: BookingItem; stats?: BookingStats }>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, token);

    if (result.success) {
      setMessage(`Booking ${statusLabel(status).toLowerCase()} qilindi.`);
      await loadBookings();
      await loadMe();
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  const isApproved = me?.account.status === "approved";
  const totalTours = tours.length;
  const approvedTours = tours.filter((tour) => tour.approvalStatus === "approved");
  const pendingTours = tours.filter((tour) => tour.approvalStatus === "pending_review");
  const draftTours = tours.filter((tour) => tour.approvalStatus === "draft");
  const rejectedTours = tours.filter((tour) => tour.approvalStatus === "rejected");
  const estimatedPortfolioValue = approvedTours.reduce((sum, tour) => sum + Number(tour.priceMin || 0), 0);
  const salesSummary = me?.bookingStats || {
    revenue: 0,
    bookings: 0,
    pending: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    customers: 0,
    conversion: 0,
  };
  const latestBookings = bookings.slice(0, 4);
  const activeTour = approvedTours[0] || tours[0] || null;

  return (
    <main className={`agency-shell ${isApproved ? "agency-shell--dashboard" : ""}`}>
      {!isApproved && <section className="agency-hero">
        <div className="agency-brand">
          <span><Sparkles size={18} /></span>
          <b>TravelorAI Agency</b>
        </div>
        <h1>Tourlaringizni dunyo sayohatchilariga chiqaring.</h1>
        <p>Agency profilingizni yuboring, admin tekshiruvidan o&apos;ting va tasdiqlangan tourlarni TravelorAI platformalarida ko&apos;rsating.</p>
        <div className="agency-hero__steps">
          <span><Mail size={16} /> Ro&apos;yxatdan o&apos;tish</span>
          <span><FileText size={16} /> Ariza yuborish</span>
          <span><ShieldCheck size={16} /> Admin tasdiqlashi</span>
          <span><BadgeCheck size={16} /> Tour chiqarish</span>
        </div>
      </section>}

      <section className="agency-panel">
        {token && me && (
          <div className="agency-session-bar">
            <div>
              <span>Agency hisobi</span>
              <b>{me.account.email}</b>
            </div>
            <button onClick={() => loadMe()} disabled={loading} type="button">
              <RefreshCw size={16} /> Yangilash
            </button>
            <button className="agency-session-bar__logout" onClick={logout} type="button">
              <LogOut size={16} /> Chiqish
            </button>
          </div>
        )}

        {!token ? (
          <form className="agency-card agency-auth" onSubmit={handleAuth}>
            <p className="agency-eyebrow">{mode === "register" ? "Yangi agency" : mode === "verify" ? "Email tasdiqlash" : "Qaytgan agency"}</p>
            <h2>{mode === "register" ? "Agency ro'yxatdan o'tishi" : mode === "verify" ? "Emailni tasdiqlang" : "Agency login"}</h2>
            {message && <div className="agency-alert agency-alert--success">{message}</div>}
            {error && <div className="agency-alert agency-alert--error">{error}</div>}

            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
            </label>
            {mode !== "verify" && (
              <label>
                Parol
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
              </label>
            )}
            {mode === "verify" && (
              <label>
                Tasdiqlash kodi
                <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" required />
              </label>
            )}
            <button disabled={loading} type="submit">
              {loading ? <Loader2 className="agency-spin" size={18} /> : <ArrowRight size={18} />}
              {mode === "register" ? "Ro'yxatdan o'tish" : mode === "verify" ? "Tasdiqlash" : "Kirish"}
            </button>
            <button
              className="agency-link-button"
              type="button"
              onClick={() => {
                setError("");
                setMessage("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Yangi agency akkaunt ochish" : "Login sahifasiga qaytish"}
            </button>
          </form>
        ) : !isApproved ? (
          <div className="agency-card">
            <p className="agency-eyebrow">Agency arizasi</p>
            <h2>Kompaniya ma&apos;lumotlarini tahrirlash</h2>
            <p className="agency-muted">Status: <b>{statusLabel(me?.application?.status || me?.account.status)}</b></p>
            <div className="agency-alert agency-alert--info">
              Bu bo‘limda agentlik rasmi, aloqa ma’lumotlari va ariza tafsilotlarini o‘zgartirishingiz mumkin. Public profil va tour boshqaruvi admin tasdiqlagandan keyin ochiladi.
            </div>
            {me?.application?.adminNote && <div className="agency-alert agency-alert--error">Admin note: {me.application.adminNote}</div>}
            {message && <div className="agency-alert agency-alert--success">{message}</div>}
            {error && <div className="agency-alert agency-alert--error">{error}</div>}

            <div className="agency-form-grid">
              {([
                ["companyName", "Kompaniya nomi"],
                ["legalName", "Yuridik nomi"],
                ["contactPerson", "Mas'ul shaxs"],
                ["phone", "Telefon"],
                ["email", "Public email"],
                ["city", "Shahar"],
                ["country", "Davlat"],
                ["website", "Website URL"],
                ["telegram", "Telegram"],
                ["instagram", "Instagram"],
                ["serviceTypes", "Xizmat turlari, vergul bilan"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}{REQUIRED_APPLICATION_FIELDS.has(key) ? <b className="agency-required"> *</b> : null}</span>
                  <input
                    value={applicationForm[key]}
                    onChange={(event) => setApplicationForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    required={REQUIRED_APPLICATION_FIELDS.has(key)}
                  />
                </label>
              ))}
              <label className="agency-wide">
                <span>Tavsif<b className="agency-required"> *</b></span>
                <textarea required minLength={20} value={applicationForm.description} onChange={(event) => setApplicationForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <label className="agency-wide">
                Agentlik rasmi yoki logotipi
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => chooseImage(event.target.files?.[0] || null, "application")} />
                {applicationForm.imageUrl ? <Image unoptimized width={840} height={480} className="agency-image-preview" src={publicImageSrc(applicationForm.imageUrl)} alt="Agentlik rasmi preview" /> : null}
              </label>
              <label className="agency-wide">
                Hujjat yoki rasm URLlari, har biri yangi qatorda
                <textarea value={applicationForm.documents} onChange={(event) => setApplicationForm((prev) => ({ ...prev, documents: event.target.value }))} />
              </label>
            </div>
            <div className="agency-actions">
              <button disabled={loading} onClick={() => saveApplication(false)} type="button">
                <FileText size={18} /> Draft saqlash
              </button>
              <button disabled={loading} onClick={() => saveApplication(true)} type="button">
                <Send size={18} /> Reviewga yuborish
              </button>
            </div>
            {renderEmailChangePanel()}
          </div>
        ) : (
          <div className="agency-dashboard-shell">
            <aside className="agency-dashboard-sidebar">
              <div className="agency-dashboard-brand">
                <span><Sparkles size={18} /></span>
                <div>
                  <b>TravelorAI</b>
                  <small>Agency panel</small>
                </div>
              </div>
              <nav aria-label="Agency dashboard">
                <a href="#agency-overview"><LayoutDashboard size={17} /> Overview</a>
                <a href="#agency-sales"><BarChart3 size={17} /> Sotuvlar</a>
                <a href="#agency-bookings"><CalendarDays size={17} /> Bookinglar</a>
                <a href="#agency-profile"><Pencil size={17} /> Profilni tahrirlash</a>
                <a href="#agency-new-tour"><Plus size={17} /> Tour qo&apos;shish</a>
                <a href="#agency-tours"><ListChecks size={17} /> Mening tourlarim</a>
              </nav>
              <button onClick={logout} type="button">
                <LogOut size={16} /> Chiqish
              </button>
            </aside>

            <div className="agency-dashboard-main">
              <header className="agency-dashboard-topbar" id="agency-overview">
                <div>
                  <p className="agency-eyebrow">Tasdiqlangan agency dashboard</p>
                  <h2>{me?.agency?.name || "Agency dashboard"}</h2>
                  <p className="agency-muted">
                    {me?.agency?.city || "Global"} · {me?.agency?.specialty || "Tours"} · Public tourlarni admin tasdiqlagandan keyin chiqaramiz.
                  </p>
                </div>
                <div className="agency-dashboard-actions">
                  <button disabled={loading} onClick={() => loadMe()} type="button">
                    <RefreshCw size={17} /> Yangilash
                  </button>
                  <button className="agency-dashboard-actions__ghost" onClick={logout} type="button">
                    <LogOut size={17} /> Chiqish
                  </button>
                </div>
              </header>

              {message && <div className="agency-alert agency-alert--success">{message}</div>}
              {error && <div className="agency-alert agency-alert--error">{error}</div>}

              <section className="agency-kpi-grid">
                <article className="agency-kpi-card agency-kpi-card--dark">
                  <span><Wallet size={18} /> Taxminiy portfolio</span>
                  <b>{formatMoney(estimatedPortfolioValue)}</b>
                  <small>Approved tourlarning minimal narxlari yig&apos;indisi</small>
                </article>
                <article className="agency-kpi-card">
                  <span><FileText size={18} /> Jami tour</span>
                  <b>{totalTours}</b>
                  <small>{draftTours.length} qoralama · {pendingTours.length} reviewda · {rejectedTours.length} rad etilgan</small>
                </article>
                <article className="agency-kpi-card agency-kpi-card--success">
                  <span><CheckCircle2 size={18} /> Publicda</span>
                  <b>{approvedTours.length}</b>
                  <small>Tasdiqlangan va foydalanuvchilarga ko&apos;rinadigan tourlar</small>
                </article>
                <article className="agency-kpi-card agency-kpi-card--warning">
                  <span><Clock3 size={18} /> Tekshiruv</span>
                  <b>{pendingTours.length}</b>
                  <small>Admin review kutayotgan tourlar</small>
                </article>
              </section>

              <section className="agency-dashboard-grid">
                <article className="agency-dashboard-section agency-sales-panel" id="agency-sales">
                  <div className="agency-section-heading">
                    <div>
                      <p className="agency-eyebrow">Sotuv nazorati</p>
                      <h3>Sotuvlar va bookinglar</h3>
                    </div>
                    <TrendingUp size={28} />
                  </div>
                  <div className="agency-sales-grid">
                    <div>
                      <span>Daromad</span>
                      <b>{formatMoney(salesSummary.revenue)}</b>
                    </div>
                    <div>
                      <span>Booking</span>
                      <b>{salesSummary.bookings}</b>
                    </div>
                    <div>
                      <span>Mijozlar</span>
                      <b>{salesSummary.customers}</b>
                    </div>
                    <div>
                      <span>Conversion</span>
                      <b>{salesSummary.conversion}%</b>
                    </div>
                  </div>
                  {latestBookings.length ? (
                    <div className="agency-sales-table">
                      {latestBookings.map((booking) => (
                        <div key={booking.id}>
                          <span>{booking.customerName}</span>
                          <b>{booking.tour?.title || "Tour"}</b>
                          <em>{statusLabel(booking.status)} · {formatMoney(Number(booking.totalEstimate || 0))}</em>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="agency-empty-sales">
                      <BarChart3 size={22} />
                      <div>
                        <b>Hali booking so&apos;rovlari yo&apos;q.</b>
                        <p>Public tourlar mobile appda ko&apos;ringandan keyin foydalanuvchi booking so&apos;rovi shu yerga tushadi.</p>
                      </div>
                    </div>
                  )}
                </article>

                <article className="agency-dashboard-section agency-focus-card">
                  <p className="agency-eyebrow">Profil sifati</p>
                  <h3>{activeTour ? activeTour.title : "Birinchi touringizni yarating"}</h3>
                  <p className="agency-muted">
                    {activeTour
                      ? `${activeTour.city} · ${statusLabel(activeTour.approvalStatus)} · yangilangan: ${formatDate(activeTour.updatedAt)}`
                      : "Tour rasm, itinerary, narx va highlights bilan to'liq kiritilsa, admin review tezroq o'tadi."}
                  </p>
                  <ul className="agency-quality-list">
                    <li><CheckCircle2 size={17} /> Aniq narx va davomiylik</li>
                    <li><CheckCircle2 size={17} /> Kamida 3 ta highlight</li>
                    <li><CheckCircle2 size={17} /> Kunma-kun itinerary</li>
                    <li><CheckCircle2 size={17} /> Sifatli cover image URL</li>
                  </ul>
                </article>
              </section>

              <section className="agency-dashboard-section" id="agency-bookings">
                <div className="agency-section-heading">
                  <div>
                    <p className="agency-eyebrow">Mijoz so&apos;rovlari</p>
                    <h3>Bookinglar</h3>
                  </div>
                  <span className="agency-tour-count">{bookings.length} ta</span>
                </div>
                <div className="agency-booking-list">
                  {bookings.length === 0 && (
                    <div className="agency-empty-state">
                      <CalendarDays size={28} />
                      <div>
                        <b>Booking hali kelmagan.</b>
                        <p>Tour publicga chiqgach, foydalanuvchilar detail sahifadan so&apos;rov yuboradi.</p>
                      </div>
                    </div>
                  )}
                  {bookings.map((booking) => (
                    <article className="agency-booking-card" key={booking.id}>
                      <div>
                        <span className={`agency-status agency-status--${booking.status}`}>{statusLabel(booking.status)}</span>
                        <h4>{booking.customerName}</h4>
                        <p>{booking.tour?.title || "Tour"} · {booking.travelers} kishi · {formatDate(booking.travelDate || booking.createdAt)}</p>
                        <small>{booking.customerEmail}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}</small>
                        {booking.message ? <small>{booking.message}</small> : null}
                        {booking.status === "pending" ? <small className="agency-countdown"><Clock3 size={14} /> {remainingTime(booking.responseDeadlineAt)}</small> : null}
                      </div>
                      <div className="agency-booking-side">
                        <b>{formatMoney(Number(booking.totalEstimate || 0))}</b>
                        <div className="agency-booking-actions">
                          <button disabled={loading || booking.status === "confirmed"} onClick={() => updateBookingStatus(booking.id, "confirmed")} type="button">
                            Tasdiqlash
                          </button>
                          <button disabled={loading || booking.status === "completed"} onClick={() => updateBookingStatus(booking.id, "completed")} type="button">
                            Yakunlash
                          </button>
                          <button disabled={loading || booking.status === "rejected"} onClick={() => updateBookingStatus(booking.id, "rejected")} type="button">
                            Rad etish
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="agency-dashboard-section" id="agency-profile">
                <div className="agency-section-heading">
                  <div>
                    <p className="agency-eyebrow">Public agentlik profili</p>
                    <h3>Ma&apos;lumotlarni tahrirlash</h3>
                  </div>
                  <Pencil size={28} />
                </div>
                <div className="agency-form-grid agency-form-grid--wide">
                  {([
                    ["name", "Agentlik nomi"],
                    ["city", "Shahar"],
                    ["specialty", "Yo‘nalish / xizmatlar"],
                    ["phone", "Telefon"],
                    ["website", "Website URL"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      <span>{label}{["name", "city", "specialty"].includes(key) ? <b className="agency-required"> *</b> : null}</span>
                      <input
                        required={["name", "city", "specialty"].includes(key)}
                        value={profileForm[key]}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                  <label className="agency-wide">
                    Tavsif
                    <textarea value={profileForm.description} onChange={(event) => setProfileForm((prev) => ({ ...prev, description: event.target.value }))} />
                  </label>
                  <label className="agency-wide">
                    Agentlik rasmi yoki logotipi
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => chooseImage(event.target.files?.[0] || null, "profile")} />
                    {profileForm.imageUrl ? <Image unoptimized width={840} height={480} className="agency-image-preview" src={publicImageSrc(profileForm.imageUrl)} alt="Agentlik profili preview" /> : null}
                  </label>
                </div>
                <div className="agency-actions">
                  <button disabled={loading} onClick={saveProfile} type="button"><Pencil size={18} /> Profilni saqlash</button>
                </div>

                {renderEmailChangePanel()}
              </section>

              <section className="agency-dashboard-section" id="agency-new-tour">
                <div className="agency-section-heading">
                  <div>
                    <p className="agency-eyebrow">Yangi tour</p>
                    <h3>{editingTourId ? "Tour ma'lumotlarini tahrirlash" : "Tour ma'lumotlarini to'liq qo'shish"}</h3>
                  </div>
                  <Plus size={30} />
                </div>
                {editingTourId ? (
                  <div className="agency-editing-banner">
                    <Pencil size={16} />
                    Eski tour formaga yuklandi. Bo&apos;sh maydonlarni to&apos;ldirib saqlasangiz, admin qayta review qiladi.
                  </div>
                ) : null}
                <div className="agency-form-grid agency-form-grid--wide">
                  <p className="agency-form-section-title agency-wide">Asosiy paket</p>
                  {([
                    ["title", "Sarlavha", "text"],
                    ["city", "Shahar / yo'nalish", "text"],
                    ["subtitle", "Qisqa subtitle", "text"],
                    ["duration", "Davomiylik", "text"],
                    ["departureCity", "Jo'nash shahri", "text"],
                    ["destinationCountry", "Davlat / yo'nalish mamlakati", "text"],
                    ["tourGroup", "Tour guruhi", "text"],
                    ["nights", "Tunlar soni", "number"],
                  ] as const).map(([key, label, type]) => (
                    <label key={key}>
                      {label}
                      <input
                        type={type}
                        value={tourForm[key]}
                        onChange={(event) => setTourForm((prev) => ({ ...prev, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                  <p className="agency-form-section-title agency-wide">Mehmonxona va ovqatlanish</p>
                  <label className="agency-checkbox-row agency-wide">
                    <input
                      type="checkbox"
                      checked={tourForm.hotelIncluded}
                      onChange={(event) => setTourForm((prev) => ({ ...prev, hotelIncluded: event.target.checked }))}
                    />
                    Mehmonxona paketga kiritilgan
                  </label>
                  <label>
                    Mehmonxona nomi
                    <input value={tourForm.hotelName} onChange={(event) => setTourForm((prev) => ({ ...prev, hotelName: event.target.value }))} />
                  </label>
                  <label>
                    Hotel category
                    <select value={tourForm.hotelCategory} onChange={(event) => setTourForm((prev) => ({ ...prev, hotelCategory: event.target.value }))}>
                      {HOTEL_CATEGORY_OPTIONS.map((item) => <option key={item || "empty"} value={item}>{item || "To'ldirilmagan"}</option>)}
                    </select>
                  </label>
                  <label>
                    Hotel hududi
                    <input value={tourForm.hotelLocation} onChange={(event) => setTourForm((prev) => ({ ...prev, hotelLocation: event.target.value }))} placeholder="Dubai Marina, Baku center..." />
                  </label>
                  <label>
                    Room type
                    <select value={tourForm.roomType} onChange={(event) => setTourForm((prev) => ({ ...prev, roomType: event.target.value }))}>
                      {ROOM_TYPE_OPTIONS.map((item) => <option key={item || "empty"} value={item}>{item || "To'ldirilmagan"}</option>)}
                    </select>
                  </label>
                  <label>
                    Ovqatlanish turi
                    <select
                      value={tourForm.mealPlan}
                      onChange={(event) => {
                        const mealPlan = event.target.value;
                        setTourForm((prev) => ({ ...prev, mealPlan, mealPlanLabel: mealPlan ? selectedMealLabel(mealPlan) : "" }));
                      }}
                    >
                      {MEAL_PLAN_OPTIONS.map((item) => <option key={item.value || "empty"} value={item.value}>{item.label}</option>)}
                    </select>
                    <span className="agency-field-hint">{selectedMealLabel(tourForm.mealPlan) || "RO, BB, HB, FB, AI, UAI kabi aniq paket turi."}</span>
                  </label>
                  <label>
                    Bolalar siyosati
                    <input value={tourForm.childPolicy} onChange={(event) => setTourForm((prev) => ({ ...prev, childPolicy: event.target.value }))} placeholder="0-5 yosh bepul, alohida joy so'rov bo'yicha..." />
                  </label>
                  <p className="agency-form-section-title agency-wide">Narx va mavjudlik</p>
                  {([
                    ["responseTimeMinutes", "Bookingga javob vaqti (daqiqa)", "number"],
                    ["price", "Narx matni", "text"],
                    ["priceMin", "Minimal narx", "number"],
                    ["priceBasis", "Narx nimaga hisoblangan", "text"],
                  ] as const).map(([key, label, type]) => (
                    <label key={key}>
                      {label}
                      <input
                        type={type}
                        min={key === "responseTimeMinutes" ? 5 : undefined}
                        max={key === "responseTimeMinutes" ? 1440 : undefined}
                        value={tourForm[key]}
                        onChange={(event) => setTourForm((prev) => ({ ...prev, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                  <label>
                    Currency
                    <select value={tourForm.priceCurrency} onChange={(event) => setTourForm((prev) => ({ ...prev, priceCurrency: event.target.value }))}>
                      {CURRENCY_OPTIONS.map((item) => <option key={item || "empty"} value={item}>{item || "To'ldirilmagan"}</option>)}
                    </select>
                  </label>
                  <label>
                    Tour mavjudligi
                    <select value={tourForm.availabilityStatus} onChange={(event) => setTourForm((prev) => ({ ...prev, availabilityStatus: event.target.value }))}>
                      {AVAILABILITY_OPTIONS.map((item) => <option key={item.value || "empty"} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Avia joylari
                    <select value={tourForm.flightSeatStatus} onChange={(event) => setTourForm((prev) => ({ ...prev, flightSeatStatus: event.target.value }))}>
                      {FLIGHT_SEAT_OPTIONS.map((item) => <option key={item.value || "empty"} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <div className="agency-checkbox-group agency-wide">
                    {([
                      ["instantConfirmation", "Instant confirmation"],
                      ["stopSale", "Stop-sale"],
                      ["promo", "Promo tour"],
                    ] as const).map(([key, label]) => (
                      <label className="agency-checkbox-row" key={key}>
                        <input
                          type="checkbox"
                          checked={tourForm[key]}
                          onChange={(event) => setTourForm((prev) => ({ ...prev, [key]: event.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="agency-form-section-title agency-wide">Kontent</p>
                  {([
                    ["badge", "Badge"],
                    ["imageUrl", "Cover image URL"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="text"
                        value={tourForm[key]}
                        onChange={(event) => setTourForm((prev) => ({ ...prev, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                  <label className="agency-wide">
                    Highlights, har bir qator alohida
                    <textarea
                      value={tourForm.highlights}
                      onChange={(event) => setTourForm((prev) => ({ ...prev, highlights: event.target.value }))}
                      placeholder={"Burj Khalifa\nDubai Mall\nDesert Safari"}
                    />
                  </label>
                  <label className="agency-wide">
                    Tour cover rasmini fayldan tanlash
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => chooseImage(event.target.files?.[0] || null, "tour")} />
                    {tourForm.imageUrl ? <Image unoptimized width={840} height={480} className="agency-image-preview" src={publicImageSrc(tourForm.imageUrl)} alt="Tour cover preview" /> : null}
                  </label>
                  <label className="agency-wide">
                    Kunma-kun itinerary, har bir qator alohida activity
                    <textarea
                      value={tourForm.itineraryText}
                      onChange={(event) => setTourForm((prev) => ({ ...prev, itineraryText: event.target.value }))}
                      placeholder={"1-kun: Airport pick-up va city walk\n2-kun: Asosiy landmarklar va mahalliy taomlar"}
                    />
                  </label>
                  <label className="agency-wide">
                    To&apos;liq tavsif
                    <textarea
                      value={tourForm.description}
                      onChange={(event) => setTourForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Tour kimlar uchun, nimalar kiradi, nimalar alohida to'lanadi va uchrashuv joyi..."
                    />
                  </label>
                  <label className="agency-wide">
                    Narxga kiradi, har bir qator alohida
                    <textarea
                      value={tourForm.priceIncludes}
                      onChange={(event) => setTourForm((prev) => ({ ...prev, priceIncludes: event.target.value }))}
                      placeholder={"Mehmonxona\nAeroport transferi\nEkskursiya"}
                    />
                  </label>
                  <label className="agency-wide">
                    Narxga kirmaydi, har bir qator alohida
                    <textarea
                      value={tourForm.priceExcludes}
                      onChange={(event) => setTourForm((prev) => ({ ...prev, priceExcludes: event.target.value }))}
                      placeholder={"Viza\nSug'urta\nShaxsiy xarajatlar"}
                    />
                  </label>
                </div>
                <div className="agency-actions">
                  <button disabled={loading} onClick={() => saveTour(false)} type="button">
                    <FileText size={18} /> {editingTourId ? "O'zgarishlarni saqlash" : "Qoralama saqlash"}
                  </button>
                  <button disabled={loading} onClick={() => saveTour(true)} type="button">
                    <Send size={18} /> {editingTourId ? "Saqlash va reviewga yuborish" : "Admin reviewga yuborish"}
                  </button>
                  {editingTourId ? (
                    <button disabled={loading} onClick={resetTourEditor} type="button">
                      <RefreshCw size={18} /> Bekor qilish
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="agency-dashboard-section" id="agency-tours">
                <div className="agency-section-heading">
                  <div>
                    <p className="agency-eyebrow">Mening tourlarim</p>
                    <h3>Tourlar boshqaruvi</h3>
                  </div>
                  <span className="agency-tour-count">{totalTours} ta</span>
                </div>
                <div className="agency-tour-card-list">
                  {tours.length === 0 && (
                    <div className="agency-empty-state">
                      <ListChecks size={28} />
                      <b>Hali tour yo&apos;q.</b>
                      <p>Birinchi tourni yuqoridagi forma orqali qoralama sifatida saqlang yoki reviewga yuboring.</p>
                    </div>
                  )}
                  {tours.map((tour) => (
                    <article className="agency-tour-card" key={tour.id}>
                      <div className="agency-tour-thumb">
                        {tour.imageUrl ? (
                          <span
                            className="agency-tour-thumb__image"
                            style={{ backgroundImage: `url(${publicImageSrc(tour.imageUrl)})` }}
                            role="img"
                            aria-label={tour.title}
                          />
                        ) : <Eye size={28} />}
                      </div>
                      <div className="agency-tour-body">
                        <div className="agency-tour-body__title">
                          <div>
                            <span className={`agency-status agency-status--${tour.approvalStatus}`}>{statusLabel(tour.approvalStatus)}</span>
                            <h4>{tour.title}</h4>
                          </div>
                          <b>{tour.price || formatMoney(Number(tour.priceMin || 0))}</b>
                        </div>
                        <p>{tour.subtitle || tour.description || "Qisqa tavsif kiritilmagan."}</p>
                        <div className="agency-tour-meta">
                          <span><CalendarDays size={15} /> {tour.duration || "Davomiylik yo'q"}</span>
                          <span><Clock3 size={15} /> {tour.responseTimeMinutes || 45} daqiqada javob</span>
                          <span><BadgeCheck size={15} /> {tour.badge || "No badge"}</span>
                          <span><Clock3 size={15} /> {formatDate(tour.updatedAt)}</span>
                        </div>
                        <div className="agency-tour-meta">
                          <span>Hotel: {tour.hotelName || tour.hotelCategory || "To'ldirilmagan"}</span>
                          <span>Room: {tour.roomType || "To'ldirilmagan"}</span>
                          <span>Meal: {tour.mealPlan ? `${tour.mealPlan} — ${tour.mealPlanLabel || selectedMealLabel(tour.mealPlan)}` : "To'ldirilmagan"}</span>
                          <span>{optionLabel(AVAILABILITY_OPTIONS, tour.availabilityStatus)}</span>
                        </div>
                        {tour.adminNote && <small className="agency-admin-note">Admin note: {tour.adminNote}</small>}
                        <div className="agency-tour-actions">
                          <button onClick={() => startEditTour(tour)} type="button">
                            <Pencil size={15} /> Tahrirlash
                          </button>
                          {tour.approvalStatus === "approved" ? (
                            <span className="agency-public-chip"><CheckCircle2 size={15} /> Publicda ko&apos;rinadi</span>
                          ) : tour.approvalStatus === "pending_review" ? (
                            <span className="agency-public-chip agency-public-chip--pending"><Clock3 size={15} /> Review kutilmoqda</span>
                          ) : (
                            <button onClick={() => submitExistingTour(tour.id)} type="button">
                              <Send size={15} /> Reviewga yuborish
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
