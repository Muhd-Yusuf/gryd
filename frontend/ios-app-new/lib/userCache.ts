import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedUserProfile = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
    stakeholderBadge?: string;
    company?: string;
    cachedAt: number;
};

const CACHE_KEY = 'gryd_user_profiles_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for instant access
let memoryCache: Record<string, CachedUserProfile> = {};
let cacheLoaded = false;

// Load cache from storage on init
export const loadUserCache = async (): Promise<void> => {
    if (cacheLoaded) return;
    try {
        const stored = await AsyncStorage.getItem(CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Filter out expired entries
            const now = Date.now();
            Object.keys(parsed).forEach((key) => {
                if (now - parsed[key].cachedAt < CACHE_DURATION) {
                    memoryCache[key] = parsed[key];
                }
            });
        }
        cacheLoaded = true;
    } catch (err) {
        console.warn('[UserCache] Failed to load cache:', err);
        cacheLoaded = true;
    }
};

// Save cache to storage (debounced)
let saveTimeout: NodeJS.Timeout | null = null;
const saveUserCache = async (): Promise<void> => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
        } catch (err) {
            console.warn('[UserCache] Failed to save cache:', err);
        }
    }, 1000);
};

// Get a user profile from cache
export const getCachedUser = (userId: string): CachedUserProfile | null => {
    const cached = memoryCache[userId];
    if (!cached) return null;
    // Check if expired
    if (Date.now() - cached.cachedAt > CACHE_DURATION) {
        delete memoryCache[userId];
        return null;
    }
    return cached;
};

// Cache a user profile
export const cacheUser = (user: Omit<CachedUserProfile, 'cachedAt'>): void => {
    if (!user.id) return;
    memoryCache[user.id] = {
        ...user,
        cachedAt: Date.now(),
    };
    saveUserCache();
};

// Cache multiple user profiles
export const cacheUsers = (users: Record<string, any>): void => {
    const now = Date.now();
    Object.entries(users).forEach(([id, user]) => {
        if (id && user) {
            memoryCache[id] = {
                id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.username,
                avatarUrl: user.avatarUrl,
                role: user.role,
                stakeholderBadge: user.stakeholderBadge,
                company: user.company,
                cachedAt: now,
            };
        }
    });
    saveUserCache();
};

// Get multiple users from cache
export const getCachedUsers = (userIds: string[]): Record<string, CachedUserProfile> => {
    const result: Record<string, CachedUserProfile> = {};
    const now = Date.now();
    userIds.forEach((id) => {
        const cached = memoryCache[id];
        if (cached && now - cached.cachedAt < CACHE_DURATION) {
            result[id] = cached;
        }
    });
    return result;
};

// Get all cached users
export const getAllCachedUsers = (): Record<string, CachedUserProfile> => {
    return { ...memoryCache };
};

// Clear cache
export const clearUserCache = async (): Promise<void> => {
    memoryCache = {};
    try {
        await AsyncStorage.removeItem(CACHE_KEY);
    } catch (err) {
        console.warn('[UserCache] Failed to clear cache:', err);
    }
};

// Initialize cache on module load
loadUserCache();
