/**
 * Dashboard Data Hook
 * Wrapper hook that provides React Query data with backward compatibility
 * Can be gradually adopted in existing components
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    useSubgrids,
    useChannels,
    usePosts,
    useMembers,
    useFriends,
    useEvents,
    useCategories,
    useSubgridDashboardData,
} from './queries/useSubgridQueries';
import {
    useChannelMessages,
    useDirectMessages,
    useDMList,
    addMessageToCache,
    removeMessageFromCache,
} from './queries/useMessageQueries';
import { queryKeys } from '../lib/queryClient';
import { cacheUsers, cacheFriends } from '../lib/userCache';

/**
 * Hook for Member Dashboard data
 * Replaces the multiple useEffect fetches with React Query
 */
export const useMemberDashboard = (tenantId: string, activeSubgridId: string) => {
    const queryClient = useQueryClient();

    // Subgrids list
    const subgridsQuery = useSubgrids(tenantId);

    // All subgrid data in parallel
    const dashboardData = useSubgridDashboardData(activeSubgridId);

    // Cache members for DM loading (backward compatibility)
    useEffect(() => {
        if (dashboardData.members.data) {
            const memberProfiles: Record<string, any> = {};
            dashboardData.members.data.forEach((m: any) => {
                if (m.userId) {
                    memberProfiles[m.userId] = {
                        id: m.userId,
                        firstName: m.firstName,
                        lastName: m.lastName,
                        email: m.email,
                        avatarUrl: m.avatarUrl,
                        role: m.role || m.userRole,
                    };
                }
            });
            cacheUsers(memberProfiles);
        }
    }, [dashboardData.members.data]);

    // Cache friends (backward compatibility)
    useEffect(() => {
        if (dashboardData.friends.data && activeSubgridId) {
            const friendsList = dashboardData.friends.data?.friends || [];
            const users = dashboardData.friends.data?.users || {};
            cacheFriends(activeSubgridId, friendsList, users);
        }
    }, [dashboardData.friends.data, activeSubgridId]);

    return {
        // Subgrids
        subgrids: subgridsQuery.data || [],
        subgridsLoading: subgridsQuery.isLoading,
        refetchSubgrids: subgridsQuery.refetch,

        // Channels
        channels: dashboardData.channels.data || [],
        channelsLoading: dashboardData.channels.isLoading,
        refetchChannels: dashboardData.channels.refetch,

        // Posts
        posts: dashboardData.posts.data || [],
        postsLoading: dashboardData.posts.isLoading,
        refetchPosts: dashboardData.posts.refetch,

        // Members
        members: dashboardData.members.data || [],
        membersLoading: dashboardData.members.isLoading,
        memberCount: dashboardData.members.data?.length || 0,
        refetchMembers: dashboardData.members.refetch,

        // Friends
        friends: dashboardData.friends.data?.friends || [],
        friendUsers: dashboardData.friends.data?.users || {},
        friendsLoading: dashboardData.friends.isLoading,
        refetchFriends: dashboardData.friends.refetch,

        // Events
        events: dashboardData.events.data || [],
        eventsLoading: dashboardData.events.isLoading,
        refetchEvents: dashboardData.events.refetch,

        // Categories
        categories: dashboardData.categories.data || [],
        categoriesLoading: dashboardData.categories.isLoading,
        refetchCategories: dashboardData.categories.refetch,

        // Combined state - partial loading support
        isLoading: dashboardData.isLoading || subgridsQuery.isLoading,
        isPartiallyLoaded: subgridsQuery.isSuccess || dashboardData.channels.isSuccess || dashboardData.members.isSuccess,
        isError: dashboardData.isError || subgridsQuery.isError,
        refetchAll: () => {
            subgridsQuery.refetch();
            dashboardData.refetchAll();
        },
    };
};

/**
 * Hook for channel messages with WebSocket integration support
 */
export const useChannelMessagesWithRealtime = (subgridId: string, channelId: string) => {
    const queryClient = useQueryClient();
    const messagesQuery = useChannelMessages(subgridId, channelId);

    // Helper to add message from WebSocket
    const addMessage = (message: any) => {
        addMessageToCache(queryClient, 'channel', subgridId, channelId, message);
    };

    // Helper to remove message from WebSocket
    const removeMessage = (messageId: string) => {
        removeMessageFromCache(queryClient, 'channel', subgridId, channelId, messageId);
    };

    // Helper to update message from WebSocket
    const updateMessage = (message: any) => {
        queryClient.setQueryData(
            queryKeys.messages.channel(subgridId, channelId),
            (old: any[] | undefined) => {
                if (!old) return [message];
                return old.map((m: any) => m._id === message._id ? message : m);
            }
        );
    };

    return {
        messages: messagesQuery.data || [],
        isLoading: messagesQuery.isLoading,
        isError: messagesQuery.isError,
        refetch: messagesQuery.refetch,
        // WebSocket helpers
        addMessage,
        removeMessage,
        updateMessage,
    };
};

/**
 * Hook for DM messages with WebSocket integration support
 */
export const useDMMessagesWithRealtime = (subgridId: string, peerId: string) => {
    const queryClient = useQueryClient();
    const messagesQuery = useDirectMessages(subgridId, peerId);

    const addMessage = (message: any) => {
        addMessageToCache(queryClient, 'dm', subgridId, peerId, message);
    };

    const removeMessage = (messageId: string) => {
        removeMessageFromCache(queryClient, 'dm', subgridId, peerId, messageId);
    };

    return {
        messages: messagesQuery.data || [],
        isLoading: messagesQuery.isLoading,
        isError: messagesQuery.isError,
        refetch: messagesQuery.refetch,
        addMessage,
        removeMessage,
    };
};

/**
 * Invalidate all dashboard data (useful after mutations)
 */
export const useInvalidateDashboard = () => {
    const queryClient = useQueryClient();

    return {
        invalidateSubgrids: (tenantId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.list(tenantId) });
        },
        invalidateChannels: (subgridId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.channels(subgridId) });
        },
        invalidatePosts: (subgridId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
        },
        invalidateMembers: (subgridId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.members(subgridId) });
        },
        invalidateMessages: (subgridId: string, channelId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(subgridId, channelId) });
        },
        invalidateAll: (tenantId: string, subgridId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.list(tenantId) });
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId] });
        },
    };
};
