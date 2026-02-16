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
const CHANNEL_MESSAGES_CACHE_KEY = 'gryd_channel_messages_cache';
const CHANNEL_POSTS_CACHE_KEY = 'gryd_channel_posts_cache';
const SUBGRIDS_CACHE_KEY = 'gryd_subgrids_cache';
const FRIENDS_CACHE_KEY = 'gryd_friends_cache';
const SUPER_ADMIN_CACHE_KEY = 'gryd_super_admin_cache';
const CU_ADMIN_MEMBERS_CACHE_KEY = 'gryd_cu_admin_members_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MESSAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for messages (was 5 min, too short)
const ADMIN_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for admin data

// In-memory caches for instant access
let userCache: Record<string, CachedUserProfile> = {};
let messagesCache: Record<string, { messages: CachedMessage[]; cachedAt: number }> = {};
let channelMessagesCache: Record<string, { messages: CachedMessage[]; cachedAt: number }> = {};
let channelPostsCache: Record<string, { posts: any[]; cachedAt: number }> = {};
let subgridsCache: { data: any[]; tenantId: string; cachedAt: number } | null = null;
let friendsCache: { friends: string[]; users: Record<string, any>; subgridId: string; cachedAt: number } | null = null;
let superAdminCache: {
    stats?: any;
    customers?: any[];
    customersTotal?: number;
    moderation?: any[];
    config?: any;
    teamMembers?: any[];
    cachedAt: number;
} | null = null;
let cuAdminMembersCache: Record<string, { members: any[]; cachedAt: number }> = {};
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
    } catch {
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
        } catch {
            // Silently fail - cache is best-effort
        }
    }, 1000);
};

const saveMessagesCache = (): void => {
    if (msgSaveTimeout) clearTimeout(msgSaveTimeout);
    msgSaveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(messagesCache));
        } catch {
            // Silently fail - cache is best-effort
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
        } catch {
            // Silently fail - cache is best-effort
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
        } catch {
            // Silently fail - cache is best-effort
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
    } else {
        // Create new cache entry if it doesn't exist
        messagesCache[peerId] = {
            messages: [message],
            cachedAt: Date.now(),
        };
        saveMessagesCache();
    }
};

export const removeMessageFromCache = (peerId: string, messageId: string): void => {
    const existing = messagesCache[peerId];
    if (existing) {
        existing.messages = existing.messages.filter(m => m._id !== messageId);
        saveMessagesCache();
    }
};

// ============ CHANNEL MESSAGES CACHE ============

export const getCachedChannelMessages = (channelId: string): CachedMessage[] | null => {
    const cached = channelMessagesCache[channelId];
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > MESSAGE_CACHE_DURATION) {
        delete channelMessagesCache[channelId];
        return null;
    }
    return cached.messages;
};

export const cacheChannelMessages = (channelId: string, messages: CachedMessage[]): void => {
    channelMessagesCache[channelId] = {
        messages,
        cachedAt: Date.now(),
    };
};

export const addChannelMessageToCache = (channelId: string, message: CachedMessage): void => {
    const existing = channelMessagesCache[channelId];
    if (existing) {
        if (!existing.messages.find(m => m._id === message._id)) {
            existing.messages.push(message);
            existing.cachedAt = Date.now();
        }
    } else {
        channelMessagesCache[channelId] = {
            messages: [message],
            cachedAt: Date.now(),
        };
    }
};

export const removeChannelMessageFromCache = (channelId: string, messageId: string): void => {
    const existing = channelMessagesCache[channelId];
    if (existing) {
        existing.messages = existing.messages.filter(m => m._id !== messageId);
    }
};

// ============ CHANNEL POSTS CACHE ============

export const getCachedChannelPosts = (channelId: string): any[] | null => {
    const cached = channelPostsCache[channelId];
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > MESSAGE_CACHE_DURATION) {
        delete channelPostsCache[channelId];
        return null;
    }
    return cached.posts;
};

export const cacheChannelPosts = (channelId: string, posts: any[]): void => {
    channelPostsCache[channelId] = {
        posts,
        cachedAt: Date.now(),
    };
};

export const addChannelPostToCache = (channelId: string, post: any): void => {
    const existing = channelPostsCache[channelId];
    if (existing) {
        if (!existing.posts.find(p => p._id === post._id)) {
            existing.posts.unshift(post); // Posts are newest first
            existing.cachedAt = Date.now();
        }
    } else {
        channelPostsCache[channelId] = {
            posts: [post],
            cachedAt: Date.now(),
        };
    }
};

export const updateChannelPostInCache = (channelId: string, post: any): void => {
    const existing = channelPostsCache[channelId];
    if (existing) {
        const idx = existing.posts.findIndex(p => p._id === post._id);
        if (idx >= 0) {
            existing.posts[idx] = post;
            existing.cachedAt = Date.now();
        }
    }
};

