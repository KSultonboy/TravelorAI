// Guruh / Umra jo'nash ro'yxati: tur bo'yicha kelishilgan lidlar + pasport OCR
// ma'lumotlari, ogohlantirishlar va Excel uchun CSV eksport.
//
// Pasport ma'lumoti LeadFile.ocrData'dan olinadi (leadFiles.controller →
// passportOcr.service shakli: surname, givenNames, passportNumber, nationality,
// birthDate, expiryDate — YYYY-MM-DD). Fayl tanasi (data) HECH QACHON o'qilmaydi.
const { prisma } = require('../config/database');
const { HttpError, tashkentToday, toDateOnly, ymd } = require('./paymentSchedule.service');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ELIGIBLE_STATUSES = ['confirmed', 'completed'];
const EXCLUDED_STATUSES = ['rejected', 'cancelled'];

/* ───────────── Ism solishtirish (maslahat xarakterida) ───────────── */

const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q',
  л: 'l', м: 'm', н: 'n', о: 'o', ў: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ҳ: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const HONORIFICS = new Set(['AKA', 'OPA', 'XONIM', 'JANOB', 'OTA', 'ONA', 'MR', 'MRS', 'MS', 'HOJI', 'XOJI']);

// Lotin/rus/pasport transliteratsiyasidagi odatiy farqlarni bir ko'rinishga keltiradi:
// Xasanov/KHASANOV, Qodirov/KODIROV, Aliyev/ALIEV, Abdullayev/ABDULAEV, Iuldashev/YULDASHEV.
function canonicalToken(token) {
  return token
    .replace(/KH/g, 'X').replace(/Q/g, 'K').replace(/DJ/g, 'J').replace(/ZH/g, 'J')
    .replace(/^IU/, 'YU').replace(/^IA/, 'YA').replace(/^IO/, 'YO')
    .replace(/([AEIOU])Y([AEIOU])/g, '$1$2')
    .replace(/(.)\1+/g, '$1');
}

/** Ismni solishtirish uchun tokenlarga ajratadi: kirill → lotin, apostrof va diakritikasiz, katta harf. */
function nameTokens(value) {
  const latin = String(value || '').toLowerCase().split('').map((ch) => (CYRILLIC[ch] !== undefined ? CYRILLIC[ch] : ch)).join('');
  return latin
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'ʻʼ`´]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && !HONORIFICS.has(t))
    .map(canonicalToken);
}

// Bir harfli imlo xatosi (bir xil uzunlik, 6+ harf) ham mos deb olinadi:
// uzunlik farqi qo'shimcha harf degani — Valiyev/Aliyev kabi boshqa familiya bo'lishi mumkin.
function oneSubstitution(a, b) {
  if (a.length !== b.length || a.length < 6) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i] && ++diff > 1) return false;
  return true;
}
const tokensEqual = (a, b) => a === b || oneSubstitution(a, b);

/**
 * Lid nomi va pasportdagi F.I.Sh mosmi (normallashtirilgan, tartibsiz).
 * Kamida min(2, ikkala tomondagi tokenlar soni) ta token mos kelishi kerak.
 * Ikkala tomon ham bo'sh bo'lsa — tekshirib bo'lmaydi, mos deb hisoblanadi.
 */
function namesMatch(leadName, passportName) {
  const a = nameTokens(leadName); const b = nameTokens(passportName);
  if (!a.length || !b.length) return true;
  const used = new Set(); let matched = 0;
  for (const token of a) {
    const index = b.findIndex((other, k) => !used.has(k) && tokensEqual(token, other));
    if (index >= 0) { used.add(index); matched += 1; }
  }
  return matched >= Math.min(2, a.length, b.length);
}

/* ───────────── Sana va pasport muddati ───────────── */

/** UTC kalendar sanasiga oy qo'shadi; oy oxiri qisqaroq bo'lsa oxirgi kunga qisiladi (31-avg + 6 oy → 28/29-fev). */
function addMonthsUtc(date, months) {
  const d = new Date(date);
  const y = d.getUTCFullYear(); const m = d.getUTCMonth() + months; const day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay)));
}

/** Tur davomiyligi (kun): days → nights+1 → duration matnidagi birinchi son → 0. */
function tourDurationDays(tour) {
  if (Number.isInteger(tour?.days) && tour.days > 0) return tour.days;
  if (Number.isInteger(tour?.nights) && tour.nights >= 0) return tour.nights + 1;
  const m = String(tour?.duration || '').match(/(\d{1,3})/);
  return m ? Number(m[1]) : 0;
}

/** Bron sanasini Toshkent kalendar kuniga aylantiradi (UTC yarim tun yoki Toshkent yarim tuni bo'lishidan qat'i nazar). */
const tashkentDateOf = (value) => (value ? tashkentToday(new Date(value)) : null);

