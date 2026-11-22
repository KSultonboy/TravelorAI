// Mijoz to'lov jadvali: avans + bo'lib to'lash, qarzdorlik va eslatmalar.
//
// Summalar FinanceTransaction bilan bir xil saqlanadi — valyuta birligidagi
// butun son (USD → dollar, UZS → so'm). Muddat (dueDate) — kalendar sanasi,
// UTC yarim tun sifatida saqlanadi; "bugun" Toshkent vaqti (UTC+5, DST yo'q)
// bo'yicha hisoblanadi.
const { prisma } = require('../config/database');
const tg = require('./telegram.service');
const { syncManagerCommission } = require('./financeWorkflow.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const REMINDER_HOUR = 10; // 10:00 Toshkent
const REMINDER_DAYS_AHEAD = 2;
const INSTALMENT_STATUSES = ['planned', 'paid', 'cancelled'];
const WRITE_ROLES = ['owner', 'manager', 'accountant'];

class HttpError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

/** 'YYYY-MM-DD' (yoki ISO) → shu kalendar kunining UTC yarim tuni. Noto'g'ri bo'lsa null. */
function toDateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) return null;
  return date;
}

/** Toshkentdagi bugungi kalendar sana (UTC yarim tun sifatida). */
function tashkentToday(now = new Date()) {
  const t = new Date(now.getTime() + TZ_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
const tashkentHour = (now = new Date()) => new Date(now.getTime() + TZ_OFFSET_MS).getUTCHours();
const ymd = (date) => new Date(date).toISOString().slice(0, 10);
const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS);

function formatAmount(amount, currency) {
  const n = String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n} ${currency === 'UZS' ? 'so‘m' : currency}`;
}
function formatDateUz(date) {
  const iso = ymd(date);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/**
 * Avans + teng bo'laklar rejasi. Har bir summa butun son; yaxlitlash qoldig'i
 * oxirgi bo'lakka qo'shiladi, shuning uchun bo'laklar yig'indisi DOIM `total`ga teng.
 *  - deposit = round(total * depositPercent / 100), muddati depositDueDate (yo'q bo'lsa firstDueDate)
 *  - qolgan summa `instalments` ta bo'lakka: i-bo'lak firstDueDate + i*intervalDays
 */
function generatePlan({ total, depositPercent = 0, instalments = 1, firstDueDate, depositDueDate, intervalDays = 30 }) {
  const sum = Number(total);
  if (!Number.isSafeInteger(sum) || sum <= 0) throw new HttpError('Umumiy summa musbat butun son bo‘lishi kerak');
  const pct = Number(depositPercent) || 0;
  if (pct < 0 || pct > 100) throw new HttpError('Avans foizi 0 dan 100 gacha bo‘lishi kerak');
  const count = Number(instalments) || 0;
  if (!Number.isInteger(count) || count < 0 || count > 36) throw new HttpError('Bo‘laklar soni 0 dan 36 gacha bo‘lishi kerak');
  const first = toDateOnly(firstDueDate);
  if (!first) throw new HttpError('Birinchi to‘lov sanasi noto‘g‘ri');
  const depositDate = depositDueDate ? toDateOnly(depositDueDate) : first;
  if (!depositDate) throw new HttpError('Avans sanasi noto‘g‘ri');
  const step = Number(intervalDays) || 30;

  const deposit = Math.min(sum, Math.max(0, Math.round((sum * pct) / 100)));
  const rest = sum - deposit;
  if (rest > 0 && count === 0) throw new HttpError('Qolgan summa uchun kamida bitta bo‘lak kerak');
  const rows = [];
  if (deposit > 0) rows.push({ title: 'Avans', amount: deposit, dueDate: depositDate });
  if (rest > 0) {
    const base = Math.floor(rest / count);
    if (base <= 0) throw new HttpError('Bo‘laklar soni summa uchun juda ko‘p');
    for (let i = 0; i < count; i += 1) {
      const isLast = i === count - 1;
      rows.push({
        title: count === 1 ? 'Qoldiq' : isLast ? `${i + 1}-to‘lov (qoldiq)` : `${i + 1}-to‘lov`,
        amount: isLast ? rest - base * (count - 1) : base,
        dueDate: addDays(first, i * step),
      });
    }
  }
  return rows.map((row, index) => ({ ...row, position: index }));
}

/** Bitta bo'lakning holati (UI va API uchun): overdue — muddati Toshkent bo'yicha bugundan oldin. */
function decorateInstalment(row, today = tashkentToday()) {
  const due = new Date(row.dueDate);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  return { ...row, overdue: row.status === 'planned' && daysUntilDue < 0, daysUntilDue };
}

/** Lid bo'yicha valyuta kesimidagi yig'indilar. */
function summarizeLead(rows, today = tashkentToday()) {
  const byCurrency = new Map();
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    const cur = byCurrency.get(row.currency) || { currency: row.currency, planned: 0, paid: 0, overdue: 0, total: 0 };
    if (row.status === 'paid') { cur.paid += row.paidAmount ?? row.amount; cur.total += row.paidAmount ?? row.amount; }
    else { cur.planned += row.amount; cur.total += row.amount; if (decorateInstalment(row, today).overdue) cur.overdue += row.amount; }
    byCurrency.set(row.currency, cur);
  }
  return [...byCurrency.values()];
}

/**
 * Agentlik bo'yicha qarzdorlik: muddati o'tgan + 7 kun ichida + valyuta bo'yicha jami.
 * `rows` — dueDate <= bugun+7 bo'lgan `planned` bo'laklar; `outstanding` — groupBy natijasi.
 */
function summarizeDebts({ rows = [], outstanding = [], bookings = [], today = tashkentToday(), topLimit = 5 }) {
  const weekEnd = addDays(today, 7);
  const names = new Map(bookings.map((b) => [b.id, b]));
  const totals = new Map();
  const totalFor = (currency) => {
    if (!totals.has(currency)) totals.set(currency, { currency, overdue: 0, overdueCount: 0, dueWeek: 0, dueWeekCount: 0, outstanding: 0 });
    return totals.get(currency);
  };
  for (const g of outstanding) totalFor(g.currency).outstanding += Number(g._sum?.amount || 0);

  const overdue = []; const dueSoon = []; const leads = new Map();
  for (const raw of rows) {
    if (raw.status !== 'planned') continue;
    const row = decorateInstalment(raw, today);
    const booking = names.get(row.bookingId);
    const item = {
      id: row.id, bookingId: row.bookingId, title: row.title, amount: row.amount, currency: row.currency,
      dueDate: row.dueDate, daysUntilDue: row.daysUntilDue,
      customerName: booking?.customerName || 'Noma’lum mijoz', customerPhone: booking?.customerPhone || null,
    };
    const t = totalFor(row.currency);
    if (row.overdue) {
      t.overdue += row.amount; t.overdueCount += 1; overdue.push(item);
      const lead = leads.get(row.bookingId) || { bookingId: row.bookingId, customerName: item.customerName, customerPhone: item.customerPhone, amounts: {}, count: 0, oldestDueDate: row.dueDate, daysOverdue: 0 };
      lead.amounts[row.currency] = (lead.amounts[row.currency] || 0) + row.amount;
      lead.count += 1;
      if (new Date(row.dueDate) < new Date(lead.oldestDueDate)) lead.oldestDueDate = row.dueDate;
      lead.daysOverdue = Math.max(lead.daysOverdue, -row.daysUntilDue);
      leads.set(row.bookingId, lead);
    } else if (new Date(row.dueDate) <= weekEnd) {
      t.dueWeek += row.amount; t.dueWeekCount += 1; dueSoon.push(item);
    }
  }
  const leadTotal = (lead) => Object.values(lead.amounts).reduce((a, b) => a + b, 0);
  const topOverdueLeads = [...leads.values()]
    .sort((a, b) => b.daysOverdue - a.daysOverdue || leadTotal(b) - leadTotal(a))
    .slice(0, topLimit);
  overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  dueSoon.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  return {
    today: ymd(today),
    totals: [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    overdue: overdue.slice(0, 100),
    dueSoon: dueSoon.slice(0, 100),
    topOverdueLeads,
  };
}

async function loadDebts(agencyId, now = new Date(), db = prisma) {
  const today = tashkentToday(now);
  const [rows, outstanding] = await Promise.all([
    db.paymentInstalment.findMany({
      where: { agencyId, status: 'planned', dueDate: { lte: addDays(today, 7) } },
      orderBy: { dueDate: 'asc' }, take: 2000,
    }),
    db.paymentInstalment.groupBy({ by: ['currency'], where: { agencyId, status: 'planned' }, _sum: { amount: true } }),
  ]);
  const ids = [...new Set(rows.map((r) => r.bookingId))];
  const bookings = ids.length
    ? await db.tourBooking.findMany({ where: { agencyId, id: { in: ids } }, select: { id: true, customerName: true, customerPhone: true } })
    : [];
  return summarizeDebts({ rows, outstanding, bookings, today });
}

/**
 * Bo'lakni "to'landi" qilish → moliya bo'limiga bitta income FinanceTransaction.
 * Idempotent: bo'lak allaqachon to'langan bo'lsa (ikki marta bosish yoki parallel
 * so'rov) yangi tranzaksiya yaratilmaydi, mavjudi qaytariladi. Parallel holatda
 * `updateMany ... where status='planned'` faqat bitta so'rovda 1 qator yangilaydi.
 */
async function markInstalmentPaid({ agencyId, instalmentId, actorAccountId, accountId = null, paidAmount, paidAt, paymentMethod = null, note = null }, db = prisma) {
  const instalment = await db.paymentInstalment.findFirst({ where: { id: instalmentId, agencyId } });
  if (!instalment) throw new HttpError('To‘lov bo‘lagi topilmadi', 404);
  if (instalment.status === 'paid') return { instalment, transactionId: instalment.financeTransactionId, alreadyPaid: true };
  if (instalment.status !== 'planned') throw new HttpError('Bekor qilingan bo‘lakni to‘lab bo‘lmaydi', 409);

  const amount = paidAmount == null ? instalment.amount : paidAmount;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new HttpError('Musbat summa kiriting');
  if (amount > instalment.amount) throw new HttpError(`To‘lov summasi bo‘lakdan oshmasligi kerak: ${formatAmount(instalment.amount, instalment.currency)}`);
  const when = paidAt || new Date();

  let account = null;
  if (accountId) {
    account = await db.financeAccount.findFirst({ where: { id: accountId, agencyId, active: true } });
    if (!account) throw new HttpError('Kassa yoki hisob topilmadi', 404);
    if (account.currency !== instalment.currency) throw new HttpError(`Hisob valyutasi (${account.currency}) to‘lov valyutasiga (${instalment.currency}) mos emas`);
  }
  const booking = await db.tourBooking.findFirst({
    where: { id: instalment.bookingId, agencyId },
    select: { id: true, customerName: true, branchId: true, assignedMemberId: true, assignedMember: { select: { branchId: true } } },
  });
  if (!booking) throw new HttpError('Lid topilmadi', 404);

  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.paymentInstalment.updateMany({
      where: { id: instalment.id, agencyId, status: 'planned' },
      data: { status: 'paid', paidAt: when, paidAmount: amount },
    });
    if (claimed.count !== 1) return { alreadyPaid: true };
    const transaction = await tx.financeTransaction.create({ data: {
      agencyId, accountId: account?.id || null, bookingId: booking.id,
      branchId: booking.branchId || booking.assignedMember?.branchId || account?.branchId || null,
      managerMemberId: booking.assignedMemberId || null,
      direction: 'income', status: 'paid', category: 'Mijoz to‘lovi',
      amount, currency: instalment.currency, counterparty: booking.customerName || null,
      paymentMethod: paymentMethod ? String(paymentMethod).trim().slice(0, 80) || null : null,
      note: (note ? String(note).trim().slice(0, 1000) : '') || `To‘lov jadvali: ${instalment.title}`,
      paidAt: when, createdByAccountId: actorAccountId || null,
    } });
    await tx.paymentInstalment.update({ where: { id: instalment.id }, data: { financeTransactionId: transaction.id } });
    let remainder = null;
    if (amount < instalment.amount) {
      remainder = await tx.paymentInstalment.create({ data: {
        agencyId, bookingId: instalment.bookingId, title: `${instalment.title} — qoldiq`.slice(0, 120),
        amount: instalment.amount - amount, currency: instalment.currency, dueDate: instalment.dueDate,
        position: instalment.position, createdByAccountId: actorAccountId || null,
      } });
    }
    await syncManagerCommission(tx, transaction);
    return { transactionId: transaction.id, remainder };
  });

  const fresh = await db.paymentInstalment.findFirst({ where: { id: instalment.id, agencyId } });
  if (result.alreadyPaid) return { instalment: fresh, transactionId: fresh?.financeTransactionId || null, alreadyPaid: true };
  return { instalment: fresh, transactionId: result.transactionId, remainder: result.remainder, alreadyPaid: false };
}

/* ───────────────────────── Scheduler: eslatmalar ───────────────────────── */

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function reminderText({ customerName, agencyName, title, amount, currency, dueDate }) {
  return `Assalomu alaykum, ${customerName || 'hurmatli mijoz'}!\n\n` +
    `${agencyName || 'Agentligimiz'} sizga eslatib o‘tmoqchi: «${title}» to‘lovi — ${formatAmount(amount, currency)} — ` +
    `${formatDateUz(dueDate)} sanasigacha to‘lanishi rejalashtirilgan.\n\n` +
    'Agar to‘lovni allaqachon amalga oshirgan bo‘lsangiz, ushbu xabarga e’tibor bermang. ' +
    'Savollaringiz bo‘lsa, shu chatga yozing. Rahmat!';
}

/**
 * Muddatiga 0..2 kun qolgan bo'laklar uchun mijozga agentlik boti orqali
 * bitta xushmuomala eslatma. Har bo'lak uchun bir marta: `reminderSentAt`
 * atomar `updateMany(where reminderSentAt=null)` bilan "band qilinadi".
 */
async function runInstalmentReminders(now = new Date(), db = prisma) {
  if (tashkentHour(now) < REMINDER_HOUR) return 0;
  const today = tashkentToday(now);
  const rows = await db.paymentInstalment.findMany({
    where: { status: 'planned', reminderSentAt: null, dueDate: { gte: today, lte: addDays(today, REMINDER_DAYS_AHEAD) } },
    orderBy: { dueDate: 'asc' }, take: 500,
  });
  if (!rows.length) return 0;
  const agencyIds = [...new Set(rows.map((r) => r.agencyId))];
  const bookingIds = [...new Set(rows.map((r) => r.bookingId))];
  const [agencies, bookings] = await Promise.all([
    db.tourAgency.findMany({ where: { id: { in: agencyIds }, telegramBotActive: true, NOT: { telegramBotToken: null } }, select: { id: true, name: true, telegramBotToken: true } }),
    db.tourBooking.findMany({ where: { id: { in: bookingIds }, telegramChatId: { not: null } }, select: { id: true, agencyId: true, customerName: true, telegramChatId: true } }),
  ]);
  const agencyById = new Map(agencies.map((a) => [a.id, a]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  let sent = 0;
  for (const row of rows) {
    const agency = agencyById.get(row.agencyId);
    const booking = bookingById.get(row.bookingId);
    // Lid boshqa agentlikka tegishli bo'lsa (yoki Telegram chat yo'q) — yubormaymiz.
    if (!agency || !booking || booking.agencyId !== row.agencyId || !booking.telegramChatId) continue;
    const claim = await db.paymentInstalment.updateMany({ where: { id: row.id, reminderSentAt: null, status: 'planned' }, data: { reminderSentAt: now } });
    if (claim.count !== 1) continue; // boshqa jarayon allaqachon yubordi
    const text = reminderText({ customerName: booking.customerName, agencyName: agency.name, title: row.title, amount: row.amount, currency: row.currency, dueDate: row.dueDate });
    try {
      await tg.sendMessage(agency.telegramBotToken, booking.telegramChatId, text);
      await db.telegramMessage.create({ data: { agencyId: row.agencyId, bookingId: booking.id, direction: 'out', text, fromName: 'To‘lov eslatmasi' } }).catch(() => {});
      sent += 1;
    } catch { /* bot bloklangan yoki tarmoq — takror spam qilmaslik uchun belgi qoladi */ }
    await pause(60);
  }
  return sent;
}

/**
 * Agentlikning xabarnoma chatiga (notifyChatId) kuniga bitta "muddati o'tgan
 * to'lovlar" xulosasi. Kunlik takrorlanmaslik AuditLog.dedupeKey (unique)
 * orqali kafolatlanadi — yozuv YUBORISHDAN OLDIN band qilinadi.
 */
async function runOverdueDigest(now = new Date(), db = prisma) {
  if (tashkentHour(now) < REMINDER_HOUR) return 0;
  const today = tashkentToday(now);
  const rows = await db.paymentInstalment.findMany({
    where: { status: 'planned', dueDate: { lt: today } },
    orderBy: { dueDate: 'asc' }, take: 5000,
  });
  if (!rows.length) return 0;
  const byAgency = new Map();
  for (const row of rows) byAgency.set(row.agencyId, [...(byAgency.get(row.agencyId) || []), row]);
  const agencies = await db.tourAgency.findMany({
    where: { id: { in: [...byAgency.keys()] }, telegramBotActive: true, NOT: [{ telegramBotToken: null }, { notifyChatId: null }] },
    select: { id: true, name: true, telegramBotToken: true, notifyChatId: true },
  });
  let sent = 0;
  for (const agency of agencies) {
    if (!agency.notifyChatId || !agency.telegramBotToken) continue;
    const list = byAgency.get(agency.id) || [];
    const bookings = await db.tourBooking.findMany({ where: { agencyId: agency.id, id: { in: [...new Set(list.map((r) => r.bookingId))] } }, select: { id: true, customerName: true, customerPhone: true } });
    const summary = summarizeDebts({ rows: list, bookings, today, topLimit: 10 });
    if (!summary.overdue.length) continue;
    const dedupeKey = `payment-overdue-digest:${agency.id}:${ymd(today)}`;
    // Oddiy holat — oldindan tekshiruv (har 30 daqiqalik tick'da xato logi bo'lmasin);
    // unique cheklov esa parallel jarayonlar poygasidan himoya qiladi.
    if (await db.auditLog.findUnique({ where: { dedupeKey }, select: { id: true } })) continue;
    try {
      await db.auditLog.create({ data: {
        agencyId: agency.id, action: 'SCHEDULER overdue-digest', entityType: 'instalments',
        changes: { count: summary.overdue.length, totals: summary.totals.map((t) => ({ currency: t.currency, overdue: t.overdue })) },
        dedupeKey,
      } });
    } catch { continue; } // P2002 — bugun allaqachon yuborilgan
    const lines = summary.topOverdueLeads.map((lead) => `• ${lead.customerName} — ${Object.entries(lead.amounts).map(([cur, sum]) => formatAmount(sum, cur)).join(', ')} (${lead.daysOverdue} kun kechikdi)`);
    const more = summary.overdue.length > lines.length ? `\n…va boshqa to‘lovlar (jami ${summary.overdue.length} ta bo‘lak)` : '';
    const totalLine = summary.totals.filter((t) => t.overdue > 0).map((t) => formatAmount(t.overdue, t.currency)).join('; ');
    const text = `📋 Muddati o‘tgan mijoz to‘lovlari — ${formatDateUz(today)}\n\n${lines.join('\n')}${more}\n\nJami qarzdorlik: ${totalLine}\nBatafsil: CRM → Boshqaruv paneli → «Qarzdorlik».`;
    try { await tg.sendMessage(agency.telegramBotToken, agency.notifyChatId, text); sent += 1; } catch { /* keyingi kuni qayta */ }
    await pause(60);
  }
  return sent;
}

async function runPaymentScheduleJobs(now = new Date()) {
  const reminders = await runInstalmentReminders(now).catch(() => 0);
  const digests = await runOverdueDigest(now).catch(() => 0);
  return { reminders, digests };
}

module.exports = {
  HttpError, INSTALMENT_STATUSES, WRITE_ROLES, REMINDER_HOUR,
  addDays, decorateInstalment, formatAmount, formatDateUz, generatePlan, loadDebts, markInstalmentPaid,
  reminderText, runInstalmentReminders, runOverdueDigest, runPaymentScheduleJobs,
  summarizeDebts, summarizeLead, tashkentHour, tashkentToday, toDateOnly, ymd,
};
