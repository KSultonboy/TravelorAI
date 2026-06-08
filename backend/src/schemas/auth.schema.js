const { z } = require('zod');

const emailSchema = z.string().trim().toLowerCase().email('Email noto\'g\'ri');
const codeSchema = z.string().trim().regex(/^\d{6}$/, 'Kod 6 xonali bo\'lishi kerak');
const avatarSchema = z
  .string()
  .trim()
  .max(2_500_000, 'Avatar rasmi juda katta')
  .refine(
    (value) => value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://'),
    'Avatar rasmi noto\'g\'ri formatda'
  );

const registerSchema = z.object({
  name: z.string().min(2, 'Ism kamida 2 harf'),
  email: emailSchema,
  password: z.string().min(8, 'Parol kamida 8 ta belgi'),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Parol talab qilinadi'),
});

const verifyEmailSchema = z.object({
  email: emailSchema,
  code: codeSchema,
});

const resendVerificationSchema = z.object({
  email: emailSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  newPassword: z.string().min(8, 'Parol kamida 8 ta belgi'),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google token talab qilinadi'),
});

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Ism kamida 2 harf').max(50, 'Ism juda uzun'),
  lastName: z.string().trim().max(50, 'Familiya juda uzun').optional().nullable(),
  bio: z.string().trim().max(160, 'Bio 160 belgidan oshmasin').optional().nullable(),
  avatarUrl: avatarSchema.optional().nullable(),
});

const preferencesSchema = z.object({
  style: z.enum(['budget', 'mid', 'luxury']),
  interests: z.array(z.string().trim().min(1)).min(1, 'Kamida 1 ta qiziqish bo\'lsin').max(20),
});

const deleteAccountSchema = z.object({
  confirm: z.literal(true),
  code: codeSchema,
});

const requestEmailChangeSchema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, 'Parol talab qilinadi').optional(),
});

const verifyEmailChangeSchema = z.object({
  code: codeSchema,
});

const requestAccountDeletionSchema = z.object({
  password: z.string().min(1, 'Parol talab qilinadi').optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
  profileSchema,
  preferencesSchema,
  deleteAccountSchema,
  requestEmailChangeSchema,
  verifyEmailChangeSchema,
  requestAccountDeletionSchema,
};
