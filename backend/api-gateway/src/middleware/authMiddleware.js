const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

const attachUserContext = async (req, res, next) => {
    // Try JWT token from Authorization header first
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;
            if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                // Check if token has been revoked (logout)
                if (mongoose.connection.readyState === 1) {
                    const blacklisted = await TokenBlacklist.findOne({ token }).lean();
                    if (blacklisted) {
                        return next(); // Token revoked — treat as unauthenticated
                    }

                    const user = await User.findById(userId);
                    if (user) {
                        req.user = {
                            _id: user._id,
                            id: String(user._id),
                            role: user.role,
                            email: user.email,
                        };
                        return next();
                    }
                }
                // DB unavailable or user not in main DB - use token claims
                req.user = {
                    _id: userId,
                    id: userId,
                    role: decoded.role || 'member',
                    email: 'unknown@local',
                };
                return next();
            }
        } catch (err) {
            // Invalid or expired JWT — proceed as unauthenticated
        }
    }

    // No valid JWT token — continue without authentication
    // Protected routes use requireUser middleware to enforce auth
    return next();
};

const requireUser = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    return next();
};

module.exports = {
    attachUserContext,
    requireUser,
};
