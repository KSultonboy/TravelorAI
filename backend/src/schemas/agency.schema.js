const { z } = require('zod');

const nullableUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const imageValue = z
  .string()
  .trim()
  .max(12_000_000)
  .refine(
    (value) =>
      !value ||
      /^https?:\/\//i.test(value) ||
      /^\/uploads\//i.test(value) ||
      /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(value),
    'Rasm URL yoki JPG/PNG/WEBP/GIF fayl bo‘lishi kerak'
  )
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const tourBadge = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => (String(value || '').toLowerCase() === 'popular' ? 'Popular' : 'Latest'));

const optionalText = z
  .string()
  .trim()
  .max(240)
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const optionalLongText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const stringList = z
  .array(z.string().trim().min(1).max(160))
  .max(30)
  .optional()
  .default([]);

const mealPlan = z
  .enum(['RO', 'BB', 'HB', 'FB', 'AI', 'UAI', 'UALL', 'FBT'])
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const availabilityStatus = z
  .enum(['available', 'few_seats', 'on_request', 'sold_out'])
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const flightSeatStatus = z
  .enum(['available', 'few_seats', 'on_request', 'no_seats', 'not_included'])
  .optional()
  .or(z.literal(''))
  .transform((value) => value || undefined);

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(4).max(10),
});

const emailChangeRequestSchema = z.object({
  newEmail: z.string().trim().email(),
});

const emailChangeConfirmSchema = z.object({
  code: z.string().trim().length(6),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional().or(z.literal('')),
    newPassword: z
      .string()
      .min(8, "Yangi parol kamida 8 belgidan iborat bo'lishi kerak")
      .max(128, 'Yangi parol juda uzun'),
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'Yangi parol avvalgi paroldan farq qilishi kerak',
    path: ['newPassword'],
  });

const applicationSchema = z.object({
  companyName: z.string().trim().min(2),
  legalName: z.string().trim().optional().or(z.literal('')),
  contactPerson: z.string().trim().min(2),
  phone: z.string().trim().min(5),
  email: z.string().trim().email(),
  city: z.string().trim().min(2),
  country: z.string().trim().min(2).default('Global'),
  website: nullableUrl,
  telegram: z.string().trim().optional().or(z.literal('')),
  instagram: z.string().trim().optional().or(z.literal('')),
  serviceTypes: z.array(z.string().trim().min(2)).min(1).max(12),
  description: z.string().trim().min(20),
  imageUrl: imageValue,
  documents: z.any().optional(),
});

const tourSchema = z.object({
  title: z.string().trim().min(3),
  city: z.string().trim().min(2),
  subtitle: z.string().trim().min(3),
  description: z.string().trim().optional().or(z.literal('')),
  duration: z.string().trim().min(2),
  responseTimeMinutes: z.coerce.number().int().min(5).max(1440).default(45),
  price: z.string().trim().optional().or(z.literal('')),
  priceMin: z.coerce.number().int().nonnegative().optional().nullable(),
  priceCurrency: optionalText,
  priceBasis: optionalText,
  badge: tourBadge,
  imageUrl: imageValue,
  itinerary: z.any().optional(),
  highlights: z.array(z.string().trim().min(2)).max(20).optional().default([]),
  departureCity: optionalText,
  destinationCountry: optionalText,
  tourGroup: optionalText,
  nights: z.coerce.number().int().nonnegative().optional().nullable(),
  days: z.coerce.number().int().nonnegative().optional().nullable(),
  hotelIncluded: z.coerce.boolean().optional().default(false),
  flightIncluded: z.coerce.boolean().optional().default(false),
  discount: optionalText,
  priceBasisPeople: z.coerce.number().int().positive().optional().nullable(),
  priceLockMinutes: z.coerce.number().int().nonnegative().max(100000).optional().nullable(),
  hotelName: optionalText,
  hotelCategory: optionalText,
  hotelLocation: optionalText,
  roomType: optionalText,
  mealPlan,
  mealPlanLabel: optionalText,
  childPolicy: optionalLongText,
  flightSeatStatus,
  availabilityStatus,
  instantConfirmation: z.coerce.boolean().optional().default(false),
  stopSale: z.coerce.boolean().optional().default(false),
  promo: z.coerce.boolean().optional().default(false),
  priceIncludes: stringList,
  priceExcludes: stringList,
});

const googleAuthSchema = z.object({
  idToken: z.string().trim().min(10, 'Google idToken talab qilinadi'),
});

const adminReviewSchema = z.object({
  adminNote: z.string().trim().max(800).optional().or(z.literal('')),
});

module.exports = {
  googleAuthSchema,
  registerSchema,
  verifyEmailSchema,
  emailChangeRequestSchema,
  emailChangeConfirmSchema,
  changePasswordSchema,
  loginSchema,
  applicationSchema,
  tourSchema,
  adminReviewSchema,
};
