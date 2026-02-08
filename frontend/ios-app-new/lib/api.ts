import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth storage keys
const AUTH_TOKEN_KEY = '@auth_token';
const AUTH_USER_KEY = '@auth_user';

const withApiSuffix = (baseUrl: string) => {
    const trimmed = baseUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const resolveBaseUrl = () => {
    const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
    console.log('[API] Platform:', Platform.OS);
    console.log('[API] EXPO_PUBLIC_API_BASE_URL:', explicit);

    // For native apps (iOS/Android), use Expo's hostUri to get the dev machine's IP
    // This is necessary because "localhost" on mobile refers to the phone, not your computer
    if (Platform.OS !== 'web') {
        const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
        console.log('[API] hostUri:', hostUri);
        if (hostUri) {
            const host = String(hostUri).split(':')[0];
            if (host && host !== 'localhost') {
                // Use the same host IP but port 4000 for backend
                const url = `http://${host}:4000/api`;
                console.log('[API] Using hostUri-based URL for native:', url);
                return url;
            }
        }
        // Fallback for native when hostUri not available
        if (explicit) {
            // Replace localhost with 10.0.2.2 for Android emulator or keep for iOS simulator
            const url = withApiSuffix(explicit);
            console.log('[API] Using explicit URL for native:', url);
            return url;
        }
    }

    // For web, use explicit env var or window.location.origin
    if (Platform.OS === 'web') {
        if (explicit) {
            const url = withApiSuffix(explicit);
            console.log('[API] Using explicit URL for web:', url);
            return url;
        }
        if (typeof window !== 'undefined') {
            const url = withApiSuffix(window.location.origin);
            console.log('[API] Using window.location.origin:', url);
            return url;
        }
    }

    console.log('[API] Using fallback localhost:4000/api');
    return 'http://localhost:4000/api';
};

let API_BASE_URL = resolveBaseUrl();
const USER_ID = process.env.EXPO_PUBLIC_USER_ID || '';
const USER_ROLE = process.env.EXPO_PUBLIC_USER_ROLE || 'member';
const TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID || '';

let resolvedUserId = USER_ID;
let resolvedTenantId = TENANT_ID;
let resolvedUserRole: string = USER_ROLE;
let authToken: string | null = null;
let bootstrapPromise: Promise<void> | null = null;

// ===================
// AUTHENTICATION API
// ===================

export type UserRole = 'member' | 'stakeholder' | 'admin' | 'super_admin';
export type StakeholderBadge = 'stakeholder' | 'vendor' | 'partner' | 'sponsor' | 'investor';

export interface AuthUser {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    stakeholderBadge?: StakeholderBadge;
    company?: string;
    avatarUrl?: string;
    tenantId?: string;
}

// Initialize auth from storage (call on app start)
export const initAuth = async (): Promise<AuthUser | null> => {
    try {
        const [tokenStr, userStr] = await Promise.all([
            AsyncStorage.getItem(AUTH_TOKEN_KEY),
            AsyncStorage.getItem(AUTH_USER_KEY),
        ]);

        if (tokenStr && userStr) {
            authToken = tokenStr;
            const user = JSON.parse(userStr) as AuthUser;
            resolvedUserId = user.userId;
            if (user.tenantId) {
                resolvedTenantId = user.tenantId;
            }
            if (user.role) {
                resolvedUserRole = user.role;
            }
            return user;
        }
    } catch (err) {
        console.error('[Auth] Failed to init auth:', err);
    }
    return null;
};

// Store auth data after login/signup
export const setAuthUser = async (token: string, user: AuthUser): Promise<void> => {
    try {
        await Promise.all([
            AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
            AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)),
        ]);
        authToken = token;
        resolvedUserId = user.userId;
        if (user.tenantId) {
            resolvedTenantId = user.tenantId;
        }
        if (user.role) {
            resolvedUserRole = user.role;
        }
    } catch (err) {
        console.error('[Auth] Failed to store auth:', err);
        throw err;
    }
};

export const updateAuthUser = async (updates: Partial<AuthUser>): Promise<AuthUser | null> => {
    try {
        const userStr = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (!userStr) {
            return null;
        }
        const existing = JSON.parse(userStr) as AuthUser;
        const merged = { ...existing, ...updates };
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(merged));
        if (merged.userId) {
            resolvedUserId = merged.userId;
        }
        return merged;
    } catch (err) {
        console.error('[Auth] Failed to update auth user:', err);
        return null;
    }
};

// Get current auth user
export const getAuthUser = async (): Promise<AuthUser | null> => {
    try {
        const userStr = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (userStr) {
            return JSON.parse(userStr) as AuthUser;
        }
    } catch (err) {
        console.error('[Auth] Failed to get auth user:', err);
    }
    return null;
};

// Get auth token
export const getAuthToken = (): string | null => authToken;

