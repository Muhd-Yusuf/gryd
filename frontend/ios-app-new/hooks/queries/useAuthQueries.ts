/**
 * React Query hooks for Authentication and User data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
    getAuthUser,
    getUserSubgrids,
    updateUserProfile,
    initAuth,
    setAuthUser,
    logout as apiLogout,
    AuthUser,
    communityGet,
    communityPatch,
    uploadAvatar,
    uploadBanner,
    updateAuthUser,
    getNotificationInbox,
    markNotificationsAsRead,
    deleteNotifications,
    resolveTenantId,
} from '../../lib/api';

// ==================
// TENANT ID
// ==================

export const useTenantId = () => {
    return useQuery({
        queryKey: ['tenantId'],
        queryFn: async () => {
            const tenantId = await resolveTenantId();
            return tenantId || '';
        },
        staleTime: Infinity, // Show cached instantly
        gcTime: 60 * 60 * 1000,
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

// ==================
// CURRENT USER
// ==================

export const useCurrentUser = () => {
    return useQuery({
        queryKey: queryKeys.auth.user,
        queryFn: async () => {
            const user = await getAuthUser();
            return user;
        },
        staleTime: Infinity, // Show cached instantly
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

export const useInitAuth = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const user = await initAuth();
            return user;
        },
        onSuccess: (user) => {
            if (user) {
                queryClient.setQueryData(queryKeys.auth.user, user);
            }
        },
    });
};

export const useSetAuthUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ token, user }: { token: string; user: AuthUser }) => {
            await setAuthUser(token, user);
            return user;
        },
        onSuccess: (user) => {
            queryClient.setQueryData(queryKeys.auth.user, user);
            // Invalidate user-related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.subgrids });
        },
    });
};

export const useLogout = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            // Clear auth state, persisted React Query cache, bootstrap state, and all custom caches
            await apiLogout();
        },
        onSuccess: () => {
            // Clear all in-memory React Query cache
            queryClient.clear();
        },
    });
};

// ==================
// USER PROFILE
// ==================

export const useUpdateProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { firstName?: string; lastName?: string; email?: string; username?: string }) => {
            const response = await updateUserProfile(data);
            return response?.data;
        },
        onSuccess: (updatedUser) => {
            // Update the cached user data
            queryClient.setQueryData(queryKeys.auth.user, (old: AuthUser | null | undefined) => {
                if (!old) return old;
                return { ...old, ...updatedUser };
            });
        },
    });
};

// ==================
// USER SUBGRIDS
// ==================

export const useUserSubgrids = () => {
    const { data: user } = useCurrentUser();

    return useQuery({
        queryKey: queryKeys.auth.subgrids,
        queryFn: async () => {
            const response = await getUserSubgrids();
            return response?.subgrids || [];
        },
        enabled: !!user?.userId,
        staleTime: Infinity, // Show cached instantly
        refetchOnMount: false, // Don't refetch on mount - use cache
    });
};

// ==================
// USER PROFILE (Full Profile Data)
// ==================

export const useUserProfile = () => {
    return useQuery({
        queryKey: queryKeys.users.me,
        queryFn: async () => {
            const response = await communityGet('/users/me');
            return response?.data || null;
        },
        staleTime: Infinity, // Show cached instantly
    });
};

export const useUpdateUsername = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (username: string) => {
            const response = await communityPatch('/users/me', { username });
            return response;
        },
        onSuccess: (_, username) => {
            queryClient.setQueryData(queryKeys.users.me, (old: any) => {
                if (!old) return old;
                return { ...old, username };
            });
            queryClient.setQueryData(queryKeys.auth.user, (old: any) => {
                if (!old) return old;
                return { ...old, username };
            });
        },
    });
};

export const useUploadAvatar = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (file: { uri: string; name: string; type: string }) => {
            const response = await uploadAvatar(file);
            return response;
        },
        onSuccess: async (response) => {
            const avatarUrl = response?.avatarUrl || response?.url || response?.secureUrl || response?.secure_url;
            if (avatarUrl) {
                await updateAuthUser({ avatarUrl });
                queryClient.setQueryData(queryKeys.users.me, (old: any) => {
                    if (!old) return old;
                    return { ...old, avatarUrl };
                });
                queryClient.setQueryData(queryKeys.auth.user, (old: any) => {
                    if (!old) return old;
                    return { ...old, avatarUrl };
                });
            }
        },
    });
};

export const useUploadBanner = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (file: { uri: string; name: string; type: string }) => {
            const response = await uploadBanner(file);
            return response;
        },
        onSuccess: async (response) => {
            const bannerUrl = response?.bannerUrl || response?.url || response?.secureUrl || response?.secure_url;
            if (bannerUrl) {
                await updateAuthUser({ bannerUrl });
                queryClient.setQueryData(queryKeys.users.me, (old: any) => {
                    if (!old) return old;
                    return { ...old, bannerUrl };
                });
            }
        },
    });
};

// ==================
// USER MEMBERSHIPS
// ==================

export const useUserMemberships = (tenantId: string) => {
    return useQuery({
        queryKey: ['users', 'memberships', tenantId],
        queryFn: async () => {
            const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
            const subgrids = subgridsRes?.data || [];

            const membershipPromises = subgrids.map(async (subgrid: any) => {
                try {
                    const roleRes = await communityGet(`/subgrids/${subgrid._id}/my-role`);
                    return {
                        subgridId: subgrid._id,
                        subgridName: subgrid.name || 'Community',
                        role: roleRes?.data?.role || 'member',
                    };
                } catch {
                    return {
                        subgridId: subgrid._id,
                        subgridName: subgrid.name || 'Community',
                        role: 'member',
                    };
                }
            });

            return Promise.all(membershipPromises);
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
    });
};

// ==================
// NOTIFICATIONS
// ==================

export const useNotifications = (params?: { limit?: number; offset?: number; type?: string; unreadOnly?: boolean }) => {
    return useQuery({
        queryKey: queryKeys.notifications.inbox(params),
        queryFn: async () => {
            const response = await getNotificationInbox(params);
            return response?.data || { notifications: [], total: 0, unreadCount: 0 };
        },
        staleTime: Infinity, // Show cached instantly
    });
};

export const useMarkNotificationsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ notificationIds, markAll }: { notificationIds?: string[]; markAll?: boolean }) => {
            const response = await markNotificationsAsRead(notificationIds, markAll);
            return response;
        },
        onSuccess: () => {
            // Invalidate all notification queries to refresh counts
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

export const useDeleteNotifications = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationIds: string[]) => {
            const response = await deleteNotifications(notificationIds);
            return response;
        },
        onSuccess: () => {
            // Invalidate all notification queries
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

// ==================
// NOTIFICATIONS PREFERENCES
// ==================

export const useNotificationPreferences = () => {
    return useQuery({
        queryKey: queryKeys.notifications.preferences,
        queryFn: async () => {
            // This would call getNotificationPreferences from api.ts
            // Placeholder for now
            return {};
        },
        staleTime: Infinity, // Show cached instantly
    });
};
