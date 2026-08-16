const { z } = require('zod');

const createBookingSchema = z
  .object({
    tourId: z.string().trim().optional(),
    tourSlug: z.string().trim().optional(),
    customerName: z.string().trim().min(2, 'Ism kamida 2 ta belgidan iborat bo‘lsin'),
    customerEmail: z.string().trim().email('Email noto‘g‘ri').optional().or(z.literal('')),
    customerPhone: z.string().trim().min(5).max(40).optional().or(z.literal('')),
    travelers: z.coerce.number().int().min(1).max(50).default(1),
    travelDate: z.string().trim().optional().or(z.literal('')),
    message: z.string().trim().max(1200).optional().or(z.literal('')),
    source: z.string().trim().max(60).optional().default('mobile'),
    // Lid manbasi — reklama havolasidan keladi, mijoz kiritmaydi
    utmSource: z.string().trim().max(80).optional().or(z.literal('')),
    utmMedium: z.string().trim().max(80).optional().or(z.literal('')),
    utmCampaign: z.string().trim().max(120).optional().or(z.literal('')),
    referrer: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .refine((value) => value.tourId || value.tourSlug, {
    message: 'tourId yoki tourSlug talab qilinadi',
    path: ['tourId'],
  })
  .refine((value) => Boolean((value.customerEmail || '').trim()) || Boolean((value.customerPhone || '').trim()), {
    message: 'Email yoki telefon raqamidan kamida bittasi kerak',
    path: ['customerPhone'],
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
