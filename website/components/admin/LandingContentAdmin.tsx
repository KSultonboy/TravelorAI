"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  ImagePlus,
  Landmark,
  Loader2,
  LogOut,
  MessageSquareQuote,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";

type SectionKey = "applications" | "tourReviews" | "bookings" | "hero" | "places" | "agencies" | "stories";

type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  actionUrl: string | null;
  placeSlug: string | null;
  sortOrder: number;
  active: boolean;
  confidenceScore: number;
};

type PlaceItem = {
  id: string;
  name: string;
  city: string;
  type: string;
  subtype?: string | null;
  lat: number;
  lng: number;
  info?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  featured?: boolean;
  manualBoost?: number;
  qualityScore?: number;
  landingSortOrder?: number;
  landingActive?: boolean;
};

type AgencyItem = {
  id: string;
  name: string;
  city: string;
  specialty: string;
  description?: string | null;
  rating: number;
  reviews: number;
  toursCount: number;
  phone?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  active: boolean;
  featured?: boolean;
  manualBoost?: number;
  qualityScore?: number;
  landingSortOrder?: number;
};

type StoryItem = {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  avatar?: string | null;
  avatarColor?: string | null;
  rating: number;
  sortOrder: number;
  active: boolean;
  featured?: boolean;
  manualBoost?: number;
  qualityScore?: number;
};

type AgencyApplicationItem = {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  website?: string | null;
  serviceTypes: string[];
  description: string;
  status: string;
  adminNote?: string | null;
  submittedAt?: string | null;
  account?: {
    email: string;
    status: string;
    emailVerified: boolean;
  } | null;
};

type TourReviewItem = {
  id: string;
  title: string;
  city: string;
  subtitle: string;
  duration: string;
  price?: string | null;
  imageUrl?: string | null;
  approvalStatus: string;
  submittedAt?: string | null;
  adminNote?: string | null;
  agency?: {
    name: string;
    city: string;
  } | null;
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
  createdAt?: string | null;
  tour?: {
    title: string;
    city: string;
    duration?: string | null;
    price?: string | null;
  } | null;
  agency?: {
    name: string;
    city?: string | null;
  } | null;
};

type FormValue = string | boolean;

type HeroForm = Record<
  "title" | "subtitle" | "imageUrl" | "actionUrl" | "placeSlug" | "sortOrder" | "confidenceScore",
  string
> & { active: boolean };

type PlaceForm = Record<
  | "name"
  | "city"
  | "type"
  | "subtype"
  | "lat"
  | "lng"
  | "info"
  | "description"
  | "imageUrl"
  | "rating"
  | "ratingCount"
  | "manualBoost"
  | "qualityScore"
  | "landingSortOrder",
  string
> & { featured: boolean; landingActive: boolean };

type AgencyForm = Record<
  | "name"
  | "city"
  | "specialty"
  | "description"
  | "rating"
  | "reviews"
  | "toursCount"
  | "phone"
  | "website"
  | "imageUrl"
  | "manualBoost"
  | "qualityScore"
  | "landingSortOrder",
  string
> & { featured: boolean; active: boolean };

type StoryForm = Record<
  "quote" | "authorName" | "authorRole" | "avatar" | "avatarColor" | "rating" | "sortOrder" | "manualBoost" | "qualityScore",
  string
> & { featured: boolean; active: boolean };

const sectionMeta = {
  applications: { title: "Agency applications", subtitle: "Yangi agency arizalarini approve yoki reject qilish", icon: ClipboardCheck },
  tourReviews: { title: "Tour reviews", subtitle: "Agency yuborgan tourlarni publicga chiqarishdan oldin tekshirish", icon: CheckCircle2 },
  bookings: { title: "Booking requests", subtitle: "Foydalanuvchi yuborgan tour booking so'rovlarini boshqarish", icon: CalendarDays },
  hero: { title: "Hero slaydlar", subtitle: "Website va mobile app hero background rasmlari", icon: ImagePlus },
  places: { title: "Trending joylar", subtitle: "Landingdagi mashhur destination kartalari", icon: Landmark },
  agencies: { title: "Top agencies", subtitle: "Agency reyting va landing tartibi", icon: Building2 },
  stories: { title: "Traveler stories", subtitle: "Foydalanuvchi fikrlari va social proof", icon: MessageSquareQuote },
};

const emptyHeroForm: HeroForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  actionUrl: "",
  placeSlug: "",
  sortOrder: "0",
  active: true,
  confidenceScore: "0.9",
};

const emptyPlaceForm: PlaceForm = {
  name: "",
  city: "",
  type: "landmark",
  subtype: "",
  lat: "",
  lng: "",
  info: "",
  description: "",
  imageUrl: "",
  rating: "4.8",
  ratingCount: "0",
  featured: true,
  manualBoost: "3",
  qualityScore: "0.85",
  landingSortOrder: "0",
  landingActive: true,
};

const emptyAgencyForm: AgencyForm = {
  name: "",
  city: "",
  specialty: "",
  description: "",
  rating: "4.8",
  reviews: "0",
  toursCount: "0",
  phone: "",
  website: "",
  imageUrl: "",
  featured: true,
  manualBoost: "2",
  qualityScore: "0.8",
  landingSortOrder: "0",
  active: true,
};

