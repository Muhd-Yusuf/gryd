const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Subgrid = require('../models/Subgrid');
const SubgridMembership = require('../models/SubgridMembership');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const { sendOtpEmail, sendStakeholderInviteEmail } = require('../services/emailService');

// In-memory OTP store (in production, use Redis)
// Format: { email: { otp: string, expiresAt: number, attempts: number } }
const otpStore = new Map();
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// In-memory stakeholder invite store (in production, use database or Redis)
// Format: { token: { email, subgridId, stakeholderBadge, expiresAt } }
const stakeholderInviteStore = new Map();

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
    try {
        const { firstName, lastName, email, password, username } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        // Check if username is taken (if provided)
        if (username) {
            const existingUsername = await User.findOne({ username: username.toLowerCase() });
            if (existingUsername) {
                return res.status(400).json({ message: 'This username is already taken' });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            firstName,
            lastName,
            username: username ? username.toLowerCase() : null,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'member',
        });

        // Generate simple token (in production, use JWT)
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            token,
        });
    } catch (error) {
        console.error('[auth/signup] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check if user has a password set
        if (!user.password) {
            return res.status(401).json({ message: 'Please set up your password first' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
            token,
        });
    } catch (error) {
        console.error('[auth/login] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('[auth/me] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Set password for user (for users who signed up via OAuth)
// @route   PUT /api/auth/password
// @access  Private
exports.setPassword = async (req, res) => {
    try {
        const { password, currentPassword } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const user = await User.findById(req.user?.id || req.body.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user already has a password, verify current password
        if (user.password && currentPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        console.error('[auth/password] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Validate an invite code
// @route   GET /api/auth/validate-code/:code
// @access  Public
exports.validateInviteCode = async (req, res) => {
    try {
        const { code } = req.params;

        if (!code || code.length < 4) {
            return res.status(400).json({ message: 'Invalid invite code' });
        }

        const subgrid = await Subgrid.findOne({
            inviteCode: code.toUpperCase(),
            status: 'active',
        }).populate('tenantId');

        if (!subgrid) {
            return res.status(404).json({ message: 'Invalid or expired invite code' });
        }

        // Get member count for this subgrid
        const memberCount = await SubgridMembership.countDocuments({
            subgridId: subgrid._id,
            status: 'active',
        });

        // Get online member count (members active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineCount = await SubgridMembership.countDocuments({
            subgridId: subgrid._id,
            status: 'active',
            lastActiveAt: { $gte: fiveMinutesAgo },
        });

        return res.status(200).json({
            success: true,
            data: {
                subgridId: subgrid._id,
                subgridName: subgrid.name,
                clientName: subgrid.clientName,
                description: subgrid.description || '',
                logoUrl: subgrid.logoUrl || '',
                coverImageUrl: subgrid.coverImageUrl || '',
                memberCount: memberCount || 0,
                onlineCount: onlineCount || 0,
            },
        });
    } catch (error) {
        console.error('[auth/validate-code] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Register a new member using invite code
// @route   POST /api/auth/signup-with-code
// @access  Public
exports.signupWithCode = async (req, res) => {
    try {
        const { firstName, lastName, email, password, inviteCode, username } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!inviteCode) {
            return res.status(400).json({ message: 'Invite code is required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Validate invite code
        const subgrid = await Subgrid.findOne({
            inviteCode: inviteCode.toUpperCase(),
            status: 'active',
        }).populate('tenantId');

        if (!subgrid) {
            return res.status(400).json({ message: 'Invalid or expired invite code' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        // Check if username is taken (if provided)
        if (username) {
            const existingUsername = await User.findOne({ username: username.toLowerCase() });
            if (existingUsername) {
                return res.status(400).json({ message: 'This username is already taken' });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user as member
        const user = await User.create({
            firstName,
            lastName,
            username: username ? username.toLowerCase() : null,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'member',
            defaultTenantId: subgrid.tenantId?._id,
        });

        // Add user to tenant membership
        if (subgrid.tenantId) {
            await TenantMembership.create({
                tenantId: subgrid.tenantId._id,
                userId: user._id,
                role: 'member',
            });
        }

        // Add user to subgrid membership
        await SubgridMembership.create({
            tenantId: subgrid.tenantId?._id,
            subgridId: subgrid._id,
            userId: user._id,
            role: 'member',
        });

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                subgrid: {
                    _id: subgrid._id,
                    name: subgrid.name,
                    clientName: subgrid.clientName,
                },
            },
            token,
            message: `Welcome! You have joined ${subgrid.name}`,
        });
    } catch (error) {
        console.error('[auth/signup-with-code] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Login and check user role for routing
// @route   POST /api/auth/login-with-role
// @access  Public
exports.loginWithRole = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Check if MongoDB is connected before attempting database operation
        if (mongoose.connection.readyState !== 1) {
            console.error('[auth/login-with-role] MongoDB not connected. readyState:', mongoose.connection.readyState);
            return res.status(503).json({
                message: 'Database unavailable. Please try again in a moment.',
                code: 'DB_UNAVAILABLE'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check if user has a password set
        if (!user.password) {
            return res.status(401).json({ message: 'Please set up your password first' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Get user's memberships to determine routing
        let subgridMembership = null;
        let redirectTo = '/(main)';

        if (user.role === 'super_admin') {
            redirectTo = '/admin';
        } else if (user.role === 'admin') {
            // Check if user is a CU admin (subgrid_admin)
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
                role: 'subgrid_admin',
            }).populate('subgridId');

            if (subgridMembership) {
                redirectTo = '/community/admin';
            } else {
                // System admin (Team Member)
                redirectTo = '/admin';
            }
        } else if (user.role === 'stakeholder') {
            // Stakeholder - same dashboard as members but web-focused
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
                role: 'stakeholder',
            }).populate('subgridId');
        } else {
            // Regular member
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
            }).populate('subgridId');
        }

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                stakeholderBadge: user.stakeholderBadge,
                avatarUrl: user.avatarUrl,
                subgrid: subgridMembership?.subgridId ? {
                    _id: subgridMembership.subgridId._id,
                    name: subgridMembership.subgridId.name,
                    role: subgridMembership.role,
                } : null,
            },
            token,
            redirectTo,
        });
    } catch (error) {
        console.error('[auth/login-with-role] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Register a new super admin
// @route   POST /api/auth/signup-super-admin
// @access  Public (with secret key)
exports.signupSuperAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, password, secretKey } = req.body;

        // Verify secret key for super admin creation
        const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || 'GRYD_SUPER_ADMIN_2024';
        if (secretKey !== SUPER_ADMIN_SECRET) {
            return res.status(403).json({ message: 'Invalid secret key' });
        }

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create super admin user
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'super_admin',
        });

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
            token,
            redirectTo: '/admin',
            message: 'Super admin account created successfully',
        });
    } catch (error) {
        console.error('[auth/signup-super-admin] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Send OTP to email
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res) => {
    try {
        const { email, purpose } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

        // Store OTP
        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            attempts: 0,
        });

        // Log OTP for development
        console.log(`[OTP] Code for ${normalizedEmail}: ${otp}`);

        // Send email via Brevo
        try {
            await sendOtpEmail({
                email: normalizedEmail,
                otp,
                purpose: purpose || 'signup',
            });
        } catch (emailError) {
            console.warn('[auth/send-otp] Email send failed:', emailError.message);
            // Continue anyway - OTP is stored and logged for development
        }

        return res.status(200).json({
            success: true,
            message: 'Verification code sent to your email',
        });
    } catch (error) {
        console.error('[auth/send-otp] Error:', error);
        res.status(500).json({ message: 'Failed to send verification code', error: error.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const storedData = otpStore.get(normalizedEmail);

        if (!storedData) {
            return res.status(400).json({ message: 'No verification code found. Please request a new one.' });
        }

        // Check if expired
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(normalizedEmail);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        // Check attempts
        if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
            otpStore.delete(normalizedEmail);
            return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
        }

        // Verify OTP
        if (storedData.otp !== otp) {
            storedData.attempts += 1;
            otpStore.set(normalizedEmail, storedData);
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // OTP is valid - delete it from store
        otpStore.delete(normalizedEmail);

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            verified: true,
        });
    } catch (error) {
        console.error('[auth/verify-otp] Error:', error);
        res.status(500).json({ message: 'Failed to verify code', error: error.message });
    }
};

// @desc    Register a new member using invite code (passwordless - OTP based)
// @route   POST /api/auth/signup-member
// @access  Public
exports.signupMember = async (req, res) => {
    try {
        const { firstName, lastName, email, username, inviteCode, avatarUrl } = req.body;

        if (!firstName || !lastName || !email) {
            return res.status(400).json({ message: 'First name, last name, and email are required' });
        }

        if (!inviteCode) {
            return res.status(400).json({ message: 'Invite code is required' });
        }

        // Validate invite code
        const subgrid = await Subgrid.findOne({
            inviteCode: inviteCode.toUpperCase(),
            status: 'active',
        }).populate('tenantId');

        if (!subgrid) {
            return res.status(400).json({ message: 'Invalid or expired invite code' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        // Check if username is taken (if provided)
        if (username) {
            const existingUsername = await User.findOne({ username: username.toLowerCase() });
            if (existingUsername) {
                return res.status(400).json({ message: 'This username is already taken' });
            }
        }

        // Create user as member (no password - OTP based auth)
        const user = await User.create({
            firstName,
            lastName,
            username: username ? username.toLowerCase() : null,
            email: normalizedEmail,
            avatarUrl: avatarUrl || null,
            role: 'member',
            defaultTenantId: subgrid.tenantId?._id,
        });

        // Add user to tenant membership
        if (subgrid.tenantId) {
            await TenantMembership.create({
                tenantId: subgrid.tenantId._id,
                userId: user._id,
                role: 'member',
            });
        }

        // Add user to subgrid membership
        await SubgridMembership.create({
            tenantId: subgrid.tenantId?._id,
            subgridId: subgrid._id,
            userId: user._id,
            role: 'member',
        });

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
                tenantId: subgrid.tenantId?._id,
                subgrid: {
                    _id: subgrid._id,
                    name: subgrid.name,
                    clientName: subgrid.clientName,
                },
            },
            token,
            message: `Welcome! You have joined ${subgrid.name}`,
        });
    } catch (error) {
        console.error('[auth/signup-member] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Login with OTP (send OTP to email)
// @route   POST /api/auth/login-otp-request
// @access  Public
exports.loginOtpRequest = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

        // Store OTP
        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            attempts: 0,
        });

        // Log OTP for development
        console.log(`[OTP Login] Code for ${normalizedEmail}: ${otp}`);

        // Send email via Brevo
        try {
            await sendOtpEmail({
                email: normalizedEmail,
                otp,
                purpose: 'login',
            });
        } catch (emailError) {
            console.warn('[auth/login-otp-request] Email send failed:', emailError.message);
            // Continue anyway - OTP is stored and logged for development
        }

        return res.status(200).json({
            success: true,
            message: 'Verification code sent to your email',
        });
    } catch (error) {
        console.error('[auth/login-otp-request] Error:', error);
        res.status(500).json({ message: 'Failed to send verification code', error: error.message });
    }
};

// @desc    Login with OTP verification
// @route   POST /api/auth/login-otp-verify
// @access  Public
exports.loginOtpVerify = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Verify OTP
        const storedData = otpStore.get(normalizedEmail);

        if (!storedData) {
            return res.status(400).json({ message: 'No verification code found. Please request a new one.' });
        }

        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(normalizedEmail);
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
            otpStore.delete(normalizedEmail);
            return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
        }

        if (storedData.otp !== otp) {
            storedData.attempts += 1;
            otpStore.set(normalizedEmail, storedData);
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // OTP is valid
        otpStore.delete(normalizedEmail);

        // Find user
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's memberships to determine routing
        let subgridMembership = null;
        let redirectTo = '/(main)';

        if (user.role === 'super_admin') {
            redirectTo = '/super-admin';
        } else if (user.role === 'admin') {
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
                role: 'subgrid_admin',
            }).populate('subgridId');

            if (subgridMembership) {
                redirectTo = '/admin';
            }
        } else if (user.role === 'stakeholder') {
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
                role: 'stakeholder',
            }).populate('subgridId');
        } else {
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
            }).populate('subgridId');
        }

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                stakeholderBadge: user.stakeholderBadge,
                avatarUrl: user.avatarUrl,
                subgrid: subgridMembership?.subgridId ? {
                    _id: subgridMembership.subgridId._id,
                    name: subgridMembership.subgridId.name,
                    role: subgridMembership.role,
                } : null,
            },
            token,
            redirectTo,
        });
    } catch (error) {
        console.error('[auth/login-otp-verify] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ===================
// STAKEHOLDER AUTHENTICATION
// ===================

// @desc    Invite a stakeholder via email
// @route   POST /api/auth/invite-stakeholder
// @access  Private (Admin only)
exports.inviteStakeholder = async (req, res) => {
    console.log('[inviteStakeholder] START - Request received at', new Date().toISOString());

    // Set a response timeout to ensure we always respond
    const responseTimeout = setTimeout(() => {
        if (!res.headersSent) {
            console.error('[inviteStakeholder] TIMEOUT - No response sent after 25 seconds');
            res.status(500).json({ message: 'Request timed out' });
        }
    }, 25000);

    try {
        const { email, subgridId, stakeholderBadge } = req.body;
        console.log('[inviteStakeholder] Body:', { email, subgridId, stakeholderBadge });

        if (!email || !subgridId) {
            clearTimeout(responseTimeout);
            return res.status(400).json({ message: 'Email and subgrid ID are required' });
        }

        // Validate badge
        const validBadges = ['stakeholder', 'vendor', 'partner', 'sponsor', 'investor'];
        if (stakeholderBadge && !validBadges.includes(stakeholderBadge)) {
            clearTimeout(responseTimeout);
            return res.status(400).json({ message: 'Invalid stakeholder badge' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        console.log('[inviteStakeholder] Processing email:', normalizedEmail);

        // Skip user existence check entirely - just proceed with sending invite
        // This eliminates the DB query that was causing issues for some requests
        console.log('[inviteStakeholder] Skipping user check, proceeding to send invite...');

        // Get subgrid info
        console.log('[inviteStakeholder] Fetching subgrid...');
        let subgrid;
        try {
            subgrid = await Subgrid.findById(subgridId).populate('tenantId').maxTimeMS(10000);
        } catch (subgridError) {
            console.error('[inviteStakeholder] Subgrid fetch error:', subgridError.message);
            clearTimeout(responseTimeout);
            return res.status(500).json({ message: 'Failed to fetch subgrid info' });
        }

        if (!subgrid) {
            clearTimeout(responseTimeout);
            return res.status(404).json({ message: 'Subgrid not found' });
        }
        console.log('[inviteStakeholder] Subgrid found:', subgrid.name);

        // Get inviter info - use a default if it fails
        let inviterName = 'The Team';
        if (req.user?.id) {
            console.log('[inviteStakeholder] Fetching inviter info...');
            try {
                const inviter = await User.findById(req.user.id).maxTimeMS(5000);
                if (inviter) {
                    inviterName = `${inviter.firstName} ${inviter.lastName}`;
                }
            } catch (inviterError) {
                console.warn('[inviteStakeholder] Failed to fetch inviter, using default:', inviterError.message);
            }
        }
        console.log('[inviteStakeholder] Inviter:', inviterName);

        // Generate invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

        // Store invite
        stakeholderInviteStore.set(inviteToken, {
            email: normalizedEmail,
            subgridId: subgrid._id.toString(),
            tenantId: subgrid.tenantId?._id.toString(),
            stakeholderBadge: stakeholderBadge || 'stakeholder',
            expiresAt,
        });

        // Log invite token for development
        console.log(`[Stakeholder Invite] Token for ${normalizedEmail}: ${inviteToken}`);

        // Send invite email via Brevo
        console.log('[inviteStakeholder] Sending email to', normalizedEmail);
        let emailResult = null;
        try {
            emailResult = await sendStakeholderInviteEmail({
                email: normalizedEmail,
                inviteToken,
                subgridId: subgrid._id.toString(),
                subgridName: subgrid.name,
                inviterName,
                stakeholderBadge: stakeholderBadge || 'stakeholder',
            });
            console.log(`[inviteStakeholder] Email sent successfully to ${normalizedEmail}`, emailResult);
        } catch (emailError) {
            console.error('[inviteStakeholder] Email send failed:', emailError.message);
            // Don't fail the request - the invite is stored and token logged
        }

        console.log('[inviteStakeholder] SUCCESS - Sending response for', normalizedEmail);
        clearTimeout(responseTimeout);
        return res.status(200).json({
            success: true,
            message: `Invitation sent to ${normalizedEmail}`,
            inviteToken, // Include for development/testing
            emailSent: !!emailResult,
        });
    } catch (error) {
        console.error('[inviteStakeholder] CATCH Error:', error.message, error.stack);
        clearTimeout(responseTimeout);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to send invitation', error: error.message });
        }
    }
};

// @desc    Validate stakeholder invite token
// @route   GET /api/auth/validate-stakeholder-invite/:token
// @access  Public
exports.validateStakeholderInvite = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ message: 'Invite token is required' });
        }

        const inviteData = stakeholderInviteStore.get(token);

        if (!inviteData) {
            return res.status(404).json({ message: 'Invalid or expired invitation' });
        }

        if (Date.now() > inviteData.expiresAt) {
            stakeholderInviteStore.delete(token);
            return res.status(400).json({ message: 'Invitation has expired' });
        }

        // Get subgrid info
        const subgrid = await Subgrid.findById(inviteData.subgridId);
        if (!subgrid) {
            return res.status(404).json({ message: 'Server not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                email: inviteData.email,
                subgridId: inviteData.subgridId,
                subgridName: subgrid.name,
                clientName: subgrid.clientName,
                logoUrl: subgrid.logoUrl,
                stakeholderBadge: inviteData.stakeholderBadge,
            },
        });
    } catch (error) {
        console.error('[auth/validate-stakeholder-invite] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Register a stakeholder using invite token
// @route   POST /api/auth/signup-stakeholder
// @access  Public (with valid invite token)
exports.signupStakeholder = async (req, res) => {
    try {
        const { inviteToken, firstName, lastName, email, username, company, avatarUrl, stakeholderBadge } = req.body;

        if (!inviteToken) {
            return res.status(400).json({ message: 'Invite token is required' });
        }

        if (!firstName || !lastName || !email) {
            return res.status(400).json({ message: 'First name, last name, and email are required' });
        }

        // Validate invite token
        const inviteData = stakeholderInviteStore.get(inviteToken);

        if (!inviteData) {
            return res.status(400).json({ message: 'Invalid or expired invitation' });
        }

        if (Date.now() > inviteData.expiresAt) {
            stakeholderInviteStore.delete(inviteToken);
            return res.status(400).json({ message: 'Invitation has expired' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Verify email matches invite
        if (normalizedEmail !== inviteData.email) {
            return res.status(400).json({ message: 'Email does not match invitation' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        // Check if username is taken
        if (username) {
            const existingUsername = await User.findOne({ username: username.toLowerCase() });
            if (existingUsername) {
                return res.status(400).json({ message: 'This username is already taken' });
            }
        }

        // Get subgrid
        const subgrid = await Subgrid.findById(inviteData.subgridId).populate('tenantId');
        if (!subgrid) {
            return res.status(404).json({ message: 'Server not found' });
        }

        // Use the badge from request or from invite
        const finalBadge = stakeholderBadge || inviteData.stakeholderBadge || 'stakeholder';

        // Create stakeholder user
        const user = await User.create({
            firstName,
            lastName,
            username: username ? username.toLowerCase() : null,
            email: normalizedEmail,
            company: company || null,
            avatarUrl: avatarUrl || null,
            role: 'stakeholder',
            stakeholderBadge: finalBadge,
            defaultTenantId: subgrid.tenantId?._id,
        });

        // Add user to tenant membership
        if (subgrid.tenantId) {
            await TenantMembership.create({
                tenantId: subgrid.tenantId._id,
                userId: user._id,
                role: 'stakeholder',
            });
        }

        // Add user to subgrid membership
        await SubgridMembership.create({
            tenantId: subgrid.tenantId?._id,
            subgridId: subgrid._id,
            userId: user._id,
            role: 'stakeholder',
        });

        // Delete used invite
        stakeholderInviteStore.delete(inviteToken);

        // Generate token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(201).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                stakeholderBadge: user.stakeholderBadge,
                company: user.company,
                avatarUrl: user.avatarUrl,
                tenantId: subgrid.tenantId?._id,
                subgrid: {
                    _id: subgrid._id,
                    name: subgrid.name,
                    clientName: subgrid.clientName,
                },
            },
            token,
            message: `Welcome! You have joined ${subgrid.name} as a ${finalBadge}`,
        });
    } catch (error) {
        console.error('[auth/signup-stakeholder] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Validate CU Admin setup token
// @route   GET /api/auth/validate-setup/:token
// @access  Public
exports.validateSetupToken = async (req, res) => {
    try {
        const { token } = req.params;
        const { tenant: tenantId } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Setup token is required' });
        }

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID is required' });
        }

        // Find user with this setup token
        const user = await User.findOne({
            setupToken: token,
            setupTokenExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(404).json({ message: 'Invalid or expired setup link' });
        }

        // Get tenant info
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        // Get subgrid for this tenant
        const subgrid = await Subgrid.findOne({ tenantId: tenant._id });

        return res.status(200).json({
            success: true,
            data: {
                email: user.email,
                customerName: tenant.name,
                tenantId: tenant._id,
                subgridId: subgrid?._id || null,
                subgridName: subgrid?.name || tenant.name,
                logoUrl: subgrid?.logoUrl || '',
            },
        });
    } catch (error) {
        console.error('[auth/validate-setup] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Complete CU Admin account setup
// @route   POST /api/auth/complete-setup
// @access  Public (with valid setup token)
exports.completeSetup = async (req, res) => {
    try {
        const {
            setupToken,
            tenantId,
            firstName,
            lastName,
            username,
            avatarUrl,
            // Server customization fields
            serverName,
            serverDescription,
            serverLogoUrl,
            serverBannerColor,
        } = req.body;

        if (!setupToken || !tenantId) {
            return res.status(400).json({ message: 'Setup token and tenant ID are required' });
        }

        // Find user with this setup token
        const user = await User.findOne({
            setupToken,
            setupTokenExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(404).json({ message: 'Invalid or expired setup link' });
        }

        // Verify tenant exists
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        // Check if username is taken (if provided)
        if (username) {
            const existingUsername = await User.findOne({
                username: username.toLowerCase(),
                _id: { $ne: user._id },
            });
            if (existingUsername) {
                return res.status(400).json({ message: 'This username is already taken' });
            }
        }

        // Update user profile if provided
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (username) {
            user.username = username.toLowerCase();
        }
        if (avatarUrl) {
            user.avatarUrl = avatarUrl;
        }
        // Clear setup token after successful setup
        user.setupToken = null;
        user.setupTokenExpires = null;

        await user.save();

        // Get and update subgrid with server customization
        let subgrid = await Subgrid.findOne({ tenantId: tenant._id });
        if (subgrid) {
            if (serverName) subgrid.name = serverName;
            if (serverDescription) subgrid.description = serverDescription;
            if (serverLogoUrl) subgrid.logoUrl = serverLogoUrl;
            if (serverBannerColor) subgrid.coverImageUrl = serverBannerColor; // Store banner color in coverImageUrl
            await subgrid.save();
        }

        // Generate auth token
        const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

        return res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
                tenant: {
                    _id: tenant._id,
                    name: tenant.name,
                },
                subgrid: subgrid
                    ? {
                        _id: subgrid._id,
                        name: subgrid.name,
                        clientName: subgrid.clientName,
                        inviteCode: subgrid.inviteCode,
                    }
                    : null,
            },
            token,
            redirectTo: '/admin',
            message: `Welcome! Your account has been set up successfully.`,
        });
    } catch (error) {
        console.error('[auth/complete-setup] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get subgrids/servers the current user has access to
// @route   GET /api/auth/my-subgrids
// @access  Private
exports.getMySubgrids = async (req, res) => {
    try {
        const userId = req.userId || req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        // Find all subgrid memberships for this user
        const memberships = await SubgridMembership.find({ userId })
            .populate('subgridId', 'name clientName logoUrl description')
            .lean();

        // Get subgrid details with member counts
        const subgrids = await Promise.all(
            memberships.map(async (membership) => {
                if (!membership.subgridId) return null;

                const memberCount = await SubgridMembership.countDocuments({
                    subgridId: membership.subgridId._id,
                });

                return {
                    id: membership.subgridId._id,
                    name: membership.subgridId.name,
                    clientName: membership.subgridId.clientName,
                    logoUrl: membership.subgridId.logoUrl,
                    memberCount,
                };
            })
        );

        // Filter out nulls
        const validSubgrids = subgrids.filter(Boolean);

        return res.status(200).json({
            success: true,
            data: {
                subgrids: validSubgrids,
            },
        });
    } catch (error) {
        console.error('[auth/my-subgrids] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