/**
 * Pasport muddati ogohlantirishi. Qoida: pasport qaytish sanasidan keyin
 * kamida 6 oy amal qilishi kerak (qaytish = jo'nash + tur davomiyligi).
 * Aynan 6 oy — yetarli (qat'iy "<" bilan tekshiriladi).
 */
function passportExpiryWarning(expiryDate, { departureDate, returnDate }) {
  const expiry = toDateOnly(expiryDate);
  if (!expiry) return { code: 'expiry_unknown', message: 'Pasport amal qilish muddati o‘qilmadi — qo‘lda tekshiring' };
  if (departureDate && expiry < departureDate) return { code: 'passport_expired', message: 'Pasport muddati jo‘nash sanasigacha tugaydi' };
  const minValid = addMonthsUtc(returnDate || departureDate, 6);
  if (expiry < minValid) return { code: 'expires_within_6_months', message: `Pasport qaytishdan keyin 6 oydan kam amal qiladi (kamida ${formatDmy(minValid)} gacha bo‘lishi kerak)` };
  return null;
}

function formatDmy(value) {
  const date = toDateOnly(value);
  if (!date) return '';
  const iso = ymd(date);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/* ───────────── Qatorlar ───────────── */

const passportFullName = (ocr) => [ocr?.surname, ocr?.givenNames].filter(Boolean).join(' ').trim();
const hasPassportData = (file) => file?.ocrStatus === 'done' && file.ocrData && (file.ocrData.passportNumber || file.ocrData.surname);

/**
 * Bitta lid → bir yoki bir nechta qator (har bir sayyoh/pasport uchun).
 * Pasportlar soni `travelers`dan kam bo'lsa yetishmayotganlari uchun bo'sh qator.
 */
function buildBookingRows({ booking, files = [], durationDays = 0, today = tashkentToday() }) {
  const departureDate = tashkentDateOf(booking.travelDate);
  const baseDate = departureDate || today;
  const returnDate = new Date(baseDate.getTime() + durationDays * DAY_MS);
  const seen = new Set();
  const passports = files
    .filter(hasPassportData)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((file) => {
      const key = String(file.ocrData.passportNumber || file.id).toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  const travelers = Math.max(1, Number(booking.travelers) || 1, passports.length);
  const common = {
    bookingId: booking.id, customerName: booking.customerName, phone: booking.customerPhone || '',
    departureDate: departureDate ? ymd(departureDate) : null, returnDate: ymd(returnDate),
  };
  const noDate = departureDate ? null : { code: 'no_departure_date', message: 'Lidda sayohat sanasi ko‘rsatilmagan' };
  const rows = passports.map((file) => {
    const ocr = file.ocrData;
    const warnings = [];
    const expiry = passportExpiryWarning(ocr.expiryDate, { departureDate, returnDate });
    if (expiry) warnings.push(expiry);
    if (noDate) warnings.push(noDate);
    return {
      ...common, fileId: file.id, fullName: passportFullName(ocr) || booking.customerName,
      passportNumber: ocr.passportNumber || '', nationality: ocr.nationality || ocr.countryCode || '',
      birthDate: ocr.birthDate || null, expiryDate: ocr.expiryDate || null,
      note: travelers > 1 ? `Lid: ${booking.customerName}` : '', warnings,
    };
  });
  if (rows.length && !passports.some((file) => namesMatch(booking.customerName, passportFullName(file.ocrData)))) {
    rows[0].warnings.push({ code: 'name_mismatch', message: `Lid ismi («${booking.customerName}») pasportdagi ism bilan mos emas — tekshiring` });
  }
  for (let k = rows.length; k < travelers; k += 1) {
    rows.push({
      ...common, fileId: null,
      fullName: k === 0 ? booking.customerName : `${booking.customerName} — ${k + 1}-sayyoh`,
      passportNumber: '', nationality: '', birthDate: null, expiryDate: null,
      note: travelers > 1 ? `Lid: ${booking.customerName}` : '',
      warnings: [{ code: 'missing_passport', message: 'Pasport yuklanmagan yoki OCR qilinmagan' }, ...(noDate ? [noDate] : [])],
    });
  }
  return rows;
}

function buildGroupRows({ bookings = [], files = [], tour, today = tashkentToday() }) {
  const durationDays = tourDurationDays(tour);
  const filesByBooking = new Map();
  for (const file of files) filesByBooking.set(file.bookingId, [...(filesByBooking.get(file.bookingId) || []), file]);
  const sorted = [...bookings].sort((a, b) => String(a.customerName || '').localeCompare(String(b.customerName || ''), 'uz'));
  const rows = sorted.flatMap((booking) => buildBookingRows({ booking, files: filesByBooking.get(booking.id) || [], durationDays, today }));
  return rows.map((row, index) => ({ no: index + 1, ...row }));
}

function summarizeRows(rows) {
  const byCode = {};
  for (const row of rows) for (const w of row.warnings) byCode[w.code] = (byCode[w.code] || 0) + 1;
  return {
    bookings: new Set(rows.map((r) => r.bookingId)).size,
    travelers: rows.length,
    passports: rows.filter((r) => r.fileId).length,
    rowsWithWarnings: rows.filter((r) => r.warnings.length).length,
    byCode,
  };
}

/* ───────────── CSV ───────────── */

// Excel/Sheets = + - @ TAB CR bilan boshlangan katakni formula deb bajaradi
// (CSV formula injection) — bunday qiymat oldiga apostrof qo'yiladi.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_COLUMNS = [
  ['№', (r) => r.no],
  ['F.I.Sh (pasport)', (r) => r.fullName],
  ['Pasport raqami', (r) => r.passportNumber],
  ['Fuqaroligi', (r) => r.nationality],
  ['Tug‘ilgan sana', (r) => formatDmy(r.birthDate)],
  ['Pasport amal qilish muddati', (r) => formatDmy(r.expiryDate)],
  ['Telefon', (r) => r.phone],
  ['Izoh', (r) => r.note],
  ['Ogohlantirish', (r) => r.warnings.map((w) => w.message).join('; ')],
];

/** Excel o'zbek harflarini to'g'ri ochishi uchun UTF-8 BOM + CRLF. */
function buildGroupCsv(rows) {
  const lines = [CSV_COLUMNS.map(([label]) => csvCell(label)).join(',')];
  for (const row of rows) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(row))).join(','));
  return `﻿${lines.join('\r\n')}`;
}

