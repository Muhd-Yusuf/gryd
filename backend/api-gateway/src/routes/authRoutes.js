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
} = require('../controllers/authController');
const { attachUserContext } = require('../middleware/authMiddleware');
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

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/login-with-role', authRateLimiter, loginWithRole);
router.get('/me', attachUserContext, getMe);
router.put('/password', attachUserContext, setPassword);

// Member signup with invite code (password-based - legacy)
router.get('/validate-code/:code', validateInviteCode);
router.post('/signup-with-code', signupWithCode);

// OTP-based authentication
router.post('/send-otp', otpRateLimiter, sendOtp);
router.post('/verify-otp', otpRateLimiter, verifyOtp);

// Member signup with OTP (passwordless)
router.post('/signup-member', signupMember);

// OTP-based login
router.post('/login-otp-request', otpRateLimiter, loginOtpRequest);
router.post('/login-otp-verify', otpRateLimiter, loginOtpVerify);

// Stakeholder invite & signup
router.post('/invite-stakeholder', (req, res, next) => {
    console.log('[AUTH ROUTE] /invite-stakeholder hit at', new Date().toISOString());
    console.log('[AUTH ROUTE] Headers:', JSON.stringify(req.headers));
    console.log('[AUTH ROUTE] Body:', JSON.stringify(req.body));
    next();
}, attachUserContext, inviteStakeholder);
router.get('/validate-stakeholder-invite/:token', validateStakeholderInvite);
router.post('/signup-stakeholder', signupStakeholder);

// CU Admin setup (from Super Admin invite)
router.get('/validate-setup/:token', validateSetupToken);
router.post('/complete-setup', completeSetup);

// Get user's subgrids/servers
router.get('/my-subgrids', attachUserContext, getMySubgrids);

// Super admin signup (requires secret key)
router.post('/signup-super-admin', signupSuperAdmin);

module.exports = router;
