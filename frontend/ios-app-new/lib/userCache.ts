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

export type CachedMessage = {
    _id: string;
    senderId?: string;
    body?: string;
    kind?: string;
    attachments?: any[];
    createdAt?: string;
    callType?: string;
    callDuration?: number;
    callStatus?: string;
};

const USER_CACHE_KEY = 'gryd_user_profiles_cache';
const MESSAGES_CACHE_KEY = 'gryd_dm_messages_cache';
const SUBGRIDS_CACHE_KEY = 'gryd_subgrids_cache';
const FRIENDS_CACHE_KEY = 'gryd_friends_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MESSAGE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for messages

// In-memory caches for instant access
let userCache: Record<string, CachedUserProfile> = {};
let messagesCache: Record<string, { messages: CachedMessage[]; cachedAt: number }> = {};
let subgridsCache: { data: any[]; tenantId: string; cachedAt: number } | null = null;
let friendsCache: { friends: string[]; users: Record<string, any>; subgridId: string; cachedAt: number } | null = null;
let cacheLoaded = false;

// Load all caches from storage on init
export const loadAllCaches = async (): Promise<void> => {
    if (cacheLoaded) return;
    try {
        const [userStored, msgStored, subStored, friendsStored] = await Promise.all([
            AsyncStorage.getItem(USER_CACHE_KEY),
            AsyncStorage.getItem(MESSAGES_CACHE_KEY),
            AsyncStorage.getItem(SUBGRIDS_CACHE_KEY),
            AsyncStorage.getItem(FRIENDS_CACHE_KEY),
        ]);

        const now = Date.now();

        if (userStored) {
            const parsed = JSON.parse(userStored);
            Object.keys(parsed).forEach((key) => {
                if (now - parsed[key].cachedAt < CACHE_DURATION) {
                    userCache[key] = parsed[key];
                }
            });
        }

        if (msgStored) {
            const parsed = JSON.parse(msgStored);
            Object.keys(parsed).forEach((key) => {
                if (now - parsed[key].cachedAt < MESSAGE_CACHE_DURATION) {
                    messagesCache[key] = parsed[key];
                }
            });
        }

        if (subStored) {
            const parsed = JSON.parse(subStored);
            if (now - parsed.cachedAt < CACHE_DURATION) {
                subgridsCache = parsed;
            }
        }

        if (friendsStored) {
            const parsed = JSON.parse(friendsStored);
            if (now - parsed.cachedAt < CACHE_DURATION) {
                friendsCache = parsed;
            }
        }

        cacheLoaded = true;
    } catch (err) {
        console.warn('[Cache] Failed to load caches:', err);
        cacheLoaded = true;
    }
};

// Debounced save functions
let userSaveTimeout: NodeJS.Timeout | null = null;
let msgSaveTimeout: NodeJS.Timeout | null = null;
let subgridsSaveTimeout: NodeJS.Timeout | null = null;
let friendsSaveTimeout: NodeJS.Timeout | null = null;

const saveUserCache = (): void => {
    if (userSaveTimeout) clearTimeout(userSaveTimeout);
    userSaveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userCache));
        } catch (err) {
            console.warn('[Cache] Failed to save user cache:', err);
        }
    }, 1000);
};

const saveMessagesCache = (): void => {
    if (msgSaveTimeout) clearTimeout(msgSaveTimeout);
    msgSaveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(messagesCache));
        } catch (err) {
            console.warn('[Cache] Failed to save messages cache:', err);
        }
    }, 1000);
};

const saveSubgridsCache = (): void => {
    if (subgridsSaveTimeout) clearTimeout(subgridsSaveTimeout);
    subgridsSaveTimeout = setTimeout(async () => {
        try {
            if (subgridsCache) {
                await AsyncStorage.setItem(SUBGRIDS_CACHE_KEY, JSON.stringify(subgridsCache));
            }
        } catch (err) {
            console.warn('[Cache] Failed to save subgrids cache:', err);
        }
    }, 1000);
};

const saveFriendsCache = (): void => {
    if (friendsSaveTimeout) clearTimeout(friendsSaveTimeout);
    friendsSaveTimeout = setTimeout(async () => {
        try {
            if (friendsCache) {
                await AsyncStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify(friendsCache));
            }
        } catch (err) {
            console.warn('[Cache] Failed to save friends cache:', err);
        }
    }, 1000);
};