function csvFilename(tour, date) {
  const slug = String(tour?.title || 'tur').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tur';
  return `guruh-${slug}-${date || 'barcha-sanalar'}.csv`;
}

/* ───────────── Ma'lumot yuklash ───────────── */

async function loadGroupList(agencyId, { tourId, date }, db = prisma, now = new Date()) {
  const tour = await db.tour.findFirst({ where: { id: tourId, agencyId }, select: { id: true, title: true, city: true, days: true, nights: true, duration: true } });
  if (!tour) throw new HttpError('Tur topilmadi', 404);
  let day = null;
  if (date) { day = toDateOnly(date); if (!day) throw new HttpError('Sana noto‘g‘ri (YYYY-MM-DD)'); }

  // CRM bosqich semantikasi: won (yoki systemType=won bo'lgan maxsus ustun) → status confirmed;
  // completed ham kiradi (o'tgan guruh ro'yxatini ham chiqarish mumkin). Rad etilgan/bekor qilinganlar yo'q.
  const wonStages = await db.crmPipelineStage.findMany({ where: { agencyId, systemType: 'won' }, select: { key: true } });
  const wonKeys = [...new Set(['won', ...wonStages.map((s) => s.key)])];
  const bookings = await db.tourBooking.findMany({
    where: {
      agencyId, tourId: tour.id, status: { notIn: EXCLUDED_STATUSES },
      OR: [{ status: { in: ELIGIBLE_STATUSES } }, { pipelineStage: { in: wonKeys } }],
    },
    select: { id: true, customerName: true, customerPhone: true, travelers: true, travelDate: true, pipelineStage: true, status: true },
    orderBy: { travelDate: 'asc' }, take: 2000,
  });

  const departures = new Map();
  for (const b of bookings) {
    const key = b.travelDate ? ymd(tashkentDateOf(b.travelDate)) : '';
    departures.set(key, (departures.get(key) || 0) + 1);
  }
  const selected = day ? bookings.filter((b) => b.travelDate && ymd(tashkentDateOf(b.travelDate)) === ymd(day)) : bookings;
  const files = selected.length
    ? await db.leadFile.findMany({
      where: { agencyId, bookingId: { in: selected.map((b) => b.id) } },
      // `data` (skan) ATAYIN tanlanmaydi — faqat OCR natijasi.
      select: { id: true, bookingId: true, ocrStatus: true, ocrData: true, createdAt: true },
    })
    : [];
  const rows = buildGroupRows({ bookings: selected, files, tour, today: tashkentToday(now) });
  return {
    tour: { id: tour.id, title: tour.title, city: tour.city, durationDays: tourDurationDays(tour) },
    date: day ? ymd(day) : null,
    departures: [...departures.entries()].map(([d, count]) => ({ date: d || null, count })).sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999'))),
    rows,
    summary: summarizeRows(rows),
  };
}

module.exports = {
  CSV_COLUMNS, addMonthsUtc, buildBookingRows, buildGroupCsv, buildGroupRows, csvCell, csvFilename,
  loadGroupList, nameTokens, namesMatch, passportExpiryWarning, summarizeRows, tourDurationDays,
};
