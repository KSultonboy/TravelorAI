"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  FileText,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Wallet,
} from "lucide-react";

type ApiResponse<T> = { success: true; data: T } | { success: false; message: string; code?: string };

type Account = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
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
  price?: string | null;
  priceMin?: number | null;
  badge?: string | null;
  imageUrl?: string | null;
  itinerary?: unknown;
  highlights?: string[];
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

type BookingStatus = "all" | "pending" | "confirmed" | "completed" | "rejected" | "cancelled";

type MeData = {
  account: Account;
  application: AgencyApplication | null;
  agency: Agency | null;
  stats: Record<string, number>;
  bookingStats?: BookingStats;
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
};

type TourForm = {
  title: string;
  city: string;
  subtitle: string;
  duration: string;
  price: string;
  priceMin: string;
  badge: string;
  imageUrl: string;
  highlights: string;
  itineraryText: string;
  description: string;
};

const TOKEN_KEY = "travelorai_agency_token";

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
};

const emptyTour: TourForm = {
  title: "",
  city: "",
  subtitle: "",
  duration: "",
  price: "",
  priceMin: "",
  badge: "Latest",
  imageUrl: "",
  highlights: "",
  itineraryText: "",
  description: "",
};

const bookingStatusFilters: { key: BookingStatus; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "pending", label: "Yangi" },
  { key: "confirmed", label: "Tasdiqlangan" },
  { key: "completed", label: "Yakunlangan" },
  { key: "rejected", label: "Rad etilgan" },
  { key: "cancelled", label: "Bekor qilingan" },
];

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

