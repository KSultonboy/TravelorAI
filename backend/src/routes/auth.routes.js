const router = require('express').Router();
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  forgotPassword,
  resetPassword,
  googleAuth,
  adminLogin,
  adminLoginVerify,
  updateProfile,
  getMe,
  getSession,
  getPreferences,
  updatePreferences,
  requestEmailChange,
  verifyEmailChange,
  requestAccountDeletion,
  deleteAccount,
  savePushToken,
} = require('../controllers/auth.controller');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { forgotPasswordLimiter } = require('../middleware/rateLimit.middleware');
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

router.post('/register', validate(registerSchema), register);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', forgotPasswordLimiter, validate(resendVerificationSchema), resendVerification);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/google', validate(googleAuthSchema), googleAuth);
router.post('/admin/login', adminLogin);
router.post('/admin/login/verify', adminLoginVerify);
router.get('/me', authMiddleware, getMe);
router.get('/session', optionalAuth, getSession);
router.put('/profile', authMiddleware, validate(profileSchema), updateProfile);
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, validate(preferencesSchema), updatePreferences);
router.post('/email-change/request', authMiddleware, validate(requestEmailChangeSchema), requestEmailChange);
router.post('/email-change/verify', authMiddleware, validate(verifyEmailChangeSchema), verifyEmailChange);
router.post('/account-deletion/request', authMiddleware, validate(requestAccountDeletionSchema), requestAccountDeletion);
router.post('/push-token', authMiddleware, savePushToken);
router.delete('/account', authMiddleware, validate(deleteAccountSchema), deleteAccount);

module.exports = router;