export const removeChannelPostFromCache = (channelId: string, postId: string): void => {
    const existing = channelPostsCache[channelId];
    if (existing) {
        existing.posts = existing.posts.filter(p => p._id !== postId);
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

// ============ SUPER ADMIN CACHE ============

export const getCachedSuperAdminStats = (): any | null => {
    if (!superAdminCache?.stats) return null;
    if (Date.now() - superAdminCache.cachedAt > ADMIN_CACHE_DURATION) return null;
    return superAdminCache.stats;
};

export const cacheSuperAdminStats = (stats: any): void => {
    superAdminCache = {
        ...superAdminCache,
        stats,
        cachedAt: Date.now(),
    };
    saveSuperAdminCache();
};

export const getCachedSuperAdminCustomers = (): { customers: any[]; total: number } | null => {
    if (!superAdminCache?.customers) return null;
    if (Date.now() - superAdminCache.cachedAt > ADMIN_CACHE_DURATION) return null;
    return { customers: superAdminCache.customers, total: superAdminCache.customersTotal || 0 };
};

export const cacheSuperAdminCustomers = (customers: any[], total: number): void => {
    superAdminCache = {
        ...superAdminCache,
        customers,
        customersTotal: total,
        cachedAt: Date.now(),
    };
    saveSuperAdminCache();
};

export const getCachedSuperAdminModeration = (): any[] | null => {
    if (!superAdminCache?.moderation) return null;
    if (Date.now() - superAdminCache.cachedAt > ADMIN_CACHE_DURATION) return null;
    return superAdminCache.moderation;
};

export const cacheSuperAdminModeration = (moderation: any[]): void => {
    superAdminCache = {
        ...superAdminCache,
        moderation,
        cachedAt: Date.now(),
    };
    saveSuperAdminCache();
};

export const getCachedSuperAdminConfig = (): any | null => {
    if (!superAdminCache?.config) return null;
    if (Date.now() - superAdminCache.cachedAt > ADMIN_CACHE_DURATION) return null;
    return superAdminCache.config;
};

export const cacheSuperAdminConfig = (config: any): void => {
    superAdminCache = {
        ...superAdminCache,
        config,
        cachedAt: Date.now(),
    };
    saveSuperAdminCache();
};

export const getCachedSuperAdminTeamMembers = (): any[] | null => {
    if (!superAdminCache?.teamMembers) return null;
    if (Date.now() - superAdminCache.cachedAt > ADMIN_CACHE_DURATION) return null;
    return superAdminCache.teamMembers;
};

export const cacheSuperAdminTeamMembers = (teamMembers: any[]): void => {
    superAdminCache = {
        ...superAdminCache,
        teamMembers,
        cachedAt: Date.now(),
    };
    saveSuperAdminCache();
};

let superAdminSaveTimeout: NodeJS.Timeout | null = null;
const saveSuperAdminCache = (): void => {
    if (superAdminSaveTimeout) clearTimeout(superAdminSaveTimeout);
    superAdminSaveTimeout = setTimeout(async () => {
        try {
            if (superAdminCache) {
                await AsyncStorage.setItem(SUPER_ADMIN_CACHE_KEY, JSON.stringify(superAdminCache));
            }
        } catch {
            // Silently fail - cache is best-effort
        }
    }, 1000);
};

// ============ CU ADMIN MEMBERS CACHE ============

export const getCachedCUAdminMembers = (subgridId: string): any[] | null => {
    const cached = cuAdminMembersCache[subgridId];
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > ADMIN_CACHE_DURATION) {
        delete cuAdminMembersCache[subgridId];
        return null;
    }
    return cached.members;
};

export const cacheCUAdminMembers = (subgridId: string, members: any[]): void => {
    cuAdminMembersCache[subgridId] = {
        members,
        cachedAt: Date.now(),
    };
    saveCUAdminMembersCache();
};

export const updateCUAdminMemberInCache = (subgridId: string, member: any): void => {
    const cached = cuAdminMembersCache[subgridId];
    if (cached) {
        const idx = cached.members.findIndex(m => m._id === member._id || m.userId === member.userId);
        if (idx >= 0) {
            cached.members[idx] = { ...cached.members[idx], ...member };
            cached.cachedAt = Date.now();
            saveCUAdminMembersCache();
        }
    }
};

export const removeCUAdminMemberFromCache = (subgridId: string, memberId: string): void => {
    const cached = cuAdminMembersCache[subgridId];
    if (cached) {
        cached.members = cached.members.filter(m => m._id !== memberId && m.userId !== memberId);
        saveCUAdminMembersCache();
    }
};

let cuAdminMembersSaveTimeout: NodeJS.Timeout | null = null;
const saveCUAdminMembersCache = (): void => {
    if (cuAdminMembersSaveTimeout) clearTimeout(cuAdminMembersSaveTimeout);
    cuAdminMembersSaveTimeout = setTimeout(async () => {
        try {
            await AsyncStorage.setItem(CU_ADMIN_MEMBERS_CACHE_KEY, JSON.stringify(cuAdminMembersCache));
        } catch {
            // Silently fail - cache is best-effort
        }
    }, 1000);
};

// ============ CLEAR ALL ============

export const clearAllCaches = async (): Promise<void> => {
    userCache = {};
    messagesCache = {};
    channelMessagesCache = {};
    channelPostsCache = {};
    subgridsCache = null;
    friendsCache = null;
    superAdminCache = null;
    cuAdminMembersCache = {};
    cacheLoaded = false; // Allow re-initialization on next login
    try {
        await Promise.all([
            AsyncStorage.removeItem(USER_CACHE_KEY),
            AsyncStorage.removeItem(MESSAGES_CACHE_KEY),
            AsyncStorage.removeItem(CHANNEL_MESSAGES_CACHE_KEY),
            AsyncStorage.removeItem(CHANNEL_POSTS_CACHE_KEY),
            AsyncStorage.removeItem(SUBGRIDS_CACHE_KEY),
            AsyncStorage.removeItem(FRIENDS_CACHE_KEY),
            AsyncStorage.removeItem(SUPER_ADMIN_CACHE_KEY),
            AsyncStorage.removeItem(CU_ADMIN_MEMBERS_CACHE_KEY),
        ]);
    } catch {
        // Silently fail - cache clear is best-effort
    }
};

// Legacy exports for backward compatibility
export const loadUserCache = loadAllCaches;
export const clearUserCache = clearAllCaches;

// Initialize cache on module load
loadAllCaches();
