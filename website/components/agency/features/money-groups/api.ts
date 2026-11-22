// To'lov jadvali / qarzdorlik / guruh ro'yxati — backend turlari va yordamchilar.
// Backend: backend/src/routes/agencyMoneyGroups.routes.js (`/agency/crm/...`).

export type InstalmentStatus = "planned" | "paid" | "cancelled";

export type Instalment = {
  id: string;
  bookingId: string;
  title: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: InstalmentStatus;
  paidAt: string | null;
  paidAmount: number | null;
  financeTransactionId: string | null;
  note: string | null;
  reminderSentAt: string | null;
  overdue: boolean;
  daysUntilDue: number;
};

export type PlanPreviewRow = { title: string; amount: number; currency: string; dueDate: string; position: number };

export type LeadMoneySummary = { currency: string; planned: number; paid: number; overdue: number; total: number };

export type FinanceAccountLite = { id: string; name: string; type: string; currency: string };

export type InstalmentListData = {
  booking: { id: string; customerName: string; totalEstimate: number | null; currency: string; hasTelegram: boolean };
  instalments: Instalment[];
  summary: LeadMoneySummary[];
  accounts: FinanceAccountLite[];
  canWrite: boolean;
};

export type DebtItem = {
  id: string; bookingId: string; title: string; amount: number; currency: string; dueDate: string;
  daysUntilDue: number; customerName: string; customerPhone: string | null;
};

export type DebtsData = {
  today: string;
  totals: { currency: string; overdue: number; overdueCount: number; dueWeek: number; dueWeekCount: number; outstanding: number }[];
  overdue: DebtItem[];
  dueSoon: DebtItem[];
  topOverdueLeads: { bookingId: string; customerName: string; customerPhone: string | null; amounts: Record<string, number>; count: number; oldestDueDate: string; daysOverdue: number }[];
};

export type GroupWarning = { code: string; message: string };

export type GroupRow = {
  no: number;
  bookingId: string;
  customerName: string;
  fileId: string | null;
  fullName: string;
  passportNumber: string;
  nationality: string;
  birthDate: string | null;
  expiryDate: string | null;
  phone: string;
  note: string;
  departureDate: string | null;
  returnDate: string;
  warnings: GroupWarning[];
};

export type GroupListData = {
  tour: { id: string; title: string; city: string; durationDays: number };
  date: string | null;
  departures: { date: string | null; count: number }[];
  rows: GroupRow[];
  summary: { bookings: number; travelers: number; passports: number; rowsWithWarnings: number; byCode: Record<string, number> };
};

export const CURRENCIES = ["USD", "UZS", "EUR"] as const;
export const PAYMENT_METHODS = ["Naqd", "Plastik karta", "Bank o‘tkazmasi", "Click", "Payme"] as const;

/** 1500000, "UZS" → "1 500 000 so‘m". */
export function fmtAmount(amount: number | null | undefined, currency: string) {
  const n = String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} ${currency === "UZS" ? "so‘m" : currency}`;
}

/** "2026-12-01..." → "01.12.2026". */
export function fmtDay(value?: string | null) {
  const iso = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** Toshkent vaqti bo'yicha bugungi sana, YYYY-MM-DD (input[type=date] uchun). */
export function todayIso(offsetDays = 0) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

export const ERR_STYLE = { background: "var(--rose-soft)", color: "#8f2a20", borderColor: "#f3c9c4" } as const;
export const DANGER = "#b42318";