// ============ USER PROFILE CACHE ============

export const getCachedUser = (userId: string): CachedUserProfile | null => {
    const cached = userCache[userId];
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > CACHE_DURATION) {
        delete userCache[userId];
        return null;
    }
    return cached;
};

export const cacheUser = (user: Omit<CachedUserProfile, 'cachedAt'>): void => {
    if (!user.id) return;
    userCache[user.id] = {
        ...user,
        cachedAt: Date.now(),
    };
    saveUserCache();
};

export const cacheUsers = (users: Record<string, any>): void => {
    const now = Date.now();
    Object.entries(users).forEach(([id, user]) => {
        if (id && user) {
            userCache[id] = {
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

export const getCachedUsers = (userIds: string[]): Record<string, CachedUserProfile> => {
    const result: Record<string, CachedUserProfile> = {};
    const now = Date.now();
    userIds.forEach((id) => {
        const cached = userCache[id];
        if (cached && now - cached.cachedAt < CACHE_DURATION) {
            result[id] = cached;
        }
    });
    return result;
};

export const getAllCachedUsers = (): Record<string, CachedUserProfile> => {
    return { ...userCache };
};

// ============ DM MESSAGES CACHE ============

export const getCachedMessages = (peerId: string): CachedMessage[] | null => {
    const cached = messagesCache[peerId];
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > MESSAGE_CACHE_DURATION) {
        delete messagesCache[peerId];
        return null;
    }
    return cached.messages;
};

export const cacheMessages = (peerId: string, messages: CachedMessage[]): void => {
    messagesCache[peerId] = {
        messages,
        cachedAt: Date.now(),
    };
    saveMessagesCache();
};

export const addMessageToCache = (peerId: string, message: CachedMessage): void => {
    const existing = messagesCache[peerId];
    if (existing) {
        // Add message if not already present
        if (!existing.messages.find(m => m._id === message._id)) {
            existing.messages.push(message);
            existing.cachedAt = Date.now();
            saveMessagesCache();
        }
    }
};

export const removeMessageFromCache = (peerId: string, messageId: string): void => {
    const existing = messagesCache[peerId];
    if (existing) {
        existing.messages = existing.messages.filter(m => m._id !== messageId);
        saveMessagesCache();
    }
};

// ============ SUBGRIDS CACHE ============

export const getCachedSubgrids = (tenantId: string): any[] | null => {
    if (!subgridsCache) return null;
    if (subgridsCache.tenantId !== tenantId) return null;
    if (Date.now() - subgridsCache.cachedAt > CACHE_DURATION) {
        subgridsCache = null;
        return null;
    }
    return subgridsCache.data;
};

export const cacheSubgrids = (tenantId: string, data: any[]): void => {
    subgridsCache = {
        data,
        tenantId,
        cachedAt: Date.now(),
    };
    saveSubgridsCache();
};

// ============ FRIENDS CACHE ============

export const getCachedFriends = (subgridId: string): { friends: string[]; users: Record<string, any> } | null => {
    if (!friendsCache) return null;
    if (friendsCache.subgridId !== subgridId) return null;
    if (Date.now() - friendsCache.cachedAt > CACHE_DURATION) {
        friendsCache = null;
        return null;
    }
    return { friends: friendsCache.friends, users: friendsCache.users };
};

export const cacheFriends = (subgridId: string, friends: string[], users: Record<string, any>): void => {
    friendsCache = {
        friends,
        users,
        subgridId,
        cachedAt: Date.now(),
    };
    // Also cache all users
    cacheUsers(users);
    saveFriendsCache();
};

// ============ CLEAR ALL ============

export const clearAllCaches = async (): Promise<void> => {
    userCache = {};
    messagesCache = {};
    subgridsCache = null;
    friendsCache = null;
    try {
        await Promise.all([
            AsyncStorage.removeItem(USER_CACHE_KEY),
            AsyncStorage.removeItem(MESSAGES_CACHE_KEY),
            AsyncStorage.removeItem(SUBGRIDS_CACHE_KEY),
            AsyncStorage.removeItem(FRIENDS_CACHE_KEY),
        ]);
    } catch (err) {
        console.warn('[Cache] Failed to clear caches:', err);
    }
};

// Legacy exports for backward compatibility
export const loadUserCache = loadAllCaches;
export const clearUserCache = clearAllCaches;

// Initialize cache on module load
loadAllCaches();
