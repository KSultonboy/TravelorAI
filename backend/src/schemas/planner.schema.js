const { z } = require('zod');

// Planner so'rovi Gemini promptiga to'liq ketadi — hajm cheklanmasa bitta
// so'rov bilan katta token xarajati qilish mumkin edi.
const MAX_POI_CONTEXT = 200;
const MAX_RECOMMENDED_POI = 30;
const MAX_ANALYSIS_CONTEXT_BYTES = 8 * 1024;

const plannerSchema = z.object({
  budget: z.coerce.number().min(200000, 'Minimum budget 200 000 so\'m'),
  duration: z.coerce.number().int().min(1).max(14),
  travelers: z.coerce.number().int().min(1).max(8),
  style: z.enum(['budget', 'mid', 'luxury']),
  interests: z.array(z.string().max(60)).min(1, 'Kamida 1 ta qiziqish tanlang').max(20),
  city: z.string().optional(),
  country: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  companions: z.enum(['solo', 'friends', 'family', 'couple']).optional(),
  comfortLevel: z.enum(['budget', 'mid', 'luxury']).optional(),
  foodPreferences: z.enum(['halal', 'vegetarian', 'vegan', 'none']).optional(),
  transportType: z.enum(['cheap', 'fast', 'comfort']).optional(),
  flexibility: z.enum(['fixed', 'flexible']).optional(),
  analysisContext: z
    .record(z.unknown())
    .optional()
    .nullable()
    .refine((value) => value == null || Buffer.byteLength(JSON.stringify(value)) <= MAX_ANALYSIS_CONTEXT_BYTES, {
      message: `analysisContext ${MAX_ANALYSIS_CONTEXT_BYTES / 1024} KB dan oshmasligi kerak`,
    }),
  recommendedPoiNames: z.array(z.string().max(160)).max(MAX_RECOMMENDED_POI).optional(),
  poiContext: z
    .array(
      z
        .object({
          name: z.string().max(160),
          city: z.string().optional(),
          type: z.string().optional(),
          subtype: z.string().optional(),
          info: z.string().max(1000).optional(),
          description: z.string().max(1000).optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          price: z.number().optional(),
          rating: z.number().optional(),
        })
        .passthrough()
    )
    .max(MAX_POI_CONTEXT, `poiContext ko'pi bilan ${MAX_POI_CONTEXT} ta joy bo'lishi mumkin`)
    .optional(),
  departureCity: z.string().optional().default('toshkent'),
});

module.exports = { plannerSchema, MAX_POI_CONTEXT, MAX_RECOMMENDED_POI, MAX_ANALYSIS_CONTEXT_BYTES };
