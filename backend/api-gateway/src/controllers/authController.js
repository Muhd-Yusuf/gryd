const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Subgrid = require('../models/Subgrid');
const SubgridMembership = require('../models/SubgridMembership');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');

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

        return res.status(200).json({
            success: true,
            data: {
                subgridId: subgrid._id,
                subgridName: subgrid.name,
                clientName: subgrid.clientName,
                logoUrl: subgrid.logoUrl,
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
            redirectTo = '/super-admin';
        } else if (user.role === 'admin') {
            // Check if user is a CU admin (subgrid_admin)
            subgridMembership = await SubgridMembership.findOne({
                userId: user._id,
                role: 'subgrid_admin',
            }).populate('subgridId');

            if (subgridMembership) {
                redirectTo = '/admin';
            }
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
            redirectTo: '/super-admin',
            message: 'Super admin account created successfully',
        });
    } catch (error) {
        console.error('[auth/signup-super-admin] Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