const emptyStoryForm: StoryForm = {
  quote: "",
  authorName: "",
  authorRole: "",
  avatar: "",
  avatarColor: "#0c8b63",
  rating: "5",
  sortOrder: "0",
  featured: true,
  manualBoost: "2",
  qualityScore: "0.82",
  active: true,
};

function heroToForm(item: HeroSlide): HeroForm {
  return {
    title: item.title,
    subtitle: item.subtitle || "",
    imageUrl: item.imageUrl,
    actionUrl: item.actionUrl || "",
    placeSlug: item.placeSlug || "",
    sortOrder: String(item.sortOrder ?? 0),
    active: item.active,
    confidenceScore: String(item.confidenceScore ?? 0.9),
  };
}

function placeToForm(item: PlaceItem): PlaceForm {
  return {
    name: item.name,
    city: item.city,
    type: item.type || "landmark",
    subtype: item.subtype || "",
    lat: String(item.lat ?? ""),
    lng: String(item.lng ?? ""),
    info: item.info || "",
    description: item.description || "",
    imageUrl: item.imageUrl || "",
    rating: String(item.rating ?? ""),
    ratingCount: String(item.ratingCount ?? ""),
    featured: Boolean(item.featured),
    manualBoost: String(item.manualBoost ?? 0),
    qualityScore: String(item.qualityScore ?? 0.7),
    landingSortOrder: String(item.landingSortOrder ?? 0),
    landingActive: item.landingActive !== false,
  };
}

function agencyToForm(item: AgencyItem): AgencyForm {
  return {
    name: item.name,
    city: item.city,
    specialty: item.specialty || "",
    description: item.description || "",
    rating: String(item.rating ?? 0),
    reviews: String(item.reviews ?? 0),
    toursCount: String(item.toursCount ?? 0),
    phone: item.phone || "",
    website: item.website || "",
    imageUrl: item.imageUrl || "",
    featured: Boolean(item.featured),
    manualBoost: String(item.manualBoost ?? 0),
    qualityScore: String(item.qualityScore ?? 0.7),
    landingSortOrder: String(item.landingSortOrder ?? 0),
    active: item.active !== false,
  };
}

function storyToForm(item: StoryItem): StoryForm {
  return {
    quote: item.quote,
    authorName: item.authorName,
    authorRole: item.authorRole,
    avatar: item.avatar || "",
    avatarColor: item.avatarColor || "#0c8b63",
    rating: String(item.rating ?? 5),
    sortOrder: String(item.sortOrder ?? 0),
    featured: Boolean(item.featured),
    manualBoost: String(item.manualBoost ?? 0),
    qualityScore: String(item.qualityScore ?? 0.8),
    active: item.active !== false,
  };
}

function scoreLabel(value?: number) {
  return Number(value ?? 0).toFixed(2);
}

function formatMoney(value?: number | null, currency = "USD") {
  const amount = Number(value || 0);
  const prefix = currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${new Intl.NumberFormat("en-US").format(Math.round(amount))}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sana yo'q";
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function bookingStatusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: "Kutilmoqda",
    confirmed: "Tasdiqlangan",
    rejected: "Rad etilgan",
    cancelled: "Bekor qilingan",
    completed: "Yakunlangan",
  };
  return map[status || ""] || status || "Noma'lum";
}

function FormInput<T extends Record<string, FormValue>>({
  form,
  name,
  label,
  type = "text",
  required,
  onChange,
}: {
  form: T;
  name: keyof T;
  label: string;
  type?: string;
  required?: boolean;
  onChange: (name: keyof T, value: FormValue) => void;
}) {
  return (
    <label>
      {label}
      <input
        required={required}
        type={type}
        checked={type === "checkbox" ? Boolean(form[name]) : undefined}
        value={type === "checkbox" ? undefined : String(form[name] ?? "")}
        onChange={(event) => onChange(name, type === "checkbox" ? event.target.checked : event.target.value)}
      />
    </label>
  );
}