// Get user's role in a subgrid (cached in memory)
let cachedSubgridRoles: Record<string, string> = {};

export const getSubgridRole = async (subgridId: string): Promise<string | null> => {
    if (!subgridId) return null;

    // Return cached role if available
    if (cachedSubgridRoles[subgridId]) {
        return cachedSubgridRoles[subgridId];
    }

    try {
        const response = await safeFetch(`/community/subgrids/${subgridId}/my-role`, {
            method: 'GET',
            headers: buildHeaders({}),
        });
        const data = await parseJson(response);
        if (response.ok && data?.data?.role) {
            cachedSubgridRoles[subgridId] = data.data.role;
            return data.data.role;
        }
    } catch {
        // Ignore errors
    }
    return null;
};

// Check if user is admin of a subgrid
export const isSubgridAdmin = async (subgridId: string): Promise<boolean> => {
    const role = await getSubgridRole(subgridId);
    return role === 'subgrid_admin' || role === 'owner';
};

// Clear cached subgrid roles (call on logout)
export const clearSubgridRoleCache = () => {
    cachedSubgridRoles = {};
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return !!token;
};

// Logout - clear auth data
export const logout = async (): Promise<void> => {
    try {
        await Promise.all([
            AsyncStorage.removeItem(AUTH_TOKEN_KEY),
            AsyncStorage.removeItem(AUTH_USER_KEY),
        ]);
        authToken = null;
        resolvedUserId = USER_ID; // Reset to env user or empty
    } catch (err) {
        console.error('[Auth] Failed to logout:', err);
    }
};

// Auth API calls (don't require bootstrap)
export const authSignup = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}): Promise<{ token: string; user: AuthUser }> => {
    const response = await safeFetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Signup failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
    };
    return { token: result.token, user };
};

export const authLogin = async (data: {
    email: string;
    password: string;
}): Promise<{ token: string; user: AuthUser }> => {
    const response = await safeFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Login failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
    };
    return { token: result.token, user };
};

// Login with role check for routing
export const authLoginWithRole = async (data: {
    email: string;
    password: string;
}): Promise<{ token: string; user: AuthUser; redirectTo: string }> => {
    console.log('[authLoginWithRole] Sending request to /auth/login-with-role');
    const response = await safeFetch('/auth/login-with-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    console.log('[authLoginWithRole] Response status:', response.status, response.ok);
    const result = await parseJson(response);
    console.log('[authLoginWithRole] Parsed result:', JSON.stringify(result));
    if (!response.ok) {
        throw new Error(result?.message || 'Login failed');
    }
    const userData = result?.data;
    if (!userData || !userData.userId) {
        console.error('[authLoginWithRole] Invalid login response - missing data or userId:', result);
        throw new Error(result?.message || 'Invalid response from server');
    }
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
    };
    console.log('[authLoginWithRole] Success, redirectTo:', result.redirectTo);
    return { token: result.token, user, redirectTo: result.redirectTo || '/(main)' };
};

// Validate invite code
export const validateInviteCode = async (code: string): Promise<{
    subgridId: string;
    subgridName: string;
    clientName?: string;
    description?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    memberCount?: number;
    onlineCount?: number;
}> => {
    const response = await safeFetch(`/auth/validate-code/${code}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Invalid invite code');
    }
    return result.data;
};

// Signup with invite code
export const authSignupWithCode = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    inviteCode: string;
}): Promise<{ token: string; user: AuthUser; message: string }> => {
    const response = await safeFetch('/auth/signup-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Signup failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
    };
    return { token: result.token, user, message: result.message };
};

// Super admin signup
export const authSignupSuperAdmin = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    secretKey: string;
}): Promise<{ token: string; user: AuthUser; redirectTo: string; message: string }> => {
    const response = await safeFetch('/auth/signup-super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Signup failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
    };
    return { token: result.token, user, redirectTo: result.redirectTo, message: result.message };
};

// ===================
// OTP-BASED AUTHENTICATION
// ===================

// Send OTP to email (for signup verification)
export const authSendOtp = async (data: { email: string }): Promise<{ message: string }> => {
    const response = await safeFetch('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Failed to send verification code');
    }
    return { message: result.message };
};

// Verify OTP (for signup verification)
export const authVerifyOtp = async (data: { email: string; otp: string }): Promise<{ verified: boolean; message: string }> => {
    const response = await safeFetch('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Invalid verification code');
    }
    return { verified: result.verified, message: result.message };
};

// Signup member with invite code (passwordless - OTP based)
export const authSignupMember = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    inviteCode: string;
    avatarUrl?: string;
}): Promise<{ token: string; user: AuthUser; message: string }> => {
    const response = await safeFetch('/auth/signup-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Signup failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
        tenantId: userData.tenantId,
    };
    return { token: result.token, user, message: result.message };
};

// Request OTP for login
export const authLoginOtpRequest = async (data: { email: string }): Promise<{ message: string }> => {
    const response = await safeFetch('/auth/login-otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Failed to send verification code');
    }
    return { message: result.message };
};

// Verify OTP for login
export const authLoginOtpVerify = async (data: {
    email: string;
    otp: string;
}): Promise<{ token: string; user: AuthUser; redirectTo: string }> => {
    const response = await safeFetch('/auth/login-otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Login failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        stakeholderBadge: userData.stakeholderBadge,
        avatarUrl: userData.avatarUrl,
    };
    return { token: result.token, user, redirectTo: result.redirectTo || '/(main)' };
};

// ===================
// STAKEHOLDER AUTHENTICATION
// ===================

// Validate stakeholder invite token
export const validateStakeholderInvite = async (token: string): Promise<{
    email: string;
    subgridId: string;
    subgridName: string;
    clientName?: string;
    logoUrl?: string;
    stakeholderBadge: StakeholderBadge;
}> => {
    const response = await safeFetch(`/auth/validate-stakeholder-invite/${token}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Invalid or expired invitation');
    }
    return result.data;
};

