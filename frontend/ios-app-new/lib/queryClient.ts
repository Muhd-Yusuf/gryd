/**
 * React Query Configuration
 * Centralized query client with optimized defaults for mobile
 *
 * Key features for native app feel:
 * - Persistent cache to AsyncStorage (survives app restarts)
 * - Show stale data immediately, refresh in background
 * - Longer stale times for better perceived performance
 */

import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create query client with mobile-optimized defaults
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 10 minutes - won't refetch during this time
            staleTime: 10 * 60 * 1000,
            // Keep unused data in cache for 24 hours (persisted to disk)
            gcTime: 24 * 60 * 60 * 1000,
            // Retry failed requests 2 times with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Don't refetch on window focus for mobile (saves battery/data)
            refetchOnWindowFocus: false,
            // Refetch when network reconnects
            refetchOnReconnect: 'always',
            // Refetch on mount only if data is stale - respects staleTime settings
            // With staleTime: Infinity, this means no refetch if cached data exists
            refetchOnMount: true,
            // Keep showing old data while fetching new data
            placeholderData: (previousData: any) => previousData,
        },
        mutations: {
            // Retry mutations once on failure
            retry: 1,
        },
    },
});

// Create AsyncStorage persister for React Query cache
export const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'GRYD_REACT_QUERY_CACHE',
    // Throttle writes to storage - balance between performance and data safety
    throttleTime: 250,
    // Serialize/deserialize functions (default JSON is fine)
});

// Query key factory for consistent key management
export const queryKeys = {
    // Auth
    auth: {
        user: ['auth', 'user'] as const,
        subgrids: ['auth', 'subgrids'] as const,
    },

    // Community/Subgrid data
    subgrids: {
        all: ['subgrids'] as const,
        list: (tenantId: string) => ['subgrids', 'list', tenantId] as const,
        detail: (subgridId: string) => ['subgrids', 'detail', subgridId] as const,
        channels: (subgridId: string) => ['subgrids', subgridId, 'channels'] as const,
        posts: (subgridId: string) => ['subgrids', subgridId, 'posts'] as const,
        members: (subgridId: string) => ['subgrids', subgridId, 'members'] as const,
        friends: (subgridId: string) => ['subgrids', subgridId, 'friends'] as const,
        events: (subgridId: string) => ['subgrids', subgridId, 'events'] as const,
        categories: (subgridId: string) => ['subgrids', subgridId, 'categories'] as const,
        roles: (subgridId: string) => ['subgrids', subgridId, 'roles'] as const,
        roleMembers: (subgridId: string, roleId: string) => ['subgrids', subgridId, 'roles', roleId, 'members'] as const,
        contentModeration: (subgridId: string) => ['subgrids', subgridId, 'contentModeration'] as const,
        messages: (subgridId: string) => ['subgrids', subgridId, 'messages'] as const,
    },

    // Messages
    messages: {
        channel: (subgridId: string, channelId: string) => ['messages', 'channel', subgridId, channelId] as const,
        dm: (subgridId: string, peerId: string) => ['messages', 'dm', subgridId, peerId] as const,
        dmList: (subgridId: string) => ['messages', 'dmList', subgridId] as const,
    },

    // Users
    users: {
        profile: (userId: string) => ['users', 'profile', userId] as const,
        me: ['users', 'me'] as const,
    },

    // Super Admin
    superAdmin: {
        overview: (growthDays?: number) => ['superAdmin', 'overview', growthDays] as const,
        customers: (params?: { q?: string; limit?: number; offset?: number; status?: string }) =>
            ['superAdmin', 'customers', params] as const,
        customerDetail: (customerId: string) => ['superAdmin', 'customers', customerId] as const,
        moderation: (params?: { status?: string; limit?: number; offset?: number }) =>
            ['superAdmin', 'moderation', params] as const,
        config: ['superAdmin', 'config'] as const,
        users: (params?: { q?: string; limit?: number; offset?: number; role?: string }) =>
            ['superAdmin', 'users', params] as const,
        team: (params?: { q?: string; limit?: number; offset?: number }) =>
            ['superAdmin', 'team', params] as const,
    },

    // Notifications
    notifications: {
        inbox: (params?: { limit?: number; offset?: number; type?: string; unreadOnly?: boolean }) =>
            ['notifications', 'inbox', params] as const,
        unreadCount: ['notifications', 'unreadCount'] as const,
        preferences: ['notifications', 'preferences'] as const,
    },

    // Calls
    calls: {
        history: (params?: { limit?: number; offset?: number; callType?: string; peerId?: string }) =>
            ['calls', 'history', params] as const,
        voiceChannelParticipants: (channelId: string, subgridId?: string) =>
            ['calls', 'voiceChannel', channelId, subgridId] as const,
    },
};
