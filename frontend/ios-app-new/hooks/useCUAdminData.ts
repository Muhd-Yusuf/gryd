/**
 * Credit Union Admin Dashboard Data Hook
 * Wrapper hook that provides React Query data with backward compatibility
 */

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    useChannels,
    useCreateChannel,
    useUpdateChannel,
    useDeleteChannel,
    useMembers,
    useUpdateMemberRole,
    useRemoveMember,
    useEvents,
    useCreateEvent,
    useUpdateEvent,
    useDeleteEvent,
    useCategories,
    useCreateCategory,
    useCustomRoles,
    useCreateCustomRole,
    useUpdateCustomRole,
    useDeleteCustomRole,
    useAssignCustomRole,
    useContentModerationSettings,
    useUpdateContentModeration,
    useAddProhibitedWords,
    useRemoveProhibitedWords,
    useSubgridDashboardData,
} from './queries/useSubgridQueries';
import { queryKeys } from '../lib/queryClient';

interface UseCUAdminDashboardOptions {
    subgridId: string;
}

/**
 * Main hook for CU Admin Dashboard
 * Provides all data with React Query caching
 */
export const useCUAdminDashboard = ({ subgridId }: UseCUAdminDashboardOptions) => {
    // All dashboard data
    const dashboardData = useSubgridDashboardData(subgridId);

    // Custom roles
    const rolesQuery = useCustomRoles(subgridId);

    // Content moderation
    const moderationQuery = useContentModerationSettings(subgridId);

    // Mutations for channels
    const createChannel = useCreateChannel(subgridId);
    const updateChannel = useUpdateChannel(subgridId);
    const deleteChannel = useDeleteChannel(subgridId);

    // Mutations for members
    const updateMemberRole = useUpdateMemberRole(subgridId);
    const removeMember = useRemoveMember(subgridId);

    // Mutations for events
    const createEvent = useCreateEvent(subgridId);
    const updateEvent = useUpdateEvent(subgridId);
    const deleteEvent = useDeleteEvent(subgridId);

    // Mutations for categories
    const createCategory = useCreateCategory(subgridId);

    // Mutations for custom roles
    const createRole = useCreateCustomRole(subgridId);
    const updateRole = useUpdateCustomRole(subgridId);
    const deleteRole = useDeleteCustomRole(subgridId);
    const assignRole = useAssignCustomRole(subgridId);

    // Mutations for content moderation
    const updateModeration = useUpdateContentModeration(subgridId);
    const addWords = useAddProhibitedWords(subgridId);
    const removeWords = useRemoveProhibitedWords(subgridId);

    return {
        // Data
        channels: dashboardData.channels.data || [],
        channelsLoading: dashboardData.channels.isLoading,
        refetchChannels: dashboardData.channels.refetch,

        members: dashboardData.members.data || [],
        membersLoading: dashboardData.members.isLoading,
        memberCount: dashboardData.members.data?.length || 0,
        refetchMembers: dashboardData.members.refetch,

        events: dashboardData.events.data || [],
        eventsLoading: dashboardData.events.isLoading,
        refetchEvents: dashboardData.events.refetch,

        categories: dashboardData.categories.data || [],
        categoriesLoading: dashboardData.categories.isLoading,
        refetchCategories: dashboardData.categories.refetch,

        customRoles: rolesQuery.data || [],
        rolesLoading: rolesQuery.isLoading,
        refetchRoles: rolesQuery.refetch,

        moderationSettings: moderationQuery.data,
        moderationLoading: moderationQuery.isLoading,
        refetchModeration: moderationQuery.refetch,

        // Channel mutations
        createChannel: createChannel.mutateAsync,
        updateChannel: (channelId: string, data: any) => updateChannel.mutateAsync({ channelId, data }),
        deleteChannel: deleteChannel.mutateAsync,
        channelMutating: createChannel.isPending || updateChannel.isPending || deleteChannel.isPending,

        // Member mutations
        updateMemberRole: (memberId: string, role: string) => updateMemberRole.mutateAsync({ memberId, role }),
        removeMember: removeMember.mutateAsync,
        memberMutating: updateMemberRole.isPending || removeMember.isPending,

        // Event mutations
        createEvent: createEvent.mutateAsync,
        updateEvent: (eventId: string, data: any) => updateEvent.mutateAsync({ eventId, data }),
        deleteEvent: deleteEvent.mutateAsync,
        eventMutating: createEvent.isPending || updateEvent.isPending || deleteEvent.isPending,

        // Category mutations
        createCategory: createCategory.mutateAsync,
        categoryMutating: createCategory.isPending,

        // Role mutations
        createRole: createRole.mutateAsync,
        updateRole: (roleId: string, data: any) => updateRole.mutateAsync({ roleId, data }),
        deleteRole: deleteRole.mutateAsync,
        assignRole: (memberId: string, roleId: string | null) => assignRole.mutateAsync({ memberId, roleId }),
        roleMutating: createRole.isPending || updateRole.isPending || deleteRole.isPending || assignRole.isPending,

        // Moderation mutations
        updateModeration: updateModeration.mutateAsync,
        addProhibitedWords: addWords.mutateAsync,
        removeProhibitedWords: removeWords.mutateAsync,
        moderationMutating: updateModeration.isPending || addWords.isPending || removeWords.isPending,

        // Combined state
        isLoading: dashboardData.isLoading,
        isError: dashboardData.isError,
        refetchAll: dashboardData.refetchAll,
    };
};

/**
 * Hook for managing a single channel
 */
export const useCUAdminChannel = (subgridId: string, channelId: string) => {
    const queryClient = useQueryClient();

    const updateChannel = useUpdateChannel(subgridId);
    const deleteChannel = useDeleteChannel(subgridId);

    return {
        update: (data: any) => updateChannel.mutateAsync({ channelId, data }),
        delete: () => deleteChannel.mutateAsync(channelId),
        isUpdating: updateChannel.isPending,
        isDeleting: deleteChannel.isPending,
    };
};

/**
 * Hook for managing members
 */
export const useCUAdminMembers = (subgridId: string) => {
    const membersQuery = useMembers(subgridId);
    const updateRole = useUpdateMemberRole(subgridId);
    const removeMember = useRemoveMember(subgridId);
    const assignRole = useAssignCustomRole(subgridId);

    return {
        members: membersQuery.data || [],
        isLoading: membersQuery.isLoading,
        refetch: membersQuery.refetch,
        updateRole: (memberId: string, role: string) => updateRole.mutateAsync({ memberId, role }),
        remove: removeMember.mutateAsync,
        assignCustomRole: (memberId: string, roleId: string | null) => assignRole.mutateAsync({ memberId, roleId }),
        isMutating: updateRole.isPending || removeMember.isPending || assignRole.isPending,
    };
};

/**
 * Hook for managing custom roles
 */
export const useCUAdminRoles = (subgridId: string) => {
    const rolesQuery = useCustomRoles(subgridId);
    const createRole = useCreateCustomRole(subgridId);
    const updateRole = useUpdateCustomRole(subgridId);
    const deleteRole = useDeleteCustomRole(subgridId);

    return {
        roles: rolesQuery.data || [],
        isLoading: rolesQuery.isLoading,
        refetch: rolesQuery.refetch,
        create: createRole.mutateAsync,
        update: (roleId: string, data: any) => updateRole.mutateAsync({ roleId, data }),
        delete: deleteRole.mutateAsync,
        isMutating: createRole.isPending || updateRole.isPending || deleteRole.isPending,
    };
};
