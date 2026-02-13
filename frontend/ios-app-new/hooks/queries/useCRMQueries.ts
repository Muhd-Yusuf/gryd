/**
 * React Query hooks for CRM/Leads data
 * Handles leads, tasks, campaigns, contacts, pipeline, etc.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

// ==================
// LEADS
// ==================

export const useLeads = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'leads', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/leads`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

export const useLeadDetail = (tenantId: string, leadId: string) => {
    return useQuery({
        queryKey: ['crm', 'leads', tenantId, leadId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/leads/${leadId}`);
            return response?.data;
        },
        enabled: !!tenantId && !!leadId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// TASKS
// ==================

export const useCRMTasks = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'tasks', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/tasks`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// CAMPAIGNS
// ==================

export const useCampaigns = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'campaigns', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/campaigns`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// CONTACTS
// ==================

export const useContacts = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'contacts', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/contacts`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// PIPELINE
// ==================

export const usePipeline = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'pipeline', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/pipeline`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// PROPERTIES
// ==================

export const useProperties = (tenantId: string) => {
    return useQuery({
        queryKey: ['properties', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/properties/tenants/${tenantId}/properties`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// CALENDAR EVENTS
// ==================

export const useCRMCalendarEvents = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'calendar', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/calendar-events`);
            return response?.data || [];
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// REPORTS / ANALYTICS
// ==================

export const useCRMReports = (tenantId: string) => {
    return useQuery({
        queryKey: ['crm', 'reports', tenantId],
        queryFn: async () => {
            const response = await apiFetch(`/crm/tenants/${tenantId}/reports`);
            return response?.data || {};
        },
        enabled: !!tenantId,
        staleTime: Infinity, // Show cached instantly
        gcTime: 24 * 60 * 60 * 1000,
    });
};

// ==================
// COMBINED OVERVIEW DATA
// ==================

export const useCRMOverview = (tenantId: string) => {
    const leads = useLeads(tenantId);
    const tasks = useCRMTasks(tenantId);
    const campaigns = useCampaigns(tenantId);
    const properties = useProperties(tenantId);

    return {
        leads,
        tasks,
        campaigns,
        properties,
        isLoading: leads.isLoading || tasks.isLoading || campaigns.isLoading || properties.isLoading,
        isError: leads.isError || tasks.isError || campaigns.isError || properties.isError,
        refetchAll: () => {
            leads.refetch();
            tasks.refetch();
            campaigns.refetch();
            properties.refetch();
        },
    };
};
