"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Plane,
  RefreshCw,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import GoogleContinueButton from "@/components/GoogleContinueButton";

type ApiResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      message: string;
      requiresVerification?: boolean;
      email?: string;
      authProvider?: "local" | "google";
      contactAdmin?: boolean;
      attemptsRemaining?: number;
    };
type User = {
  id: string;
  name: string;
  lastName?: string | null;
  fullName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  email: string;
  emailVerified?: boolean;
  authProvider?: "local" | "google";
};
type Tour = {
  id: string;
  slug: string;
  title: string;
  city: string;
  duration?: string;
  price?: string;
  priceMin?: number | null;
  imageUrl?: string | null;
  responseTimeMinutes?: number;
  agency?: { name: string; phone?: string | null; website?: string | null; imageUrl?: string | null } | null;
};
type Booking = {
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
  responseDeadlineAt?: string | null;
  createdAt?: string;
  tour?: Tour | null;
  agency?: { name: string; city?: string; phone?: string | null; website?: string | null } | null;
};
type TravelPreferences = {
  style: "budget" | "mid" | "luxury";
  interests: string[];
  updatedAt?: string | null;
};
type TripPlan = {
  status?: string;
  destinations?: string[];
  startDate?: string;
  endDate?: string;
  coverImage?: string;
  notes?: string;
  days?: unknown[];
  highlights?: string[];
  progress?: { visitedStopIds?: string[] };
};
type Trip = {
  id: string;
  title: string;
  totalCost: number;
  travelers: number;
  duration: number;
  perPersonCost: number;
  budgetUsed: number;
  budgetRemaining: number;
  style: string;
  planData?: TripPlan | null;
  createdAt?: string;
  updatedAt?: string;
};
type WishlistItem = {
  id: string;
  poiId?: string | null;
  name: string;
  city: string;
  slug: string;
  type: string;
  icon: string;
  savedAt: string;
};
type AchievementItem = {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: string;
  accent: string;
  target: number;
  current: number;
  unlocked: boolean;
  progress: number;
  progressText: string;
};
type Achievements = {
  items: AchievementItem[];
  unlockedCount: number;
  totalCount: number;
  completionRate: number;
  nextAchievement: AchievementItem | null;
  stats: {
    tripCount: number;
    uniqueCities: number;
    totalSpent: number;
    budgetTrips: number;
    maxDuration: number;
    maxTravelers: number;
  };
};
type TripReview = {
  id: string;
  tripId: string;
  rating: number;
  comment: string;
  createdAt: string;
  trip?: { id: string; title: string; createdAt?: string };
};
type ReviewsPayload = {
  items: TripReview[];
  total: number;
  averageRating: number;
};
type SecurityCodeResult = {
  message: string;
  email?: string;
  currentEmail?: string;
  pendingEmail?: string;
  attemptsRemaining: number;
  devCode?: string;
};

const COOKIE_SESSION = "cookie-session";

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token && token !== COOKIE_SESSION) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`/api/backend${path}`, { ...init, headers, cache: "no-store" });
  return response.json();
}

function countdown(deadline?: string | null) {
  if (!deadline) return "Deadline yo‘q";
  const distance = new Date(deadline).getTime() - Date.now();
  if (distance <= 0) return "Javob muddati tugagan";
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  const seconds = Math.floor((distance % 60_000) / 1000);
  return `${hours ? `${hours} soat ` : ""}${minutes} daqiqa ${seconds} soniya`;
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "Ko‘rsatilmagan";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("uz-UZ");
}

type GeneratedPlanDay = {
  day?: number;
  dayNumber?: number;
  destination?: string;
  city?: string;
  activities?: { name?: string; time?: string; cost?: number; type?: string }[];
  dailyCost?: number;
};

type GeneratedPlan = {
  title?: string;
  duration?: number;
  travelers?: number;
  totalCost?: number;
  style?: string;
  days?: GeneratedPlanDay[];
  [key: string]: unknown;
};

function styleLabel(style?: string) {
  if (style === "budget") return "Tejamkor";
  if (style === "luxury") return "Premium";
  return "O‘rtacha";
}

const STYLE_OPTIONS: { value: "budget" | "mid" | "luxury"; label: string }[] = [
  { value: "budget", label: "Tejamkor" },
  { value: "mid", label: "O‘rtacha" },
  { value: "luxury", label: "Premium" },
];

const INTEREST_OPTIONS = [
  "Tarix",
  "Tabiat",
  "Plyaj",
  "Shopping",
  "Gastronomiya",
  "Madaniyat",
  "Sarguzasht",
  "Dam olish",
  "Diniy",
  "Oilaviy",
];

