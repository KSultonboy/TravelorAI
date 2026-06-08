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

router.post('/register', validate(registerSchema), register);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', validate(resendVerificationSchema), resendVerification);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/google', validate(googleAuthSchema), googleAuth);
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, validate(profileSchema), updateProfile);
router.get('/preferences', authMiddleware, getPreferences);
router.put('/preferences', authMiddleware, validate(preferencesSchema), updatePreferences);
router.post('/email-change/request', authMiddleware, validate(requestEmailChangeSchema), requestEmailChange);
router.post('/email-change/verify', authMiddleware, validate(verifyEmailChangeSchema), verifyEmailChange);
router.post('/account-deletion/request', authMiddleware, validate(requestAccountDeletionSchema), requestAccountDeletion);
router.delete('/account', authMiddleware, validate(deleteAccountSchema), deleteAccount);

module.exports = router;
