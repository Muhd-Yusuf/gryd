const { verifyEmbedToken } = require('../utils/tokenUtils');

const attachEmbedContext = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.replace('Bearer ', '').trim();
    try {
        const decoded = verifyEmbedToken(token);
        req.embed = decoded;
    } catch (error) {
        // Token is not a valid embed token - that's OK, it might be a regular auth token
        // Just continue without setting req.embed
    }
    return next();
};

module.exports = {
    attachEmbedContext,
};
