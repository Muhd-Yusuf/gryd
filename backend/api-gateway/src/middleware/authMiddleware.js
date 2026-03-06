const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const attachUserContext = async (req, res, next) => {
    // Try JWT token from Authorization header first
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;
            if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                if (mongoose.connection.readyState === 1) {
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
            // Invalid token - fall through to legacy x-user-id header
        }
    }

    // Legacy fallback: x-user-id header (for backward compatibility during migration)
    // TODO: Remove this fallback once all clients send JWT tokens
    const userId = req.header('x-user-id') || req.query.userId;
    if (!userId) {
        return next();
    }

    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.error('[AuthMiddleware] Invalid ObjectId format:', userId);
            return res.status(401).json({ message: 'Invalid user ID format' });
        }

        if (mongoose.connection.readyState !== 1) {
            req.user = {
                _id: userId,
                id: userId,
                role: 'member',
                email: 'unknown@local',
            };
            return next();
        }

        const user = await User.findById(userId);
        if (user) {
            req.user = {
                _id: user._id,
                id: String(user._id),
                role: user.role,
                email: user.email,
            };
        } else {
            req.user = {
                _id: userId,
                id: userId,
                role: 'member',
                email: 'unknown@local',
            };
        }
        return next();
    } catch (error) {
        console.error('[AuthMiddleware] Error resolving user context:', error.message);
        return next();
    }
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
