/**
 * React Query hooks for Messages and Direct Messages
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import { communityGet, communityPost, communityDelete } from '../../lib/api';

// ==================
// CHANNEL MESSAGES
// ==================

interface MessageQueryParams {
    limit?: number;
    before?: string;
}

export const useChannelMessages = (subgridId: string, channelId: string, params?: MessageQueryParams) => {
    return useQuery({
        queryKey: queryKeys.messages.channel(subgridId, channelId),
        queryFn: async () => {
            const queryParams = new URLSearchParams();
            queryParams.append('channelId', channelId);
            if (params?.limit) queryParams.append('limit', String(params.limit));
            if (params?.before) queryParams.append('before', params.before);

            const response = await communityGet(`/subgrids/${subgridId}/messages?${queryParams.toString()}`);
            return response?.data || [];
        },
        enabled: !!subgridId && !!channelId,
        staleTime: Infinity, // Show cached data instantly - realtime updates via WebSocket
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache + WebSocket updates
        refetchOnWindowFocus: false, // Don't refetch on window focus
    });
};

export const useSendChannelMessage = (subgridId: string, channelId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { content: string; mediaUrls?: string[]; subgridId?: string; channelId?: string }) => {
            // Use passed values or fall back to hook params
            const targetSubgridId = data.subgridId || subgridId;
            const targetChannelId = data.channelId || channelId;

            console.log('[useSendChannelMessage] Sending to subgridId:', targetSubgridId, 'channelId:', targetChannelId);

            if (!targetSubgridId || !targetChannelId) {
                throw new Error('Missing subgridId or channelId for sending channel message');
            }

            // Use the same endpoint format as the original code
            const response = await communityPost(`/subgrids/${targetSubgridId}/messages`, {
                channelId: targetChannelId,
                body: data.content,
                attachments: data.mediaUrls?.map(url => ({
                    type: url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? 'image' :
                          url.match(/\.(mp3|wav|m4a|webm|ogg)/i) ? 'audio' : 'file',
                    value: url,
                })) || [],
            });
            console.log('[useSendChannelMessage] Response:', response);
            return { ...response?.data, _subgridId: targetSubgridId, _channelId: targetChannelId };
        },
        onSuccess: (newMessage) => {
            // Optimistically add message to cache
            if (newMessage) {
                const targetSubgridId = newMessage._subgridId || subgridId;
                const targetChannelId = newMessage._channelId || channelId;
                // Remove temporary fields
                const cleanMessage = { ...newMessage };
                delete cleanMessage._subgridId;
                delete cleanMessage._channelId;

                queryClient.setQueryData(
                    queryKeys.messages.channel(targetSubgridId, targetChannelId),
                    (old: any[] | undefined) => {
                        if (!old) return [cleanMessage];
                        // Avoid duplicates
                        if (old.some(m => m._id === cleanMessage._id)) return old;
                        return [...old, cleanMessage];
                    }
                );
            }
        },
    });
};

export const useDeleteChannelMessage = (subgridId: string, channelId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (messageId: string) => {
            await communityDelete(`/subgrids/${subgridId}/channels/${channelId}/messages/${messageId}`);
            return messageId;
        },
        onSuccess: (deletedId) => {
            queryClient.setQueryData(
                queryKeys.messages.channel(subgridId, channelId),
                (old: any[] | undefined) => {
                    if (!old) return [];
                    return old.filter((msg: any) => msg._id !== deletedId);
                }
            );
        },
    });
};

// ==================
// DIRECT MESSAGES
// ==================

export const useDirectMessages = (subgridId: string, peerId: string, params?: MessageQueryParams) => {
    return useQuery({
        queryKey: queryKeys.messages.dm(subgridId, peerId),
        queryFn: async () => {
            const queryParams = new URLSearchParams();
            if (params?.limit) queryParams.append('limit', String(params.limit));
            if (params?.before) queryParams.append('before', params.before);
            const query = queryParams.toString();

            const response = await communityGet(`/subgrids/${subgridId}/direct-messages?peerId=${peerId}${query ? `&${query}` : ''}`);
            return response?.data || [];
        },
        enabled: !!subgridId && !!peerId,
        staleTime: Infinity, // Show cached data instantly - realtime updates via WebSocket
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache + WebSocket updates
        refetchOnWindowFocus: false, // Don't refetch on window focus
    });
};

export const useSendDirectMessage = (subgridId: string, peerId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { content: string; mediaUrls?: string[]; subgridId?: string; peerId?: string }) => {
            // Use passed values or fall back to hook params
            const targetSubgridId = data.subgridId || subgridId;
            const targetPeerId = data.peerId || peerId;

            console.log('[useSendDirectMessage] Sending to subgridId:', targetSubgridId, 'peerId:', targetPeerId);
            console.log('[useSendDirectMessage] Message data:', data);

            if (!targetSubgridId || !targetPeerId) {
                throw new Error('Missing subgridId or peerId for sending DM');
            }

            // Build attachments from mediaUrls if provided
            const attachments = data.mediaUrls?.map(url => ({
                type: url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? 'image' :
                      url.match(/\.(mp3|wav|m4a|webm|ogg)/i) ? 'audio' : 'file',
                value: url,
            })) || [];

            const response = await communityPost(`/subgrids/${targetSubgridId}/direct-messages`, {
                recipientId: targetPeerId,
                body: data.content,
                attachments,
            });
            console.log('[useSendDirectMessage] Response:', response);
            return { ...response?.data, _subgridId: targetSubgridId, _peerId: targetPeerId };
        },
        onSuccess: (newMessage) => {
            if (newMessage) {
                const targetSubgridId = newMessage._subgridId || subgridId;
                const targetPeerId = newMessage._peerId || peerId;
                // Remove temporary fields
                const cleanMessage = { ...newMessage };
                delete cleanMessage._subgridId;
                delete cleanMessage._peerId;

                queryClient.setQueryData(
                    queryKeys.messages.dm(targetSubgridId, targetPeerId),
                    (old: any[] | undefined) => {
                        if (!old) return [cleanMessage];
                        // Avoid duplicates
                        if (old.some(m => m._id === cleanMessage._id)) return old;
                        return [...old, cleanMessage];
                    }
                );
                // Also invalidate DM list to update last message
                queryClient.invalidateQueries({ queryKey: queryKeys.messages.dmList(targetSubgridId) });
            }
        },
    });
};

// ==================
// DM LIST (Conversations)
// ==================

export const useDMList = (subgridId: string) => {
    return useQuery({
        queryKey: queryKeys.messages.dmList(subgridId),
        queryFn: async () => {
            const response = await communityGet(`/subgrids/${subgridId}/direct-messages/conversations`);
            return response?.data || [];
        },
        enabled: !!subgridId,
        staleTime: Infinity, // Show cached data instantly
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

// ==================
// INFINITE SCROLL MESSAGES
// ==================

export const useInfiniteChannelMessages = (subgridId: string, channelId: string) => {
    return useInfiniteQuery({
        queryKey: [...queryKeys.messages.channel(subgridId, channelId), 'infinite'],
        queryFn: async ({ pageParam }) => {
            const queryParams = new URLSearchParams();
            queryParams.append('limit', '50');
            if (pageParam) queryParams.append('before', pageParam);

            const response = await communityGet(`/subgrids/${subgridId}/channels/${channelId}/messages?${queryParams.toString()}`);
            return response?.data || [];
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => {
            if (lastPage.length < 50) return undefined;
            return lastPage[0]?._id;
        },
        enabled: !!subgridId && !!channelId,
        staleTime: Infinity, // Show cached instantly
    });
};

export const useInfiniteDirectMessages = (subgridId: string, peerId: string) => {
    return useInfiniteQuery({
        queryKey: [...queryKeys.messages.dm(subgridId, peerId), 'infinite'],
        queryFn: async ({ pageParam }) => {
            const queryParams = new URLSearchParams();
            queryParams.append('peerId', peerId);
            queryParams.append('limit', '50');
            if (pageParam) queryParams.append('before', pageParam);

            const response = await communityGet(`/subgrids/${subgridId}/direct-messages?${queryParams.toString()}`);
            return response?.data || [];
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => {
            if (lastPage.length < 50) return undefined;
            return lastPage[0]?._id;
        },
        enabled: !!subgridId && !!peerId,
        staleTime: Infinity, // Show cached instantly
    });
};

// ==================
// REALTIME MESSAGE HELPERS
// ==================

/**
 * Add a new message to the cache (call this when receiving via WebSocket)
 */
export const addMessageToCache = (
    queryClient: ReturnType<typeof useQueryClient>,
    type: 'channel' | 'dm',
    subgridId: string,
    targetId: string, // channelId or peerId
    message: any
) => {
    const queryKey = type === 'channel'
        ? queryKeys.messages.channel(subgridId, targetId)
        : queryKeys.messages.dm(subgridId, targetId);

    queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
        if (!old) return [message];
        // Check if message already exists
        if (old.some((m: any) => m._id === message._id)) return old;
        return [...old, message];
    });
};

/**
 * Remove a message from the cache (call this when message is deleted via WebSocket)
 */
export const removeMessageFromCache = (
    queryClient: ReturnType<typeof useQueryClient>,
    type: 'channel' | 'dm',
    subgridId: string,
    targetId: string,
    messageId: string
) => {
    const queryKey = type === 'channel'
        ? queryKeys.messages.channel(subgridId, targetId)
        : queryKeys.messages.dm(subgridId, targetId);

    queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
        if (!old) return [];
        return old.filter((m: any) => m._id !== messageId);
    });
};
