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
  getPreferences,
  updatePreferences,
  requestEmailChange,
  verifyEmailChange,
  requestAccountDeletion,
  deleteAccount,
} = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { authLimiter, securityCodeLimiter } = require('../middleware/rateLimit.middleware');
const { validate } = require('../middleware/validate.middleware');
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

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', securityCodeLimiter, validate(resendVerificationSchema), resendVerification);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/forgot-password', securityCodeLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/google', authLimiter, validate(googleAuthSchema), googleAuth);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, validate(profileSchema), updateProfile);
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, validate(preferencesSchema), updatePreferences);
router.post('/email-change/request', securityCodeLimiter, authMiddleware, validate(requestEmailChangeSchema), requestEmailChange);
router.post('/email-change/verify', securityCodeLimiter, authMiddleware, validate(verifyEmailChangeSchema), verifyEmailChange);
router.post('/account-deletion/request', securityCodeLimiter, authMiddleware, validate(requestAccountDeletionSchema), requestAccountDeletion);
router.delete('/account', securityCodeLimiter, authMiddleware, validate(deleteAccountSchema), deleteAccount);

module.exports = router;
