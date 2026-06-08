const { z } = require('zod');

const createTripReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Reyting 1 dan kichik bo'lmasin").max(5, "Reyting 5 dan katta bo'lmasin"),
  comment: z.string().trim().min(8, "Izoh kamida 8 belgi bo'lsin").max(420, "Izoh 420 belgidan oshmasin"),
});

module.exports = {
  createTripReviewSchema,
};