function FormTextarea<T extends Record<string, FormValue>>({
  form,
  name,
  label,
  required,
  onChange,
}: {
  form: T;
  name: keyof T;
  label: string;
  required?: boolean;
  onChange: (name: keyof T, value: FormValue) => void;
}) {
  return (
    <label>
      {label}
      <textarea
        rows={3}
        required={required}
        value={String(form[name] ?? "")}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

function Accordion({
  section,
  open,
  count,
  onToggle,
  children,
}: {
  section: SectionKey;
  open: boolean;
  count: number;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = sectionMeta[section].icon;
  return (
    <section className={`admin-accordion ${open ? "is-open" : ""}`} id={`admin-section-${section}`}>
      <button className="admin-accordion__trigger" onClick={onToggle} type="button">
        <span className="admin-accordion__icon">
          <Icon size={20} />
        </span>
        <span>
          <strong>{sectionMeta[section].title}</strong>
          <small>{sectionMeta[section].subtitle}</small>
        </span>
        <em>{count} ta</em>
        <ChevronDown size={20} />
      </button>
      {open ? <div className="admin-accordion__body">{children}</div> : null}
    </section>
  );
}

export default function LandingContentAdmin({ username }: { username: string }) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    applications: true,
    tourReviews: false,
    bookings: false,
    hero: true,
    places: false,
    agencies: false,
    stories: false,
  });
  const [openNavGroups, setOpenNavGroups] = useState({
    dashboard: true,
    review: true,
    landing: true,
    system: false,
  });
  const [heroItems, setHeroItems] = useState<HeroSlide[]>([]);
  const [placeItems, setPlaceItems] = useState<PlaceItem[]>([]);
  const [agencyItems, setAgencyItems] = useState<AgencyItem[]>([]);
  const [storyItems, setStoryItems] = useState<StoryItem[]>([]);
  const [applicationItems, setApplicationItems] = useState<AgencyApplicationItem[]>([]);
  const [tourReviewItems, setTourReviewItems] = useState<TourReviewItem[]>([]);
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [heroForm, setHeroForm] = useState<HeroForm>(emptyHeroForm);
  const [placeForm, setPlaceForm] = useState<PlaceForm>(emptyPlaceForm);
  const [agencyForm, setAgencyForm] = useState<AgencyForm>(emptyAgencyForm);
  const [storyForm, setStoryForm] = useState<StoryForm>(emptyStoryForm);
  const [selectedHero, setSelectedHero] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggle(section: SectionKey) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function toggleNavGroup(group: keyof typeof openNavGroups) {
    setOpenNavGroups((current) => ({ ...current, [group]: !current[group] }));
  }

  function focusSection(section: SectionKey) {
    setOpenSections((current) => ({ ...current, [section]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(`admin-section-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [applications, tourReviews, bookings, hero, places, agencies, stories] = await Promise.all([
        fetch("/api/admin-proxy/admin/agency-applications?status=pending", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin-proxy/admin/tours?status=pending_review", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin-proxy/admin/bookings?status=pending", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin-proxy/admin/hero-slides", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin-proxy/admin/places?limit=300", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin-proxy/admin/agencies", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin-proxy/admin/stories", { cache: "no-store" }).then((res) => res.json()),
      ]);

      if (!applications.success) throw new Error(applications.message || "Agency arizalar yuklanmadi");
      if (!tourReviews.success) throw new Error(tourReviews.message || "Tour reviewlar yuklanmadi");
      if (!bookings.success) throw new Error(bookings.message || "Bookinglar yuklanmadi");
      if (!hero.success) throw new Error(hero.message || "Hero slaydlar yuklanmadi");
      if (!places.success) throw new Error(places.message || "Joylar yuklanmadi");
      if (!agencies.success) throw new Error(agencies.message || "Agencylar yuklanmadi");
      if (!stories.success) throw new Error(stories.message || "Stories yuklanmadi");

      setApplicationItems(applications.data.items || []);
      setTourReviewItems(tourReviews.data.items || []);
      setBookingItems(bookings.data.items || []);
      setHeroItems(hero.data.items || []);
      setPlaceItems(places.data.items || []);
      setAgencyItems(agencies.data.items || []);
      setStoryItems(stories.data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumot yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function request(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.message || "So'rov bajarilmadi");
    return payload.data;
  }

  function updateHero<K extends keyof HeroForm>(name: K, value: FormValue) {
    setHeroForm((current) => ({ ...current, [name]: value }));
  }

  function updatePlace<K extends keyof PlaceForm>(name: K, value: FormValue) {
    setPlaceForm((current) => ({ ...current, [name]: value }));
  }

  function updateAgency<K extends keyof AgencyForm>(name: K, value: FormValue) {
    setAgencyForm((current) => ({ ...current, [name]: value }));
  }

  function updateStory<K extends keyof StoryForm>(name: K, value: FormValue) {
    setStoryForm((current) => ({ ...current, [name]: value }));
  }

  function reset(section: SectionKey) {
    if (section === "hero") {
      setSelectedHero(null);
      setHeroForm(emptyHeroForm);
    }
    if (section === "places") {
      setSelectedPlace(null);
      setPlaceForm(emptyPlaceForm);
    }
    if (section === "agencies") {
      setSelectedAgency(null);
      setAgencyForm(emptyAgencyForm);
    }
    if (section === "stories") {
      setSelectedStory(null);
      setStoryForm(emptyStoryForm);
    }
  }

  async function saveHero(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("hero");
    setMessage("");
    setError("");
    try {
      const data = await request(
        selectedHero
          ? `/api/admin-proxy/admin/hero-slides/${encodeURIComponent(selectedHero)}`
          : "/api/admin-proxy/admin/hero-slides",
        selectedHero ? "PUT" : "POST",
        {
          ...heroForm,
          sortOrder: Number(heroForm.sortOrder) || 0,
          confidenceScore: Number(heroForm.confidenceScore) || 0.8,
        }
      );
      setSelectedHero(data.id);
      setHeroForm(heroToForm(data));
      setMessage("Hero slayd saqlandi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hero saqlanmadi");
    } finally {
      setSaving(null);
    }
  }

  async function savePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("places");
    setMessage("");
    setError("");
    try {
      const data = await request(
        selectedPlace ? `/api/admin-proxy/admin/places/${encodeURIComponent(selectedPlace)}` : "/api/admin-proxy/admin/places",
        selectedPlace ? "PUT" : "POST",
        {
          ...placeForm,
          lat: Number(placeForm.lat),
          lng: Number(placeForm.lng),
          rating: placeForm.rating ? Number(placeForm.rating) : null,
          ratingCount: placeForm.ratingCount ? Number(placeForm.ratingCount) : null,
          manualBoost: Number(placeForm.manualBoost) || 0,
          qualityScore: Number(placeForm.qualityScore) || 0,
          landingSortOrder: Number(placeForm.landingSortOrder) || 0,
        }
      );
      setSelectedPlace(data.id);
      setPlaceForm(placeToForm(data));
      setPlaceItems((current) => {
        const withoutCurrent = current.filter((item) => item.id !== data.id);
        return [data, ...withoutCurrent];
      });
      setMessage("Joy saqlandi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Joy saqlanmadi");
    } finally {
      setSaving(null);
    }
  }

  async function saveAgency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("agencies");
    setMessage("");
    setError("");
    try {
      const data = await request(
        selectedAgency
          ? `/api/admin-proxy/admin/agencies/${encodeURIComponent(selectedAgency)}`
          : "/api/admin-proxy/admin/agencies",
        selectedAgency ? "PUT" : "POST",
        {
          ...agencyForm,
          rating: Number(agencyForm.rating) || 0,
          reviews: Number(agencyForm.reviews) || 0,
          toursCount: Number(agencyForm.toursCount) || 0,
          manualBoost: Number(agencyForm.manualBoost) || 0,
          qualityScore: Number(agencyForm.qualityScore) || 0,
          landingSortOrder: Number(agencyForm.landingSortOrder) || 0,
        }
      );
      setSelectedAgency(data.id);
      setAgencyForm(agencyToForm(data));
      setMessage("Agency saqlandi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agency saqlanmadi");
    } finally {
      setSaving(null);
    }
  }

  async function saveStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("stories");
    setMessage("");
    setError("");
    try {
      const data = await request(
        selectedStory ? `/api/admin-proxy/admin/stories/${encodeURIComponent(selectedStory)}` : "/api/admin-proxy/admin/stories",
        selectedStory ? "PUT" : "POST",
        {
          ...storyForm,
          rating: Number(storyForm.rating) || 5,
          sortOrder: Number(storyForm.sortOrder) || 0,
          manualBoost: Number(storyForm.manualBoost) || 0,
          qualityScore: Number(storyForm.qualityScore) || 0,
        }
      );
      setSelectedStory(data.id);
      setStoryForm(storyToForm(data));
      setMessage("Story saqlandi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Story saqlanmadi");
    } finally {
      setSaving(null);
    }
  }

  async function remove(section: SectionKey, id: string) {
    if (!window.confirm("O'chirishni tasdiqlaysizmi?")) return;
    setMessage("");
    setError("");
    try {
      const endpoint =
        section === "hero"
          ? "hero-slides"
          : section === "places"
            ? "places"
            : section === "agencies"
              ? "agencies"
              : "stories";
      await request(`/api/admin-proxy/admin/${endpoint}/${encodeURIComponent(id)}`, "DELETE");
      reset(section);
      setMessage("O'chirildi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirilmadi");
    }
  }

  async function reviewApplication(id: string, action: "approve" | "reject") {
    setSaving("applications");
    setMessage("");
    setError("");
    try {
      await request(`/api/admin-proxy/admin/agency-applications/${encodeURIComponent(id)}/${action}`, "PATCH", {
        adminNote: reviewNote,
      });
      setReviewNote("");
      setMessage(action === "approve" ? "Agency ariza tasdiqlandi" : "Agency ariza rad etildi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ariza review bajarilmadi");
    } finally {
      setSaving(null);
    }
  }

  async function reviewTour(id: string, action: "approve" | "reject") {
    setSaving("tourReviews");
    setMessage("");
    setError("");
    try {
      await request(`/api/admin-proxy/admin/tours/${encodeURIComponent(id)}/${action}`, "PATCH", {
        adminNote: reviewNote,
      });
      setReviewNote("");
      setMessage(action === "approve" ? "Tour publicga chiqarildi" : "Tour rad etildi");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tour review bajarilmadi");
    } finally {
      setSaving(null);
    }
  }

  async function reviewBooking(id: string, status: "confirmed" | "rejected" | "cancelled" | "completed") {
    setSaving("bookings");
    setMessage("");
    setError("");
    try {
      await request(`/api/admin-proxy/admin/bookings/${encodeURIComponent(id)}/status`, "PATCH", {
        status,
        adminNote: reviewNote,
      });
      setMessage("Booking statusi yangilandi");
      setReviewNote("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking statusi yangilanmadi");
    } finally {
      setSaving(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const sectionCounts: Record<SectionKey, number> = {
    applications: applicationItems.length,
    tourReviews: tourReviewItems.length,
    bookings: bookingItems.length,
    hero: heroItems.length,
    places: placeItems.length,
    agencies: agencyItems.length,
    stories: storyItems.length,
  };

  return (
    <div className="admin-shell">
      <aside className="admin-aside">
        <div>
          <div className="admin-brand">
            <span className="admin-brand__mark">
              <Sparkles size={18} />
            </span>
            <span>TravelorAI</span>
            <small>Admin</small>
          </div>
          <nav className="admin-sidebar-nav">
            <div className="admin-sidebar-group is-open">
              <button className="admin-sidebar-group__head" type="button" onClick={() => toggleNavGroup("dashboard")}>
                <span><Sparkles size={17} /> Dashboard</span>
                <ChevronDown size={16} />
              </button>
              {openNavGroups.dashboard ? (
                <div className="admin-sidebar-group__items">
                  <button className="active" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    Platform overview
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`admin-sidebar-group ${openNavGroups.review ? "is-open" : ""}`}>
              <button className="admin-sidebar-group__head" type="button" onClick={() => toggleNavGroup("review")}>
                <span><ClipboardCheck size={17} /> Review markazi</span>
                <ChevronDown size={16} />
              </button>
              {openNavGroups.review ? (
                <div className="admin-sidebar-group__items">
                  {(["applications", "tourReviews", "bookings"] as SectionKey[]).map((section) => (
                    <button key={section} type="button" onClick={() => focusSection(section)}>
                      {sectionMeta[section].title}
                      <em>{sectionCounts[section]}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={`admin-sidebar-group ${openNavGroups.landing ? "is-open" : ""}`}>
              <button className="admin-sidebar-group__head" type="button" onClick={() => toggleNavGroup("landing")}>
                <span><ImagePlus size={17} /> Landing content</span>
                <ChevronDown size={16} />
              </button>
              {openNavGroups.landing ? (
                <div className="admin-sidebar-group__items">
                  {(["hero", "places", "agencies", "stories"] as SectionKey[]).map((section) => (
                    <button key={section} type="button" onClick={() => focusSection(section)}>
                      {sectionMeta[section].title}
                      <em>{sectionCounts[section]}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={`admin-sidebar-group ${openNavGroups.system ? "is-open" : ""}`}>
              <button className="admin-sidebar-group__head" type="button" onClick={() => toggleNavGroup("system")}>
                <span><RefreshCw size={17} /> Tizim</span>
                <ChevronDown size={16} />
              </button>
              {openNavGroups.system ? (
                <div className="admin-sidebar-group__items">
                  <button type="button" onClick={loadAll}>Ma&apos;lumotlarni yangilash</button>
                  <button className="danger" type="button" onClick={handleLogout}>Chiqish</button>
                </div>
              ) : null}
            </div>
          </nav>
        </div>
        <button className="admin-logout" onClick={handleLogout} type="button">
          <LogOut size={17} />
          Chiqish
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Kirish: {username}</p>
            <h1>Platform boshqaruvi</h1>
            <p>Agency onboarding, tour review va landing content bitta accordion dashboardda boshqariladi.</p>
          </div>
          <button className="admin-secondary" onClick={loadAll} type="button">
            <RefreshCw size={17} />
            Yangilash
          </button>
        </header>

        {(message || error) && (
          <div className={error ? "admin-alert admin-alert--error" : "admin-alert admin-alert--success"}>
            {error || message}
          </div>
        )}

        {loading ? (
          <div className="admin-loading admin-loading--page">
            <Loader2 className="admin-spin" size={22} />
            Admin content yuklanmoqda...
          </div>
        ) : (
          <div className="admin-accordion-stack">
            <Accordion section="applications" open={openSections.applications} count={applicationItems.length} onToggle={() => toggle("applications")}>
              <div className="admin-panel">
                <div className="admin-panel__head">
                  <div>
                    <p className="admin-eyebrow">Agency onboarding</p>
                    <h2>Review kutilayotgan arizalar</h2>
                  </div>
                </div>
                <label className="admin-review-note">
                  Admin note
                  <textarea
                    rows={2}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Approve/reject sababini shu yerga yozing..."
                  />
                </label>
                <div className="admin-review-list">
                  {applicationItems.length === 0 ? <div className="admin-empty">Review kutilayotgan agency ariza yo&apos;q.</div> : null}
                  {applicationItems.map((item) => (
                    <article className="admin-review-card" key={item.id}>
                      <div>
                        <span className="admin-status-pill">{item.status}</span>
                        <h3>{item.companyName}</h3>
                        <p>{item.description}</p>
                        <small>
                          {item.city}, {item.country} | {item.contactPerson} | {item.phone} | {item.email}
                        </small>
                        <small>{item.serviceTypes.join(", ")}</small>
                      </div>
                      <div className="admin-review-actions">
                        {item.website ? (
                          <a href={item.website} target="_blank" rel="noreferrer">
                            <ExternalLink size={15} /> Website
                          </a>
                        ) : null}
                        <button disabled={saving === "applications"} onClick={() => reviewApplication(item.id, "approve")} type="button">
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button disabled={saving === "applications"} onClick={() => reviewApplication(item.id, "reject")} type="button">
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </Accordion>

            <Accordion section="tourReviews" open={openSections.tourReviews} count={tourReviewItems.length} onToggle={() => toggle("tourReviews")}>
              <div className="admin-panel">
                <div className="admin-panel__head">
                  <div>
                    <p className="admin-eyebrow">Tour publishing</p>
                    <h2>Agency tour review</h2>
                  </div>
                </div>
                <label className="admin-review-note">
                  Admin note
                  <textarea
                    rows={2}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Tour bo'yicha izoh..."
                  />
                </label>
                <div className="admin-review-list">
                  {tourReviewItems.length === 0 ? <div className="admin-empty">Review kutilayotgan tour yo&apos;q.</div> : null}
                  {tourReviewItems.map((item) => (
                    <article className="admin-review-card" key={item.id}>
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : null}
                      <div>
                        <span className="admin-status-pill">{item.approvalStatus}</span>
                        <h3>{item.title}</h3>
                        <p>{item.subtitle}</p>
                        <small>
                          {item.city} | {item.duration} | {item.price || "Narx kiritilmagan"} | {item.agency?.name || "Agency"}
                        </small>
                      </div>
                      <div className="admin-review-actions">
                        <button disabled={saving === "tourReviews"} onClick={() => reviewTour(item.id, "approve")} type="button">
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button disabled={saving === "tourReviews"} onClick={() => reviewTour(item.id, "reject")} type="button">
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </Accordion>

            <Accordion section="bookings" open={openSections.bookings} count={bookingItems.length} onToggle={() => toggle("bookings")}>
              <div className="admin-panel">
                <div className="admin-panel__head">
                  <div>
                    <p className="admin-eyebrow">Booking control</p>
                    <h2>Tour booking so&apos;rovlari</h2>
                  </div>
                </div>
                <label className="admin-review-note">
                  Admin note
                  <textarea
                    rows={2}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Mijoz yoki agency uchun izoh..."
                  />
                </label>
                <div className="admin-review-list">
                  {bookingItems.length === 0 ? <div className="admin-empty">Kutilayotgan booking yo&apos;q.</div> : null}
                  {bookingItems.map((item) => (
                    <article className="admin-review-card" key={item.id}>
                      <div>
                        <span className="admin-status-pill">{bookingStatusLabel(item.status)}</span>
                        <h3>{item.customerName}</h3>
                        <p>{item.tour?.title || "Tour"} · {item.travelers} kishi · {formatMoney(item.totalEstimate, item.currency)}</p>
                        <small>
                          {item.customerEmail}{item.customerPhone ? ` | ${item.customerPhone}` : ""} | {formatDate(item.travelDate || item.createdAt)}
                        </small>
                        <small>{item.agency?.name || "Agency yo'q"} | {item.tour?.city || "Global"}</small>
                        {item.message ? <small>{item.message}</small> : null}
                      </div>
                      <div className="admin-review-actions">
                        <button disabled={saving === "bookings"} onClick={() => reviewBooking(item.id, "confirmed")} type="button">
                          <CheckCircle2 size={16} /> Confirm
                        </button>
                        <button disabled={saving === "bookings"} onClick={() => reviewBooking(item.id, "completed")} type="button">
                          <CheckCircle2 size={16} /> Complete
                        </button>
                        <button disabled={saving === "bookings"} onClick={() => reviewBooking(item.id, "rejected")} type="button">
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </Accordion>

            <Accordion section="hero" open={openSections.hero} count={heroItems.length} onToggle={() => toggle("hero")}>
              <div className="admin-grid">
                <div className="admin-panel">
                  <div className="admin-panel__head">
                    <div>
                      <p className="admin-eyebrow">Hero</p>
                      <h2>{selectedHero ? "Slaydni tahrirlash" : "Yangi slayd"}</h2>
                    </div>
                    <button className="admin-icon-button" onClick={() => reset("hero")} type="button">
                      <Plus size={15} />
                      Yangi
                    </button>
                  </div>
                  <div className="admin-preview">
                    {heroForm.imageUrl ? <img src={heroForm.imageUrl} alt={heroForm.title || "Hero preview"} /> : null}
                    <div>
                      <span>#{heroForm.sortOrder || 0}</span>
                      <strong>{heroForm.title || "Hero sarlavha"}</strong>
                      <p>{heroForm.subtitle || "Subtitle shu yerda ko'rinadi."}</p>
                    </div>
                  </div>
                  <form className="admin-form" onSubmit={saveHero}>
                    <FormInput form={heroForm} name="title" label="Sarlavha" required onChange={updateHero} />
                    <FormTextarea form={heroForm} name="subtitle" label="Subtitle" onChange={updateHero} />
                    <FormInput form={heroForm} name="imageUrl" label="Rasm URL" required onChange={updateHero} />
                    <div className="admin-form__row">
                      <FormInput form={heroForm} name="sortOrder" label="Tartib" type="number" onChange={updateHero} />
                      <FormInput form={heroForm} name="confidenceScore" label="Ishonchlilik" type="number" onChange={updateHero} />
                    </div>
                    <FormInput form={heroForm} name="actionUrl" label="Action URL" onChange={updateHero} />
                    <FormInput form={heroForm} name="placeSlug" label="Place slug" onChange={updateHero} />
                    <label className="admin-check">
                      <input checked={heroForm.active} type="checkbox" onChange={(event) => updateHero("active", event.target.checked)} />
                      Aktiv slayd
                    </label>
                    <button disabled={saving === "hero"} type="submit">
                      {saving === "hero" ? <Loader2 className="admin-spin" size={17} /> : null}
                      Saqlash
                    </button>
                  </form>
                </div>
                <div className="admin-panel">
                  <ContentList
                    empty="Hali hero slayd yo'q."
                    items={heroItems.map((item) => ({
                      id: item.id,
                      title: item.title,
                      meta: `#${item.sortOrder} | ${item.active ? "Aktiv" : "O'chiq"}`,
                      description: item.subtitle || "Subtitle yo'q",
                      imageUrl: item.imageUrl,
                      selected: item.id === selectedHero,
                      onEdit: () => {
                        setSelectedHero(item.id);
                        setHeroForm(heroToForm(item));
                      },
                      onDelete: () => remove("hero", item.id),
                    }))}
                  />
                </div>
              </div>
            </Accordion>

            <Accordion section="places" open={openSections.places} count={placeItems.length} onToggle={() => toggle("places")}>
              <div className="admin-grid">
                <div className="admin-panel">
                  <PanelTitle label="Trending" title={selectedPlace ? "Joyni tahrirlash" : "Yangi joy"} onNew={() => reset("places")} />
                  <form className="admin-form" onSubmit={savePlace}>
                    <FormInput form={placeForm} name="name" label="Nomi" required onChange={updatePlace} />
                    <div className="admin-form__row">
                      <FormInput form={placeForm} name="city" label="Shahar" required onChange={updatePlace} />
                      <FormInput form={placeForm} name="type" label="Turi" required onChange={updatePlace} />
                    </div>
                    <div className="admin-form__row">
                      <FormInput form={placeForm} name="lat" label="Lat" type="number" required onChange={updatePlace} />
                      <FormInput form={placeForm} name="lng" label="Lng" type="number" required onChange={updatePlace} />
                    </div>
                    <FormInput form={placeForm} name="imageUrl" label="Rasm URL" onChange={updatePlace} />
                    <FormTextarea form={placeForm} name="info" label="Qisqa info" onChange={updatePlace} />
                    <FormTextarea form={placeForm} name="description" label="Description" onChange={updatePlace} />
                    <div className="admin-form__row">
                      <FormInput form={placeForm} name="rating" label="Rating" type="number" onChange={updatePlace} />
                      <FormInput form={placeForm} name="ratingCount" label="Review soni" type="number" onChange={updatePlace} />
                    </div>
                    <RankingFields form={placeForm} update={updatePlace} activeKey="landingActive" orderKey="landingSortOrder" />
                    <button disabled={saving === "places"} type="submit">
                      {saving === "places" ? <Loader2 className="admin-spin" size={17} /> : null}
                      Saqlash
                    </button>
                  </form>
                </div>
                <div className="admin-panel">
                  <ContentList
                    empty="Hali joy yo'q."
                    items={placeItems.map((item) => ({
                      id: item.id,
                      title: item.name,
                      meta: `${item.city} | ${item.type} | score ${scoreLabel(item.qualityScore)}`,
                      description: item.description || item.info || "Description yo'q",
                      imageUrl: item.imageUrl || undefined,
                      selected: item.id === selectedPlace,
                      onEdit: () => {
                        setSelectedPlace(item.id);
                        setPlaceForm(placeToForm(item));
                      },
                      onDelete: () => remove("places", item.id),
                    }))}
                  />
                </div>
              </div>
            </Accordion>

            <Accordion section="agencies" open={openSections.agencies} count={agencyItems.length} onToggle={() => toggle("agencies")}>
              <div className="admin-grid">
                <div className="admin-panel">
                  <PanelTitle label="Agency" title={selectedAgency ? "Agency tahrirlash" : "Yangi agency"} onNew={() => reset("agencies")} />
                  <form className="admin-form" onSubmit={saveAgency}>
                    <FormInput form={agencyForm} name="name" label="Nomi" required onChange={updateAgency} />
                    <div className="admin-form__row">
                      <FormInput form={agencyForm} name="city" label="Shahar" required onChange={updateAgency} />
                      <FormInput form={agencyForm} name="specialty" label="Specialty" required onChange={updateAgency} />
                    </div>
                    <FormTextarea form={agencyForm} name="description" label="Description" onChange={updateAgency} />
                    <div className="admin-form__row">
                      <FormInput form={agencyForm} name="rating" label="Rating" type="number" onChange={updateAgency} />
                      <FormInput form={agencyForm} name="reviews" label="Review soni" type="number" onChange={updateAgency} />
                    </div>
                    <FormInput form={agencyForm} name="toursCount" label="Tour soni" type="number" onChange={updateAgency} />
                    <FormInput form={agencyForm} name="website" label="Website" onChange={updateAgency} />
                    <FormInput form={agencyForm} name="imageUrl" label="Rasm URL" onChange={updateAgency} />
                    <RankingFields form={agencyForm} update={updateAgency} activeKey="active" orderKey="landingSortOrder" />
                    <button disabled={saving === "agencies"} type="submit">
                      {saving === "agencies" ? <Loader2 className="admin-spin" size={17} /> : null}
                      Saqlash
                    </button>
                  </form>
                </div>
                <div className="admin-panel">
                  <ContentList
                    empty="Hali agency yo'q."
                    items={agencyItems.map((item) => ({
                      id: item.id,
                      title: item.name,
                      meta: `${item.city} | ${item.rating} rating | ${item.reviews} review`,
                      description: item.description || item.specialty,
                      imageUrl: item.imageUrl || undefined,
                      selected: item.id === selectedAgency,
                      onEdit: () => {
                        setSelectedAgency(item.id);
                        setAgencyForm(agencyToForm(item));
                      },
                      onDelete: () => remove("agencies", item.id),
                    }))}
                  />
                </div>
              </div>
            </Accordion>

            <Accordion section="stories" open={openSections.stories} count={storyItems.length} onToggle={() => toggle("stories")}>
              <div className="admin-grid">
                <div className="admin-panel">
                  <PanelTitle label="Stories" title={selectedStory ? "Story tahrirlash" : "Yangi story"} onNew={() => reset("stories")} />
                  <form className="admin-form" onSubmit={saveStory}>
                    <FormTextarea form={storyForm} name="quote" label="Quote" required onChange={updateStory} />
                    <div className="admin-form__row">
                      <FormInput form={storyForm} name="authorName" label="Muallif" required onChange={updateStory} />
                      <FormInput form={storyForm} name="authorRole" label="Role" required onChange={updateStory} />
                    </div>
                    <div className="admin-form__row">
                      <FormInput form={storyForm} name="avatar" label="Avatar harf" onChange={updateStory} />
                      <FormInput form={storyForm} name="avatarColor" label="Avatar rang" onChange={updateStory} />
                    </div>
                    <div className="admin-form__row">
                      <FormInput form={storyForm} name="rating" label="Rating" type="number" onChange={updateStory} />
                      <FormInput form={storyForm} name="sortOrder" label="Tartib" type="number" onChange={updateStory} />
                    </div>
                    <RankingFields form={storyForm} update={updateStory} activeKey="active" orderKey="sortOrder" />
                    <button disabled={saving === "stories"} type="submit">
                      {saving === "stories" ? <Loader2 className="admin-spin" size={17} /> : null}
                      Saqlash
                    </button>
                  </form>
                </div>
                <div className="admin-panel">
                  <ContentList
                    empty="Hali story yo'q."
                    items={storyItems.map((item) => ({
                      id: item.id,
                      title: item.authorName,
                      meta: `${item.authorRole} | ${item.rating} yulduz | #${item.sortOrder}`,
                      description: item.quote,
                      selected: item.id === selectedStory,
                      onEdit: () => {
                        setSelectedStory(item.id);
                        setStoryForm(storyToForm(item));
                      },
                      onDelete: () => remove("stories", item.id),
                    }))}
                  />
                </div>
              </div>
            </Accordion>
          </div>
        )}
      </main>
    </div>
  );
}

