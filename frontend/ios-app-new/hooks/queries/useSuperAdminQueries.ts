/**
 * React Query hooks for Super Admin data
 * Handles overview, customers, moderation, config, users, team
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
    getSuperAdminOverview,
    getSuperAdminCustomers,
    getSuperAdminCustomerDetails,
    updateSuperAdminCustomer,
    getSuperAdminModeration,
    getSuperAdminConfig,
    updateSuperAdminConfig,
    getSuperAdminUsers,
    getSuperAdminTeamMembers,
    inviteSuperAdminTeamMember,
    deleteSuperAdminTeamMember,
    suspendSuperAdminTeamMember,
} from '../../lib/api';

// ==================
// OVERVIEW / DASHBOARD
// ==================

export const useSuperAdminOverview = (growthDays?: number) => {
    return useQuery({
        queryKey: queryKeys.superAdmin.overview(growthDays),
        queryFn: async () => {
            const response = await getSuperAdminOverview({ growthDays });
            return response?.data;
        },
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    });
};

// ==================
// CUSTOMERS (TENANTS/SUBGRIDS)
// ==================

interface CustomerQueryParams {
    q?: string;
    limit?: number;
    offset?: number;
    status?: string;
}

export const useSuperAdminCustomers = (params?: CustomerQueryParams) => {
    return useQuery({
        queryKey: queryKeys.superAdmin.customers(params),
        queryFn: async () => {
            const response = await getSuperAdminCustomers(params);
            return response?.data || { customers: [], total: 0 };
        },
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useSuperAdminCustomerDetail = (customerId: string) => {
    return useQuery({
        queryKey: queryKeys.superAdmin.customerDetail(customerId),
        queryFn: async () => {
            const response = await getSuperAdminCustomerDetails(customerId);
            return response?.data;
        },
        enabled: !!customerId,
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useUpdateSuperAdminCustomer = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ customerId, data }: { customerId: string; data: { status?: string; settings?: any } }) => {
            const response = await updateSuperAdminCustomer(customerId, data);
            return response?.data;
        },
        onSuccess: (_, { customerId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.customers() });
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.customerDetail(customerId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.overview() });
        },
    });
};

// ==================
// MODERATION
// ==================

interface ModerationQueryParams {
    status?: string;
    limit?: number;
    offset?: number;
}

export const useSuperAdminModeration = (params?: ModerationQueryParams) => {
    return useQuery({
        queryKey: queryKeys.superAdmin.moderation(params),
        queryFn: async () => {
            const response = await getSuperAdminModeration(params);
            return response?.data || { items: [], total: 0 };
        },
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// CONFIG
// ==================

export const useSuperAdminConfig = () => {
    return useQuery({
        queryKey: queryKeys.superAdmin.config,
        queryFn: async () => {
            const response = await getSuperAdminConfig();
            return response?.data;
        },
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useUpdateSuperAdminConfig = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { features?: any; limits?: any; defaults?: any }) => {
            const response = await updateSuperAdminConfig(data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.config });
        },
    });
};

// ==================
// USERS
// ==================

interface UserQueryParams {
    q?: string;
    limit?: number;
    offset?: number;
    role?: string;
}

export const useSuperAdminUsers = (params?: UserQueryParams) => {
    return useQuery({
        queryKey: queryKeys.superAdmin.users(params),
        queryFn: async () => {
            const response = await getSuperAdminUsers(params);
            return response?.data || { users: [], total: 0 };
        },
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// TEAM MEMBERS
// ==================

interface TeamQueryParams {
    q?: string;
    limit?: number;
    offset?: number;
}

export const useSuperAdminTeam = (params?: TeamQueryParams) => {
    return useQuery({
        queryKey: queryKeys.superAdmin.team(params),
        queryFn: async () => {
            const response = await getSuperAdminTeamMembers(params);
            return response?.data || { members: [], total: 0 };
        },
        staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useInviteTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { email: string; firstName?: string; lastName?: string; role?: string }) => {
            const response = await inviteSuperAdminTeamMember(data);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.team() });
        },
    });
};

export const useDeleteTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: string) => {
            const response = await deleteSuperAdminTeamMember(userId);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.team() });
        },
    });
};

export const useSuspendTeamMember = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
            const response = await suspendSuperAdminTeamMember(userId, suspend);
            return response?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.team() });
        },
    });
};

// ==================
// COMBINED DASHBOARD HOOK
// ==================

export const useSuperAdminDashboard = (growthDays?: number) => {
    const overview = useSuperAdminOverview(growthDays);
    const customers = useSuperAdminCustomers({ limit: 10 });
    const moderation = useSuperAdminModeration({ limit: 10, status: 'pending' });
    const team = useSuperAdminTeam({ limit: 10 });

    return {
        overview,
        customers,
        moderation,
        team,
        isLoading: overview.isLoading || customers.isLoading,
        isError: overview.isError || customers.isError,
        refetchAll: () => {
            overview.refetch();
            customers.refetch();
            moderation.refetch();
            team.refetch();
        },
    };
};