// Signup stakeholder with invite token
export const authSignupStakeholder = async (data: {
    inviteToken: string;
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    company?: string;
    avatarUrl?: string;
    stakeholderBadge?: StakeholderBadge;
}): Promise<{ token: string; user: AuthUser; message: string }> => {
    const response = await safeFetch('/auth/signup-stakeholder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Signup failed');
    }
    const userData = result?.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        stakeholderBadge: userData.stakeholderBadge,
        company: userData.company,
        avatarUrl: userData.avatarUrl,
        tenantId: userData.tenantId,
    };
    return { token: result.token, user, message: result.message };
};

// Invite a stakeholder (admin only)
export const inviteStakeholder = async (data: {
    email: string;
    subgridId: string;
    stakeholderBadge?: StakeholderBadge;
}): Promise<{ message: string; inviteToken?: string }> => {
    const response = await safeFetch('/auth/invite-stakeholder', {
        method: 'POST',
        headers: buildHeaders({}),
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Failed to send invitation');
    }
    return { message: result.message, inviteToken: result.inviteToken };
};

// ===================
// CU ADMIN SETUP (from Super Admin invite)
// ===================

// Validate CU Admin setup token
export const validateSetupToken = async (
    token: string,
    tenantId: string
): Promise<{
    email: string;
    customerName: string;
    tenantId: string;
    subgridId: string | null;
    subgridName: string;
    logoUrl: string;
}> => {
    const response = await safeFetch(`/auth/validate-setup/${token}?tenant=${tenantId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Invalid or expired setup link');
    }
    return result.data;
};

// Complete CU Admin account setup
export const completeSetup = async (data: {
    setupToken: string;
    tenantId: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    avatarUrl?: string;
    // Server customization
    serverName?: string;
    serverDescription?: string;
    serverLogoUrl?: string;
    serverBannerColor?: string;
}): Promise<{
    token: string;
    user: AuthUser;
    redirectTo: string;
    message: string;
    subgrid?: { _id: string; name: string; inviteCode?: string };
}> => {
    const response = await safeFetch('/auth/complete-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Failed to complete setup');
    }
    const userData = result.data;
    const user: AuthUser = {
        userId: userData.userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        avatarUrl: userData.avatarUrl,
    };
    return {
        token: result.token,
        user,
        redirectTo: result.redirectTo || '/admin',
        message: result.message,
        subgrid: userData.subgrid,
    };
};

// Get subgrids/servers the current user has access to
export const getUserSubgrids = async (): Promise<{
    subgrids: Array<{
        id: string;
        name: string;
        clientName?: string;
        logoUrl?: string;
        memberCount?: number;
    }>;
}> => {
    const response = await safeFetch('/auth/my-subgrids', {
        method: 'GET',
        headers: buildHeaders({}),
    });
    const result = await parseJson(response);
    if (!response.ok) {
        throw new Error(result?.message || 'Failed to fetch servers');
    }
    return { subgrids: result.data?.subgrids || result.subgrids || [] };
};

const buildHeaders = (headers = {}) => {
    const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (authToken) {
        baseHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    const activeUserId = resolvedUserId || USER_ID;
    if (activeUserId) {
        baseHeaders['x-user-id'] = activeUserId;
        baseHeaders['x-user-role'] = resolvedUserRole || USER_ROLE;
    }

    return { ...baseHeaders, ...headers };
};

const parseJson = async (response) => {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const buildCandidateUrls = () => {
    const candidates = [API_BASE_URL];
    const addCandidate = (value?: string) => {
        if (!value) return;
        if (!candidates.includes(value)) {
            candidates.push(value);
        }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        addCandidate(withApiSuffix(window.location.origin));
    }

    addCandidate('http://127.0.0.1:3000/api');
    addCandidate('http://localhost:3000/api');

    return candidates;
};

const safeFetch = async (path, options) => {
    const candidates = buildCandidateUrls();
    let lastError;
    for (const base of candidates) {
        try {
            const response = await fetch(`${base}${path}`, options);
            API_BASE_URL = base;
            return response;
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`Unable to reach API at ${candidates[0]}`);
};

const ensureBootstrap = async () => {
    // Try to init auth from storage if we don't have a user ID yet
    if (!resolvedUserId && !authToken) {
        console.log('[Bootstrap] No user ID or token, initializing auth from storage...');
        await initAuth();
    }

    console.log('[Bootstrap] Current state - userId:', resolvedUserId, 'tenantId:', resolvedTenantId, 'hasToken:', !!authToken);

    // If we have a user ID from auth, we don't need bootstrap
    if (resolvedUserId) {
        // If we still need tenant ID, try to get user's first tenant
        if (!resolvedTenantId) {
            console.log('[Bootstrap] User ID found but no tenant, fetching tenants...');
            try {
                const response = await safeFetch('/community/tenants', {
                    method: 'GET',
                    headers: buildHeaders({}),
                });
                const data = await parseJson(response);
                console.log('[Bootstrap] Tenants response:', response.status, data);
                if (response.ok && data?.data?.length > 0) {
                    resolvedTenantId = data.data[0]._id;
                    console.log('[Bootstrap] Set tenantId from first tenant:', resolvedTenantId);
                }
            } catch (err) {
                console.error('[Bootstrap] Failed to fetch tenants:', err);
                // Ignore - user might not have any tenants yet
            }
        }
        return;
    }

    // Legacy bootstrap for development (when no auth)
    if (bootstrapPromise) {
        return bootstrapPromise;
    }

    bootstrapPromise = (async () => {
        const response = await safeFetch('/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const data = await parseJson(response);
        if (!response.ok) {
            const message = data?.message || 'Bootstrap failed';
            throw new Error(message);
        }
        const payload = data?.data || {};
        if (payload.userId) {
            resolvedUserId = payload.userId;
        }
        if (payload.tenantId) {
            resolvedTenantId = payload.tenantId;
        }
    })();

    try {
        await bootstrapPromise;
    } finally {
        bootstrapPromise = null;
    }
};

export const getTenantId = () => resolvedTenantId || TENANT_ID;
export const getUserId = () => resolvedUserId || USER_ID;
export const getApiBaseUrl = () => API_BASE_URL;
export const resolveTenantId = async () => {
    await ensureBootstrap();
    return resolvedTenantId || TENANT_ID;
};
export const resolveUserId = async () => {
    await ensureBootstrap();
    return resolvedUserId || USER_ID;
};

export const apiFetch = async (path, options: any = {}) => {
    await ensureBootstrap();
    const headers = buildHeaders(options.headers || {});
    console.log('[apiFetch] Request:', options.method || 'GET', path, 'headers:', headers);
    const response = await safeFetch(path, {
        ...options,
        headers,
    });
    const data = await parseJson(response);
    console.log('[apiFetch] Response:', response.status, response.ok, data);
    if (!response.ok) {
        const message = data?.message || 'Request failed';
        console.error('[apiFetch] Error:', message);
        throw new Error(message);
    }
    return data;
};

export const communityGet = (path) => apiFetch(`/community${path}`);
export const communityPost = (path, body) =>
    apiFetch(`/community${path}`, { method: 'POST', body: JSON.stringify(body || {}) });
export const communityPatch = (path, body) =>
    apiFetch(`/community${path}`, { method: 'PATCH', body: JSON.stringify(body || {}) });
export const communityPut = (path, body) =>
    apiFetch(`/community${path}`, { method: 'PUT', body: JSON.stringify(body || {}) });
export const communityDelete = (path) =>
    apiFetch(`/community${path}`, { method: 'DELETE' });

// Update current user profile
export const updateUserProfile = (data: { firstName?: string; lastName?: string; email?: string; username?: string }) =>
    communityPatch('/users/me', data);

// Presence/Online Status Tracking
// In-memory cache for user presence (updated via heartbeat or API polling)
const presenceCache: Map<string, { online: boolean; lastSeen: number }> = new Map();
const PRESENCE_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout for considering user offline

// Update presence for current user
export const updatePresence = async (subgridId: string) => {
    const userId = getUserId();
    if (!userId || !subgridId) return;

    // Update local cache
    presenceCache.set(userId, { online: true, lastSeen: Date.now() });

    // Try to update server presence (endpoint may not exist yet)
    try {
        await communityPost(`/subgrids/${subgridId}/presence`, { online: true });
    } catch {
        // Silently fail if endpoint doesn't exist
    }
};

// Get online status for multiple users
export const getOnlineStatus = async (userIds: string[], subgridId?: string): Promise<Record<string, boolean>> => {
    const result: Record<string, boolean> = {};
    const currentUserId = getUserId();

    // Try to fetch from server first
    if (subgridId) {
        try {
            const response = await communityGet(`/subgrids/${subgridId}/presence?userIds=${userIds.join(',')}`);
            if (response?.data) {
                return response.data;
            }
        } catch {
            // Fall back to local cache if API fails
        }
    }

    // Fall back to local cache or mock status
    const now = Date.now();
    userIds.forEach((userId) => {
        // Current user is always online
        if (userId === currentUserId) {
            result[userId] = true;
            return;
        }

        // Check cache
        const cached = presenceCache.get(userId);
        if (cached && (now - cached.lastSeen) < PRESENCE_TIMEOUT) {
            result[userId] = cached.online;
        } else {
            // Default to offline if not in cache
            result[userId] = false;
        }
    });

    return result;
};

// Set user online status in local cache (called when receiving messages or activity)
export const setUserOnline = (userId: string, online: boolean = true) => {
    presenceCache.set(userId, { online, lastSeen: Date.now() });
};

// ===================
// CUSTOM ROLES API
// ===================

export interface CustomRole {
    _id: string;
    subgridId: string;
    name: string;
    color: string;
    icon?: string;
    displayOrder: number;
    isVisible: boolean;
    canBeMessaged: boolean;
    createdAt: string;
    updatedAt: string;
}

// Get all custom roles for a subgrid
export const getCustomRoles = (subgridId: string) =>
    communityGet(`/subgrids/${subgridId}/roles`);

// Create a new custom role
export const createCustomRole = (subgridId: string, data: {
    name: string;
    color?: string;
    icon?: string;
    displayOrder?: number;
    isVisible?: boolean;
    canBeMessaged?: boolean;
}) => communityPost(`/subgrids/${subgridId}/roles`, data);

// Update a custom role
export const updateCustomRole = (subgridId: string, roleId: string, data: {
    name?: string;
    color?: string;
    icon?: string;
    displayOrder?: number;
    isVisible?: boolean;
    canBeMessaged?: boolean;
}) => communityPatch(`/subgrids/${subgridId}/roles/${roleId}`, data);

// Delete a custom role
export const deleteCustomRole = (subgridId: string, roleId: string) =>
    communityDelete(`/subgrids/${subgridId}/roles/${roleId}`);

// Get members with a specific role
export const getCustomRoleMembers = (subgridId: string, roleId: string) =>
    communityGet(`/subgrids/${subgridId}/roles/${roleId}/members`);

// Assign a custom role to a member
export const assignCustomRole = (subgridId: string, memberId: string, roleId: string | null) =>
    communityPost(`/subgrids/${subgridId}/members/${memberId}/role`, { roleId });

// Remove custom role from a member
export const removeCustomRole = (subgridId: string, memberId: string) =>
    communityDelete(`/subgrids/${subgridId}/members/${memberId}/role`);

// ===================
// MEDIA API
// ===================

export const mediaGet = (path: string) => apiFetch(`/media${path}`);
export const mediaPost = (path: string, body?: any) =>
    apiFetch(`/media${path}`, { method: 'POST', body: JSON.stringify(body || {}) });
export const mediaDelete = (path: string) =>
    apiFetch(`/media${path}`, { method: 'DELETE' });

// Upload file using FormData
export const uploadFile = async (
    file: { uri: string; name: string; type: string },
    options: { type?: string; subgridId?: string } = {}
): Promise<any> => {
    await ensureBootstrap();

    const formData = new FormData();

    // For web, convert blob URL to actual Blob
    if (Platform.OS === 'web' && file.uri.startsWith('blob:')) {
        const blobResponse = await fetch(file.uri);
        const blob = await blobResponse.blob();
        formData.append('file', blob, file.name);
    } else if (Platform.OS === 'web' && file.uri.startsWith('data:')) {
        // Handle data URIs on web
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append('file', blob, file.name);
    } else {
        // React Native format
        formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.type,
        } as any);
    }

    if (options.type) formData.append('type', options.type);
    if (options.subgridId) formData.append('subgridId', options.subgridId);

    const response = await safeFetch('/media/upload', {
        method: 'POST',
        headers: {
            'x-user-id': resolvedUserId || USER_ID,
            'x-user-role': resolvedUserRole || USER_ROLE,
        },
        body: formData,
    });

    const data = await parseJson(response);
    if (!response.ok) {
        throw new Error(data?.error || 'Upload failed');
    }
    // Return a consistent format with success flag and data
    const uploadData = data?.data || data;
    return { success: true, data: uploadData };
};

// Upload avatar
export const uploadAvatar = async (file: { uri: string; name: string; type: string }): Promise<any> => {
    await ensureBootstrap();

    const formData = new FormData();

    console.log('[uploadAvatar] Platform:', Platform.OS, 'URI prefix:', file.uri.substring(0, 50));

    // For web, convert blob URL or data URI to actual Blob
    if (Platform.OS === 'web') {
        try {
            // Fetch the URI (works for blob:, data:, and http/https URIs)
            const response = await fetch(file.uri);
            const blob = await response.blob();
            console.log('[uploadAvatar] Web blob created, size:', blob.size, 'type:', blob.type);
            formData.append('file', blob, file.name);
        } catch (fetchError) {
            console.error('[uploadAvatar] Failed to fetch URI as blob:', fetchError);
            // Fallback to React Native style (shouldn't happen on web but try anyway)
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: file.type,
            } as any);
        }
    } else {
        // React Native format
        formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.type,
        } as any);
    }

    const response = await safeFetch('/media/avatar', {
        method: 'POST',
        headers: {
            'x-user-id': resolvedUserId || USER_ID,
            'x-user-role': resolvedUserRole || USER_ROLE,
        },
        body: formData,
    });

    const data = await parseJson(response);
    if (!response.ok) {
        throw new Error(data?.error || 'Avatar upload failed');
    }
    return data;
};

// Upload banner/cover image
export const uploadBanner = async (file: { uri: string; name: string; type: string }): Promise<any> => {
    await ensureBootstrap();

    const formData = new FormData();

    console.log('[uploadBanner] Platform:', Platform.OS, 'URI prefix:', file.uri.substring(0, 50));

    // For web, convert blob URL or data URI to actual Blob
    if (Platform.OS === 'web') {
        try {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            console.log('[uploadBanner] Web blob created, size:', blob.size, 'type:', blob.type);
            formData.append('file', blob, file.name);
        } catch (fetchError) {
            console.error('[uploadBanner] Failed to fetch URI as blob:', fetchError);
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: file.type,
            } as any);
        }
    } else {
        // React Native format
        formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.type,
        } as any);
    }

    const res = await safeFetch('/media/banner', {
        method: 'POST',
        headers: {
            'x-user-id': resolvedUserId || USER_ID,
            'x-user-role': resolvedUserRole || USER_ROLE,
        },
        body: formData,
    });

    const data = await parseJson(res);
    if (!res.ok) {
        throw new Error(data?.error || 'Banner upload failed');
    }
    return data;
};

// Upload voice note
export const uploadVoiceNote = async (
    file: { uri: string; name: string; type: string },
    options: { subgridId?: string; channelId?: string; dmPeerId?: string } = {}
): Promise<any> => {
    await ensureBootstrap();

    const formData = new FormData();
    formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
    } as any);

    if (options.subgridId) formData.append('subgridId', options.subgridId);
    if (options.channelId) formData.append('channelId', options.channelId);
    if (options.dmPeerId) formData.append('dmPeerId', options.dmPeerId);

    const response = await safeFetch('/media/voice-note', {
        method: 'POST',
        headers: {
            'x-user-id': resolvedUserId || USER_ID,
            'x-user-role': resolvedUserRole || USER_ROLE,
        },
        body: formData,
    });

    const data = await parseJson(response);
    if (!response.ok) {
        throw new Error(data?.error || 'Voice note upload failed');
    }
    return data;
};

// Get Cloudinary signature for direct upload
export const getUploadSignature = (options: { type?: string; subgridId?: string } = {}) =>
    mediaPost('/signature', options);

// Get S3 presigned URL
export const getPresignedUrl = (options: { filename: string; mimeType: string; type?: string; subgridId?: string }) =>
    mediaPost('/presigned-url', options);

// ===================
// CALLS API
// ===================

export const callsGet = (path: string) => apiFetch(`/media/calls${path}`);
export const callsPost = (path: string, body?: any) =>
    apiFetch(`/media/calls${path}`, { method: 'POST', body: JSON.stringify(body || {}) });

// Check call service status
export const getCallServiceStatus = () => callsGet('/status');

// Initiate DM call
export const initiateDMCall = (calleeId: string, callType: 'audio' | 'video' = 'audio', subgridId?: string) =>
    callsPost('/dm', { calleeId, callType, subgridId: subgridId || undefined });

// Initiate channel call
export const initiateChannelCall = (channelId: string, callType: 'audio' | 'video' = 'audio') =>
    callsPost('/channel', { channelId, callType });

// Initiate group call
export const initiateGroupCall = (groupId: string, callType: 'audio' | 'video' = 'audio') =>
    callsPost('/group', { groupId, callType });

// Refresh call token
export const refreshCallToken = (channelName: string) =>
    callsPost('/token', { channelName });

// Answer an incoming call
export const answerCall = (callId: string) =>
    callsPost(`/${callId}/answer`);

// Decline an incoming call
export const declineCall = (callId: string) =>
    callsPost(`/${callId}/decline`);

// End an active call
export const endCall = (callId: string) =>
    callsPost(`/${callId}/end`);

// Get call details
export const getCallDetails = (callId: string) =>
    callsGet(`/${callId}`);

// Get call history
export const getCallHistory = (options?: { limit?: number; offset?: number; callType?: string; peerId?: string }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.callType) params.append('callType', options.callType);
    if (options?.peerId) params.append('peerId', options.peerId);
    const query = params.toString();
    return callsGet(`/history${query ? `?${query}` : ''}`);
};

// Voice channel participant tracking
export const joinVoiceChannel = (channelId: string, subgridId?: string, agoraUid?: number) =>
    callsPost('/voice-channel/join', { channelId, subgridId, agoraUid });

export const leaveVoiceChannel = (channelId: string, agoraUid?: number) =>
    callsPost('/voice-channel/leave', { channelId, agoraUid });

export const getVoiceChannelParticipants = (channelId: string, subgridId?: string) => {
    const params = subgridId ? `?subgridId=${subgridId}` : '';
    return callsGet(`/voice-channel/${channelId}/participants${params}`);
};

// Voice channel Spaces-like features

// Wave to speak (raise hand)
export const waveToSpeak = (channelId: string) =>
    callsPost('/voice-channel/wave', { channelId });

// Cancel wave to speak (lower hand)
export const cancelWave = (channelId: string) =>
    callsPost('/voice-channel/cancel-wave', { channelId });

// Grant speaker permission (host/admin only)
export const grantSpeaker = (channelId: string, targetUserId: string) =>
    callsPost('/voice-channel/grant-speaker', { channelId, targetUserId });

// Revoke speaker permission (host only)
export const revokeSpeaker = (channelId: string, targetUserId: string) =>
    callsPost('/voice-channel/revoke-speaker', { channelId, targetUserId });

// Mute a participant (host/speaker can mute listeners)
export const muteParticipant = (channelId: string, targetUserId: string, mute: boolean) =>
    callsPost('/voice-channel/mute-participant', { channelId, targetUserId, mute });

// Update own mute state
export const updateVoiceChannelMuteState = (channelId: string, isMuted: boolean) =>
    callsPost('/voice-channel/update-mute', { channelId, isMuted });

// Subscribe to call events (SSE)
// Returns a cleanup function. Call this after ensuring bootstrap is complete.
export const subscribeToCallEvents = (onEvent: (event: string, data: any) => void): (() => void) => {
    const baseUrl = getApiBaseUrl();
    const userId = getUserId();

    if (!baseUrl || !userId) {
        console.warn('[CallEvents] Cannot subscribe: missing baseUrl or userId. baseUrl:', baseUrl, 'userId:', userId);
        return () => {};
    }

    console.log('[CallEvents] Subscribing with userId:', userId);

    // SSE doesn't support custom headers in most browsers, so pass auth via query params
    // The backend authMiddleware looks for userId in query params for SSE connections
    const params = new URLSearchParams();
    params.set('userId', userId);

    const eventSource = new EventSource(`${baseUrl}/media/calls/events?${params.toString()}`);

    eventSource.onopen = () => {
        console.log('[CallEvents] Connected successfully');
    };

    eventSource.onerror = (error) => {
        console.error('[CallEvents] Connection error:', error);
    };

    // Listen for specific call events
    const events = ['incoming_call', 'call_answered', 'call_declined', 'call_ended', 'call_missed', 'user_busy', 'participant_joined', 'participant_left'];
    events.forEach(eventName => {
        eventSource.addEventListener(eventName, (event: any) => {
            try {
                const data = JSON.parse(event.data);
                onEvent(eventName, data);
            } catch (err) {
                console.error(`[CallEvents] Failed to parse ${eventName}:`, err);
            }
        });
    });

    // Return cleanup function
    return () => {
        console.log('[CallEvents] Closing connection');
        eventSource.close();
    };
};

// Async version that ensures bootstrap before subscribing
export const subscribeToCallEventsAsync = async (onEvent: (event: string, data: any) => void): Promise<() => void> => {
    await ensureBootstrap();
    return subscribeToCallEvents(onEvent);
};

// ===================
// NOTIFICATIONS API
// ===================

export const notificationsGet = (path: string) => apiFetch(`/notifications${path}`);
export const notificationsPost = (path: string, body?: any) =>
    apiFetch(`/notifications${path}`, { method: 'POST', body: JSON.stringify(body || {}) });
export const notificationsPatch = (path: string, body?: any) =>
    apiFetch(`/notifications${path}`, { method: 'PATCH', body: JSON.stringify(body || {}) });
export const notificationsDelete = (path: string, body?: any) =>
    apiFetch(`/notifications${path}`, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });

// Register push token
export const registerPushToken = (pushToken: string, platform?: string, deviceId?: string) =>
    notificationsPost('/register', { pushToken, platform, deviceId });

// Unregister push token
export const unregisterPushToken = (pushToken: string) =>
    notificationsDelete('/unregister', { pushToken });

// Get registered tokens
export const getPushTokens = () => notificationsGet('/tokens');

// Send test notification
export const sendTestNotification = () => notificationsPost('/test');

// Get notification preferences
export const getNotificationPreferences = () => notificationsGet('/preferences');

// Update notification preferences
export const updateNotificationPreferences = (prefs: {
    messages?: boolean;
    dms?: boolean;
    calls?: boolean;
    mentions?: boolean;
    invites?: boolean;
    // Super Admin email notification preferences
    systemAlerts?: boolean;
    securityEvents?: boolean;
    dailyReports?: boolean;
    weeklyReports?: boolean;
}) => notificationsPatch('/preferences', prefs);

// Get in-app notification inbox
export const getNotificationInbox = (options?: {
    limit?: number;
    offset?: number;
    type?: string;
    unreadOnly?: boolean;
}) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.type) params.append('type', options.type);
    if (options?.unreadOnly) params.append('unreadOnly', 'true');
    const query = params.toString();
    return notificationsGet(`/inbox${query ? `?${query}` : ''}`);
};

// Get unread notification count
export const getUnreadNotificationCount = () => notificationsGet('/unread-count');

// Mark notifications as read
export const markNotificationsAsRead = (notificationIds?: string[], markAll?: boolean) =>
    notificationsPatch('/read', { notificationIds, markAll });

// Delete notifications
export const deleteNotifications = (notificationIds?: string[], deleteAll?: boolean) =>
    notificationsDelete('/inbox', { notificationIds, deleteAll });

// ===================
// SUPER ADMIN API
// ===================

export const superAdminGet = (path: string) => apiFetch(`/super-admin${path}`);
export const superAdminPost = (path: string, body?: any) =>
    apiFetch(`/super-admin${path}`, { method: 'POST', body: JSON.stringify(body || {}) });
export const superAdminPatch = (path: string, body?: any) =>
    apiFetch(`/super-admin${path}`, { method: 'PATCH', body: JSON.stringify(body || {}) });
export const superAdminDelete = (path: string) =>
    apiFetch(`/super-admin${path}`, { method: 'DELETE' });

// Get super admin overview stats
export const getSuperAdminOverview = (options?: { growthDays?: number }) => {
    const params = new URLSearchParams();
    if (options?.growthDays) {
        params.append('growthDays', String(options.growthDays));
    }
    const query = params.toString();
    return superAdminGet(`/overview${query ? `?${query}` : ''}`);
};

// Get customers (communities/subgrids)
export const getSuperAdminCustomers = (options?: { q?: string; limit?: number; offset?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (options?.q) params.append('q', options.q);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.status) params.append('status', options.status);
    const query = params.toString();
    return superAdminGet(`/customers${query ? `?${query}` : ''}`);
};

// Get single customer details
export const getSuperAdminCustomerDetails = (customerId: string) =>
    superAdminGet(`/customers/${customerId}`);

// Update customer (suspend/activate)
export const updateSuperAdminCustomer = (customerId: string, data: { status?: string; settings?: any }) =>
    superAdminPatch(`/customers/${customerId}`, data);

// Get moderation queue
export const getSuperAdminModeration = (options?: { status?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const query = params.toString();
    return superAdminGet(`/moderation${query ? `?${query}` : ''}`);
};

// Get system configuration
export const getSuperAdminConfig = () => superAdminGet('/config');

// Update system configuration
export const updateSuperAdminConfig = (data: { features?: any; limits?: any; defaults?: any }) =>
    superAdminPatch('/config', data);

// Get all users
export const getSuperAdminUsers = (options?: { q?: string; limit?: number; offset?: number; role?: string }) => {
    const params = new URLSearchParams();
    if (options?.q) params.append('q', options.q);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.role) params.append('role', options.role);
    const query = params.toString();
    return superAdminGet(`/users${query ? `?${query}` : ''}`);
};

// Get team members (admin and super_admin users who help manage the platform)
export const getSuperAdminTeamMembers = (options?: { q?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.q) params.append('q', options.q);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const query = params.toString();
    return superAdminGet(`/team${query ? `?${query}` : ''}`);
};

// Invite a new team member
export const inviteSuperAdminTeamMember = (data: { email: string; firstName?: string; lastName?: string; role?: string }) =>
    superAdminPost('/team/invite', data);

// Delete a team member
export const deleteSuperAdminTeamMember = (userId: string) =>
    superAdminPost(`/team/${userId}/delete`);

// Suspend or unsuspend a team member
export const suspendSuperAdminTeamMember = (userId: string, suspend: boolean) =>
    superAdminPost(`/team/${userId}/suspend`, { suspend });