export default function AccountPortal() {
  const searchParams = useSearchParams();
  const selectedTourKey = searchParams.get("tour") || "";
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [achievements, setAchievements] = useState<Achievements | null>(null);
  const [preferences, setPreferences] = useState<TravelPreferences | null>(null);
  const [reviews, setReviews] = useState<ReviewsPayload>({ items: [], total: 0, averageRating: 0 });
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [phone, setPhone] = useState("");
  const [travelers, setTravelers] = useState("1");
  const [travelDate, setTravelDate] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [emailChangeStage, setEmailChangeStage] = useState<"request" | "verify">("request");
  const [emailChangeRemaining, setEmailChangeRemaining] = useState(3);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteStage, setDeleteStage] = useState<"request" | "verify">("request");
  const [deleteRemaining, setDeleteRemaining] = useState(3);
  const [, setTick] = useState(0);
  // Profil va afzalliklarni tahrirlash (mobil bilan sinxron)
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileLastName, setProfileLastName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefStyle, setPrefStyle] = useState<"budget" | "mid" | "luxury">("mid");
  const [prefInterests, setPrefInterests] = useState<string[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  // AI sayohat rejasi (planner) — mobil bilan bir xil backend
  const [planCity, setPlanCity] = useState("");
  const [planDuration, setPlanDuration] = useState("3");
  const [planTravelers, setPlanTravelers] = useState("2");
  const [planBudget, setPlanBudget] = useState("3000000");
  const [planStyle, setPlanStyle] = useState<"budget" | "mid" | "luxury">("mid");
  const [planInterests, setPlanInterests] = useState<string[]>(["Tarix", "Tabiat"]);
  const [planStartDate, setPlanStartDate] = useState("");
  const [planResult, setPlanResult] = useState<GeneratedPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const loadDashboard = useCallback(async (nextToken: string) => {
    setDashboardLoading(true);
    setError("");
    const [me, preferenceResult, tripResult, wishlistResult, achievementResult, reviewResult, bookingResult] =
      await Promise.allSettled([
        api<{ user: User }>("/auth/me", {}, nextToken),
        api<{ preferences: TravelPreferences }>("/auth/preferences", {}, nextToken),
        api<Trip[]>("/trips", {}, nextToken),
        api<WishlistItem[]>("/wishlist", {}, nextToken),
        api<Achievements>("/achievements", {}, nextToken),
        api<ReviewsPayload>("/trips/reviews", {}, nextToken),
        api<{ items: Booking[] }>("/bookings/mine", {}, nextToken),
      ]);

    let failed = 0;
    if (me.status === "fulfilled" && me.value.success) {
      setUser(me.value.data.user);
      setName(me.value.data.user.name);
      setEmail(me.value.data.user.email);
    } else failed += 1;
    if (preferenceResult.status === "fulfilled" && preferenceResult.value.success) {
      setPreferences(preferenceResult.value.data.preferences);
    } else failed += 1;
    if (tripResult.status === "fulfilled" && tripResult.value.success) setTrips(tripResult.value.data);
    else failed += 1;
    if (wishlistResult.status === "fulfilled" && wishlistResult.value.success) setWishlist(wishlistResult.value.data);
    else failed += 1;
    if (achievementResult.status === "fulfilled" && achievementResult.value.success) setAchievements(achievementResult.value.data);
    else failed += 1;
    if (reviewResult.status === "fulfilled" && reviewResult.value.success) setReviews(reviewResult.value.data);
    else failed += 1;
    if (bookingResult.status === "fulfilled" && bookingResult.value.success) setBookings(bookingResult.value.data.items);
    else failed += 1;

    if (failed > 0) setError(`${failed} ta ma’lumot bo‘limini yuklab bo‘lmadi. Backend va internet ulanishini tekshiring.`);
    setDashboardLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    api<{ user: User }>("/auth/me").then((result) => {
      if (!active || !result.success) return;
      setToken(COOKIE_SESSION);
      setUser(result.data.user);
      setEmail(result.data.user.email);
      setName(result.data.user.name);
      void loadDashboard(COOKIE_SESSION);
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!selectedTourKey) return;
    api<{ items: Tour[] }>("/home/tours?limit=60").then((result) => {
      if (!result.success) return;
      const match = result.data.items.find((item) => item.slug === selectedTourKey || item.id === selectedTourKey) || result.data.items[0];
      setSelectedTour(match || null);
    });
  }, [selectedTourKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (mode === "register") {
        const result = await api<{ email: string; requiresVerification: boolean; devCode?: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        if (!result.success) {
          if (result.requiresVerification) {
            setEmail(result.email || email.trim().toLowerCase());
            setMode("verify");
            setMessage("Bu Gmail avval ro‘yxatdan o‘tgan. Tasdiqlash kodini qayta yuboring.");
            return;
          }
          if (result.authProvider === "local") setMode("login");
          throw new Error(result.message);
        }
        setMode("verify");
        setMessage(result.data.devCode ? `Kod yuborildi: ${result.data.devCode}` : "Tasdiqlash kodi emailingizga yuborildi.");
        return;
      }

      const path = mode === "verify" ? "/auth/verify-email" : "/auth/login";
      const body = mode === "verify" ? { email, code } : { email, password };
      const result = await api<{ user: User }>(path, { method: "POST", body: JSON.stringify(body) });
      if (!result.success) throw new Error(result.message);
      setToken(COOKIE_SESSION);
      setUser(result.data.user);
      setEmail(result.data.user.email);
      await loadDashboard(COOKIE_SESSION);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirish amalga oshmadi");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setLoading(true);
    setError("");
    const result = await api<{ message: string; devCode?: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (result.success) setMessage(result.data.devCode ? `${result.data.message} Kod: ${result.data.devCode}` : result.data.message);
    else setError(result.message);
    setLoading(false);
  }

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ user: User }>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      });
      if (!result.success) throw new Error(result.message);
      setToken(COOKIE_SESSION);
      setUser(result.data.user);
      setEmail(result.data.user.email);
      setName(result.data.user.name);
      await loadDashboard(COOKIE_SESSION);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google orqali kirib bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard]);

  const handleGoogleError = useCallback((googleError: string) => {
    setError(googleError);
  }, []);

  async function createBooking(event: FormEvent) {
    event.preventDefault();
    if (!selectedTour || !user || !token) return;
    setLoading(true);
    setError("");
    setMessage("");
    const result = await api<{ booking: Booking }>("/bookings", {
      method: "POST",
      body: JSON.stringify({
        tourId: selectedTour.id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: phone,
        travelers: Number(travelers || 1),
        travelDate,
        message: bookingMessage,
        source: "website",
      }),
    }, token);
    if (result.success) {
      setMessage("Booking so‘rovi yuborildi. Holati web va mobil ilovada bir xil akkaunt orqali ko‘rinadi.");
      setPhone("");
      setTravelDate("");
      setBookingMessage("");
      await loadDashboard(token);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  async function requestEmailChange() {
    if (!token || !user) return;
    setLoading(true);
    setError("");
    const result = await api<SecurityCodeResult>("/auth/email-change/request", {
      method: "POST",
      body: JSON.stringify({
        newEmail,
        ...(user.authProvider === "local" ? { password: securityPassword } : {}),
      }),
    }, token);
    if (result.success) {
      setEmailChangeStage("verify");
      setEmailChangeRemaining(result.data.attemptsRemaining);
      if (result.data.devCode) setEmailChangeCode(result.data.devCode);
      setMessage(result.data.devCode ? `${result.data.message} Kod: ${result.data.devCode}` : result.data.message);
    } else {
      setError(result.contactAdmin ? `${result.message} Admin bilan aloqa: Fikr va shikoyatlar bo‘limi.` : result.message);
    }
    setLoading(false);
  }

  async function verifyEmailChange() {
    if (!token) return;
    setLoading(true);
    setError("");
    const result = await api<{ message: string; user: User }>("/auth/email-change/verify", {
      method: "POST",
      body: JSON.stringify({ code: emailChangeCode }),
    }, token);
    if (result.success) {
      setToken(COOKIE_SESSION);
      setUser(result.data.user);
      setEmail(result.data.user.email);
      setNewEmail("");
      setSecurityPassword("");
      setEmailChangeCode("");
      setEmailChangeStage("request");
      setEmailChangeRemaining(3);
      setMessage(result.data.message);
    } else setError(result.message);
    setLoading(false);
  }

  async function requestDeleteCode() {
    if (!token || !user) return;
    setLoading(true);
    setError("");
    const result = await api<SecurityCodeResult>("/auth/account-deletion/request", {
      method: "POST",
      body: JSON.stringify(user.authProvider === "local" ? { password: securityPassword } : {}),
    }, token);
    if (result.success) {
      setDeleteStage("verify");
      setDeleteRemaining(result.data.attemptsRemaining);
      if (result.data.devCode) setDeleteCode(result.data.devCode);
      setMessage(result.data.devCode ? `${result.data.message} Kod: ${result.data.devCode}` : result.data.message);
    } else {
      setError(result.contactAdmin ? `${result.message} Admin bilan aloqa: Fikr va shikoyatlar bo‘limi.` : result.message);
    }
    setLoading(false);
  }

  async function deleteAccount() {
    if (!token) return;
    setLoading(true);
    setError("");
    const result = await api<{ message: string }>("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ confirm: true, code: deleteCode }),
    }, token);
    if (result.success) {
      logout();
      setMessage(result.data.message);
    } else setError(result.message);
    setLoading(false);
  }

  function startEditProfile() {
    if (!user) return;
    setProfileLastName(user.lastName || "");
    setProfileBio(user.bio || "");
    setName(user.name);
    setEditingProfile(true);
  }

  async function saveProfile() {
    if (!token || !user) return;
    setSavingProfile(true);
    setError("");
    const result = await api<{ user: User }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: name.trim() || user.name,
        lastName: profileLastName.trim() || null,
        bio: profileBio.trim() || null,
        avatarUrl: user.avatarUrl || null,
      }),
    }, token);
    if (result.success) {
      setUser(result.data.user);
      setEditingProfile(false);
      setMessage("Profil yangilandi.");
    } else setError(result.message);
    setSavingProfile(false);
  }

  function startEditPrefs() {
    setPrefStyle((preferences?.style as "budget" | "mid" | "luxury") || "mid");
    setPrefInterests(preferences?.interests || []);
    setEditingPrefs(true);
  }

  function toggleInterest(value: string) {
    setPrefInterests((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function savePreferences() {
    if (!token) return;
    if (prefInterests.length === 0) {
      setError("Kamida 1 ta qiziqish tanlang.");
      return;
    }
    setSavingPrefs(true);
    setError("");
    const result = await api<{ preferences: TravelPreferences }>("/auth/preferences", {
      method: "PUT",
      body: JSON.stringify({ style: prefStyle, interests: prefInterests }),
    }, token);
    if (result.success) {
      setPreferences(result.data.preferences);
      setEditingPrefs(false);
      setMessage("Sayohat afzalliklari yangilandi.");
    } else setError(result.message);
    setSavingPrefs(false);
  }

  async function removeWishlist(id: string) {
    if (!token) return;
    const previous = wishlist;
    setWishlist((current) => current.filter((item) => item.id !== id));
    const result = await api(`/wishlist/${id}`, { method: "DELETE" }, token);
    if (!result.success) {
      setWishlist(previous);
      setError(result.message);
    }
  }

  function togglePlanInterest(value: string) {
    setPlanInterests((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function generatePlan(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (planInterests.length === 0) {
      setError("Kamida 1 ta qiziqish tanlang.");
      return;
    }
    setGenerating(true);
    setError("");
    setMessage("");
    setPlanResult(null);
    const result = await api<GeneratedPlan>("/planner/generate", {
      method: "POST",
      body: JSON.stringify({
        city: planCity.trim() || undefined,
        duration: Number(planDuration) || 3,
        travelers: Number(planTravelers) || 1,
        budget: Number(planBudget) || 3000000,
        style: planStyle,
        interests: planInterests,
        ...(planStartDate ? { startDate: planStartDate } : {}),
      }),
    }, token);
    if (result.success) {
      setPlanResult(result.data);
      setMessage("AI reja tayyor. Pastda ko‘rib, saqlashingiz mumkin.");
    } else setError(result.message);
    setGenerating(false);
  }

  async function savePlan() {
    if (!token || !planResult) return;
    setSavingPlan(true);
    setError("");
    const result = await api<{ trip: Trip }>("/trips", {
      method: "POST",
      body: JSON.stringify(planResult),
    }, token);
    if (result.success) {
      setPlanResult(null);
      setMessage("Reja “Mening safarlarim”ga saqlandi.");
      void loadDashboard(token);
    } else setError(result.message);
    setSavingPlan(false);
  }

  function logout() {
    void api("/auth/logout", { method: "POST" });
    setToken(null);
    setUser(null);
    setBookings([]);
    setTrips([]);
    setWishlist([]);
    setAchievements(null);
    setPreferences(null);
    setReviews({ items: [], total: 0, averageRating: 0 });
  }

  return (
    <main className={`account-page ${!token || !user ? "account-page--auth" : ""}`}>
      <header className="account-topbar">
        <Link href="/">TravelorAI</Link>
        {user ? <button type="button" onClick={logout}><LogOut size={16} /> Chiqish</button> : null}
      </header>
      <div className="account-wrap">
        {!token || !user ? (
          <form className="account-card account-auth" onSubmit={authenticate}>
            <span className="account-auth__icon"><UserRound size={30} /></span>
            <p>{mode === "register" ? "Yangi foydalanuvchi" : mode === "verify" ? "Gmail tasdiqlash" : "Foydalanuvchi hisobi"}</p>
            <h1>{mode === "register" ? "Ro‘yxatdan o‘tish" : mode === "verify" ? "Kodni kiriting" : "Kirish"}</h1>
            <small className="account-auth__note">Bitta Gmail bilan faqat bir marta ro‘yxatdan o‘tish mumkin.</small>
            {error ? <div className="account-alert account-alert--error">{error}</div> : null}
            {message ? <div className="account-alert">{message}</div> : null}
            {mode === "register" ? <label>Ism *<input required value={name} onChange={(event) => setName(event.target.value)} /></label> : null}
            <label>Email *<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {mode !== "verify" ? <label>Parol *<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label> : null}
            {mode === "verify" ? <label>Kod *<input required maxLength={6} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label> : null}
            <button disabled={loading} type="submit">{mode === "verify" ? "Tasdiqlash" : mode === "register" ? "Akkaunt yaratish" : "Kirish"}</button>
            {mode !== "verify" ? (
              <>
                <div className="account-divider"><span>yoki</span></div>
                <GoogleContinueButton
                  disabled={loading}
                  onCredential={handleGoogleCredential}
                  onError={handleGoogleError}
                />
              </>
            ) : null}
            {mode === "verify" ? <button disabled={loading} type="button" className="account-secondary" onClick={resendVerification}><Mail size={16} /> Kodni qayta yuborish</button> : null}
            <button type="button" className="account-secondary" onClick={() => {
              setError("");
              setMessage("");
              setMode(mode === "login" ? "register" : "login");
            }}>
              {mode === "login" ? "Ro‘yxatdan o‘tish" : "Kirish sahifasi"}
            </button>
          </form>
        ) : (
          <>
            <section className="account-hero">
              <div>
                <p>Yagona web va mobil akkaunt</p>
                <h1>{user.fullName || user.name}, barcha sayohatlaringiz</h1>
                <span>{user.email}</span>
              </div>
              <button disabled={dashboardLoading} type="button" onClick={() => loadDashboard(token)}>
                <RefreshCw className={dashboardLoading ? "is-spinning" : ""} size={17} />
                {dashboardLoading ? "Yuklanmoqda" : "Yangilash"}
              </button>
            </section>
            {error ? <div className="account-alert account-alert--error">{error}</div> : null}
            {message ? <div className="account-alert">{message}</div> : null}

            <section className="account-profile-grid" aria-label="Akkaunt ma’lumotlari">
              <article className="account-card account-profile">
                <div className="account-profile__avatar">
                  {user.avatarUrl ? (
                    <Image unoptimized width={96} height={96} src={publicImageSrc(user.avatarUrl)} alt={user.fullName || user.name} />
                  ) : (
                    <UserRound size={38} />
                  )}
                </div>
                <div>
                  <p className="account-eyebrow">Foydalanuvchi profili</p>
                  {editingProfile ? (
                    <div className="account-edit-form">
                      <label>Ism<input value={name} onChange={(event) => setName(event.target.value)} /></label>
                      <label>Familiya<input value={profileLastName} onChange={(event) => setProfileLastName(event.target.value)} /></label>
                      <label>Bio<textarea rows={2} value={profileBio} onChange={(event) => setProfileBio(event.target.value)} /></label>
                      <div className="account-edit-actions">
                        <button type="button" disabled={savingProfile} onClick={saveProfile}>{savingProfile ? "Saqlanmoqda..." : "Saqlash"}</button>
                        <button type="button" className="account-secondary" onClick={() => setEditingProfile(false)}>Bekor</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2>{user.fullName || user.name}</h2>
                      <span>{user.email}</span>
                      {user.bio ? <p className="account-profile__bio">{user.bio}</p> : null}
                      <div className="account-chip-list">
                        <b><ShieldCheck size={15} /> {user.emailVerified ? "Email tasdiqlangan" : "Email tasdiqlanmagan"}</b>
                        <b>{user.authProvider === "google" ? "Google akkaunt" : "Email akkaunt"}</b>
                      </div>
                      <button type="button" className="account-edit-trigger" onClick={startEditProfile}>Profilni tahrirlash</button>
                    </>
                  )}
                </div>
              </article>

              <article className="account-card account-preferences">
                <p className="account-eyebrow">Ilovadagi sayohat sozlamalari</p>
                {editingPrefs ? (
                  <div className="account-edit-form">
                    <label>Sayohat uslubi</label>
                    <div className="account-chip-toggle">
                      {STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={prefStyle === opt.value ? "is-active" : ""}
                          onClick={() => setPrefStyle(opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <label>Qiziqishlar</label>
                    <div className="account-chip-toggle">
                      {INTEREST_OPTIONS.map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          className={prefInterests.includes(interest) ? "is-active" : ""}
                          onClick={() => toggleInterest(interest)}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                    <div className="account-edit-actions">
                      <button type="button" disabled={savingPrefs} onClick={savePreferences}>{savingPrefs ? "Saqlanmoqda..." : "Saqlash"}</button>
                      <button type="button" className="account-secondary" onClick={() => setEditingPrefs(false)}>Bekor</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2>{preferences ? styleLabel(preferences.style) : "Hali tanlanmagan"}</h2>
                    <div className="account-chip-list">
                      {preferences?.interests.length
                        ? preferences.interests.map((interest) => <b key={interest}>{interest}</b>)
                        : <span>Qiziqishlar hali tanlanmagan.</span>}
                    </div>
                    <button type="button" className="account-edit-trigger" onClick={startEditPrefs}>Afzalliklarni tahrirlash</button>
                  </>
                )}
              </article>
            </section>

            <section className="account-kpi-grid" aria-label="Sayohat statistikasi">
              <article className="account-kpi"><Plane size={22} /><span>Safarlar</span><strong>{trips.length}</strong></article>
              <article className="account-kpi"><Heart size={22} /><span>Saqlangan joylar</span><strong>{wishlist.length}</strong></article>
              <article className="account-kpi"><CalendarDays size={22} /><span>Bookinglar</span><strong>{bookings.length}</strong></article>
              <article className="account-kpi"><Trophy size={22} /><span>Yutuqlar</span><strong>{achievements?.unlockedCount || 0}/{achievements?.totalCount || 0}</strong></article>
              <article className="account-kpi"><MapPin size={22} /><span>Shaharlar</span><strong>{achievements?.stats.uniqueCities || 0}</strong></article>
              <article className="account-kpi"><WalletCards size={22} /><span>Jami xarajat</span><strong>{formatMoney(achievements?.stats.totalSpent)}</strong></article>
            </section>

            <section className="account-security-grid" aria-label="Akkaunt xavfsizligi">
              <article className="account-card account-security-card">
                <p className="account-eyebrow">Akkaunt xavfsizligi</p>
                <h2>Emailni almashtirish</h2>
                <small>Tasdiqlash kodi eski emailingizga yuboriladi: {user.email}</small>
                <label>
                  Yangi email *
                  <input type="email" value={newEmail} disabled={emailChangeStage === "verify"} onChange={(event) => setNewEmail(event.target.value)} />
                </label>
                {emailChangeStage === "request" && user.authProvider === "local" ? (
                  <label>Joriy parol *<input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} /></label>
                ) : null}
                {emailChangeStage === "verify" ? (
                  <label>
                    Eski emailga kelgan kod *
                    <input inputMode="numeric" maxLength={6} value={emailChangeCode} onChange={(event) => setEmailChangeCode(event.target.value.replace(/\D/g, ""))} />
                  </label>
                ) : null}
                <button disabled={loading} type="button" onClick={emailChangeStage === "request" ? requestEmailChange : verifyEmailChange}>
                  {emailChangeStage === "request" ? "Kodni yuborish" : "Emailni tasdiqlash"}
                </button>
                {emailChangeStage === "verify" ? (
                  <button disabled={loading || emailChangeRemaining <= 0} className="account-secondary" type="button" onClick={requestEmailChange}>
                    Kodni qayta yuborish ({emailChangeRemaining})
                  </button>
                ) : null}
              </article>

              <article className="account-card account-security-card account-security-card--danger">
                <p className="account-eyebrow">Muhim amal</p>
                <h2>Akkauntni o‘chirish</h2>
                <small>Barcha safarlar, wishlist, sharhlar va booking bog‘lanishlari o‘chiriladi.</small>
                {deleteStage === "request" && user.authProvider === "local" ? (
                  <label>Joriy parol *<input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} /></label>
                ) : null}
                {deleteStage === "verify" ? (
                  <label>
                    {user.email} manziliga kelgan kod *
                    <input inputMode="numeric" maxLength={6} value={deleteCode} onChange={(event) => setDeleteCode(event.target.value.replace(/\D/g, ""))} />
                  </label>
                ) : null}
                <button disabled={loading} className="account-danger-button" type="button" onClick={deleteStage === "request" ? requestDeleteCode : deleteAccount}>
                  {deleteStage === "request" ? "O‘chirish kodini yuborish" : "Akkauntni butunlay o‘chirish"}
                </button>
                {deleteStage === "verify" ? (
                  <button disabled={loading || deleteRemaining <= 0} className="account-secondary" type="button" onClick={requestDeleteCode}>
                    Kodni qayta yuborish ({deleteRemaining})
                  </button>
                ) : null}
              </article>
            </section>

            {selectedTour ? (
              <form className="account-card account-booking-form" onSubmit={createBooking}>
                <div className="account-selected-tour">
                  {selectedTour.imageUrl ? <Image unoptimized width={300} height={210} src={publicImageSrc(selectedTour.imageUrl)} alt={selectedTour.title} /> : null}
                  <div>
                    <p>{selectedTour.agency?.name || "TravelorAI partner"}</p>
                    <h2>{selectedTour.title}</h2>
                    <span>{selectedTour.city} · {selectedTour.duration} · {selectedTour.responseTimeMinutes || 45} daqiqada javob</span>
                  </div>
                </div>
                <div className="account-form-grid">
                  <label>Telefon<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                  <label>Sayohatchilar soni *<input required min={1} max={50} type="number" value={travelers} onChange={(event) => setTravelers(event.target.value)} /></label>
                  <label>Sayohat sanasi<input type="date" value={travelDate} onChange={(event) => setTravelDate(event.target.value)} /></label>
                  <label className="account-wide">Qo‘shimcha izoh<textarea value={bookingMessage} onChange={(event) => setBookingMessage(event.target.value)} /></label>
                </div>
                <button disabled={loading} type="submit"><Send size={17} /> Booking so‘rovini yuborish</button>
              </form>
            ) : null}

            <section className="account-data-section">
              <div className="account-section-title">
                <div><p>Mobil ilova bilan bir xil AI</p><h2>Yangi AI sayohat rejasi</h2></div>
              </div>
              <article className="account-card">
                <form className="account-planner-form" onSubmit={generatePlan}>
                  <label>Yo‘nalish (shahar/davlat)
                    <input value={planCity} onChange={(event) => setPlanCity(event.target.value)} placeholder="masalan: Dubay" />
                  </label>
                  <label>Kunlar
                    <input type="number" min={1} max={14} value={planDuration} onChange={(event) => setPlanDuration(event.target.value)} />
                  </label>
                  <label>Sayohatchilar
                    <input type="number" min={1} max={8} value={planTravelers} onChange={(event) => setPlanTravelers(event.target.value)} />
                  </label>
                  <label>Byudjet (so‘m)
                    <input type="number" min={200000} step={100000} value={planBudget} onChange={(event) => setPlanBudget(event.target.value)} />
                  </label>
                  <label>Uslub
                    <select value={planStyle} onChange={(event) => setPlanStyle(event.target.value as "budget" | "mid" | "luxury")}>
                      {STYLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </label>
                  <label>Boshlanish sanasi
                    <input type="date" value={planStartDate} onChange={(event) => setPlanStartDate(event.target.value)} />
                  </label>
                  <div className="account-planner-form__full">
                    <label>Qiziqishlar</label>
                    <div className="account-chip-toggle">
                      {INTEREST_OPTIONS.map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          className={planInterests.includes(interest) ? "is-active" : ""}
                          onClick={() => togglePlanInterest(interest)}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="account-planner-form__full">
                    <button className="account-planner-generate" type="submit" disabled={generating}>
                      {generating ? "AI reja tuzmoqda..." : "AI reja yaratish"}
                    </button>
                  </div>
                </form>

                {planResult ? (
                  <div className="account-planner-result">
                    <h3>{planResult.title || "Sayohat rejasi"}</h3>
                    {(planResult.days || []).map((day, idx) => (
                      <div className="account-planner-day" key={idx}>
                        <h4>Kun {day.day || day.dayNumber || idx + 1}{day.destination ? ` · ${day.destination}` : ""}</h4>
                        <ul>
                          {(day.activities || []).map((act, i) => (
                            <li key={i}>{act.time ? `${act.time} — ` : ""}{act.name || "Faoliyat"}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="account-edit-actions">
                      <button type="button" disabled={savingPlan} onClick={savePlan}>
                        {savingPlan ? "Saqlanmoqda..." : "Rejani saqlash"}
                      </button>
                      <button type="button" className="account-secondary" onClick={() => setPlanResult(null)}>Bekor</button>
                    </div>
                  </div>
                ) : null}
              </article>
            </section>

            <section className="account-data-section">
              <div className="account-section-title">
                <div><p>Mobil ilova bilan sinxron</p><h2>Mening safarlarim</h2></div>
                <b>{trips.length} ta</b>
              </div>
              {trips.length === 0 ? (
                <div className="account-card account-empty">
                  <Plane size={30} />
                  <p>Hali saqlangan safar yo‘q. Mobil ilovada reja yaratsangiz, shu yerda ham ko‘rinadi.</p>
                </div>
              ) : (
                <div className="account-trip-grid">
                  {trips.map((trip) => {
                    const destinations = Array.isArray(trip.planData?.destinations) ? trip.planData.destinations : [];
                    const visited = trip.planData?.progress?.visitedStopIds?.length || 0;
                    const totalStops = Array.isArray(trip.planData?.days) ? trip.planData.days.length : 0;
                    return (
                      <article className="account-card account-trip-card" key={trip.id}>
                        {trip.planData?.coverImage ? (
                          <Image unoptimized width={520} height={300} src={publicImageSrc(trip.planData.coverImage)} alt={trip.title} />
                        ) : (
                          <div className="account-trip-card__placeholder"><Plane size={30} /></div>
                        )}
                        <div className="account-trip-card__body">
                          <div className="account-card-heading">
                            <span className="account-status">{trip.planData?.status || "final"}</span>
                            <small>{formatDate(trip.updatedAt)}</small>
                          </div>
                          <h3>{trip.title}</h3>
                          <p><MapPin size={15} /> {destinations.length ? destinations.join(", ") : "Yo‘nalish ko‘rsatilmagan"}</p>
                          <div className="account-trip-meta">
                            <span><Clock3 size={15} /> {trip.duration} kun</span>
                            <span><Users size={15} /> {trip.travelers} kishi</span>
                            <span><WalletCards size={15} /> {formatMoney(trip.totalCost)}</span>
                          </div>
                          <small>{formatDate(trip.planData?.startDate)} – {formatDate(trip.planData?.endDate)}</small>
                          {totalStops || visited ? <b className="account-sync-note"><CheckCircle2 size={15} /> Bajarilgan: {visited}{totalStops ? ` / ${totalStops}` : ""}</b> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="account-data-section">
              <div className="account-section-title">
                <div><p>Ilovada saqlangan</p><h2>Wishlist</h2></div>
                <b>{wishlist.length} ta</b>
              </div>
              {wishlist.length === 0 ? (
                <div className="account-card account-empty"><Heart size={30} /><p>Hali saqlangan joy yo‘q.</p></div>
              ) : (
                <div className="account-wishlist-grid">
                  {wishlist.map((item) => (
                    <article className="account-card account-wishlist-card" key={item.id}>
                      <span className="account-wishlist-card__icon">{item.icon || "•"}</span>
                      <div><h3>{item.name}</h3><p><MapPin size={14} /> {item.city}</p><small>{item.type} · {formatDate(item.savedAt)}</small></div>
                      <button type="button" className="account-wishlist-card__remove" aria-label="Wishlistdan o‘chirish" onClick={() => removeWishlist(item.id)}>
                        <Trash2 size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="account-data-section">
              <div className="account-section-title">
                <div><p>Ilovadagi progress</p><h2>Yutuqlar</h2></div>
                <b>{achievements?.completionRate || 0}%</b>
              </div>
              <div className="account-achievement-grid">
                {achievements?.items.map((item) => (
                  <article className={`account-card account-achievement ${item.unlocked ? "is-unlocked" : ""}`} key={item.id}>
                    <span className="account-achievement__icon">{item.icon}</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.unlocked ? item.description : item.hint}</p>
                      <div className="account-progress"><i style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} /></div>
                      <small>{item.progressText}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="account-data-section">
              <div className="account-section-title">
                <div><p>Safarlarga berilgan baholar</p><h2>Mening sharhlarim</h2></div>
                <b><Star size={15} /> {reviews.averageRating || 0}</b>
              </div>
              {reviews.items.length === 0 ? (
                <div className="account-card account-empty"><Star size={30} /><p>Hali safarga sharh qoldirilmagan.</p></div>
              ) : (
                <div className="account-review-list">
                  {reviews.items.map((review) => (
                    <article className="account-card account-review" key={review.id}>
                      <div><h3>{review.trip?.title || "Sayohat"}</h3><span>{Array.from({ length: 5 }, (_, index) => index < review.rating ? "★" : "☆").join("")}</span></div>
                      <p>{review.comment}</p>
                      <small>{formatDate(review.createdAt)}</small>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="account-bookings">
              <div className="account-section-title"><div><p>100% backenddan kelgan ma’lumot</p><h2>Mening bookinglarim</h2></div><b>{bookings.length} ta</b></div>
              {bookings.length === 0 ? <div className="account-card account-empty"><CalendarDays size={30} /><p>Hali booking yo‘q. Bosh sahifadagi tourlardan birini tanlang.</p><Link href="/#tours">Tourlarni ko‘rish</Link></div> : null}
              {bookings.map((booking) => (
                <article className="account-card account-booking" key={booking.id}>
                  {booking.tour?.imageUrl ? <Image unoptimized width={460} height={360} src={publicImageSrc(booking.tour.imageUrl)} alt={booking.tour.title} /> : null}
                  <div className="account-booking__body">
                    <span className={`account-status account-status--${booking.status}`}>{booking.status}</span>
                    <h3>{booking.tour?.title || "Tour"}</h3>
                    <p>{booking.tour?.city} · {booking.tour?.duration} · {booking.travelers} kishi</p>
                    <small>Agentlik: {booking.agency?.name || "Belgilanmagan"} · {booking.agency?.phone || "Telefon yo‘q"}</small>
                    <small>Email: {booking.customerEmail}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}</small>
                    <small>Sana: {booking.travelDate ? new Date(booking.travelDate).toLocaleDateString("uz-UZ") : "Kelishiladi"}</small>
                    {booking.message ? <small>Izoh: {booking.message}</small> : null}
                    <strong>{booking.totalEstimate ? `${booking.totalEstimate} ${booking.currency}` : "Narx agentlik bilan kelishiladi"}</strong>
                    {booking.status === "pending" ? <b className="account-countdown"><Clock3 size={16} /> {countdown(booking.responseDeadlineAt)}</b> : null}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
