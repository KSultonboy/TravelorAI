export type ApiResponse<T> = { success: true; data: T } | { success: false; message: string; code?: string };

export type Account = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
  pendingEmail?: string | null;
  emailChangeResendCount?: number;
  emailChangeResendsRemaining?: number;
};

export type AgencyApplication = {
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

export type Agency = {
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

export type Tour = {
  id: string;
  title: string;
  city: string;
  subtitle: string;
  description?: string | null;
  duration: string;
  responseTimeMinutes?: number;
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

export type BookingItem = {
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

export type BookingStats = {
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

export type MeData = {
  account: Account;
  application: AgencyApplication | null;
  agency: Agency | null;
  stats: Record<string, number>;
  bookingStats?: BookingStats;
  supportEmail?: string;
};

export type BookingStatusAction = "confirmed" | "rejected" | "cancelled" | "completed";
