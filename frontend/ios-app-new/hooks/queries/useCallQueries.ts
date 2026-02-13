/**
 * React Query hooks for Voice/Video Call data
 * Handles voice channel participants, call history, etc.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
    getVoiceChannelParticipants,
    joinVoiceChannel,
    leaveVoiceChannel,
    waveToSpeak,
    cancelWave,
    grantSpeaker,
    revokeSpeaker,
    muteParticipant,
    updateVoiceChannelMuteState,
} from '../../lib/api';

// ==================
// VOICE CHANNEL PARTICIPANTS
// ==================

export const useVoiceChannelParticipants = (channelId: string, subgridId?: string) => {
    return useQuery({
        queryKey: queryKeys.calls.voiceChannelParticipants(channelId, subgridId),
        queryFn: async () => {
            const response = await getVoiceChannelParticipants(channelId, subgridId);
            return response?.data || { participants: [], hostId: null, waveRequests: [] };
        },
        enabled: !!channelId,
        staleTime: 2 * 1000, // 2 seconds - voice channels need fresh data
        refetchInterval: 3000, // Auto-refetch every 3 seconds
    });
};

// ==================
// VOICE CHANNEL MUTATIONS
// ==================

export const useJoinVoiceChannel = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, subgridId, agoraUid }: { channelId: string; subgridId?: string; agoraUid: number }) => {
            const response = await joinVoiceChannel(channelId, subgridId, agoraUid);
            return response;
        },
        onSuccess: (_, { channelId, subgridId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.calls.voiceChannelParticipants(channelId, subgridId) });
        },
    });
};

export const useLeaveVoiceChannel = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, agoraUid }: { channelId: string; agoraUid: number }) => {
            const response = await leaveVoiceChannel(channelId, agoraUid);
            return response;
        },
        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['calls', 'voiceChannel', channelId] });
        },
    });
};

export const useWaveToSpeak = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (channelId: string) => {
            const response = await waveToSpeak(channelId);
            return response;
        },
        onSuccess: (_, channelId) => {
            queryClient.invalidateQueries({ queryKey: ['calls', 'voiceChannel', channelId] });
        },
    });
};

export const useCancelWave = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (channelId: string) => {
            const response = await cancelWave(channelId);
            return response;
        },
        onSuccess: (_, channelId) => {
            queryClient.invalidateQueries({ queryKey: ['calls', 'voiceChannel', channelId] });
        },
    });
};

export const useGrantSpeaker = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, targetUserId }: { channelId: string; targetUserId: string }) => {
            const response = await grantSpeaker(channelId, targetUserId);
            return response;
        },
        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['calls', 'voiceChannel', channelId] });
        },
    });
};

export const useRevokeSpeaker = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, targetUserId }: { channelId: string; targetUserId: string }) => {
            const response = await revokeSpeaker(channelId, targetUserId);
            return response;
        },
        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['calls', 'voiceChannel', channelId] });
        },
    });
};

export const useMuteParticipant = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId, targetUserId, mute }: { channelId: string; targetUserId: string; mute: boolean }) => {
            const response = await muteParticipant(channelId, targetUserId, mute);
            return response;
        },
        onSuccess: (_, { channelId }) => {
            queryClient.invalidateQueries({ queryKey: ['calls', 'voiceChannel', channelId] });
        },
    });
};

export const useUpdateMuteState = () => {
    return useMutation({
        mutationFn: async ({ channelId, isMuted }: { channelId: string; isMuted: boolean }) => {
            const response = await updateVoiceChannelMuteState(channelId, isMuted);
            return response;
        },
    });
};
