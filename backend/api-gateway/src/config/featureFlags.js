const asBool = (value, fallback) => {
    if (value === undefined) {
        return fallback;
    }
    return value === 'true' || value === '1' || value === 'yes';
};

const FEATURE_FLAGS = {
    community: asBool(process.env.FEATURE_COMMUNITY, true),
    crm: asBool(process.env.FEATURE_CRM, false),
    calendar: asBool(process.env.FEATURE_CALENDAR, false),
    billing: asBool(process.env.FEATURE_BILLING, false),
    admin: asBool(process.env.FEATURE_ADMIN, true),
};

const isFeatureEnabled = (key) => FEATURE_FLAGS[key] === true;

module.exports = {
    FEATURE_FLAGS,
    isFeatureEnabled,
};
