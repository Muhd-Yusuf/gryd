/**
 * React Query hooks for Subgrid/Community data
 * Handles channels, posts, members, friends, events, categories
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
    communityGet,
    communityPost,
    communityPatch,
    communityDelete,
    getCustomRoles,
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    getCustomRoleMembers,
    assignCustomRole,
    getContentModerationSettings,
    updateContentModerationSettings,
    addProhibitedWords,
    removeProhibitedWords,
} from '../../lib/api';

// ==================
// SUBGRID QUERIES
// ==================

export const useSubgrids = (tenantId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.list(tenantId),
        queryFn: async () => {
            const response = await communityGet(`/tenants/${tenantId}/subgrids`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Never stale - show cached data instantly, refetch manually
        gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useSubgridDetail = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.detail(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}`);
            return response?.data;
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useMyRole = (subgridId: string) => {
    return useQuery({
        queryKey: ['subgrids', subgridId, 'my-role'],
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/my-role`);
            return response?.data?.role || null;
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// CHANNELS
// ==================

export const useChannels = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.channels(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/channels`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useCreateChannel = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; type?: string; category?: string }) => {
            const response = await communityPost(`/subgrids/${subgridId}/channels`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.channels(subgridId) });
        },
    });
};

export const useUpdateChannel = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, data }: { channelId: string; data: Partial<{ name: string; type: string; category: string }> }) => {
            const response = await communityPatch(`/subgrids/${subgridId}/channels/${channelId}`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.channels(subgridId) });
        },
    });
};

export const useDeleteChannel = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (channelId: string) => {
            await communityDelete(`/subgrids/${subgridId}/channels/${channelId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.channels(subgridId) });
        },
    });
};

// ==================
// POSTS
// ==================

export const usePosts = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.posts(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/posts`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// SUBGRID MESSAGES (all messages in subgrid)
// ==================

export const useSubgridMessages = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.messages(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/messages`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useCreatePost = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { content: string; channelId?: string; mediaUrls?: string[] }) => {
            const response = await communityPost(`/subgrids/${subgridId}/posts`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
        },
    });
};

// ==================
// MEMBERS
// ==================

export const useMembers = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.members(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/members`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useUpdateMemberRole = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
            const response = await communityPatch(`/subgrids/${subgridId}/members/${memberId}`, { role });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.members(subgridId) });
        },
    });
};

export const useRemoveMember = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (memberId: string) => {
            await communityDelete(`/subgrids/${subgridId}/members/${memberId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.members(subgridId) });
        },
    });
};

// ==================
// FRIENDS
// ==================

export const useFriends = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.friends(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/friends`);
            return response?.data || { friends: [], users: {} };
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useFriendRequests = (subgridId: string, direction: 'incoming' | 'outgoing') => {
    return useQuery({
        queryKey: ['subgrids', subgridId, 'friend-requests', direction],
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/friend-requests?direction=${direction}`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useAcceptFriendRequest = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (requestId: string) => {
            const response = await communityPost(`/subgrids/${subgridId}/friend-requests/${requestId}/accept`, {});
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.friends(subgridId) });
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'friend-requests'] });
        },
    });
};

export const useDeclineFriendRequest = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (requestId: string) => {
            await communityDelete(`/subgrids/${subgridId}/friend-requests/${requestId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'friend-requests'] });
        },
    });
};

export const useSendFriendRequest = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (recipientId: string) => {
            const response = await communityPost(`/subgrids/${subgridId}/friend-requests`, { recipientId });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'friend-requests', 'outgoing'] });
        },
    });
};

export const useBlocks = (subgridId: string) => {
    return useQuery({
        queryKey: ['subgrids', subgridId, 'blocks'],
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/blocks`);
            return response?.data || { blocked: [], users: {} };
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Never stale - show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useBlockUser = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (targetUserId: string) => {
            const response = await communityPost(`/subgrids/${subgridId}/blocks`, { targetUserId });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'blocks'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.friends(subgridId) });
        },
    });
};

export const useUnblockUser = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (targetUserId: string) => {
            await communityDelete(`/subgrids/${subgridId}/blocks/${targetUserId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'blocks'] });
        },
    });
};

export const useRemoveFriend = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (friendId: string) => {
            await communityDelete(`/subgrids/${subgridId}/friends/${friendId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.friends(subgridId) });
        },
    });
};

// ==================
// EVENTS
// ==================

export const useEvents = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.events(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/events`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useCreateEvent = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            title: string;
            description?: string;
            startDate: string;
            endDate?: string;
            location?: string;
            coverImageUrl?: string;
        }) => {
            const response = await communityPost(`/subgrids/${subgridId}/events`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.events(subgridId) });
        },
    });
};

export const useUpdateEvent = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ eventId, data }: { eventId: string; data: Partial<{ title: string; description: string; startDate: string; endDate: string; location: string }> }) => {
            const response = await communityPatch(`/subgrids/${subgridId}/events/${eventId}`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.events(subgridId) });
        },
    });
};

export const useDeleteEvent = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (eventId: string) => {
            await communityDelete(`/subgrids/${subgridId}/events/${eventId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.events(subgridId) });
        },
    });
};

// ==================
// CATEGORIES
// ==================

export const useCategories = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.categories(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/categories`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useCreateCategory = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; color?: string }) => {
            const response = await communityPost(`/subgrids/${subgridId}/categories`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.categories(subgridId) });
        },
    });
};

// ==================
// CUSTOM ROLES
// ==================

export const useCustomRoles = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.roles(subgridId),
        queryFn: async () => {
            const response = await getCustomRoles(subgridId);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useCustomRoleMembers = (subgridId: string, roleId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.roleMembers(subgridId, roleId),
        queryFn: async () => {
            const response = await getCustomRoleMembers(subgridId, roleId);
            return response?.data || [];
        },
        enabled: !!subgridId && !!roleId,
    });
};

export const useCreateCustomRole = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; color?: string; icon?: string; displayOrder?: number; isVisible?: boolean; canBeMessaged?: boolean }) => {
            const response = await createCustomRole(subgridId, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.roles(subgridId) });
        },
    });
};

export const useUpdateCustomRole = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ roleId, data }: { roleId: string; data: Partial<{ name: string; color: string; icon: string; displayOrder: number; isVisible: boolean; canBeMessaged: boolean }> }) => {
            const response = await updateCustomRole(subgridId, roleId, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.roles(subgridId) });
        },
    });
};

export const useDeleteCustomRole = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (roleId: string) => {
            await deleteCustomRole(subgridId, roleId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.roles(subgridId) });
        },
    });
};

export const useAssignCustomRole = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ memberId, roleId }: { memberId: string; roleId: string | null }) => {
            const response = await assignCustomRole(subgridId, memberId, roleId);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.members(subgridId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.roles(subgridId) });
        },
    });
};

// ==================
// CONTENT MODERATION
// ==================

export const useContentModerationSettings = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.subgrids.contentModeration(subgridId),
        queryFn: async () => {
            const response = await getContentModerationSettings(subgridId);
            return response?.data;
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useUpdateContentModeration = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { enabled?: boolean; action?: 'block' | 'flag' | 'censor'; blockedMessage?: string }) => {
            const response = await updateContentModerationSettings(subgridId, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.contentModeration(subgridId) });
        },
    });
};

export const useAddProhibitedWords = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (words: string[]) => {
            const response = await addProhibitedWords(subgridId, words);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.contentModeration(subgridId) });
        },
    });
};

export const useRemoveProhibitedWords = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (words: string[]) => {
            const response = await removeProhibitedWords(subgridId, words);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.contentModeration(subgridId) });
        },
    });
};

// ==================
// ENGAGEMENT SETTINGS
// ==================

export const useEngagementSettings = (subgridId: string) => {
    return useQuery({
        queryKey: ['subgrids', subgridId, 'engagement-settings'],
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}`);
            return response?.data?.engagementSettings || {
                joinMessage: true,
                uploadNotice: true,
                emojiReactions: true,
                autoEmoji: false,
            };
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useUpdateEngagementSettings = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: { joinMessage?: boolean; uploadNotice?: boolean; emojiReactions?: boolean; autoEmoji?: boolean }) => {
            const response = await communityPatch(`/subgrids/${subgridId}`, { engagementSettings: settings });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'engagement-settings'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.detail(subgridId) });
        },
    });
};

// ==================
// BANS
// ==================

export const useBannedUsers = (subgridId: string) => {
    return useQuery({
        queryKey: ['subgrids', subgridId, 'bans'],
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/bans`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useBanUser = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
            const response = await communityPost(`/subgrids/${subgridId}/bans`, { userId, reason });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'bans'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.members(subgridId) });
        },
    });
};

export const useUnbanUser = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (odl: string) => {
            const response = await communityDelete(`/subgrids/${subgridId}/bans/${odl}`);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'bans'] });
        },
    });
};

// ==================
// SUBGRID UPDATE (Server Profile)
// ==================

export const useUpdateSubgrid = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name?: string; description?: string; logoUrl?: string; coverImageUrl?: string; icon?: string; banner?: string; status?: string; engagementSettings?: any }) => {
            const response = await communityPatch(`/subgrids/${subgridId}`, data);
            return response?.data;
        },
        onSuccess: (updatedSubgrid, variables) => {
            // Update the subgrid detail cache
            queryClient.setQueryData(queryKeys.subgrids.detail(subgridId), updatedSubgrid);

            // Update the subgrid in all list caches
            queryClient.setQueriesData(
                { queryKey: ['subgrids', 'list'] },
                (oldData: any[] | undefined) => {
                    if (!oldData) return oldData;
                    return oldData.map((subgrid: any) =>
                        subgrid._id === subgridId
                            ? { ...subgrid, ...variables, ...(updatedSubgrid || {}) }
                            : subgrid
                    );
                }
            );

            // Also invalidate to ensure fresh data on next fetch
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.detail(subgridId) });
            queryClient.invalidateQueries({ queryKey: ['subgrids', 'list'] });
        },
    });
};

// ==================
// MEMBER STATUS/ROLE MUTATIONS
// ==================

export const useUpdateMemberStatus = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ memberId, status }: { memberId: string; status: 'active' | 'muted' | 'suspended' }) => {
            const response = await communityPatch(`/subgrids/${subgridId}/members/${memberId}`, { status });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.members(subgridId) });
        },
    });
};

// ==================
// CATEGORY MUTATIONS
// ==================

export const useDeleteCategory = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (categoryId: string) => {
            await communityDelete(`/subgrids/${subgridId}/categories/${categoryId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.categories(subgridId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.channels(subgridId) });
        },
    });
};

// ==================
// POST MUTATIONS
// ==================

export const useDeletePost = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (postId: string) => {
            await communityDelete(`/subgrids/${subgridId}/posts/${postId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
        },
    });
};

// ==================
// MESSAGE MUTATIONS
// ==================

export const useDeleteMessage = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (messageId: string) => {
            await communityDelete(`/subgrids/${subgridId}/messages/${messageId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
        },
    });
};

export const usePinMessage = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (messageId: string) => {
            const response = await communityPost(`/subgrids/${subgridId}/messages/${messageId}/pin`, {});
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
        },
    });
};

export const useUnpinMessage = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (messageId: string) => {
            await communityDelete(`/subgrids/${subgridId}/messages/${messageId}/pin`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
        },
    });
};

// ==================
// LIKE/RESHARE MUTATIONS
// ==================

export const useLikeItem = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, itemType }: { itemId: string; itemType: 'posts' | 'messages' }) => {
            const response = await communityPost(`/subgrids/${subgridId}/${itemType}/${itemId}/like`, {});
            return response?.data;
        },
        onSuccess: (_, { itemType }) => {
            if (itemType === 'posts') {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
            }
        },
    });
};

export const useUnlikeItem = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, itemType }: { itemId: string; itemType: 'posts' | 'messages' }) => {
            await communityDelete(`/subgrids/${subgridId}/${itemType}/${itemId}/like`);
        },
        onSuccess: (_, { itemType }) => {
            if (itemType === 'posts') {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
            }
        },
    });
};

export const useReshareItem = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, itemType }: { itemId: string; itemType: 'posts' | 'messages' }) => {
            const response = await communityPost(`/subgrids/${subgridId}/${itemType}/${itemId}/reshare`, {});
            return response?.data;
        },
        onSuccess: (_, { itemType }) => {
            if (itemType === 'posts') {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
            }
        },
    });
};

export const useUnreshareItem = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, itemType }: { itemId: string; itemType: 'posts' | 'messages' }) => {
            await communityDelete(`/subgrids/${subgridId}/${itemType}/${itemId}/reshare`);
        },
        onSuccess: (_, { itemType }) => {
            if (itemType === 'posts') {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
            }
        },
    });
};

// ==================
// CHANNEL MEMBERS
// ==================

export const useAddChannelMember = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
            const response = await communityPost(`/subgrids/${subgridId}/channels/${channelId}/members`, { userId });
            return response?.data;
        },
        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
        },
    });
};

export const useRemoveChannelMember = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, userId }: { channelId: string; userId: string }) => {
            await communityDelete(`/subgrids/${subgridId}/channels/${channelId}/members/${userId}`);
        },
        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['channels', channelId, 'members'] });
        },
    });
};

// ==================
// COMMENTS
// ==================

export const useCreateComment = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, itemType, body }: { itemId: string; itemType: 'posts' | 'messages'; body: string }) => {
            const endpoint = `/subgrids/${subgridId}/${itemType}/${itemId}/comments`;
            const response = await communityPost(endpoint, { body });
            return response?.data;
        },
        onSuccess: (_, { itemType }) => {
            if (itemType === 'posts') {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
            }
        },
    });
};

// ==================
// MODERATION
// ==================

export const useFlagContent = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemType, itemId, reason }: { itemType: 'posts' | 'messages'; itemId: string; reason: string }) => {
            const path = `/subgrids/${subgridId}/${itemType}/${itemId}/flag`;
            const response = await communityPost(path, { reason });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'moderation'] });
        },
    });
};

export const useModerationAction = (subgridId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ flagId, action, notes }: { flagId: string; action: 'approve' | 'reject' | 'delete'; notes?: string }) => {
            const response = await communityPost(`/subgrids/${subgridId}/moderation/${flagId}/action`, { action, notes });
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrids', subgridId, 'moderation'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.posts(subgridId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.messages(subgridId) });
        },
    });
};

// ==================
// CREATE SUBGRID
// ==================

export const useCreateSubgrid = (tenantId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; description?: string; visibility?: string }) => {
            const response = await communityPost(`/tenants/${tenantId}/subgrids`, data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subgrids.list(tenantId) });
        },
    });
};

// ==================
// COMBINED DATA HOOK (for dashboard)
// ==================

export const useSubgridDashboardData = (subgridId: string) => {
    const channels = useChannels(subgridId);
    const posts = usePosts(subgridId);
    const members = useMembers(subgridId);
    const friends = useFriends(subgridId);
    const events = useEvents(subgridId);
    const categories = useCategories(subgridId);

    return {
        channels,
        posts,
        members,
        friends,
        events,
        categories,
        isLoading: channels.isLoading || posts.isLoading || members.isLoading || friends.isLoading || events.isLoading || categories.isLoading,
        isError: channels.isError || posts.isError || members.isError || friends.isError || events.isError || categories.isError,
        refetchAll: () => {
            channels.refetch();
            posts.refetch();
            members.refetch();
            friends.refetch();
            events.refetch();
            categories.refetch();
        },
    };
};
