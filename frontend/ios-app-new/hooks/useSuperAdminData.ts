/**
 * Super Admin Dashboard Data Hook
 * Wrapper hook that provides React Query data with backward compatibility
 * Replaces manual caching with React Query's built-in caching
 */

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    useSuperAdminOverview,
    useSuperAdminCustomers,
    useSuperAdminCustomerDetail,
    useSuperAdminModeration,
    useSuperAdminConfig,
    useSuperAdminTeam,
    useUpdateSuperAdminCustomer,
    useUpdateSuperAdminConfig,
    useInviteTeamMember,
    useDeleteTeamMember,
    useSuspendTeamMember,
} from './queries/useSuperAdminQueries';
import { queryKeys } from '../lib/queryClient';
import { getSuperAdminOverview, getSuperAdminCustomers, getSuperAdminCustomerDetails } from '../lib/api';

type GrowthRange = 7 | 30 | 90;

interface UseSuperAdminDashboardOptions {
    growthRange?: GrowthRange;
    customerSearch?: string;
    customerStatus?: string;
    customerPage?: number;
    customerLimit?: number;
    moderationStatus?: string;
    moderationPage?: number;
    moderationLimit?: number;
}

/**
 * Main hook for Super Admin Dashboard
 * Provides all data with React Query caching
 */
export const useSuperAdminDashboard = (options: UseSuperAdminDashboardOptions = {}) => {
    const {
        growthRange = 7,
        customerSearch = '',
        customerStatus = 'all',
        customerPage = 1,
        customerLimit = 10,
        moderationStatus = 'pending',
        moderationPage = 1,
        moderationLimit = 10,
    } = options;

    // Overview stats
    const overviewQuery = useSuperAdminOverview(growthRange);

    // Customers with pagination and filters
    const customersQuery = useSuperAdminCustomers({
        q: customerSearch || undefined,
        status: customerStatus !== 'all' ? customerStatus : undefined,
        limit: customerLimit,
        offset: (customerPage - 1) * customerLimit,
    });

    // Moderation queue
    const moderationQuery = useSuperAdminModeration({
        status: moderationStatus,
        limit: moderationLimit,
        offset: (moderationPage - 1) * moderationLimit,
    });

    // System config
    const configQuery = useSuperAdminConfig();

    // Team members
    const teamQuery = useSuperAdminTeam();

    // Mutations
    const updateCustomer = useUpdateSuperAdminCustomer();
    const updateConfig = useUpdateSuperAdminConfig();
    const inviteTeamMember = useInviteTeamMember();
    const deleteTeamMember = useDeleteTeamMember();
    const suspendTeamMember = useSuspendTeamMember();

    // Parse overview data - stats are nested inside data.stats from the API
    const stats = useMemo(() => {
        const statsData = overviewQuery.data?.stats;
        return {
            totalCustomers: statsData?.totalCustomers || 0,
            activeChannels: statsData?.activeChannels || 0,
            totalMembers: statsData?.totalMembers || 0,
            activeSubscriptions: statsData?.activeSubscriptions || 0,
        };
    }, [overviewQuery.data]);

    const customerGrowth = useMemo(() => {
        const data = overviewQuery.data?.customerGrowth;
        return {
            labels: data?.labels || [],
            values: data?.values || [],
        };
    }, [overviewQuery.data]);

    const systemUptime = useMemo(() => {
        const data = overviewQuery.data?.systemUptime;
        return {
            labels: data?.labels || [],
            values: data?.values || [],
        };
    }, [overviewQuery.data]);

    // customerStats - derive from stats since backend doesn't provide breakdown
    const customerStats = useMemo(() => {
        const statsData = overviewQuery.data?.stats;
        return {
            totalCustomers: statsData?.totalCustomers || 0,
            activeCustomers: statsData?.totalCustomers || 0, // All are considered active for now
            trialCustomers: 0, // Not tracked in backend yet
            premiumCustomers: statsData?.activeSubscriptions || 0, // Use active subscriptions as proxy
        };
    }, [overviewQuery.data]);

    // recentCustomers comes from the customers query (first 10), not overview
    const recentCustomers = useMemo(() => {
        return customersQuery.data?.customers || [];
    }, [customersQuery.data]);

    return {
        // Overview
        stats,
        customerGrowth,
        systemUptime,
        customerStats,
        recentCustomers,
        overviewLoading: overviewQuery.isLoading,
        overviewError: overviewQuery.error,
        refetchOverview: overviewQuery.refetch,

        // Customers
        customers: customersQuery.data?.customers || [],
        customersTotal: customersQuery.data?.total || 0,
        customersLoading: customersQuery.isLoading,
        customersError: customersQuery.error,
        refetchCustomers: customersQuery.refetch,

        // Moderation
        moderationItems: moderationQuery.data?.items || [],
        moderationTotal: moderationQuery.data?.total || 0,
        moderationLoading: moderationQuery.isLoading,
        moderationError: moderationQuery.error,
        refetchModeration: moderationQuery.refetch,

        // Config
        config: configQuery.data,
        configLoading: configQuery.isLoading,
        configError: configQuery.error,
        refetchConfig: configQuery.refetch,

        // Team
        teamMembers: teamQuery.data?.members || [],
        teamTotal: teamQuery.data?.total || 0,
        teamLoading: teamQuery.isLoading,
        teamError: teamQuery.error,
        refetchTeam: teamQuery.refetch,

        // Mutations
        updateCustomer,
        updateConfig,
        inviteTeamMember,
        deleteTeamMember,
        suspendTeamMember,

        // Combined loading state
        isLoading: overviewQuery.isLoading,
        isError: overviewQuery.isError || customersQuery.isError,

        // Refetch all
        refetchAll: () => {
            overviewQuery.refetch();
            customersQuery.refetch();
            moderationQuery.refetch();
            configQuery.refetch();
            teamQuery.refetch();
        },
    };
};

/**
 * Hook for viewing a single customer's details
 */
export const useSuperAdminCustomerView = (customerId: string) => {
    const detailQuery = useSuperAdminCustomerDetail(customerId);

    return {
        customer: detailQuery.data?.customer,
        activities: detailQuery.data?.activities || [],
        stats: detailQuery.data?.stats,
        isLoading: detailQuery.isLoading,
        isError: detailQuery.isError,
        error: detailQuery.error,
        refetch: detailQuery.refetch,
    };
};

/**
 * Prefetch data for faster navigation
 */
export const usePrefetchSuperAdminData = () => {
    const queryClient = useQueryClient();

    return {
        prefetchOverview: (growthDays?: number) => {
            queryClient.prefetchQuery({
                queryKey: queryKeys.superAdmin.overview(growthDays),
                queryFn: async () => {
                    const response = await getSuperAdminOverview({ growthDays });
                    return response?.data;
                },
            });
        },
        prefetchCustomers: () => {
            queryClient.prefetchQuery({
                queryKey: queryKeys.superAdmin.customers({ limit: 10 }),
                queryFn: async () => {
                    const response = await getSuperAdminCustomers({ limit: 10 });
                    return response?.data || { customers: [], total: 0 };
                },
            });
        },
        prefetchCustomerDetail: (customerId: string) => {
            queryClient.prefetchQuery({
                queryKey: queryKeys.superAdmin.customerDetail(customerId),
                queryFn: async () => {
                    const response = await getSuperAdminCustomerDetails(customerId);
                    return response?.data;
                },
            });
        },
    };
};
