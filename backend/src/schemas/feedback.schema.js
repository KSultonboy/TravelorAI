const { z } = require('zod');

const feedbackCategoryEnum = z.enum(['suggestion', 'complaint', 'bug', 'feature', 'other']);

const createFeedbackSchema = z.object({
  category: feedbackCategoryEnum.default('suggestion'),
  subject: z.string().trim().max(120, 'Sarlavha 120 belgidan oshmasin').optional().nullable(),
  message: z.string().trim().min(8, 'Xabar kamida 8 belgi bo\'lsin').max(2000, 'Xabar juda uzun'),
  contactEmail: z.string().trim().email('Email noto\'g\'ri').optional().nullable(),
  platform: z.string().trim().max(50, 'Platform qiymati juda uzun').optional().nullable(),
  appVersion: z.string().trim().max(50, 'Versiya qiymati juda uzun').optional().nullable(),
});

module.exports = {
  createFeedbackSchema,
};