function PanelTitle({ label, title, onNew }: { label: string; title: string; onNew: () => void }) {
  return (
    <div className="admin-panel__head">
      <div>
        <p className="admin-eyebrow">{label}</p>
        <h2>{title}</h2>
      </div>
      <button className="admin-icon-button" onClick={onNew} type="button">
        <Plus size={15} />
        Yangi
      </button>
    </div>
  );
}

function RankingFields<T extends Record<string, FormValue>>({
  form,
  update,
  activeKey,
  orderKey,
}: {
  form: T;
  update: (name: keyof T, value: FormValue) => void;
  activeKey: keyof T;
  orderKey: keyof T;
}) {
  return (
    <>
      <div className="admin-form__row">
        <FormInput form={form} name="manualBoost" label="Manual boost" type="number" onChange={update} />
        <FormInput form={form} name="qualityScore" label="Quality score" type="number" onChange={update} />
      </div>
      <FormInput form={form} name={orderKey} label="Landing tartib" type="number" onChange={update} />
      <div className="admin-check-row">
        <label className="admin-check">
          <input checked={Boolean(form.featured)} type="checkbox" onChange={(event) => update("featured", event.target.checked)} />
          Featured
        </label>
        <label className="admin-check">
          <input checked={Boolean(form[activeKey])} type="checkbox" onChange={(event) => update(activeKey, event.target.checked)} />
          Aktiv
        </label>
      </div>
    </>
  );
}

function ContentList({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    title: string;
    meta: string;
    description: string;
    imageUrl?: string;
    selected?: boolean;
    onEdit: () => void;
    onDelete: () => void;
  }>;
  empty: string;
}) {
  if (!items.length) return <div className="admin-empty">{empty}</div>;

  return (
    <div className="admin-slide-list">
      {items.map((item) => (
        <article className={item.selected ? "is-selected" : ""} key={item.id}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} />
          ) : (
            <div className="admin-list-placeholder">
              <Sparkles size={22} />
            </div>
          )}
          <div>
            <div className="admin-slide-list__meta">
              <span>{item.meta}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div className="admin-slide-list__actions">
              <button onClick={item.onEdit} type="button">
                <Pencil size={15} />
                Edit
              </button>
              {item.imageUrl ? (
                <a href={item.imageUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  Rasm
                </a>
              ) : null}
              <button onClick={item.onDelete} type="button">
                <Trash2 size={15} />
                O&apos;chirish
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
