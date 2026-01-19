const asBool = (value: string | undefined, fallback: boolean) => {
    if (value === undefined) {
        return fallback;
    }
    return value === 'true' || value === '1' || value === 'yes';
};

export type FeatureKey =
    | 'dashboard'
    | 'leadCrm'
    | 'rewards'
    | 'notifications'
    | 'settings'
    | 'community'
    | 'communityAdmin'
    | 'adminDashboard'
    | 'adminCommunity'
    | 'adminSpace'
    | 'adminUsers'
    | 'adminBilling'
    | 'adminMl'
    | 'adminSettings';

export const FEATURE_FLAGS: Record<FeatureKey, boolean> = {
    dashboard: asBool(process.env.EXPO_PUBLIC_FEATURE_DASHBOARD, false),
    leadCrm: asBool(process.env.EXPO_PUBLIC_FEATURE_LEAD_CRM, false),
    rewards: asBool(process.env.EXPO_PUBLIC_FEATURE_REWARDS, false),
    notifications: asBool(process.env.EXPO_PUBLIC_FEATURE_NOTIFICATIONS, false),
    settings: asBool(process.env.EXPO_PUBLIC_FEATURE_SETTINGS, false),
    community: asBool(process.env.EXPO_PUBLIC_FEATURE_COMMUNITY, true),
    communityAdmin: asBool(process.env.EXPO_PUBLIC_FEATURE_COMMUNITY_ADMIN, false),
    adminDashboard: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_DASHBOARD, true),
    adminCommunity: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_COMMUNITY, true),
    adminSpace: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_SPACE, true),
    adminUsers: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_USERS, true),
    adminBilling: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_BILLING, true),
    adminMl: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_ML, true),
    adminSettings: asBool(process.env.EXPO_PUBLIC_FEATURE_ADMIN_SETTINGS, true),
};

export const isFeatureEnabled = (feature: FeatureKey) => FEATURE_FLAGS[feature] === true;

const normalizePath = (pathname: string) => {
    if (!pathname) {
        return '/';
    }
    const cleaned = pathname.replace(/^\/\([^)]+\)/, '');
    return cleaned === '' ? '/' : cleaned;
};

export const resolveFeatureForPath = (pathname: string): FeatureKey | null => {
    const path = normalizePath(pathname);

    if (path === '/' || path === '/index') {
        return 'community';
    }
    if (path.startsWith('/leads')) {
        return 'leadCrm';
    }
    if (path.startsWith('/rewards')) {
        return 'rewards';
    }
    if (path.startsWith('/notifications')) {
        return 'notifications';
    }
    if (path.startsWith('/settings')) {
        return 'settings';
    }
    if (path.startsWith('/sub-channel')) {
        return 'community';
    }
    if (path.startsWith('/direct-messages')) {
        return 'community';
    }
    if (path.startsWith('/community-admin')) {
        return 'communityAdmin';
    }
    if (path.startsWith('/community')) {
        return 'community';
    }

    if (path === '/admin' || path === '/admin/') {
        return 'adminDashboard';
    }
    if (path.startsWith('/admin/community')) {
        return 'adminCommunity';
    }
    if (path.startsWith('/admin/space')) {
        return 'adminSpace';
    }
    if (path.startsWith('/admin/users')) {
        return 'adminUsers';
    }
    if (path.startsWith('/admin/billing')) {
        return 'adminBilling';
    }
    if (path.startsWith('/admin/ml')) {
        return 'adminMl';
    }
    if (path.startsWith('/admin/settings')) {
        return 'adminSettings';
    }

    return null;
};

export const isPathAllowed = (pathname: string) => {
    const feature = resolveFeatureForPath(pathname);
    if (!feature) {
        return true;
    }
    return isFeatureEnabled(feature);
};

export const getAppHomePath = () => {
    if (isFeatureEnabled('community')) {
        return '/(main)';
    }
    if (isFeatureEnabled('communityAdmin')) {
        return '/(main)';
    }
    if (isFeatureEnabled('adminCommunity')) {
        return '/admin/community';
    }
    if (isFeatureEnabled('adminSpace')) {
        return '/admin/space';
    }
    return '/';
};

export const getAdminHomePath = () => {
    if (isFeatureEnabled('adminDashboard')) {
        return '/admin';
    }
    if (isFeatureEnabled('adminCommunity')) {
        return '/admin/community';
    }
    if (isFeatureEnabled('adminSpace')) {
        return '/admin/space';
    }
    if (isFeatureEnabled('community')) {
        return '/(main)';
    }
    return '/';
};