function formatDate(value?: string | null) {
  if (!value) return "Hali yo'q";
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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

function tourToForm(tour: Tour): TourForm {
  let itineraryText = "";
  if (Array.isArray(tour.itinerary)) {
    itineraryText = tour.itinerary
      .map((item: unknown, index) => {
        const entry = item as { day?: string | number; title?: string; activity?: string; name?: string; description?: string };
        const prefix = entry.day ? `${entry.day}-kun: ` : `${index + 1}-kun: `;
        const title = entry.title || entry.activity || entry.name || "";
        const description = entry.description ? ` - ${entry.description}` : "";
        return `${prefix}${title}${description}`.trim();
      })
      .filter(Boolean)
      .join("\n");
  }

  return {
    title: tour.title || "",
    city: tour.city || "",
    subtitle: tour.subtitle || "",
    duration: tour.duration || "",
    price: tour.price || "",
    priceMin: tour.priceMin ? String(tour.priceMin) : "",
    badge: tour.badge || "Latest",
    imageUrl: tour.imageUrl || "",
    highlights: Array.isArray(tour.highlights) ? tour.highlights.join(", ") : "",
    itineraryText,
    description: tour.description || "",
  };
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
  const [tours, setTours] = useState<Tour[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingFilter, setBookingFilter] = useState<BookingStatus>("all");
  const [bookingNotes, setBookingNotes] = useState<Record<string, string>>({});
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

  function resetTourEditor() {
    setTourForm(emptyTour);
    setEditingTourId(null);
  }

  function editTour(tour: Tour) {
    setTourForm(tourToForm(tour));
    setEditingTourId(tour.id);
    setMessage("");
    setError("");
    if (typeof document !== "undefined") {
      document.getElementById("agency-new-tour")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function saveTour(submit = false) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { itineraryText, ...baseTourForm } = tourForm;
      const payload = {
        ...baseTourForm,
        priceMin: tourForm.priceMin ? Number(tourForm.priceMin) : undefined,
        highlights: tourForm.highlights
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        itinerary: parseItinerary(itineraryText),
      };
      const saveResult = await api<Tour>(editingTourId ? `/tours/${editingTourId}` : "/tours", {
        method: editingTourId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      }, token);
      if (!saveResult.success) throw new Error(saveResult.message);

      if (submit) {
        const submitResult = await api<Tour>(`/tours/${saveResult.data.id}/submit`, {
          method: "POST",
        }, token);
        if (!submitResult.success) throw new Error(submitResult.message);
      }

      const wasEditing = Boolean(editingTourId);
      resetTourEditor();
      setMessage(
        submit
          ? "Tour admin tekshiruvi uchun yuborildi."
          : wasEditing
            ? "Tour yangilandi. Publicga chiqishi uchun reviewga yuboring."
            : "Tour qoralama sifatida saqlandi."
      );
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
    resetTourEditor();
    setTours([]);
    setBookings([]);
    setBookingNotes({});
    setMode("login");
  }

  async function updateBookingStatus(id: string, status: "confirmed" | "rejected" | "cancelled" | "completed") {
    setLoading(true);
    setError("");
    setMessage("");
    const result = await api<{ booking: BookingItem; stats?: BookingStats }>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, agencyNote: bookingNotes[id] || "" }),
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
  const filteredBookings = bookingFilter === "all"
    ? bookings
    : bookings.filter((booking) => booking.status === bookingFilter);
  const editingTour = editingTourId ? tours.find((tour) => tour.id === editingTourId) : null;

  return (
    <main className={`agency-shell ${isApproved ? "agency-shell--dashboard" : ""}`}>
      {!isApproved && <section className="agency-hero">
        <div className="agency-brand">
          <span><Sparkles size={18} /></span>
          <b>TravelorAI Agency</b>
        </div>
        <h1>Tourlaringizni global bozorda ko&apos;rsating.</h1>
        <p>Agency profilingizni yuboring, admin tekshiruvidan o&apos;ting va tasdiqlangan tourlarni TravelorAI platformalarida boshqaring.</p>
        <div className="agency-hero__steps">
          <span><Mail size={16} /> Ro&apos;yxatdan o&apos;tish</span>
          <span><FileText size={16} /> Ariza yuborish</span>
          <span><ShieldCheck size={16} /> Admin tasdiqlashi</span>
          <span><BadgeCheck size={16} /> Tour chiqarish</span>
        </div>
      </section>}

      <section className="agency-panel">
        {token && !isApproved && (
          <button className="agency-logout" onClick={logout} type="button">
            <LogOut size={16} /> Chiqish
          </button>
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
            <h2>Kompaniya ma&apos;lumotlarini yuboring</h2>
            <p className="agency-muted">Status: <b>{statusLabel(me?.application?.status || me?.account.status)}</b></p>
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
                  {label}
                  <input
                    value={applicationForm[key]}
                    onChange={(event) => setApplicationForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </label>
              ))}
              <label className="agency-wide">
                Tavsif
                <textarea value={applicationForm.description} onChange={(event) => setApplicationForm((prev) => ({ ...prev, description: event.target.value }))} />
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
                    {me?.agency?.city || "Global"} - {me?.agency?.specialty || "Tours"} - Public tourlarni admin tasdiqlagandan keyin chiqaramiz.
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
                  <small>{draftTours.length} qoralama - {pendingTours.length} reviewda - {rejectedTours.length} rad etilgan</small>
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
                          <em>{statusLabel(booking.status)} - {formatMoney(Number(booking.totalEstimate || 0))}</em>
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
                      ? `${activeTour.city} - ${statusLabel(activeTour.approvalStatus)} - yangilangan: ${formatDate(activeTour.updatedAt)}`
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
                  <span className="agency-tour-count">{filteredBookings.length} / {bookings.length} ta</span>
                </div>
                <div className="agency-filter-row">
                  {bookingStatusFilters.map((item) => (
                    <button
                      key={item.key}
                      className={bookingFilter === item.key ? "agency-filter-chip agency-filter-chip--active" : "agency-filter-chip"}
                      onClick={() => setBookingFilter(item.key)}
                      type="button"
                    >
                      <Search size={14} /> {item.label}
                    </button>
                  ))}
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
                  {bookings.length > 0 && filteredBookings.length === 0 && (
                    <div className="agency-empty-state">
                      <Search size={28} />
                      <div>
                        <b>Bu statusda booking yo&apos;q.</b>
                        <p>Yangi so&apos;rovlar kelganda ularni shu yerdan filterlab boshqarasiz.</p>
                      </div>
                    </div>
                  )}
                  {filteredBookings.map((booking) => (
                    <article className="agency-booking-card" key={booking.id}>
                      <div>
                        <span className={`agency-status agency-status--${booking.status}`}>{statusLabel(booking.status)}</span>
                        <h4>{booking.customerName}</h4>
                        <p>{booking.tour?.title || "Tour"} - {booking.travelers} kishi - {formatDate(booking.travelDate || booking.createdAt)}</p>
                        <small>{booking.customerEmail}{booking.customerPhone ? ` - ${booking.customerPhone}` : ""}</small>
                        {booking.message ? <small><MessageSquare size={13} /> {booking.message}</small> : null}
                        {booking.adminNote ? <small className="agency-admin-note">Admin note: {booking.adminNote}</small> : null}
                      </div>
                      <div className="agency-booking-side">
                        <b>{formatMoney(Number(booking.totalEstimate || 0))}</b>
                        <label className="agency-booking-note">
                          Agency izohi
                          <textarea
                            value={bookingNotes[booking.id] ?? booking.agencyNote ?? ""}
                            onChange={(event) => setBookingNotes((prev) => ({ ...prev, [booking.id]: event.target.value }))}
                            placeholder="Mijoz bilan gaplashildi, vaqt kelishildi..."
                          />
                        </label>
                        <div className="agency-booking-actions">
                          <button disabled={loading || booking.status === "confirmed"} onClick={() => updateBookingStatus(booking.id, "confirmed")} type="button">
                            Tasdiqlash
                          </button>
                          <button disabled={loading || booking.status === "completed"} onClick={() => updateBookingStatus(booking.id, "completed")} type="button">
                            Yakunlash
                          </button>
                          <button disabled={loading || booking.status === "cancelled"} onClick={() => updateBookingStatus(booking.id, "cancelled")} type="button">
                            Bekor
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

              <section className="agency-dashboard-section" id="agency-new-tour">
                <div className="agency-section-heading">
                  <div>
                    <p className="agency-eyebrow">{editingTourId ? "Tour editor" : "Yangi tour"}</p>
                    <h3>{editingTourId ? "Tourni professional tahrirlash" : <>Tour ma&apos;lumotlarini to&apos;liq qo&apos;shish</>}</h3>
                    {editingTour ? (
                      <p className="agency-muted">
                        {editingTour.title} tahrirlanmoqda. Approved tour o&apos;zgarsa, qayta reviewdan o&apos;tadi.
                      </p>
                    ) : (
                      <p className="agency-muted">Cover rasm, highlights va itinerary to&apos;liq bo&apos;lsa, admin tezroq tasdiqlaydi.</p>
                    )}
                  </div>
                  {editingTourId ? (
                    <button className="agency-icon-action" onClick={resetTourEditor} type="button">
                      <X size={18} /> Yangi forma
                    </button>
                  ) : (
                    <Plus size={30} />
                  )}
                </div>
                <div className="agency-tour-editor-banner">
                  <div>
                    <span><Edit3 size={16} /> Tour studio</span>
                    <b>{tourForm.title || "Yangi public tour"}</b>
                    <small>{tourForm.city || "Destination"} - {tourForm.duration || "Duration"} - {tourForm.price || "Narx so'rovda"}</small>
                  </div>
                  <em>{editingTourId ? "Edit mode" : "Draft mode"}</em>
                </div>
                <div className="agency-form-grid agency-form-grid--wide">
                  {([
                    ["title", "Sarlavha"],
                    ["city", "Shahar / yo'nalish"],
                    ["subtitle", "Qisqa subtitle"],
                    ["duration", "Davomiylik"],
                    ["price", "Narx matni"],
                    ["priceMin", "Minimal narx"],
                    ["badge", "Badge"],
                    ["imageUrl", "Cover image URL"],
                    ["highlights", "Highlights, vergul bilan"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input value={tourForm[key]} onChange={(event) => setTourForm((prev) => ({ ...prev, [key]: event.target.value }))} />
                    </label>
                  ))}
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
                </div>
                <div className="agency-actions">
                  <button className="agency-actions__ghost" disabled={loading} onClick={resetTourEditor} type="button">
                    <X size={18} /> Tozalash
                  </button>
                  <button disabled={loading} onClick={() => saveTour(false)} type="button">
                    <FileText size={18} /> {editingTourId ? "O'zgarishni saqlash" : "Qoralama saqlash"}
                  </button>
                  <button disabled={loading} onClick={() => saveTour(true)} type="button">
                    <Send size={18} /> Admin reviewga yuborish
                  </button>
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
                            style={{ backgroundImage: `url(${tour.imageUrl})` }}
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
                          <span><BadgeCheck size={15} /> {tour.badge || "No badge"}</span>
                          <span><Clock3 size={15} /> {formatDate(tour.updatedAt)}</span>
                        </div>
                        {tour.adminNote && <small className="agency-admin-note">Admin note: {tour.adminNote}</small>}
                        <div className="agency-tour-actions">
                          <button onClick={() => editTour(tour)} type="button">
                            <Edit3 size={15} /> Tahrirlash
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
