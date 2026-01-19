const mongoose = require('mongoose');
const User = require('../models/User');

const attachUserContext = async (req, res, next) => {
    // Check for userId in headers first, then query params (for SSE which can't send headers)
    const userId = req.header('x-user-id') || req.query.userId;
    if (!userId) {
        return next();
    }

    try {
        // Validate userId format before querying
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.error('[AuthMiddleware] Invalid ObjectId format:', userId);
            return res.status(401).json({ message: 'Invalid user ID format' });
        }

        // Check if mongoose is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('[AuthMiddleware] MongoDB not connected, using basic context for:', userId);
            req.user = {
                _id: userId,
                id: userId,
                role: req.header('x-user-role') || 'member',
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
            // User not found in main DB - this can happen in multi-tenant setups
            // Create a basic user context with the provided ID
            // This is safe for read-only operations like SSE subscriptions
            console.log('[AuthMiddleware] User not found, using basic context for:', userId);
            req.user = {
                _id: userId,
                id: userId,
                role: req.header('x-user-role') || 'member',
                email: 'unknown@local',
            };
        }
        return next();
    } catch (error) {
        console.error('[AuthMiddleware] Error resolving user context:', error.message, 'userId:', userId);
        // On error, still allow with basic context rather than failing
        req.user = {
            _id: userId,
            id: userId,
            role: req.header('x-user-role') || 'member',
            email: 'error@local',
        };
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
