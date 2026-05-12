const { z } = require('zod');

const nullableUrl = z
  .string()
  .trim()
  .url()
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

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
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
  documents: z.any().optional(),
});

const tourSchema = z.object({
  title: z.string().trim().min(3),
  city: z.string().trim().min(2),
  subtitle: z.string().trim().min(3),
  description: z.string().trim().optional().or(z.literal('')),
  duration: z.string().trim().min(2),
  price: z.string().trim().optional().or(z.literal('')),
  priceMin: z.coerce.number().int().nonnegative().optional().nullable(),
  badge: z.string().trim().optional().default('Latest'),
  imageUrl: nullableUrl,
  itinerary: z.any().optional(),
  highlights: z.array(z.string().trim().min(2)).max(20).optional().default([]),
});

const adminReviewSchema = z.object({
  adminNote: z.string().trim().max(800).optional().or(z.literal('')),
});

module.exports = {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  applicationSchema,
  tourSchema,
  adminReviewSchema,
};
