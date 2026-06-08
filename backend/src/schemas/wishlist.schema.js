const { z } = require('zod');

const createWishlistItemSchema = z.object({
  poiId: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1, 'Nomi talab qilinadi').max(120, 'Nomi juda uzun'),
  city: z.string().trim().min(1, 'Shahar talab qilinadi').max(120, 'Shahar juda uzun'),
  slug: z.string().trim().min(1, 'Slug talab qilinadi').max(120, 'Slug juda uzun'),
  type: z.string().trim().min(1, 'Type talab qilinadi').max(64, 'Type juda uzun'),
  icon: z.string().trim().min(1, 'Icon talab qilinadi').max(32, 'Icon juda uzun'),
});

module.exports = {
  createWishlistItemSchema,
};
