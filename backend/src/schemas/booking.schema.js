const { z } = require('zod');

const createBookingSchema = z
  .object({
    tourId: z.string().trim().optional(),
    tourSlug: z.string().trim().optional(),
    customerName: z.string().trim().min(2, 'Ism kamida 2 ta belgidan iborat bo‘lsin'),
    customerEmail: z.string().trim().email('Email noto‘g‘ri'),
    customerPhone: z.string().trim().min(5).max(40).optional().or(z.literal('')),
    travelers: z.coerce.number().int().min(1).max(50).default(1),
    travelDate: z.string().trim().optional().or(z.literal('')),
    message: z.string().trim().max(1200).optional().or(z.literal('')),
    source: z.string().trim().max(60).optional().default('mobile'),
  })
  .refine((value) => value.tourId || value.tourSlug, {
    message: 'tourId yoki tourSlug talab qilinadi',
    path: ['tourId'],
  });

const bookingStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected', 'cancelled', 'completed']),
  agencyNote: z.string().trim().max(1000).optional().or(z.literal('')),
  adminNote: z.string().trim().max(1000).optional().or(z.literal('')),
});

module.exports = {
  createBookingSchema,
  bookingStatusSchema,
};
