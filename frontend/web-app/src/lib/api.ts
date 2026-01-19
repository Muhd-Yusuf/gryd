const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const USER_ID = import.meta.env.VITE_USER_ID || '';
const USER_ROLE = import.meta.env.VITE_USER_ROLE || 'agent';
const TENANT_ID = import.meta.env.VITE_TENANT_ID || '';

let resolvedUserId = USER_ID;
let resolvedTenantId = TENANT_ID;
let bootstrapPromise: Promise<void> | null = null;

const buildHeaders = (headers: Record<string, string> = {}) => {
    const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const activeUserId = resolvedUserId || USER_ID;
    if (activeUserId) {
        baseHeaders['x-user-id'] = activeUserId;
        baseHeaders['x-user-role'] = USER_ROLE;
    }

    return { ...baseHeaders, ...headers };
};

const parseJson = async (response: Response) => {
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

const ensureBootstrap = async () => {
    if (resolvedUserId && resolvedTenantId) {
        return;
    }
    if (bootstrapPromise) {
        return bootstrapPromise;
    }

    bootstrapPromise = (async () => {
        const response = await fetch(`${API_BASE_URL}/bootstrap`, {
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
export const resolveTenantId = async () => {
    await ensureBootstrap();
    return resolvedTenantId || TENANT_ID;
};
export const resolveUserId = async () => {
    await ensureBootstrap();
    return resolvedUserId || USER_ID;
};

export const apiFetch = async (path: string, options: RequestInit = {}) => {
    await ensureBootstrap();
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(options.headers as Record<string, string>),
    });
    const data = await parseJson(response);
    if (!response.ok) {
        const message = data?.message || 'Request failed';
        throw new Error(message);
    }
    return data;
};

export const communityGet = (path: string) => apiFetch(`/community${path}`);
export const communityPost = (path: string, body?: unknown) =>
    apiFetch(`/community${path}`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
    });
export const communityPatch = (path: string, body?: unknown) =>
    apiFetch(`/community${path}`, {
        method: 'PATCH',
        body: JSON.stringify(body || {}),
    });
