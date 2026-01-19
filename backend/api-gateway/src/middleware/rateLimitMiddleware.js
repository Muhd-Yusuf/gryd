/**
 * Rate Limiting Middleware
 * In-memory rate limiter for upload endpoints
 * For production, consider using Redis for distributed rate limiting
 */

// In-memory store for rate limiting
const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (data.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * @param {Object} options Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.maxRequests - Maximum requests per window (default: 100)
 * @param {string} options.keyPrefix - Prefix for rate limit key (default: 'rl')
 * @param {string} options.message - Error message when rate limited
 * @returns {Function} Express middleware
 */
const createRateLimiter = ({
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    keyPrefix = 'rl',
    message = 'Too many requests, please try again later',
} = {}) => {
    return (req, res, next) => {
        // Use user ID if authenticated, otherwise use IP
        const identifier = req.user?._id?.toString() || req.ip || 'anonymous';
        const key = `${keyPrefix}:${identifier}`;
        const now = Date.now();

        let rateLimitData = rateLimitStore.get(key);

        if (!rateLimitData || rateLimitData.resetTime < now) {
            // Create new window
            rateLimitData = {
                count: 1,
                resetTime: now + windowMs,
            };
            rateLimitStore.set(key, rateLimitData);
        } else {
            rateLimitData.count++;
        }

        // Set rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - rateLimitData.count),
            'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000),
        });

        if (rateLimitData.count > maxRequests) {
            return res.status(429).json({
                success: false,
                error: message,
                retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000),
            });
        }

        next();
    };
};

// Pre-configured rate limiters for different use cases

/**
 * General upload rate limiter
 * 20 uploads per 15 minutes per user
 */
const uploadRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    keyPrefix: 'upload',
    message: 'Upload limit exceeded. Please wait before uploading more files.',
});

/**
 * Avatar upload rate limiter
 * 20 avatar uploads per 15 minutes per user (more lenient for development)
 */
const avatarRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    keyPrefix: 'avatar',
    message: 'Avatar upload limit exceeded. Please wait before changing your avatar again.',
});

/**
 * Voice note rate limiter
 * 30 voice notes per 15 minutes per user
 */
const voiceNoteRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30,
    keyPrefix: 'voice',
    message: 'Voice note limit exceeded. Please wait before sending more voice notes.',
});

/**
 * Signature/presigned URL rate limiter
 * 50 requests per 15 minutes per user
 */
const signatureRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
    keyPrefix: 'signature',
    message: 'Too many signature requests. Please wait before requesting more.',
});

/**
 * Clear rate limit store (for development/testing)
 * @param {string} prefix - Optional prefix to clear specific rate limits (e.g., 'avatar')
 */
const clearRateLimitStore = (prefix) => {
    if (prefix) {
        for (const key of rateLimitStore.keys()) {
            if (key.startsWith(prefix)) {
                rateLimitStore.delete(key);
            }
        }
    } else {
        rateLimitStore.clear();
    }
};

module.exports = {
    createRateLimiter,
    uploadRateLimiter,
    avatarRateLimiter,
    voiceNoteRateLimiter,
    signatureRateLimiter,
    clearRateLimitStore,
};
