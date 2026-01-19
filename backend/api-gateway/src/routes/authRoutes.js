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
} = require('../controllers/authController');
const { attachUserContext } = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/login-with-role', loginWithRole);
router.get('/me', attachUserContext, getMe);
router.put('/password', attachUserContext, setPassword);

// Member signup with invite code
router.get('/validate-code/:code', validateInviteCode);
router.post('/signup-with-code', signupWithCode);

// Super admin signup (requires secret key)
router.post('/signup-super-admin', signupSuperAdmin);

module.exports = router;
