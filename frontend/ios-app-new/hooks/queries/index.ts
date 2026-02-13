/**
 * React Query Hooks Index
 * Re-exports all query hooks for easy imports
 */

// Subgrid/Community queries
export * from './useSubgridQueries';

// Super Admin queries
export * from './useSuperAdminQueries';

// Message queries
export * from './useMessageQueries';

// Auth queries
export * from './useAuthQueries';

// Call queries
export * from './useCallQueries';

// CRM/Leads queries
export * from './useCRMQueries';

// Dashboard wrapper hooks (for gradual migration)
export * from '../useDashboardData';
export * from '../useSuperAdminData';
export * from '../useCUAdminData';
