const router = require('express').Router();
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  googleAuth,
  updateProfile,
  getMe,
  getSession,
  getPreferences,
  updatePreferences,
  requestEmailChange,
  verifyEmailChange,
  requestAccountDeletion,
  deleteAccount,
} = require('../controllers/auth.controller');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createAuthLimiters } = require('../middleware/rateLimit.middleware');
const {
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
} = require('../schemas/auth.schema');

// Har bir ochiq auth endpointi uchun alohida limit (IP + email va faqat IP).
const limit = createAuthLimiters();

router.post('/register', ...limit.register, validate(registerSchema), register);
router.post('/verify-email', ...limit.verifyEmail, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', ...limit.resend, validate(resendVerificationSchema), resendVerification);
router.post('/login', ...limit.login, validate(loginSchema), login);
router.post('/forgot-password', ...limit.forgot, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', ...limit.reset, validate(resetPasswordSchema), resetPassword);
router.post('/google', ...limit.google, validate(googleAuthSchema), googleAuth);
router.get('/me', authMiddleware, getMe);
router.get('/session', optionalAuth, getSession);
router.put('/profile', authMiddleware, validate(profileSchema), updateProfile);
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, validate(preferencesSchema), updatePreferences);
router.post('/email-change/request', authMiddleware, validate(requestEmailChangeSchema), requestEmailChange);
router.post('/email-change/verify', authMiddleware, validate(verifyEmailChangeSchema), verifyEmailChange);
router.post('/account-deletion/request', authMiddleware, validate(requestAccountDeletionSchema), requestAccountDeletion);
router.delete('/account', authMiddleware, validate(deleteAccountSchema), deleteAccount);

module.exports = router;
