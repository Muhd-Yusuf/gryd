const express = require('express');
const router = express.Router();
const {
    signup,
    login,
    getMe,
    setPassword,
    validateInviteCode,
    signupWithCode,
    loginWithRole,
    signupSuperAdmin,
    sendOtp,
    verifyOtp,
    signupMember,
    loginOtpRequest,
    loginOtpVerify,
    inviteStakeholder,
    validateStakeholderInvite,
    signupStakeholder,
    getMySubgrids,
    validateSetupToken,
    completeSetup,
    logout,
} = require('../controllers/authController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');

// Rate limiters for auth endpoints
const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    keyPrefix: 'auth',
    message: 'Too many authentication attempts. Please try again later.',
});

const otpRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'otp',
    message: 'Too many OTP requests. Please try again later.',
});

const strictRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyPrefix: 'strict',
    message: 'Too many attempts. Please try again later.',
});

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/login-with-role', authRateLimiter, loginWithRole);
router.post('/logout', attachUserContext, logout);
router.get('/me', attachUserContext, getMe);
router.put('/password', attachUserContext, setPassword);

// Member signup with invite code (password-based - legacy)
router.get('/validate-code/:code', validateInviteCode);
router.post('/signup-with-code', authRateLimiter, signupWithCode);

// OTP-based authentication
router.post('/send-otp', otpRateLimiter, sendOtp);
router.post('/verify-otp', otpRateLimiter, verifyOtp);

// Member signup with OTP (passwordless)
router.post('/signup-member', authRateLimiter, signupMember);

// OTP-based login
router.post('/login-otp-request', otpRateLimiter, loginOtpRequest);
router.post('/login-otp-verify', otpRateLimiter, loginOtpVerify);

// Stakeholder invite & signup
router.post('/invite-stakeholder', attachUserContext, inviteStakeholder);
router.get('/validate-stakeholder-invite/:token', validateStakeholderInvite);
router.post('/signup-stakeholder', authRateLimiter, signupStakeholder);

// CU Admin setup (from Super Admin invite)
router.get('/validate-setup/:token', validateSetupToken);
router.post('/complete-setup', completeSetup);

// Get user's subgrids/servers
router.get('/my-subgrids', attachUserContext, requireUser, getMySubgrids);

// Super admin signup (requires secret key — strict rate limit)
router.post('/signup-super-admin', strictRateLimiter, signupSuperAdmin);

module.exports = router;
