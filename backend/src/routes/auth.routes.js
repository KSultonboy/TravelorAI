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
  deleteAccount,
} = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
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
} = require('../schemas/auth.schema');

router.post('/register', validate(registerSchema), register);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', forgotPasswordLimiter, validate(resendVerificationSchema), resendVerification);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/google', validate(googleAuthSchema), googleAuth);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, validate(profileSchema), updateProfile);
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, validate(preferencesSchema), updatePreferences);
router.delete('/account', authMiddleware, validate(deleteAccountSchema), deleteAccount);

module.exports = router;
