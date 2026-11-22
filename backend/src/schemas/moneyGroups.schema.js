// To'lov jadvali va guruh ro'yxati so'rovlari uchun zod sxemalari (xabarlar o'zbekcha).
const { z } = require('zod');
const { positiveAmount } = require('../services/finance.service');
const { toDateOnly } = require('../services/paymentSchedule.service');

// "1 500 000", 1500000 → 1500000 (moliya bo'limi bilan bir xil qoida: butun musbat son).
const amount = (message) => z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : positiveAmount(v)),
  z.number({ required_error: message, invalid_type_error: message }).int().positive(message));
const dateOnly = (message) => z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : toDateOnly(v) || 'invalid'),
  z.date({ required_error: message, invalid_type_error: message }));
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Valyuta kodi noto‘g‘ri (masalan USD yoki UZS)');
const optionalText = (max) => z.preprocess((v) => (v === null ? '' : v), z.string().trim().max(max, `Matn ${max} belgidan oshmasligi kerak`)).optional();

const createInstalmentSchema = z.object({
  title: z.string({ required_error: 'To‘lov nomini kiriting' }).trim().min(1, 'To‘lov nomini kiriting').max(120, 'Nom 120 belgidan oshmasligi kerak'),
  amount: amount('Musbat summa kiriting'),
  currency: currency.optional(),
  dueDate: dateOnly('To‘lov sanasi noto‘g‘ri'),
  note: optionalText(1000),
}).strict();

const updateInstalmentSchema = z.object({
  title: z.string().trim().min(1, 'To‘lov nomini kiriting').max(120, 'Nom 120 belgidan oshmasligi kerak').optional(),
  amount: amount('Musbat summa kiriting').optional(),
  dueDate: dateOnly('To‘lov sanasi noto‘g‘ri').optional(),
  note: optionalText(1000),
  status: z.enum(['planned', 'cancelled'], { errorMap: () => ({ message: 'Holat faqat planned yoki cancelled bo‘lishi mumkin' }) }).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'O‘zgartirish uchun maydon yuboring');

const planSchema = z.object({
  total: amount('Umumiy summani kiriting'),
  depositPercent: z.coerce.number({ invalid_type_error: 'Avans foizi son bo‘lishi kerak' }).min(0, 'Avans foizi 0 dan kam bo‘lmaydi').max(100, 'Avans foizi 100 dan oshmaydi').default(0),
  instalments: z.coerce.number({ invalid_type_error: 'Bo‘laklar soni son bo‘lishi kerak' }).int('Bo‘laklar soni butun son bo‘lishi kerak').min(0).max(36, 'Bo‘laklar soni 36 dan oshmasligi kerak').default(1),
  firstDueDate: dateOnly('Birinchi to‘lov sanasini kiriting'),
  depositDueDate: dateOnly('Avans sanasi noto‘g‘ri').optional(),
  intervalDays: z.coerce.number().int().min(1, 'Oraliq kamida 1 kun').max(365, 'Oraliq 365 kundan oshmasin').default(30),
  currency: currency.optional(),
  replace: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
}).strict();

const markPaidSchema = z.object({
  paidAmount: amount('Musbat summa kiriting').optional(),
  paidAt: dateOnly('To‘lov sanasi noto‘g‘ri').optional(),
  accountId: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().trim().min(1).max(64).optional()),
  paymentMethod: optionalText(80),
  note: optionalText(1000),
}).strict();

const groupListQuerySchema = z.object({
  tourId: z.string({ required_error: 'Turni tanlang' }).trim().min(1, 'Turni tanlang').max(64),
  date: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD ko‘rinishida bo‘lishi kerak').optional()),
});

/** Birinchi xatoni o'zbekcha qaytaradi; muvaffaqiyatda tozalangan qiymat. */
function parseOrError(schema, value) {
  const result = schema.safeParse(value ?? {});
  if (result.success) return { data: result.data };
  const issue = result.error.errors[0];
  const message = issue?.code === 'unrecognized_keys' ? `Noma’lum maydon: ${issue.keys.join(', ')}` : issue?.message || 'So‘rov noto‘g‘ri';
  return { error: message };
}

module.exports = { createInstalmentSchema, groupListQuerySchema, markPaidSchema, parseOrError, planSchema, updateInstalmentSchema };
