/**
 * Booking-form helpers: Uzbek phone numbers, DD.MM.YYYY dates and traveller
 * counts. Pure functions, no native dependencies.
 */

export const MIN_TRAVELERS = 1;
export const MAX_TRAVELERS = 50;

/** Normalizes "+998 90 123-45-67", "998901234567" or "901234567" to "+998901234567". */
export function normalizeUzPhone(input: string): string | null {
  const digits = (input || '').replace(/\D/g, '');
  let national: string | null = null;
  if (digits.length === 12 && digits.startsWith('998')) national = digits.slice(3);
  else if (digits.length === 9) national = digits;
  if (!national) return null;
  return `+998${national}`;
}

/** Live formatting while typing: "+998 90 123 45 67". */
export function formatUzPhoneInput(input: string): string {
  const raw = input || '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998') && (raw.trim().startsWith('+') || digits.length > 9)) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (!digits) return '';
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return `+998 ${parts.join(' ')}`;
}

/** Inserts dots while typing: "01052026" → "01.05.2026". */
export function formatDateInput(input: string): string {
  const digits = (input || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export type DateParseResult =
  | { ok: true; iso: string }
  | { ok: false; reason: 'format' | 'invalid' | 'past' | 'tooFar' };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Parses DD.MM.YYYY → ISO "YYYY-MM-DD". Rejects impossible, past or >2y-ahead dates. */
export function parseTravelDate(input: string, now: Date = new Date()): DateParseResult {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((input || '').trim());
  if (!match) return { ok: false, reason: 'format' };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { ok: false, reason: 'invalid' };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date < today) return { ok: false, reason: 'past' };

  const limit = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());
  if (date > limit) return { ok: false, reason: 'tooFar' };

  return { ok: true, iso: `${year}-${pad(month)}-${pad(day)}` };
}

export function parseTravelers(input: string): number | null {
  const trimmed = (input || '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return value >= MIN_TRAVELERS && value <= MAX_TRAVELERS ? value : null;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((input || '').trim());
}
