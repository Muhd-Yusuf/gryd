const { isFeatureEnabled } = require('../config/featureFlags');

const featureGuard = (featureKey) => (req, res, next) => {
    if (isFeatureEnabled(featureKey)) {
        return next();
    }
    return res.status(403).json({ message: 'Feature disabled' });
};

module.exports = { featureGuard };
