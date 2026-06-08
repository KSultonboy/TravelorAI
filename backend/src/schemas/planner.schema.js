const { z } = require('zod');

const plannerSchema = z.object({
  budget: z.coerce.number().min(200000, 'Minimum budget 200 000 so\'m'),
  duration: z.coerce.number().int().min(1).max(14),
  travelers: z.coerce.number().int().min(1).max(8),
  style: z.enum(['budget', 'mid', 'luxury']),
  interests: z.array(z.string()).min(1, 'Kamida 1 ta qiziqish tanlang'),
  city: z.string().optional(),
  country: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  companions: z.enum(['solo', 'friends', 'family', 'couple']).optional(),
  comfortLevel: z.enum(['budget', 'mid', 'luxury']).optional(),
  foodPreferences: z.enum(['halal', 'vegetarian', 'vegan', 'none']).optional(),
  transportType: z.enum(['cheap', 'fast', 'comfort']).optional(),
  flexibility: z.enum(['fixed', 'flexible']).optional(),
  analysisContext: z.any().optional(),
  recommendedPoiNames: z.array(z.string()).optional(),
  poiContext: z
    .array(
      z
        .object({
          name: z.string(),
          city: z.string().optional(),
          type: z.string().optional(),
          subtype: z.string().optional(),
          info: z.string().optional(),
          description: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          price: z.number().optional(),
          rating: z.number().optional(),
        })
        .passthrough()
    )
    .optional(),
  departureCity: z.string().optional().default('toshkent'),
});

module.exports = { plannerSchema };
