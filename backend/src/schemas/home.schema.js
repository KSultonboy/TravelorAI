const { z } = require('zod');

const INTERACTION_EVENT_TYPES = [
  'view', 'click', 'search', 'open', 'direction_click', 'wishlist_add',
  'trip_add', 'booking_click', 'agency_click', 'story_view',
];
const MAX_METADATA_BYTES = 2048;

const shortText = (max) => z.string().trim().max(max);

// POST /home/interactions — landing reytingiga ta'sir qiladi, shuning uchun
// tur, nishon va qo'shimcha ma'lumot hajmi qat'iy tekshiriladi.
const interactionSchema = z.object({
  entityType: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['place', 'poi', 'destination', 'agency', 'story'])
  ),
  entityId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'entityId noto‘g‘ri'),
  eventType: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(INTERACTION_EVENT_TYPES)
  ),
  sessionId: shortText(120).optional().nullable(),
  userId: shortText(120).optional().nullable(),
  source: shortText(80).optional().nullable(),
  metadata: z
    .record(z.unknown())
    .optional()
    .nullable()
    .refine((value) => value == null || Buffer.byteLength(JSON.stringify(value)) <= MAX_METADATA_BYTES, {
      message: `metadata ${MAX_METADATA_BYTES} baytdan oshmasligi kerak`,
    }),
});

module.exports = { interactionSchema, INTERACTION_EVENT_TYPES, MAX_METADATA_BYTES };
