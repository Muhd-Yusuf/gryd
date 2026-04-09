import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    useWindowDimensions,
    Modal,
    Pressable,
    ActivityIndicator,
    Platform,
    RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    LayoutDashboard,
    Users,
    Shield,
    Settings,
    LogOut,
    Search,
    Bell,
    Sun,
    Moon,
    MessageSquare,
    DollarSign,
    TrendingUp,
    MoreHorizontal,
    ChevronDown,
    Download,
    Check,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Copy,
    Plus,
    MoreVertical,
    X,
    UserPlus,
    Eye,
    PauseCircle,
    PlayCircle,
    Trash2,
    Handshake,
} from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
    getSuperAdminCustomerDetails,
    getAuthUser,
    logout,
    superAdminPost,
    superAdminPatch,
    getNotificationPreferences,
    updateNotificationPreferences,
    updateUserProfile,
    communityGet,
    communityPatch,
} from '../lib/api';
import { useTheme } from '../lib/theme';
import { useSuperAdminDashboard } from '../hooks/useSuperAdminData';
import { ErrorRetry } from './ErrorRetry';
import { CardSkeleton } from './SkeletonLoader';
import { GlassButton, GlassIconButton, GlassModal, GlassStatCard, GlassBadge } from './glass';

type NavItem = 'overview' | 'customers' | 'moderation' | 'configuration' | 'income' | 'partnerships';

type CustomerStats = {
    totalCustomers: number;
    activeCustomers: number;
    trialCustomers: number;
    premiumCustomers: number;
};

type OverviewStats = {
    totalCustomers: number;
    activeChannels: number;
    totalMembers: number;
    activeSubscriptions: number;
};

type ChartData = {
    labels: string[];
    values: number[];
};

type GrowthRange = 7 | 30 | 90;
type Customer = {
    _id: string;
    name: string;
    clientName: string;
    status: string;
    memberCount: number;
    plan: string;
    subscriptionStatus: string;
    serverName?: string;
    owner?: {
        _id: string;
        name: string;
        email: string;
    };
    createdAt: string;
};

type ActivityItem = {
    _id: string;
    type: string;
    title: string;
    description: string;
    createdAt: string;
};

type ModerationItem = {
    _id: string;
    contentType: string;
    contentId: string;
    reason: string;
    status: string;
    communityName: string;
    communityId: string;
    reportedBy?: string;
    createdAt: string;
};

type SystemConfig = {
    features: {
        community: boolean;
        crm: boolean;
        calendar: boolean;
        billing: boolean;
        admin: boolean;
    };
    limits: {
        maxChannelsPerCommunity: number;
        maxMembersPerCommunity: number;
        maxFileSizeMB: number;
    };
    defaults: {
        newCommunityPlan: string;
        trialDurationDays: number;
    };
};

type ModerationSettings = {
    autoFlagSevereContent: boolean;
    banRepeatedOffenders: boolean;
    alertCustomer: boolean;
    flagHateSpeech: boolean;
};

type TeamMember = {
    _id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    avatar?: string;
};

type NotificationSettings = {
    systemAlerts: boolean;
    securityEvents: boolean;
    dailyReports: boolean;
    weeklyReports: boolean;
};

type SettingsTab = 'admin' | 'team' | 'notifications' | 'system';

const formatDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
};

const formatTimeAgo = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(value);
};

const SuperAdminDashboard = () => {
    const { colors, mode, toggleTheme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 900;
    const insets = useSafeAreaInsets();
    // Calculate safe area values for mobile
    const bottomInset = Platform.OS !== 'web' && isMobile ? Math.max(insets.bottom, 16) : 0;
    const topInset = Platform.OS !== 'web' && isMobile ? Math.max(insets.top, 0) : 0;
    const styles = useMemo(() => createStyles(colors, bottomInset, topInset), [colors, bottomInset, topInset]);

    // Navigation state
    const [activeNav, setActiveNav] = useState<NavItem>('overview');

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);

    // Data states - no loading overlays for seamless UX
    const [error, setError] = useState('');

    // React Query state
    const [growthRange, setGrowthRange] = useState<GrowthRange>(7);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [moderationStatusFilter, setModerationStatusFilter] = useState('pending');
    const [moderationPage, setModerationPage] = useState(1);

    // React Query hook for Super Admin data
    const superAdminData = useSuperAdminDashboard({
        growthRange,
        customerSearch,
        customerStatus: customerStatusFilter,
        customerPage: currentPage,
        customerLimit: rowsPerPage,
        moderationStatus: moderationStatusFilter,
        moderationPage,
        moderationLimit: 50,
    });

    // Derived data from React Query
    const stats: OverviewStats = superAdminData.stats;
    const customerGrowth: ChartData = superAdminData.customerGrowth;
    const systemUptime: ChartData = superAdminData.systemUptime;
    const recentCustomers: Customer[] = superAdminData.recentCustomers;
    const customerStats: CustomerStats = superAdminData.customerStats;
    const customers: Customer[] = superAdminData.customers;
    const customersTotal = superAdminData.customersTotal;
    const moderationItems: ModerationItem[] = superAdminData.moderationItems;
    const moderationTotal = superAdminData.moderationTotal;
    const config = superAdminData.config;
    const teamMembers: TeamMember[] = superAdminData.teamMembers;

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                superAdminData.refetchOverview(),
                superAdminData.refetchCustomers(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [superAdminData]);

    // UI state
    const [growthDropdownOpen, setGrowthDropdownOpen] = useState(false);
    const [customerFilterDropdownOpen, setCustomerFilterDropdownOpen] = useState(false);

    // Action menu
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
    const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const [actionMenuCustomer, setActionMenuCustomer] = useState<Customer | null>(null);

    // Moderation settings (new design)
    const [moderationSettings, setModerationSettings] = useState<ModerationSettings>({
        autoFlagSevereContent: true,
        banRepeatedOffenders: true,
        alertCustomer: true,
        flagHateSpeech: true,
    });

    // Settings page state
    const [settingsTab, setSettingsTab] = useState<SettingsTab>('admin');
    const [adminFirstName, setAdminFirstName] = useState('');
    const [adminLastName, setAdminLastName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminUsername, setAdminUsername] = useState('');
    const [savingAdminInfo, setSavingAdminInfo] = useState(false);

    // Team members (now from React Query)
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteFirstName, setInviteFirstName] = useState('');
    const [inviteLastName, setInviteLastName] = useState('');
    const [inviteRole, setInviteRole] = useState('admin');
    const [inviteRoleDropdownOpen, setInviteRoleDropdownOpen] = useState(false);
    const [invitingMember, setInvitingMember] = useState(false);

    // Team member action menu
    const [teamActionMenuOpen, setTeamActionMenuOpen] = useState<string | null>(null);
    const [teamActionMember, setTeamActionMember] = useState<TeamMember | null>(null);

    // Team member suspend modal
    const [teamSuspendModalOpen, setTeamSuspendModalOpen] = useState(false);
    const [teamSuspendMemberId, setTeamSuspendMemberId] = useState<string | null>(null);
    const [teamSuspendConfirmChecked, setTeamSuspendConfirmChecked] = useState(false);
    const [suspendingTeamMember, setSuspendingTeamMember] = useState(false);

    // Team member delete modal
    const [teamDeleteModalOpen, setTeamDeleteModalOpen] = useState(false);
    const [teamDeleteMemberId, setTeamDeleteMemberId] = useState<string | null>(null);
    const [teamDeleteConfirmChecked, setTeamDeleteConfirmChecked] = useState(false);
    const [deletingTeamMember, setDeletingTeamMember] = useState(false);

    // Notification settings
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        systemAlerts: true,
        securityEvents: true,
        dailyReports: true,
        weeklyReports: true,
    });

    // Configuration data (config now from React Query)
    const [configEditing, setConfigEditing] = useState(false);
    const [configForm, setConfigForm] = useState<SystemConfig | null>(null);

    // Customer detail view
    const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
    const [customerDetailData, setCustomerDetailData] = useState<any>(null);
    const [customerActivities, setCustomerActivities] = useState<ActivityItem[]>([]);

    // Add customer modal
    const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [addingCustomer, setAddingCustomer] = useState(false);

    // Suspend account modal
    const [suspendModalOpen, setSuspendModalOpen] = useState(false);
    const [suspendCustomerId, setSuspendCustomerId] = useState<string | null>(null);
    const [suspendConfirmChecked, setSuspendConfirmChecked] = useState(false);
    const [suspendingCustomer, setSuspendingCustomer] = useState(false);

    // Delete account modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
    const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
    const [deletingCustomer, setDeletingCustomer] = useState(false);

    // User info
    const [adminUser, setAdminUser] = useState<any>(null);

    // Income / RevShare state
    const [incomeData, setIncomeData] = useState<{
        totalPlatformRevenue: number;
        monthRevenue: number;
        marketplaceRevenue: number;
        marketingRevenue: number;
        clients: Array<{
            cuId: string;
            cuName: string;
            plan?: string;
            platformAmount: number;
            cuAmount: number;
            partnerAmount: number;
            transactionCount: number;
            memberCount: number;
            momChange?: number;
        }>;
        revShareQueue?: Array<{
            _id: string;
            partnerName: string;
            amount: number;
            clientName: string;
            status: string;
        }>;
    }>({
        totalPlatformRevenue: 0,
        monthRevenue: 0,
        marketplaceRevenue: 0,
        marketingRevenue: 0,
        clients: [],
        revShareQueue: [],
    });
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [incomeClientSearch, setIncomeClientSearch] = useState('');
    const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
    const [revShareFilter, setRevShareFilter] = useState<'All' | 'Pending' | 'Processing' | 'Paid'>('All');
    // Agent assignments — local-only notes, keyed by cuId
    const [agentAssignments, setAgentAssignments] = useState<Record<string, string>>({});

    // Partnership Applications state
    const [partnershipApps, setPartnershipApps] = useState<any[]>([]);
    const [partnershipAppsLoading, setPartnershipAppsLoading] = useState(false);
    const [partnershipAppsFilter, setPartnershipAppsFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Filtered customers for overview search
    const filteredRecentCustomers = useMemo(() => {
        if (!searchQuery.trim()) return recentCustomers;
        const query = searchQuery.toLowerCase().trim();
        return recentCustomers.filter((customer) =>
            customer.name?.toLowerCase().includes(query) ||
            customer.owner?.email?.toLowerCase().includes(query) ||
            customer.serverName?.toLowerCase().includes(query)
        );
    }, [recentCustomers, searchQuery]);

    // Load initial admin user data with cleanup to prevent state updates after unmount
    useEffect(() => {
        let cancelled = false;
        const loadInitialData = async () => {
            try {
                const user = await getAuthUser();
                if (cancelled) return;
                setAdminUser(user);
                setAdminFirstName(user?.firstName || '');
                setAdminLastName(user?.lastName || '');
                setAdminEmail(user?.email || '');
                setAdminUsername(user?.username || user?.email?.split('@')[0] || '');
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Failed to load initial data:', err.message);
                }
            }
        };
        loadInitialData();
        return () => { cancelled = true; };
    }, []);

    // Sync config form when config loads from React Query
    useEffect(() => {
        if (config) {
            setConfigForm((current) => {
                if (!current) return config;
                return current;
            });
        }
    }, [config]);

    // Load notification preferences when notifications tab is selected
    useEffect(() => {
        let cancelled = false;
        if (settingsTab === 'notifications') {
            loadNotificationPreferences(cancelled);
        }
        return () => { cancelled = true; };
    }, [settingsTab]);

    // Fetch income data when income section is active
    useEffect(() => {
        if (activeNav !== 'income') return;
        let cancelled = false;
        Promise.all([
            communityGet('/revshare/admin/by-client').catch(() => null),
            communityGet('/revshare/admin/queue').catch(() => null),
        ]).then(([data, queueData]: [any, any]) => {
            if (cancelled) return;
            setIncomeData({
                totalPlatformRevenue: data?.totalPlatformRevenue ?? data?.platformTotal ?? 0,
                monthRevenue: data?.monthRevenue ?? data?.monthlyPlatformRevenue ?? 0,
                marketplaceRevenue: data?.marketplaceRevenue ?? 0,
                marketingRevenue: data?.marketingRevenue ?? 0,
                clients: (data?.clients ?? data?.breakdown ?? []).map((c: any) => ({
                    cuId: c.cuId ?? c._id ?? '',
                    cuName: c.cuName ?? c.name ?? 'Unknown CU',
                    plan: c.plan ?? '-',
                    platformAmount: c.platformAmount ?? 0,
                    cuAmount: c.cuAmount ?? 0,
                    partnerAmount: c.partnerAmount ?? 0,
                    transactionCount: c.transactionCount ?? c.count ?? 0,
                    memberCount: c.memberCount ?? 0,
                    momChange: c.momChange ?? 0,
                })),
                revShareQueue: (queueData?.queue ?? queueData ?? []).map((q: any) => ({
                    _id: q._id ?? q.id ?? '',
                    partnerName: q.partnerName ?? q.name ?? '',
                    amount: q.amount ?? 0,
                    clientName: q.clientName ?? q.cuName ?? '',
                    status: q.status ?? 'Pending',
                })),
            });
        });
        return () => { cancelled = true; };
    }, [activeNav]);

    // Load notification preferences from API
    const loadNotificationPreferences = async (cancelled?: boolean) => {
        try {
            const response = await getNotificationPreferences();
            if (cancelled) return;
            if (response?.data) {
                setNotificationSettings({
                    systemAlerts: response.data.systemAlerts ?? true,
                    securityEvents: response.data.securityEvents ?? true,
                    dailyReports: response.data.dailyReports ?? true,
                    weeklyReports: response.data.weeklyReports ?? true,
                });
            }
        } catch (err: any) {
            if (!cancelled) {
                console.error('Failed to load notification preferences:', err.message);
            }
        }
    };

    const fetchPartnershipApps = useCallback(async () => {
        setPartnershipAppsLoading(true);
        try {
            const data = await communityGet('/partnership-forum/applications/all');
            setPartnershipApps(Array.isArray(data) ? data : data?.applications ?? []);
        } catch (err) {
            console.error('[SuperAdmin] partnership apps fetch error:', err);
        } finally {
            setPartnershipAppsLoading(false);
        }
    }, []);

    // Handle notification toggle - update local state and save to API
    const handleNotificationToggle = async (key: keyof NotificationSettings) => {
        const newValue = !notificationSettings[key];

        // Optimistic update
        setNotificationSettings(prev => ({
            ...prev,
            [key]: newValue
        }));

        try {
            await updateNotificationPreferences({ [key]: newValue });
        } catch (err: any) {
            // Revert on error
            setNotificationSettings(prev => ({
                ...prev,
                [key]: !newValue
            }));
            console.error('Failed to update notification preference:', err.message);
        }
    };

    const handleSaveAdminInfo = async () => {
        try {
            setSavingAdminInfo(true);
            setError('');
            await updateUserProfile({
                firstName: adminFirstName,
                lastName: adminLastName,
                username: adminUsername,
            });
            // Update local admin user state
            setAdminUser(prev => prev ? {
                ...prev,
                firstName: adminFirstName,
                lastName: adminLastName,
                username: adminUsername,
            } : prev);
        } catch (err: any) {
            setError(err.message || 'Failed to save admin info');
        } finally {
            setSavingAdminInfo(false);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail.trim()) {
            setError('Please enter an email address');
            return;
        }

        try {
            setInvitingMember(true);
            setError('');
            await superAdminData.inviteTeamMember.mutateAsync({
                email: inviteEmail,
                firstName: inviteFirstName || undefined,
                lastName: inviteLastName || undefined,
                role: inviteRole,
            });
            setInviteModalOpen(false);
            setInviteEmail('');
            setInviteFirstName('');
            setInviteLastName('');
            setInviteRole('admin');
        } catch (err: any) {
            setError(err.message || 'Failed to send invite');
        } finally {
            setInvitingMember(false);
        }
    };

    const handleDeleteTeamMember = async () => {
        if (!teamDeleteMemberId || !teamDeleteConfirmChecked) return;

        try {
            setDeletingTeamMember(true);
            setError('');
            await superAdminData.deleteTeamMember.mutateAsync(teamDeleteMemberId);
            setTeamDeleteModalOpen(false);
            setTeamDeleteMemberId(null);
            setTeamDeleteConfirmChecked(false);
            setTeamActionMember(null);
        } catch (err: any) {
            setError(err.message || 'Failed to delete team member');
        } finally {
            setDeletingTeamMember(false);
        }
    };

    const handleSuspendTeamMember = async () => {
        if (!teamSuspendMemberId || !teamSuspendConfirmChecked) return;

        const member = teamMembers?.find(m => m._id === teamSuspendMemberId);
        const shouldSuspend = member?.status !== 'suspended';

        try {
            setSuspendingTeamMember(true);
            setError('');
            await superAdminData.suspendTeamMember.mutateAsync({ userId: teamSuspendMemberId, suspend: shouldSuspend });
            setTeamSuspendModalOpen(false);
            setTeamSuspendMemberId(null);
            setTeamSuspendConfirmChecked(false);
            setTeamActionMember(null);
        } catch (err: any) {
            setError(err.message || 'Failed to update team member status');
        } finally {
            setSuspendingTeamMember(false);
        }
    };

    const openTeamMemberActionMenu = (member: TeamMember) => {
        setTeamActionMenuOpen(member._id);
        setTeamActionMember(member);
    };

    const closeTeamMemberActionMenu = () => {
        setTeamActionMenuOpen(null);
        setTeamActionMember(null);
    };

    const openTeamSuspendModal = (member: TeamMember) => {
        setTeamSuspendMemberId(member._id);
        setTeamActionMember(member);
        setTeamSuspendModalOpen(true);
        closeTeamMemberActionMenu();
    };

    const openTeamDeleteModal = (member: TeamMember) => {
        setTeamDeleteMemberId(member._id);
        setTeamActionMember(member);
        setTeamDeleteModalOpen(true);
        closeTeamMemberActionMenu();
    };

    // Data loading is now handled by React Query via useSuperAdminDashboard hook
    // The hook automatically fetches and caches: overview, customers, moderation, config, team

    const handleViewCustomer = async (customer: Customer) => {
        setViewingCustomer(customer);

        try {
            const response = await getSuperAdminCustomerDetails(customer._id);
            if (response?.data) {
                setCustomerDetailData(response.data);
                // Generate sample activities based on customer data
                const activities: ActivityItem[] = [];
                if (response.data.channels && response.data.channels.length > 0) {
                    response.data.channels.slice(0, 5).forEach((channel: any) => {
                        activities.push({
                            _id: channel._id,
                            type: 'channel',
                            title: 'New Channel created',
                            description: `#${channel.name || 'channel'}`,
                            createdAt: channel.createdAt || new Date().toISOString(),
                        });
                    });
                }
                if (response.data.members && response.data.members.length > 0) {
                    response.data.members.slice(0, 3).forEach((member: any) => {
                        activities.push({
                            _id: member._id,
                            type: 'member',
                            title: 'New member invited',
                            description: `${member.name || 'Member'} - ${member.email || ''}`,
                            createdAt: member.joinedAt || new Date().toISOString(),
                        });
                    });
                }
                setCustomerActivities(activities);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load customer details');
        }
    };

    const handleBackToCustomers = () => {
        setViewingCustomer(null);
        setCustomerDetailData(null);
        setCustomerActivities([]);
    };

    const handleCustomerStatusUpdate = async (customerId: string, newStatus: string) => {
        if (viewingCustomer?._id === customerId) {
            setViewingCustomer(prev => prev ? { ...prev, status: newStatus } : null);
        }
        setActionMenuOpen(null);

        try {
            await superAdminData.updateCustomer.mutateAsync({ customerId, data: { status: newStatus } });
        } catch (err: any) {
            superAdminData.refetchCustomers();
            setError(err.message || 'Failed to update customer status');
        }
    };

    const handleAddCustomer = async () => {
        if (!newCustomerName.trim() || !newCustomerEmail.trim()) {
            setError('Please enter customer name and email');
            return;
        }

        try {
            setAddingCustomer(true);
            await superAdminPost('/customers', {
                name: newCustomerName,
                email: newCustomerEmail,
            });
            setAddCustomerModalOpen(false);
            setNewCustomerName('');
            setNewCustomerEmail('');
            superAdminData.refetchCustomers();
            superAdminData.refetchOverview();
        } catch (err: any) {
            setError(err.message || 'Failed to add customer');
        } finally {
            setAddingCustomer(false);
        }
    };

    const handleConfigSave = async () => {
        if (!configForm) return;

        try {
            await superAdminData.updateConfig.mutateAsync(configForm);
            setConfigEditing(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save configuration');
        }
    };

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    // Open suspend modal
    const openSuspendModal = (customerId: string) => {
        setSuspendCustomerId(customerId);
        setSuspendConfirmChecked(false);
        setSuspendModalOpen(true);
        setActionMenuOpen(null);
    };

    // Handle suspend confirmation
    const handleSuspendCustomer = async () => {
        if (!suspendCustomerId || !suspendConfirmChecked) return;

        const customerId = suspendCustomerId;

        if (viewingCustomer?._id === customerId) {
            setViewingCustomer(prev => prev ? { ...prev, status: 'suspended' } : null);
        }
        setSuspendModalOpen(false);
        setSuspendCustomerId(null);

        try {
            setSuspendingCustomer(true);
            await superAdminData.updateCustomer.mutateAsync({ customerId, data: { status: 'suspended' } });
        } catch (err: any) {
            superAdminData.refetchCustomers();
            setError(err.message || 'Failed to suspend customer');
        } finally {
            setSuspendingCustomer(false);
        }
    };

    // Handle revoke suspension (activate)
    const handleRevokeSuspension = async (customerId: string) => {
        if (viewingCustomer?._id === customerId) {
            setViewingCustomer(prev => prev ? { ...prev, status: 'active' } : null);
        }

        try {
            await superAdminData.updateCustomer.mutateAsync({ customerId, data: { status: 'active' } });
        } catch (err: any) {
            superAdminData.refetchCustomers();
            setError(err.message || 'Failed to revoke suspension');
        }
    };

    // Open delete modal
    const openDeleteModal = (customerId: string) => {
        setDeleteCustomerId(customerId);
        setDeleteConfirmChecked(false);
        setDeleteModalOpen(true);
        setActionMenuOpen(null);
    };

    // Handle delete confirmation
    const handleDeleteCustomer = async () => {
        if (!deleteCustomerId || !deleteConfirmChecked) return;

        const customerId = deleteCustomerId;

        setDeleteModalOpen(false);
        setDeleteCustomerId(null);
        if (viewingCustomer?._id === customerId) {
            handleBackToCustomers();
        }

        try {
            setDeletingCustomer(true);
            await superAdminPost(`/customers/${customerId}/delete`, {});
            superAdminData.refetchCustomers();
            superAdminData.refetchOverview();
        } catch (err: any) {
            superAdminData.refetchCustomers();
            setError(err.message || 'Failed to delete customer');
        } finally {
            setDeletingCustomer(false);
        }
    };


    // Get filter label for display
    const getFilterLabel = (filter: string) => {
        switch (filter) {
            case 'all': return 'All';
            case 'active': return 'Active';
            case 'pending': return 'Pending';
            case 'suspended': return 'Suspended';
            default: return 'All';
        }
    };

    // Handle export customers as CSV
    const handleExportCSV = async () => {
        if (customers.length === 0) {
            setError('No customers to export');
            return;
        }

        try {
            // Define CSV headers
            const headers = ['Customer Name', 'Email', 'Server Name', 'Members', 'Status', 'Created Date'];

            // Build CSV rows
            const rows = customers.map((customer) => [
                customer.clientName || customer.owner?.name || '-',
                customer.owner?.email || '-',
                customer.name || '-',
                String(customer.memberCount || 0),
                customer.status || '-',
                formatDate(customer.createdAt),
            ]);

            // Combine headers and rows
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const fileName = `customers_${new Date().toISOString().split('T')[0]}.csv`;

            // Create download for web
            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                // For mobile, use expo-file-system and expo-sharing
                try {
                    const fileUri = FileSystem.documentDirectory + fileName;
                    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                        encoding: FileSystem.EncodingType.UTF8,
                    });

                    const isSharingAvailable = await Sharing.isAvailableAsync();
                    if (isSharingAvailable) {
                        await Sharing.shareAsync(fileUri, {
                            mimeType: 'text/csv',
                            dialogTitle: 'Export Customers CSV',
                            UTI: 'public.comma-separated-values-text',
                        });
                    } else {
                        setError('Sharing is not available on this device');
                    }
                } catch (mobileErr: any) {
                    console.error('Failed to export CSV on mobile:', mobileErr);
                    setError(mobileErr?.message || 'Failed to save or share CSV file');
                }
            }
        } catch (err: any) {
            console.error('Failed to export CSV:', err);
            setError(err?.message || 'Failed to export CSV');
        }
    };

    // Handle opening action menu with position
    const handleOpenActionMenu = (event: any, customer: Customer) => {
        event?.stopPropagation();
        if (actionMenuOpen === customer._id) {
            setActionMenuOpen(null);
            setActionMenuCustomer(null);
            return;
        }

        // Get position from event target for web
        const target = event?.currentTarget || event?.target;
        if (target && target.getBoundingClientRect) {
            const rect = target.getBoundingClientRect();
            setActionMenuPosition({
                top: rect.bottom + 5,
                right: window.innerWidth - rect.right,
            });
        }
        setActionMenuCustomer(customer);
        setActionMenuOpen(customer._id);
    };

    // Close action menu
    const closeActionMenu = () => {
        setActionMenuOpen(null);
        setActionMenuCustomer(null);
    };

    const buildChartPaths = (values: number[], width = 100, height = 100, padding = 10) => {
        const maxValue = Math.max(...values, 1);
        const minValue = Math.min(...values, 0);
        const range = maxValue - minValue || 1;
        const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

        const points = values.map((value, index) => {
            const x = padding + index * stepX;
            const ratio = (value - minValue) / range;
            const y = height - padding - ratio * (height - padding * 2);
            return { x, y };
        });

        const linePath = points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ');

        const areaPath = `${linePath} L ${padding + stepX * (values.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`;

        return { points, linePath, areaPath };
    };

    const renderAreaChart = (data: ChartData, color: string, fillColor: string) => {
        if (!data.values.length) {
            return null;
        }

        const { points, linePath, areaPath } = buildChartPaths(data.values);

        return (
            <View style={styles.chartContainer}>
                <View style={styles.chartGraphic}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100">
                        {[20, 40, 60, 80].map((position) => (
                            <Line
                                key={`grid-${position}`}
                                x1="0"
                                x2="100"
                                y1={position}
                                y2={position}
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth="0.6"
                                strokeDasharray="4 4"
                            />
                        ))}
                        <Defs>
                            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0%" stopColor={fillColor} stopOpacity="0.55" />
                                <Stop offset="100%" stopColor={fillColor} stopOpacity="0.12" />
                            </LinearGradient>
                        </Defs>
                        <Path d={areaPath} fill="url(#areaFill)" />
                        <Path d={linePath} stroke={color} strokeWidth="2" fill="none" />
                        {points.map((point, index) => (
                            <Circle key={index} cx={point.x} cy={point.y} r="1.8" fill={color} />
                        ))}
                    </Svg>
                </View>
                <View style={styles.chartLabels}>
                    {data.labels.map((label, index) => (
                        <Text key={index} style={styles.chartLabel} numberOfLines={1}>
                            {label}
                        </Text>
                    ))}
                </View>
            </View>
        );
    };

    const renderLineChart = (data: ChartData, color: string) => {
        if (!data.values.length) {
            return null;
        }

        const { points, linePath } = buildChartPaths(data.values);

        return (
            <View style={styles.chartContainer}>
                <View style={styles.chartGraphic}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100">
                        {[20, 40, 60, 80].map((position) => (
                            <Line
                                key={`grid-${position}`}
                                x1="0"
                                x2="100"
                                y1={position}
                                y2={position}
                                stroke="rgba(255,255,255,0.12)"
                                strokeWidth="0.6"
                                strokeDasharray="4 4"
                            />
                        ))}
                        <Path d={linePath} stroke={color} strokeWidth="2" fill="none" />
                        {points.map((point, index) => (
                            <Circle key={index} cx={point.x} cy={point.y} r="2.2" fill={color} />
                        ))}
                    </Svg>
                </View>
                <View style={styles.chartLabels}>
                    {data.labels.map((label, index) => (
                        <Text key={index} style={styles.chartLabel} numberOfLines={1}>
                            {label}
                        </Text>
                    ))}
                </View>
            </View>
        );
    };

    // Render navigation sidebar
    const renderSidebar = () => (
        <View style={styles.sidebar}>
            {/* Logo */}
            <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                    <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6 }} />
                </View>
                <Text style={styles.logoText}>THE GRYD</Text>
            </View>

            {/* Navigation Items */}
            <View style={styles.navItems}>
                {([
                    { key: 'overview' as NavItem, Icon: LayoutDashboard, label: 'Overview' },
                    { key: 'customers' as NavItem, Icon: Users, label: 'Customers' },
                    { key: 'moderation' as NavItem, Icon: Shield, label: 'Moderations & Safety' },
                    { key: 'configuration' as NavItem, Icon: Settings, label: 'Configuration' },
                    { key: 'income' as NavItem, Icon: TrendingUp, label: 'Income & RevShare' },
                    { key: 'partnerships' as NavItem, Icon: Handshake, label: 'Partnerships' },
                ]).map((item) => {
                    const isActive = activeNav === item.key;
                    return (
                        <TouchableOpacity
                            key={item.key}
                            style={[
                                styles.navItem,
                                isActive ? styles.navItemActive : styles.navItemInactive,
                            ]}
                            onPress={() => { setActiveNav(item.key); setViewingCustomer(null); if (item.key === 'partnerships') fetchPartnershipApps(); }}
                        >
                            <item.Icon size={20} color={isActive ? colors.glassActiveText : colors.sidebarTextMuted} />
                            <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>{item.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Logout */}
            <View style={styles.sidebarFooter}>
                <GlassButton
                    label="Logout"
                    onPress={handleLogout}
                    variant="ghost"
                    size="sm"
                    icon={<LogOut size={16} color={colors.sidebarTextMuted} />}
                    style={{ alignSelf: 'stretch' }}
                />
            </View>
        </View>
    );

    // Render top bar
    const renderTopBar = () => (
        <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
            {/* Mobile: Show Gryd branding at top */}
            {isMobile && (
                <View style={styles.mobileHeaderRow}>
                    <View style={styles.mobileLogoContainer}>
                        <View style={styles.mobileLogoIcon}>
                            <Image source={require('../assets/icon.png')} style={{ width: 24, height: 24, borderRadius: 4 }} />
                        </View>
                        <Text style={styles.mobileLogoText}>THE GRYD</Text>
                    </View>
                    <View style={styles.mobileHeaderActions}>
                        <GlassIconButton
                            icon={<Bell size={16} color={colors.textMuted} />}
                            onPress={() => {}}
                            variant="default"
                            size="sm"
                        />
                        <GlassIconButton
                            icon={mode === 'dark' ? <Sun size={16} color={colors.textMuted} /> : <Moon size={16} color={colors.textMuted} />}
                            onPress={toggleTheme}
                            variant="default"
                            size="sm"
                        />
                        <GlassIconButton
                            icon={<LogOut size={16} color={colors.textMuted} />}
                            onPress={handleLogout}
                            variant="default"
                            size="sm"
                        />
                        <View style={styles.profileAvatar}>
                            <Text style={styles.profileAvatarText}>
                                {adminUser?.firstName?.[0] || 'J'}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Search bar - only visible on overview page, desktop only */}
            {activeNav === 'overview' && !isMobile && (
                <View style={styles.searchContainer}>
                    <Search size={18} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search anything here"
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            )}

            {/* Desktop: Show full header with icons and profile */}
            {!isMobile && (
                <View style={styles.topBarRight}>
                    <View style={styles.topBarIconGroup}>
                        <GlassIconButton
                            icon={<Bell size={18} color={colors.textMuted} />}
                            onPress={() => {}}
                            variant="default"
                            size="sm"
                        />
                        <GlassIconButton
                            icon={mode === 'dark' ? <Sun size={18} color={colors.textMuted} /> : <Moon size={18} color={colors.textMuted} />}
                            onPress={toggleTheme}
                            variant="default"
                            size="sm"
                        />
                    </View>
                    <View style={styles.topBarDivider} />
                    <View style={styles.profileSection}>
                        <View style={styles.profileAvatar}>
                            <Text style={styles.profileAvatarText}>
                                {adminUser?.firstName?.[0] || 'J'}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{adminUser?.firstName || 'James'} {adminUser?.lastName || 'Bryce'}</Text>
                            <Text style={styles.profileRole}>Admin Account</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    // Render Overview Page
    const renderOverviewPage = () => (
        <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
            {/* Loading skeleton for stats */}
            {superAdminData.overviewLoading && (
                <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                    {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={`stat-sk-${i}`} />)}
                </View>
            )}
            {/* Error retry for stats */}
            {superAdminData.overviewError && !superAdminData.overviewLoading && (
                <ErrorRetry message="Failed to load overview stats" onRetry={() => superAdminData.refetchOverview()} />
            )}
            {/* Stats Cards */}
            {!superAdminData.overviewLoading && !superAdminData.overviewError && (
            <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                <GlassStatCard
                    label="All Customers"
                    value={stats.totalCustomers.toLocaleString()}
                    icon={<Users size={22} color="#3b82f6" />}
                    accent="rgba(59,130,246,0.85)"
                    style={{ flex: 1, minWidth: 150 }}
                />
                <GlassStatCard
                    label="Active Channels"
                    value={stats.activeChannels.toLocaleString()}
                    icon={<MessageSquare size={22} color="#ec4899" />}
                    accent="rgba(236,72,153,0.85)"
                    style={{ flex: 1, minWidth: 150 }}
                />
                <GlassStatCard
                    label="Total Members"
                    value={stats.totalMembers.toLocaleString()}
                    icon={<Users size={22} color="#8b5cf6" />}
                    accent="rgba(139,92,246,0.85)"
                    style={{ flex: 1, minWidth: 150 }}
                />
                <GlassStatCard
                    label="Active Subscriptions"
                    value={stats.activeSubscriptions.toLocaleString()}
                    icon={<DollarSign size={22} color="#22c55e" />}
                    accent="rgba(34,197,94,0.85)"
                    style={{ flex: 1, minWidth: 150 }}
                />
            </View>
            )}

            {/* Recent Customers Table */}
            <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                    <Text style={styles.tableTitle}>Recent Customer</Text>
                    <GlassButton
                        label="See all"
                        onPress={() => setActiveNav('customers')}
                        variant="secondary"
                        size="sm"
                    />
                </View>

                {isMobile ? (
                    <View style={styles.mobileCardList}>
                        {filteredRecentCustomers.map((customer) => (
                            <TouchableOpacity
                                key={customer._id}
                                style={[styles.mobileCustomerCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                                onPress={() => handleViewCustomer(customer)}
                            >
                                <View style={styles.mobileCardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.customerName} numberOfLines={1}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                        <Text style={styles.customerEmail} numberOfLines={1}>{customer.owner?.email || ''}</Text>
                                    </View>
                                    <GlassIconButton
                                        icon={<MoreHorizontal size={16} color={colors.textMuted} />}
                                        onPress={(e: any) => handleOpenActionMenu(e, customer)}
                                        variant="default"
                                        size="sm"
                                    />
                                </View>
                                <View style={styles.mobileCardRow}>
                                    <View style={styles.mobileCardField}>
                                        <Text style={styles.mobileCardLabel}>Server</Text>
                                        <Text style={styles.mobileCardValue} numberOfLines={1}>{customer.name || '-'}</Text>
                                    </View>
                                    <View style={styles.mobileCardField}>
                                        <Text style={styles.mobileCardLabel}>Members</Text>
                                        <Text style={styles.mobileCardValue}>{customer.memberCount}</Text>
                                    </View>
                                    <GlassBadge
                                        label={customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        variant={customer.status === 'active' ? 'success' : customer.status === 'pending' ? 'warning' : 'danger'}
                                        dot
                                    />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.table}>
                        <View style={[styles.tableRowHeader, { backgroundColor: colors.glassBg }]}>
                            <View style={[styles.tableHeaderCell, { width: 40 }]}>
                                <View style={styles.checkbox} />
                            </View>
                            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Customer Details</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Server Name</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Server members</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                            <View style={[styles.tableHeaderCell, { width: 50 }]} />
                        </View>

                        {filteredRecentCustomers.map((customer) => (
                            <TouchableOpacity
                                key={customer._id}
                                style={styles.tableRow}
                                onPress={() => handleViewCustomer(customer)}
                            >
                                <View style={[styles.tableCell, { width: 40 }]}>
                                    <View style={styles.checkbox} />
                                </View>
                                <View style={[styles.tableCell, { flex: 2 }]}>
                                    <Text style={styles.customerName}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                    <Text style={styles.customerEmail}>{customer.owner?.email || ''}</Text>
                                </View>
                                <Text style={[styles.tableCell, { flex: 1.5 }]}>{customer.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 1 }]}>{customer.memberCount}</Text>
                                <View style={[styles.tableCell, { flex: 1 }]}>
                                    <GlassBadge
                                        label={customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        variant={customer.status === 'active' ? 'success' : customer.status === 'pending' ? 'warning' : 'danger'}
                                        dot
                                    />
                                </View>
                                <View style={[styles.tableCell, { width: 50 }]}>
                                    <GlassIconButton
                                        icon={<MoreHorizontal size={16} color={colors.textMuted} />}
                                        onPress={(e: any) => handleOpenActionMenu(e, customer)}
                                        variant="default"
                                        size="sm"
                                    />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Charts Row */}
            <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
                <View style={[styles.chartCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                    <View style={styles.chartHeader}>
                        <Text style={styles.chartTitle}>Customer Growth</Text>
                        <View style={styles.chartDropdownWrapper}>
                            <TouchableOpacity
                                style={[styles.chartDropdown, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                                onPress={() => setGrowthDropdownOpen((prev) => !prev)}
                            >
                                <Text style={styles.chartDropdownText}>{growthRange} Days</Text>
                                <ChevronDown size={18} color={colors.text} />
                            </TouchableOpacity>
                            {growthDropdownOpen && (
                                <View style={[styles.chartDropdownMenu, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                                    {[7, 30, 90].map((range) => (
                                        <TouchableOpacity
                                            key={range}
                                            style={[
                                                styles.chartDropdownItem,
                                                growthRange === range && styles.chartDropdownItemActive,
                                            ]}
                                            onPress={() => {
                                                setGrowthRange(range as GrowthRange);
                                                setGrowthDropdownOpen(false);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.chartDropdownItemText,
                                                    growthRange === range &&
                                                        styles.chartDropdownItemTextActive,
                                                ]}
                                            >
                                                {range} Days
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                    {customerGrowth.values.length > 0 ? (
                        renderAreaChart(customerGrowth, '#22c55e', '#22c55e')
                    ) : (
                        <Text style={styles.noDataText}>No data available</Text>
                    )}
                    <View style={styles.chartLegend}>
                        <View style={styles.chartLegendItem}>
                            <View style={[styles.chartLegendDot, { backgroundColor: '#22c55e' }]} />
                            <Text style={styles.chartLegendText}>Customers</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.chartCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                    <Text style={styles.chartTitle}>System Uptime (Last 24 hours)</Text>
                    {systemUptime.values.length > 0 ? (
                        renderLineChart(systemUptime, '#22c55e')
                    ) : (
                        <Text style={styles.noDataText}>No data available</Text>
                    )}
                </View>
            </View>
        </ScrollView>
    );

    // Render Customers Page
    const renderCustomersPage = () => (
        <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
            <View style={[styles.customersHeader, isMobile && styles.customersHeaderMobile]}>
                <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Customers</Text>
                <GlassButton
                    label={isMobile ? 'Add' : 'Add New Customer'}
                    onPress={() => setAddCustomerModalOpen(true)}
                    variant="primary"
                    size="sm"
                    icon={<Plus size={15} color="#fff" />}
                />
            </View>

            {/* Customer Stats Cards */}
            <View style={[styles.customerStatsGrid, isMobile && styles.customerStatsGridMobile]}>
                <GlassStatCard
                    label="All Customers"
                    value={customerStats.totalCustomers}
                    icon={<Users size={24} color="#0284c7" />}
                    accent="rgba(2,132,199,0.85)"
                    style={{ flex: 1, minWidth: 140 }}
                />
                <GlassStatCard
                    label="Active Customers"
                    value={customerStats.activeCustomers}
                    icon={<Users size={24} color="#db2777" />}
                    accent="rgba(219,39,119,0.85)"
                    style={{ flex: 1, minWidth: 140 }}
                />
            </View>

            {/* Customers Table Card */}
            <View style={styles.customersTableCard}>
                <View style={[styles.customersTableHeader, isMobile && styles.customersTableHeaderMobile]}>
                    <Text style={styles.customerTableTitle}>Customer</Text>

                    <View style={[styles.tableControls, isMobile && styles.tableControlsMobile]}>
                        <View style={styles.tableSearchContainer}>
                            <Search size={18} color={colors.textMuted} />
                            <TextInput
                                style={styles.tableSearchInput}
                                placeholder="Search Customer..."
                                placeholderTextColor={colors.textMuted}
                                value={customerSearch}
                                onChangeText={setCustomerSearch}
                            />
                        </View>

                        <View style={styles.filterDropdownWrapper}>
                            <TouchableOpacity
                                style={styles.filterDropdown}
                                onPress={() => setCustomerFilterDropdownOpen(!customerFilterDropdownOpen)}
                            >
                                <Text style={styles.filterDropdownText}>{getFilterLabel(customerStatusFilter)}</Text>
                                <ChevronDown size={20} color={colors.text} />
                            </TouchableOpacity>

                            {/* Filter Dropdown Menu */}
                            {customerFilterDropdownOpen && (
                                <View style={styles.filterDropdownMenu}>
                                    {['all', 'active', 'pending', 'suspended'].map((filter) => (
                                        <TouchableOpacity
                                            key={filter}
                                            style={[
                                                styles.filterDropdownItem,
                                                customerStatusFilter === filter && styles.filterDropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setCustomerStatusFilter(filter);
                                                setCurrentPage(1);
                                                setCustomerFilterDropdownOpen(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.filterDropdownItemText,
                                                customerStatusFilter === filter && styles.filterDropdownItemTextActive
                                            ]}>
                                                {getFilterLabel(filter)}
                                            </Text>
                                            {customerStatusFilter === filter && (
                                                <Check size={16} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <GlassButton
                            label="Export CSV"
                            onPress={handleExportCSV}
                            variant="secondary"
                            size="sm"
                            icon={<Download size={15} color={colors.text} />}
                        />
                    </View>
                </View>

                {isMobile ? (
                    <View style={styles.mobileCardList}>
                        {customers.map((customer) => (
                            <TouchableOpacity
                                key={customer._id}
                                style={[styles.mobileCustomerCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                                onPress={() => handleViewCustomer(customer)}
                            >
                                <View style={styles.mobileCardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.customerName} numberOfLines={1}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                        <Text style={styles.customerEmail} numberOfLines={1}>{customer.owner?.email || ''}</Text>
                                    </View>
                                    <GlassIconButton
                                        icon={<MoreHorizontal size={16} color={colors.textMuted} />}
                                        onPress={(e: any) => { if (e?.stopPropagation) e.stopPropagation(); handleOpenActionMenu(e, customer); }}
                                        variant="default"
                                        size="sm"
                                    />
                                </View>
                                <View style={styles.mobileCardRow}>
                                    <View style={styles.mobileCardField}>
                                        <Text style={styles.mobileCardLabel}>Server</Text>
                                        <Text style={styles.mobileCardValue} numberOfLines={1}>{customer.name || '-'}</Text>
                                    </View>
                                    <View style={styles.mobileCardField}>
                                        <Text style={styles.mobileCardLabel}>Members</Text>
                                        <Text style={styles.mobileCardValue}>{customer.memberCount}</Text>
                                    </View>
                                    <GlassBadge
                                        label={customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        variant={customer.status === 'active' ? 'success' : customer.status === 'pending' ? 'warning' : 'danger'}
                                        dot
                                    />
                                </View>
                            </TouchableOpacity>
                        ))}

                        {customers.length === 0 && (
                            <View style={styles.emptyState}>
                                <Users size={48} color={colors.textMuted} />
                                <Text style={styles.emptyStateText}>No customers found</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.table}>
                        <View style={[styles.tableRowHeader, { backgroundColor: colors.glassBg }]}>
                            <View style={[styles.tableHeaderCell, { width: 40 }]}>
                                <View style={styles.checkbox} />
                            </View>
                            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Customer Details</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Server Name</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Server members</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                            <View style={[styles.tableHeaderCell, { width: 50 }]} />
                        </View>

                        {customers.map((customer) => (
                            <TouchableOpacity key={customer._id} style={styles.tableRow} onPress={() => handleViewCustomer(customer)}>
                                <View style={[styles.tableCell, { flex: 2 }]}>
                                    <Text style={styles.customerName}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                    <Text style={styles.customerEmail}>{customer.owner?.email || ''}</Text>
                                </View>
                                <Text style={[styles.tableCell, { flex: 1.5 }]}>{customer.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 1 }]}>{customer.memberCount}</Text>
                                <View style={[styles.tableCell, { flex: 1 }]}>
                                    <GlassBadge
                                        label={customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        variant={customer.status === 'active' ? 'success' : customer.status === 'pending' ? 'warning' : 'danger'}
                                        dot
                                    />
                                </View>
                                <View style={[styles.tableCell, { width: 50 }]}>
                                    <GlassIconButton
                                        icon={<MoreHorizontal size={16} color={colors.textMuted} />}
                                        onPress={(e: any) => handleOpenActionMenu(e, customer)}
                                        variant="default"
                                        size="sm"
                                    />
                                </View>
                            </TouchableOpacity>
                        ))}

                        {customers.length === 0 && (
                            <View style={styles.emptyState}>
                                <Users size={48} color={colors.textMuted} />
                                <Text style={styles.emptyStateText}>No customers found</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Pagination */}
                <View style={[styles.pagination, isMobile && styles.paginationMobile]}>
                    <Text style={styles.paginationInfo}>
                        {customersTotal > 0 ? ((currentPage - 1) * rowsPerPage) + 1 : 0} - {Math.min(currentPage * rowsPerPage, customersTotal)} of {customersTotal}
                    </Text>

                    <View style={styles.paginationControls}>
                        <Text style={styles.paginationLabel}>Rows per page:</Text>
                        <View style={styles.rowsPerPageSelector}>
                            {[10, 25, 50].map((num) => (
                                <TouchableOpacity
                                    key={num}
                                    style={[styles.rowsPerPageOption, rowsPerPage === num && styles.rowsPerPageOptionActive]}
                                    onPress={() => { setRowsPerPage(num); setCurrentPage(1); }}
                                >
                                    <Text style={[styles.rowsPerPageText, rowsPerPage === num && styles.rowsPerPageTextActive]}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <GlassIconButton
                            icon={<ChevronLeft size={18} color={currentPage === 1 ? colors.textMuted : colors.text} />}
                            onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            variant="default"
                            size="sm"
                            disabled={currentPage === 1}
                        />
                        <GlassIconButton
                            icon={<ChevronRight size={18} color={currentPage * rowsPerPage >= customersTotal ? colors.textMuted : colors.text} />}
                            onPress={() => setCurrentPage(prev => prev + 1)}
                            variant={currentPage * rowsPerPage < customersTotal ? 'active' : 'default'}
                            size="sm"
                            disabled={currentPage * rowsPerPage >= customersTotal}
                        />
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    // Render Customer Details View
    const renderCustomerDetailsView = () => {
        if (!viewingCustomer) return null;

        return (
            <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={[styles.customerDetailHeader, isMobile && styles.customerDetailHeaderMobile]}>
                    <View style={styles.customerDetailTitleRow}>
                        <GlassIconButton
                            icon={<ArrowLeft size={20} color={colors.text} />}
                            onPress={handleBackToCustomers}
                            variant="default"
                            size="sm"
                            style={{ marginRight: 16 }}
                        />
                        <Text style={styles.customerDetailTitle}>Customer Details</Text>
                    </View>

                    <View style={[styles.customerDetailActions, isMobile && styles.customerDetailActionsMobile]}>
                        <Text style={styles.statusLabel}>Status</Text>
                        <GlassBadge
                            label={viewingCustomer.status.charAt(0).toUpperCase() + viewingCustomer.status.slice(1)}
                            variant={viewingCustomer.status === 'active' ? 'success' : viewingCustomer.status === 'pending' ? 'warning' : 'danger'}
                            dot
                        />
                        {viewingCustomer.status === 'active' ? (
                            <GlassButton
                                label="Suspend Account"
                                onPress={() => openSuspendModal(viewingCustomer._id)}
                                variant="danger"
                                size="sm"
                            />
                        ) : (
                            <GlassButton
                                label="Revoke Suspension"
                                onPress={() => handleRevokeSuspension(viewingCustomer._id)}
                                variant="primary"
                                size="sm"
                            />
                        )}
                    </View>
                </View>

                {customerDetailData ? (
                    <>
                        {/* Account Information Card */}
                        <View style={[styles.detailCard, isMobile && styles.detailCardMobile]}>
                            <Text style={styles.detailCardTitle}>Account Information</Text>

                            <View style={[styles.detailGrid, isMobile && styles.detailGridMobile]}>
                                <View style={styles.detailGridItem}>
                                    <Text style={styles.detailLabel}>Full Name</Text>
                                    <Text style={styles.detailValue}>{customerDetailData.customer?.clientName || viewingCustomer.clientName || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailGridItem}>
                                    <Text style={styles.detailLabel}>Email</Text>
                                    <Text style={styles.detailValue}>{viewingCustomer.owner?.email || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailGridItem}>
                                    <Text style={styles.detailLabel}>Server Name</Text>
                                    <Text style={styles.detailValue}>{customerDetailData.customer?.name || 'N/A'}</Text>
                                </View>
                            </View>

                            <View style={[styles.detailGrid, isMobile && styles.detailGridMobile]}>
                                <View style={styles.detailGridItem}>
                                    <Text style={styles.detailLabel}>Server Member</Text>
                                    <Text style={styles.detailValue}>{customerDetailData.stats?.memberCount || 0}</Text>
                                </View>
                                <View style={styles.detailGridItem}>
                                    <Text style={styles.detailLabel}>Account created</Text>
                                    <Text style={styles.detailValue}>{formatDate(customerDetailData.customer?.createdAt)}</Text>
                                </View>
                            </View>

                            {/* Invite Code Section */}
                            <View style={styles.inviteCodeSection}>
                                <Text style={styles.detailLabel}>Member Invite Code</Text>
                                <View style={styles.inviteCodeBox}>
                                    <Text style={styles.inviteCodeText}>
                                        {customerDetailData.customer?.inviteCode || 'N/A'}
                                    </Text>
                                    <TouchableOpacity style={styles.copyCodeButton} onPress={() => {
                                        const code = customerDetailData.customer?.inviteCode;
                                        if (code) {
                                            import('expo-clipboard').then(Clipboard => Clipboard.setStringAsync(code));
                                        }
                                    }}>
                                        <Copy size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.inviteCodeHint}>
                                    Members can use this code to join the community
                                </Text>
                            </View>
                        </View>

                        {/* Recent Activity Card */}
                        <View style={[styles.detailCard, isMobile && styles.detailCardMobile]}>
                            <Text style={styles.detailCardTitle}>Recent Activity</Text>

                            {customerActivities.length > 0 ? (
                                customerActivities.map((activity, index) => (
                                    <View key={activity._id || index} style={styles.activityItem}>
                                        <View style={styles.activityDot} />
                                        <View style={styles.activityContent}>
                                            <Text style={styles.activityTitle}>{activity.title}</Text>
                                            <Text style={styles.activityDescription}>{activity.description}</Text>
                                        </View>
                                        <Text style={styles.activityTime}>{formatTimeAgo(activity.createdAt)}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.noActivityText}>No recent activity</Text>
                            )}
                        </View>
                    </>
                ) : null}
            </ScrollView>
        );
    };

    // Render Moderation Page
    const renderModerationPage = () => (
        <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
            <View style={[styles.pageHeader, isMobile && styles.pageHeaderMobile]}>
                <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Moderation & Safety</Text>
            </View>

            {/* Auto-flag severe content */}
            <View style={styles.moderationCard}>
                <View style={styles.moderationCardContent}>
                    <View style={styles.moderationCardInfo}>
                        <Text style={styles.moderationCardTitle}>Auto-flag severe content</Text>
                        <Text style={styles.moderationCardDescription}>Auto-flag severe contents</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.toggle, moderationSettings.autoFlagSevereContent && styles.toggleActive]}
                        onPress={() => setModerationSettings(prev => ({
                            ...prev,
                            autoFlagSevereContent: !prev.autoFlagSevereContent
                        }))}
                    >
                        <View style={[styles.toggleKnob, moderationSettings.autoFlagSevereContent && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Ban Repeated Offenders */}
            <View style={styles.moderationCard}>
                <View style={styles.moderationCardContent}>
                    <View style={styles.moderationCardInfo}>
                        <Text style={styles.moderationCardTitle}>Ban Repeated Offenders</Text>
                        <Text style={styles.moderationCardDescription}>Detect and ban repeated offenders</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.toggle, moderationSettings.banRepeatedOffenders && styles.toggleActive]}
                        onPress={() => setModerationSettings(prev => ({
                            ...prev,
                            banRepeatedOffenders: !prev.banRepeatedOffenders
                        }))}
                    >
                        <View style={[styles.toggleKnob, moderationSettings.banRepeatedOffenders && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Alert Customer */}
            <View style={styles.moderationCard}>
                <View style={styles.moderationCardContent}>
                    <View style={styles.moderationCardInfo}>
                        <Text style={styles.moderationCardTitle}>Alert Customer</Text>
                        <Text style={styles.moderationCardDescription}>Notify customers about server activities</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.toggle, moderationSettings.alertCustomer && styles.toggleActive]}
                        onPress={() => setModerationSettings(prev => ({
                            ...prev,
                            alertCustomer: !prev.alertCustomer
                        }))}
                    >
                        <View style={[styles.toggleKnob, moderationSettings.alertCustomer && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Flag Hate Speech */}
            <View style={styles.moderationCard}>
                <View style={styles.moderationCardContent}>
                    <View style={styles.moderationCardInfo}>
                        <Text style={styles.moderationCardTitle}>Flag Hate Speech</Text>
                        <Text style={styles.moderationCardDescription}>Flag hate speech or phrases</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.toggle, moderationSettings.flagHateSpeech && styles.toggleActive]}
                        onPress={() => setModerationSettings(prev => ({
                            ...prev,
                            flagHateSpeech: !prev.flagHateSpeech
                        }))}
                    >
                        <View style={[styles.toggleKnob, moderationSettings.flagHateSpeech && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Prohibited content */}
            <View style={styles.moderationCard}>
                <View style={styles.moderationCardContentVertical}>
                    <Text style={styles.moderationCardTitle}>Prohibited content</Text>
                    <View style={styles.prohibitedList}>
                        <Text style={styles.prohibitedItem}>Harassment / abuse</Text>
                        <Text style={styles.prohibitedItem}>Hate speech</Text>
                        <Text style={styles.prohibitedItem}>Fraud / impersonation</Text>
                        <Text style={styles.prohibitedItem}>Misinformation</Text>
                        <Text style={styles.prohibitedItem}>Explicit content</Text>
                        <Text style={styles.prohibitedItem}>Spam / unsolicited content</Text>
                    </View>
                </View>
            </View>

            {/* Moderation Queue */}
            <View style={styles.moderationCard}>
                <View style={styles.moderationCardContentVertical}>
                    <Text style={styles.moderationCardTitle}>Moderation Queue ({moderationTotal || 0})</Text>
                    {moderationItems.length > 0 ? (
                        moderationItems.map((item) => (
                            <View key={item._id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.glassBorder }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                                            {item.contentType} — {item.communityName}
                                        </Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                                            Reason: {item.reason}
                                        </Text>
                                        {item.reportedBy && (
                                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                                                Reported by: {item.reportedBy}
                                            </Text>
                                        )}
                                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                                            {formatTimeAgo(item.createdAt)}
                                        </Text>
                                    </View>
                                    <GlassBadge
                                        label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                        variant={item.status === 'pending' ? 'warning' : item.status === 'resolved' ? 'success' : 'muted'}
                                    />
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                            <Text style={{ color: colors.textMuted, fontSize: 14 }}>No moderation items</Text>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );

    // Render Configuration/Settings Page
    const renderConfigurationPage = () => {
        const getStatusColor = (status: string) => {
            switch (status.toLowerCase()) {
                case 'active': return { bg: colors.successBg, text: colors.successText };
                case 'suspended': return { bg: colors.dangerBg, text: colors.dangerText };
                case 'pending': return { bg: colors.warningBg, text: colors.warningText };
                default: return { bg: colors.glassBg, text: colors.textMuted };
            }
        };

        return (
            <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
                <View style={[styles.pageHeader, isMobile && styles.pageHeaderMobile]}>
                    <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Settings</Text>
                </View>

                {/* Settings Tabs */}
                <View style={[styles.settingsTabs, isMobile && styles.settingsTabsMobile]}>
                    {(['admin', 'team', 'notifications', 'system'] as SettingsTab[]).map((tab) => {
                        const labels: Record<SettingsTab, string> = { admin: 'Admin Info', team: 'Team', notifications: 'Notifications', system: 'System' };
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.settingsTab, settingsTab === tab && styles.settingsTabActive]}
                                onPress={() => setSettingsTab(tab)}
                            >
                                <Text style={[styles.settingsTabText, settingsTab === tab && styles.settingsTabTextActive]}>{labels[tab]}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Admin Info Tab */}
                {settingsTab === 'admin' && (
                    <View style={[styles.settingsContent, isMobile && styles.settingsContentMobile]}>
                        <Text style={styles.settingsSectionTitle}>Admin Info</Text>
                        <Text style={styles.settingsSectionSubtitle}>Manage your profile details here</Text>

                        <View style={[styles.settingsFormRow, isMobile && styles.settingsFormRowMobile]}>
                            <View style={styles.settingsFormGroup}>
                                <Text style={styles.settingsLabel}>First Name</Text>
                                <TextInput
                                    style={styles.settingsInput}
                                    value={adminFirstName}
                                    onChangeText={setAdminFirstName}
                                    placeholder="James"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={styles.settingsFormGroup}>
                                <Text style={styles.settingsLabel}>Last Name</Text>
                                <TextInput
                                    style={styles.settingsInput}
                                    value={adminLastName}
                                    onChangeText={setAdminLastName}
                                    placeholder="Bryce"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>

                        <View style={[styles.settingsFormRow, isMobile && styles.settingsFormRowMobile]}>
                            <View style={styles.settingsFormGroup}>
                                <Text style={styles.settingsLabel}>Account Email</Text>
                                <TextInput
                                    style={[styles.settingsInput, styles.settingsInputDisabled]}
                                    value={adminEmail}
                                    editable={false}
                                    placeholder="admin@thegryd.io"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={styles.settingsFormGroup}>
                                <Text style={styles.settingsLabel}>Username</Text>
                                <TextInput
                                    style={styles.settingsInput}
                                    value={adminUsername}
                                    onChangeText={setAdminUsername}
                                    placeholder="admin"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Save Button */}
                        <View style={styles.settingsSaveSection}>
                            <GlassButton
                                label="Save Changes"
                                onPress={handleSaveAdminInfo}
                                variant="primary"
                                size="md"
                                loading={savingAdminInfo}
                                disabled={savingAdminInfo}
                            />
                        </View>
                    </View>
                )}

                {/* Team Tab */}
                {settingsTab === 'team' && (
                    <View style={[styles.settingsContent, isMobile && styles.settingsContentMobile]}>
                        <View style={[styles.teamHeader, isMobile && styles.teamHeaderMobile]}>
                            <View>
                                <Text style={styles.settingsSectionTitle}>Team</Text>
                                <Text style={styles.settingsSectionSubtitle}>Manage your team members here</Text>
                            </View>
                            <View style={styles.teamHeaderActions}>
                                <GlassIconButton
                                    icon={<Settings size={18} color={colors.text} />}
                                    onPress={() => setSettingsTab('team')}
                                    variant="default"
                                    size="sm"
                                />
                                <GlassButton
                                    label="Add Team Member"
                                    onPress={() => setInviteModalOpen(true)}
                                    variant="primary"
                                    size="sm"
                                    icon={<Plus size={15} color="#fff" />}
                                />
                            </View>
                        </View>

                        {/* Team Table */}
                        {isMobile ? (
                            <View style={styles.mobileCardList}>
                                {teamMembers.map((member) => (
                                    <View key={member._id} style={[styles.mobileCustomerCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                                        <View style={styles.mobileCardRow}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                                <View style={styles.teamMemberAvatar}>
                                                    <Text style={styles.teamMemberAvatarText}>
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.teamMemberName}>{member.name}</Text>
                                                    <Text style={[styles.customerEmail, { marginTop: 2 }]}>{member.email}</Text>
                                                </View>
                                            </View>
                                            <View style={{ position: 'relative' }}>
                                                <GlassIconButton
                                                    icon={<MoreVertical size={16} color={colors.textMuted} />}
                                                    onPress={() => openTeamMemberActionMenu(member)}
                                                    variant="default"
                                                    size="sm"
                                                />
                                                {teamActionMenuOpen === member._id && (
                                                    <View style={[styles.actionMenuDropdown, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                                                        <TouchableOpacity
                                                            style={styles.actionMenuItem}
                                                            onPress={() => openTeamSuspendModal(member)}
                                                        >
                                                            {member.status === 'suspended' ? (
                                                                <PlayCircle size={16} color={colors.text} />
                                                            ) : (
                                                                <PauseCircle size={16} color={colors.text} />
                                                            )}
                                                            <Text style={styles.actionMenuItemText}>
                                                                {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.actionMenuItem, styles.actionMenuItemDanger]}
                                                            onPress={() => openTeamDeleteModal(member)}
                                                        >
                                                            <Trash2 size={16} color={colors.error} />
                                                            <Text style={[styles.actionMenuItemText, { color: colors.error }]}>Delete</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.mobileCardRow}>
                                            <View style={styles.mobileCardField}>
                                                <Text style={styles.mobileCardLabel}>Role</Text>
                                                <Text style={styles.mobileCardValue}>{member.role}</Text>
                                            </View>
                                            <GlassBadge
                                                label={member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                                variant={member.status === 'active' ? 'success' : member.status === 'suspended' ? 'danger' : 'muted'}
                                            />
                                        </View>
                                    </View>
                                ))}

                                {teamMembers.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <Users size={48} color={colors.textMuted} />
                                        <Text style={styles.emptyStateText}>No team members yet</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={styles.teamTable}>
                                <View style={styles.teamTableHeader}>
                                    <View style={styles.teamCheckboxCell}>
                                        <View style={styles.checkbox} />
                                    </View>
                                    <Text style={[styles.teamTableHeaderCell, { flex: 2 }]}>Name</Text>
                                    <Text style={[styles.teamTableHeaderCell, { flex: 2 }]}>Email</Text>
                                    <Text style={[styles.teamTableHeaderCell, { flex: 1 }]}>Role</Text>
                                    <Text style={[styles.teamTableHeaderCell, { flex: 1 }]}>Status</Text>
                                    <View style={{ width: 40 }} />
                                </View>

                                {teamMembers.map((member) => {
                                    const statusColors = getStatusColor(member.status);
                                    return (
                                        <View key={member._id} style={styles.teamTableRow}>
                                            <View style={styles.teamCheckboxCell}>
                                                <View style={styles.checkbox} />
                                            </View>
                                            <View style={[styles.teamTableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                                                <View style={styles.teamMemberAvatar}>
                                                    <Text style={styles.teamMemberAvatarText}>
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={styles.teamMemberName}>{member.name}</Text>
                                            </View>
                                            <Text style={[styles.teamTableCell, { flex: 2 }]}>{member.email}</Text>
                                            <Text style={[styles.teamTableCell, { flex: 1 }]}>{member.role}</Text>
                                            <View style={[styles.teamTableCell, { flex: 1 }]}>
                                                <View style={[styles.teamStatusBadge, { backgroundColor: statusColors.bg }]}>
                                                    <Text style={[styles.teamStatusText, { color: statusColors.text }]}>
                                                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ position: 'relative' }}>
                                                <TouchableOpacity
                                                    style={styles.teamActionButton}
                                                    onPress={() => openTeamMemberActionMenu(member)}
                                                >
                                                    <MoreVertical size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                                {teamActionMenuOpen === member._id && (
                                                    <View style={styles.actionMenuDropdown}>
                                                        <TouchableOpacity
                                                            style={styles.actionMenuItem}
                                                            onPress={() => openTeamSuspendModal(member)}
                                                        >
                                                            {member.status === 'suspended' ? (
                                                                <PlayCircle size={16} color={colors.text} />
                                                            ) : (
                                                                <PauseCircle size={16} color={colors.text} />
                                                            )}
                                                            <Text style={styles.actionMenuItemText}>
                                                                {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.actionMenuItem, styles.actionMenuItemDanger]}
                                                            onPress={() => openTeamDeleteModal(member)}
                                                        >
                                                            <Trash2 size={16} color={colors.error} />
                                                            <Text style={[styles.actionMenuItemText, { color: colors.error }]}>Delete</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}

                                {teamMembers.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <Users size={48} color={colors.textMuted} />
                                        <Text style={styles.emptyStateText}>No team members yet</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Notifications Tab */}
                {settingsTab === 'notifications' && (
                    <View style={[styles.settingsContent, isMobile && styles.settingsContentMobile]}>
                        <Text style={styles.settingsSectionTitle}>Email Notifications</Text>
                        <Text style={styles.settingsSectionSubtitle}>Configure when to receive email notifications</Text>

                        {/* System Alert */}
                        <View style={styles.notificationCard}>
                            <View style={styles.notificationCardContent}>
                                <View style={styles.notificationCardInfo}>
                                    <Text style={styles.notificationCardTitle}>System Alert</Text>
                                    <Text style={styles.notificationCardDescription}>Critical system issue and error</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, notificationSettings.systemAlerts && styles.toggleActive]}
                                    onPress={() => handleNotificationToggle('systemAlerts')}
                                >
                                    <View style={[styles.toggleKnob, notificationSettings.systemAlerts && styles.toggleKnobActive]} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Security Events */}
                        <View style={styles.notificationCard}>
                            <View style={styles.notificationCardContent}>
                                <View style={styles.notificationCardInfo}>
                                    <Text style={styles.notificationCardTitle}>Security Events</Text>
                                    <Text style={styles.notificationCardDescription}>Login attempts and security issues</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, notificationSettings.securityEvents && styles.toggleActive]}
                                    onPress={() => handleNotificationToggle('securityEvents')}
                                >
                                    <View style={[styles.toggleKnob, notificationSettings.securityEvents && styles.toggleKnobActive]} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Daily Reports */}
                        <View style={styles.notificationCard}>
                            <View style={styles.notificationCardContent}>
                                <View style={styles.notificationCardInfo}>
                                    <Text style={styles.notificationCardTitle}>Daily Reports</Text>
                                    <Text style={styles.notificationCardDescription}>Daily summary of platform activities</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, notificationSettings.dailyReports && styles.toggleActive]}
                                    onPress={() => handleNotificationToggle('dailyReports')}
                                >
                                    <View style={[styles.toggleKnob, notificationSettings.dailyReports && styles.toggleKnobActive]} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Weekly Reports */}
                        <View style={styles.notificationCard}>
                            <View style={styles.notificationCardContent}>
                                <View style={styles.notificationCardInfo}>
                                    <Text style={styles.notificationCardTitle}>Weekly Reports</Text>
                                    <Text style={styles.notificationCardDescription}>Weekly analytics and insights</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.toggle, notificationSettings.weeklyReports && styles.toggleActive]}
                                    onPress={() => handleNotificationToggle('weeklyReports')}
                                >
                                    <View style={[styles.toggleKnob, notificationSettings.weeklyReports && styles.toggleKnobActive]} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* System Config Tab */}
                {settingsTab === 'system' && (
                    <View style={[styles.settingsContent, isMobile && styles.settingsContentMobile]}>
                        <Text style={styles.settingsSectionTitle}>System Configuration</Text>
                        <Text style={styles.settingsSectionSubtitle}>Manage platform features, limits, and defaults</Text>

                        {configForm ? (
                            <>
                                {/* Features */}
                                <Text style={[styles.settingsSectionTitle, { fontSize: 15, marginTop: 16 }]}>Features</Text>
                                {Object.entries(configForm.features).map(([key, enabled]) => (
                                    <View key={key} style={styles.notificationCard}>
                                        <View style={styles.notificationCardContent}>
                                            <View style={styles.notificationCardInfo}>
                                                <Text style={styles.notificationCardTitle}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.toggle, enabled && styles.toggleActive]}
                                                disabled={!configEditing}
                                                onPress={() => setConfigForm(prev => prev ? {
                                                    ...prev,
                                                    features: { ...prev.features, [key]: !enabled }
                                                } : prev)}
                                            >
                                                <View style={[styles.toggleKnob, enabled && styles.toggleKnobActive]} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}

                                {/* Limits */}
                                <Text style={[styles.settingsSectionTitle, { fontSize: 15, marginTop: 16 }]}>Limits</Text>
                                {Object.entries(configForm.limits).map(([key, value]) => (
                                    <View key={key} style={[styles.settingsFormGroup, { marginBottom: 12 }]}>
                                        <Text style={styles.settingsLabel}>
                                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                                        </Text>
                                        <TextInput
                                            style={[styles.settingsInput, !configEditing && styles.settingsInputDisabled]}
                                            value={String(value)}
                                            editable={configEditing}
                                            keyboardType="numeric"
                                            onChangeText={(text) => {
                                                const num = parseInt(text, 10);
                                                if (!isNaN(num)) {
                                                    setConfigForm(prev => prev ? {
                                                        ...prev,
                                                        limits: { ...prev.limits, [key]: num }
                                                    } : prev);
                                                }
                                            }}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                ))}

                                {/* Defaults */}
                                <Text style={[styles.settingsSectionTitle, { fontSize: 15, marginTop: 16 }]}>Defaults</Text>
                                <View style={[styles.settingsFormGroup, { marginBottom: 12 }]}>
                                    <Text style={styles.settingsLabel}>New Community Plan</Text>
                                    <TextInput
                                        style={[styles.settingsInput, !configEditing && styles.settingsInputDisabled]}
                                        value={configForm.defaults.newCommunityPlan}
                                        editable={configEditing}
                                        onChangeText={(text) => setConfigForm(prev => prev ? {
                                            ...prev,
                                            defaults: { ...prev.defaults, newCommunityPlan: text }
                                        } : prev)}
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                                <View style={[styles.settingsFormGroup, { marginBottom: 12 }]}>
                                    <Text style={styles.settingsLabel}>Trial Duration (days)</Text>
                                    <TextInput
                                        style={[styles.settingsInput, !configEditing && styles.settingsInputDisabled]}
                                        value={String(configForm.defaults.trialDurationDays)}
                                        editable={configEditing}
                                        keyboardType="numeric"
                                        onChangeText={(text) => {
                                            const num = parseInt(text, 10);
                                            if (!isNaN(num)) {
                                                setConfigForm(prev => prev ? {
                                                    ...prev,
                                                    defaults: { ...prev.defaults, trialDurationDays: num }
                                                } : prev);
                                            }
                                        }}
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>

                                {/* Edit/Save button */}
                                <View style={styles.settingsSaveSection}>
                                    <TouchableOpacity
                                        style={styles.saveAdminInfoButton}
                                        onPress={() => {
                                            if (configEditing) {
                                                handleConfigSave();
                                            }
                                            setConfigEditing(!configEditing);
                                        }}
                                    >
                                        <Text style={styles.saveAdminInfoButtonText}>
                                            {configEditing ? 'Save Configuration' : 'Edit Configuration'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted, fontSize: 14 }}>Loading system configuration...</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        );
    };

    // Render Add Customer Modal
    const renderAddCustomerModal = () => (
        <Modal
            visible={addCustomerModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAddCustomerModalOpen(false)}
        >
            <Pressable style={styles.modalOverlay} onPress={() => setAddCustomerModalOpen(false)}>
                <Pressable style={styles.addCustomerModal} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.addCustomerHeader}>
                        <Text style={styles.addCustomerTitle}>Add Customer</Text>
                        <TouchableOpacity onPress={() => setAddCustomerModalOpen(false)}>
                            <X size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.addCustomerSubtitle}>
                        Onboard a new customer. Account setup link will be sent to the customer's email
                    </Text>

                    <View style={styles.addCustomerForm}>
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Customer Name</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="John Doe"
                                placeholderTextColor={colors.textMuted}
                                value={newCustomerName}
                                onChangeText={setNewCustomerName}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Email address</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="name@example.com"
                                placeholderTextColor={colors.textMuted}
                                value={newCustomerEmail}
                                onChangeText={setNewCustomerEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.addCustomerSubmitButton}
                            onPress={handleAddCustomer}
                            disabled={addingCustomer}
                        >
                            {addingCustomer ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={styles.addCustomerSubmitText}>Add Customer</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Render Suspend Account Modal
    const renderSuspendModal = () => (
        <Modal
            visible={suspendModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSuspendModalOpen(false)}
        >
            <Pressable style={styles.modalOverlay} onPress={() => setSuspendModalOpen(false)}>
                <Pressable style={styles.confirmModal} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.confirmModalHeader}>
                        <Text style={styles.confirmModalTitle}>Suspend Account</Text>
                        <TouchableOpacity onPress={() => setSuspendModalOpen(false)}>
                            <X size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.confirmModalSubtitle}>
                        Everything pertaining the account will be paused if you proceed.
                    </Text>

                    <TouchableOpacity
                        style={styles.confirmCheckboxRow}
                        onPress={() => setSuspendConfirmChecked(!suspendConfirmChecked)}
                    >
                        <View style={[styles.confirmCheckbox, suspendConfirmChecked && styles.confirmCheckboxChecked]}>
                            {suspendConfirmChecked && <Check size={16} color={colors.successText} />}
                        </View>
                        <Text style={styles.confirmCheckboxText}>Yes, I want to Suspend this Account</Text>
                    </TouchableOpacity>

                    <View style={styles.confirmModalActions}>
                        <TouchableOpacity
                            style={styles.confirmCancelButton}
                            onPress={() => setSuspendModalOpen(false)}
                        >
                            <Text style={styles.confirmCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmProceedButton, !suspendConfirmChecked && styles.confirmProceedButtonDisabled]}
                            onPress={handleSuspendCustomer}
                            disabled={!suspendConfirmChecked || suspendingCustomer}
                        >
                            {suspendingCustomer ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={styles.confirmProceedText}>Proceed</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Render Delete Account Modal
    const renderDeleteModal = () => (
        <Modal
            visible={deleteModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setDeleteModalOpen(false)}
        >
            <Pressable style={styles.modalOverlay} onPress={() => setDeleteModalOpen(false)}>
                <Pressable style={styles.confirmModal} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.confirmModalHeader}>
                        <Text style={styles.confirmModalTitle}>Delete Account</Text>
                        <TouchableOpacity onPress={() => setDeleteModalOpen(false)}>
                            <X size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.confirmModalSubtitle}>
                        Everything pertaining the account will be lost if you proceed.
                    </Text>

                    <TouchableOpacity
                        style={styles.confirmCheckboxRow}
                        onPress={() => setDeleteConfirmChecked(!deleteConfirmChecked)}
                    >
                        <View style={[styles.confirmCheckbox, deleteConfirmChecked && styles.confirmCheckboxChecked]}>
                            {deleteConfirmChecked && <Check size={16} color={colors.successText} />}
                        </View>
                        <Text style={styles.confirmCheckboxText}>Yes, I want to Delete this Account</Text>
                    </TouchableOpacity>

                    <View style={styles.confirmModalActions}>
                        <TouchableOpacity
                            style={styles.confirmCancelButton}
                            onPress={() => setDeleteModalOpen(false)}
                        >
                            <Text style={styles.confirmCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmProceedButton, !deleteConfirmChecked && styles.confirmProceedButtonDisabled]}
                            onPress={handleDeleteCustomer}
                            disabled={!deleteConfirmChecked || deletingCustomer}
                        >
                            {deletingCustomer ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                            ) : (
                                <Text style={styles.confirmProceedText}>Proceed</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Render Invite Team Member Modal
    const renderInviteModal = () => (
        <Modal
            visible={inviteModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setInviteModalOpen(false)}
        >
            <Pressable style={styles.modalOverlay} onPress={() => setInviteModalOpen(false)}>
                <Pressable style={[styles.inviteModal, isMobile && styles.inviteModalMobile]} onPress={(e) => e.stopPropagation()}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={styles.inviteModalHeader}>
                            <View style={styles.inviteIconContainer}>
                                <UserPlus size={32} color="#22c55e" />
                            </View>
                            <TouchableOpacity style={styles.inviteCloseButton} onPress={() => setInviteModalOpen(false)}>
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inviteModalTitle}>Add Team Member</Text>
                        <Text style={styles.inviteModalSubtitle}>Invite colleagues to help manage the platform</Text>

                        <View style={styles.inviteForm}>
                            {/* Name row */}
                            <View style={[styles.inviteFormRow, isMobile && styles.inviteFormRowMobile]}>
                                <View style={[styles.inviteEmailGroup, { flex: 1 }]}>
                                    <Text style={styles.inviteLabel}>First Name</Text>
                                    <TextInput
                                        style={styles.inviteInput}
                                        value={inviteFirstName}
                                        onChangeText={setInviteFirstName}
                                        placeholder="John"
                                        placeholderTextColor={colors.textMuted}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={[styles.inviteEmailGroup, { flex: 1, marginLeft: isMobile ? 0 : 12 }]}>
                                    <Text style={styles.inviteLabel}>Last Name</Text>
                                    <TextInput
                                        style={styles.inviteInput}
                                        value={inviteLastName}
                                        onChangeText={setInviteLastName}
                                        placeholder="Doe"
                                        placeholderTextColor={colors.textMuted}
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

                            {/* Email field */}
                            <View style={[styles.inviteFormRow, isMobile && styles.inviteFormRowMobile]}>
                                <View style={[styles.inviteEmailGroup, isMobile && { flex: 1 }]}>
                                    <Text style={styles.inviteLabel}>Email address *</Text>
                                    <TextInput
                                        style={styles.inviteInput}
                                        value={inviteEmail}
                                        onChangeText={setInviteEmail}
                                        placeholder="name@example.com"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                                {!isMobile && (
                                    <View style={styles.inviteRoleGroup}>
                                        <Text style={styles.inviteLabel}>Role</Text>
                                        <TouchableOpacity
                                            style={styles.inviteRoleDropdown}
                                            onPress={() => setInviteRoleDropdownOpen(!inviteRoleDropdownOpen)}
                                        >
                                            <Text style={styles.inviteRoleText}>
                                                {inviteRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                                            </Text>
                                            <ChevronDown size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                        {inviteRoleDropdownOpen && (
                                            <View style={[styles.inviteRoleDropdownMenu, { position: 'absolute', top: 70, left: 0, right: 0, zIndex: 9999 }]}>
                                                <TouchableOpacity
                                                    style={[styles.inviteRoleOption, inviteRole === 'admin' && styles.inviteRoleOptionActive]}
                                                    onPress={() => { setInviteRole('admin'); setInviteRoleDropdownOpen(false); }}
                                                >
                                                    <Text style={styles.inviteRoleOptionText}>Admin</Text>
                                                    <Text style={styles.inviteRoleOptionDesc}>Can manage customers and moderation</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.inviteRoleOption, inviteRole === 'super_admin' && styles.inviteRoleOptionActive]}
                                                    onPress={() => { setInviteRole('super_admin'); setInviteRoleDropdownOpen(false); }}
                                                >
                                                    <Text style={styles.inviteRoleOptionText}>Super Admin</Text>
                                                    <Text style={styles.inviteRoleOptionDesc}>Full platform access including settings</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Role field - separate row on mobile */}
                            {isMobile && (
                                <View style={[styles.inviteFormRow, styles.inviteFormRowMobile]}>
                                    <View style={[styles.inviteRoleGroup, { flex: 1, zIndex: 1000 }]}>
                                        <Text style={styles.inviteLabel}>Role</Text>
                                        <TouchableOpacity
                                            style={styles.inviteRoleDropdown}
                                            onPress={() => setInviteRoleDropdownOpen(!inviteRoleDropdownOpen)}
                                        >
                                            <Text style={styles.inviteRoleText}>
                                                {inviteRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                                            </Text>
                                            <ChevronDown size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                        {inviteRoleDropdownOpen && (
                                            <View style={[styles.inviteRoleDropdownMenu, { position: 'absolute', top: 70, left: 0, right: 0, zIndex: 9999 }]}>
                                                <TouchableOpacity
                                                    style={[styles.inviteRoleOption, inviteRole === 'admin' && styles.inviteRoleOptionActive]}
                                                    onPress={() => { setInviteRole('admin'); setInviteRoleDropdownOpen(false); }}
                                                >
                                                    <Text style={styles.inviteRoleOptionText}>Admin</Text>
                                                    <Text style={styles.inviteRoleOptionDesc}>Can manage customers and moderation</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.inviteRoleOption, inviteRole === 'super_admin' && styles.inviteRoleOptionActive]}
                                                    onPress={() => { setInviteRole('super_admin'); setInviteRoleDropdownOpen(false); }}
                                                >
                                                    <Text style={styles.inviteRoleOptionText}>Super Admin</Text>
                                                    <Text style={styles.inviteRoleOptionDesc}>Full platform access including settings</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>

                        <View style={[styles.inviteModalActions, isMobile && styles.inviteModalActionsMobile]}>
                            <TouchableOpacity
                                style={[styles.inviteCancelButton, isMobile && styles.inviteCancelButtonMobile]}
                                onPress={() => { setInviteModalOpen(false); setInviteRoleDropdownOpen(false); }}
                            >
                                <Text style={styles.inviteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.inviteSubmitButton, isMobile && styles.inviteSubmitButtonMobile, !inviteEmail.trim() && styles.inviteSubmitButtonDisabled]}
                                onPress={handleInviteMember}
                                disabled={!inviteEmail.trim() || invitingMember}
                            >
                                {invitingMember ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={styles.inviteSubmitText}>Send invite</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Render Team Member Suspend Modal
    const renderTeamSuspendModal = () => {
        const member = teamMembers?.find(m => m._id === teamSuspendMemberId);
        const isSuspended = member?.status === 'suspended';

        return (
            <Modal
                visible={teamSuspendModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setTeamSuspendModalOpen(false);
                    setTeamSuspendConfirmChecked(false);
                }}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => {
                        setTeamSuspendModalOpen(false);
                        setTeamSuspendConfirmChecked(false);
                    }}
                >
                    <Pressable style={styles.suspendModal} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.suspendModalHeader}>
                            <View style={[styles.suspendIconContainer, isSuspended && { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                                {isSuspended ? (
                                    <PlayCircle size={32} color="#22c55e" />
                                ) : (
                                    <PauseCircle size={32} color="#f59e0b" />
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.suspendCloseButton}
                                onPress={() => {
                                    setTeamSuspendModalOpen(false);
                                    setTeamSuspendConfirmChecked(false);
                                }}
                            >
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.suspendModalTitle}>
                            {isSuspended ? 'Reactivate Team Member' : 'Suspend Team Member'}
                        </Text>
                        <Text style={styles.suspendModalSubtitle}>
                            {isSuspended
                                ? `Are you sure you want to reactivate ${member?.name || 'this team member'}? They will regain access to the platform.`
                                : `Are you sure you want to suspend ${member?.name || 'this team member'}? They will lose access to the platform until reactivated.`
                            }
                        </Text>

                        <TouchableOpacity
                            style={styles.suspendConfirmRow}
                            onPress={() => setTeamSuspendConfirmChecked(!teamSuspendConfirmChecked)}
                        >
                            <View style={[styles.suspendCheckbox, teamSuspendConfirmChecked && styles.suspendCheckboxChecked]}>
                                {teamSuspendConfirmChecked && <Check size={14} color="#fff" />}
                            </View>
                            <Text style={styles.suspendConfirmText}>
                                {isSuspended
                                    ? 'I confirm I want to reactivate this team member'
                                    : 'I understand this will immediately revoke their access'
                                }
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.suspendModalActions}>
                            <TouchableOpacity
                                style={styles.suspendCancelButton}
                                onPress={() => {
                                    setTeamSuspendModalOpen(false);
                                    setTeamSuspendConfirmChecked(false);
                                }}
                            >
                                <Text style={styles.suspendCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.suspendSubmitButton,
                                    !teamSuspendConfirmChecked && styles.suspendSubmitButtonDisabled,
                                    isSuspended && { backgroundColor: colors.successText }
                                ]}
                                onPress={handleSuspendTeamMember}
                                disabled={!teamSuspendConfirmChecked || suspendingTeamMember}
                            >
                                {suspendingTeamMember ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={styles.suspendSubmitText}>
                                        {isSuspended ? 'Reactivate' : 'Suspend'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    };

    // Render Team Member Delete Modal
    const renderTeamDeleteModal = () => {
        const member = teamMembers.find(m => m._id === teamDeleteMemberId);

        return (
            <Modal
                visible={teamDeleteModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setTeamDeleteModalOpen(false);
                    setTeamDeleteConfirmChecked(false);
                }}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => {
                        setTeamDeleteModalOpen(false);
                        setTeamDeleteConfirmChecked(false);
                    }}
                >
                    <Pressable style={styles.suspendModal} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.suspendModalHeader}>
                            <View style={[styles.suspendIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                <Trash2 size={32} color="#EF4444" />
                            </View>
                            <TouchableOpacity
                                style={styles.suspendCloseButton}
                                onPress={() => {
                                    setTeamDeleteModalOpen(false);
                                    setTeamDeleteConfirmChecked(false);
                                }}
                            >
                                <X size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.suspendModalTitle}>Delete Team Member</Text>
                        <Text style={styles.suspendModalSubtitle}>
                            Are you sure you want to permanently delete {member?.name || 'this team member'}? This action cannot be undone.
                        </Text>

                        <TouchableOpacity
                            style={styles.suspendConfirmRow}
                            onPress={() => setTeamDeleteConfirmChecked(!teamDeleteConfirmChecked)}
                        >
                            <View style={[styles.suspendCheckbox, teamDeleteConfirmChecked && styles.suspendCheckboxChecked, teamDeleteConfirmChecked && { backgroundColor: colors.error }]}>
                                {teamDeleteConfirmChecked && <Check size={14} color={colors.primaryText} />}
                            </View>
                            <Text style={styles.suspendConfirmText}>
                                I understand this action is permanent and cannot be undone
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.suspendModalActions}>
                            <TouchableOpacity
                                style={styles.suspendCancelButton}
                                onPress={() => {
                                    setTeamDeleteModalOpen(false);
                                    setTeamDeleteConfirmChecked(false);
                                }}
                            >
                                <Text style={styles.suspendCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.suspendSubmitButton,
                                    { backgroundColor: colors.error },
                                    !teamDeleteConfirmChecked && styles.suspendSubmitButtonDisabled
                                ]}
                                onPress={handleDeleteTeamMember}
                                disabled={!teamDeleteConfirmChecked || deletingTeamMember}
                            >
                                {deletingTeamMember ? (
                                    <ActivityIndicator size="small" color={colors.primaryText} />
                                ) : (
                                    <Text style={styles.suspendSubmitText}>Delete</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    };

    // Render Income Section

    const PIE_SLICES = [
        { label: 'Marketplace Commission', pct: 45, color: '#3b82f6' },
        { label: 'Marketing RevShare', pct: 25, color: '#8b5cf6' },
        { label: 'Platform Fees', pct: 20, color: '#22c55e' },
        { label: 'Other', pct: 10, color: '#f59e0b' },
    ];

    const handleMarkRevSharePaid = async (id: string) => {
        try {
            await superAdminPost('/super-admin/revshare/mark-paid', { id });
        } catch (err: any) {
            console.error('mark-paid error', err.message);
        }
    };

    const renderIncomeSection = () => {
        const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtShort = (n: number) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + n.toFixed(2);

        const totalMarketplace = (incomeData.clients ?? []).reduce((s: number, c: any) => s + (c.platformAmount ?? 0), 0);
        const totalPartner = (incomeData.clients ?? []).reduce((s: number, c: any) => s + (c.partnerAmount ?? 0), 0);
        const grandTotal = totalMarketplace + totalPartner;

        const summary = {
            totalRevenue: incomeData.totalPlatformRevenue || grandTotal,
            monthRevenue: incomeData.monthRevenue,
            totalRevSharePaid: totalPartner,
            marketplaceRevenue: totalMarketplace,
        };

        // Build donut from real data
        const totalForChart = summary.totalRevenue || 1;
        const realSlices = [
            { label: 'Marketplace', value: summary.marketplaceRevenue, color: '#3b82f6' },
            { label: 'RevShare Paid', value: summary.totalRevSharePaid, color: '#8b5cf6' },
            { label: 'Other', value: Math.max(0, summary.totalRevenue - summary.marketplaceRevenue - summary.totalRevSharePaid), color: '#22c55e' },
        ].filter(s => s.value > 0);
        if (realSlices.length === 0) realSlices.push({ label: 'No data', value: 1, color: colors.glassBorder });

        const buildDonutPaths = () => {
            const cx = 50; const cy = 50; const r = 36; const hole = 22;
            let startAngle = -Math.PI / 2;
            const total = realSlices.reduce((s, sl) => s + sl.value, 0) || 1;
            return realSlices.map((slice) => {
                const angle = (slice.value / total) * 2 * Math.PI;
                const endAngle = startAngle + angle;
                const x1o = cx + r * Math.cos(startAngle); const y1o = cy + r * Math.sin(startAngle);
                const x2o = cx + r * Math.cos(endAngle); const y2o = cy + r * Math.sin(endAngle);
                const x1i = cx + hole * Math.cos(endAngle); const y1i = cy + hole * Math.sin(endAngle);
                const x2i = cx + hole * Math.cos(startAngle); const y2i = cy + hole * Math.sin(startAngle);
                const largeArc = angle > Math.PI ? 1 : 0;
                const d = `M ${x1o} ${y1o} A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${hole} ${hole} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
                startAngle = endAngle;
                return { d, color: slice.color, label: slice.label, pct: Math.round((slice.value / total) * 100) };
            });
        };
        const donutPaths = buildDonutPaths();

        const clientRows = (incomeData.clients ?? [])
            .map((c: any) => ({
                clientId: c.cuId,
                name: c.cuName,
                plan: c.plan ?? '-',
                members: c.memberCount,
                marketplaceRev: c.platformAmount,
                partnerRev: c.partnerAmount,
                total: (c.platformAmount ?? 0) + (c.partnerAmount ?? 0),
                momChange: c.momChange ?? 0,
            }))
            .filter((r: any) => r.name.toLowerCase().includes(incomeClientSearch.toLowerCase()))
            .sort((a: any, b: any) => b.total - a.total);

        const queueItems = (incomeData.revShareQueue ?? []).filter(
            (q: any) => revShareFilter === 'All' || q.status === revShareFilter
        );

        const queueStatusColor = (status: string) => {
            if (status === 'Paid') return '#10B981';
            if (status === 'Processing') return '#3B82F6';
            return '#F59E0B'; // Pending = amber
        };

        return (
            <ScrollView
                style={[styles.pageContent, isMobile && styles.pageContentMobile]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            >
                {/* Page header */}
                <View style={[styles.pageHeader, isMobile && styles.pageHeaderMobile, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={22} color={colors.primary} />
                    </View>
                    <View>
                        <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile, { marginBottom: 0 }]}>Income & RevShare</Text>
                        <Text style={styles.pageSubtitle}>Platform revenue breakdown by client</Text>
                    </View>
                </View>

                {/* Section 1: Summary stat cards */}
                <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                    <GlassStatCard
                        label="Revenue"
                        value={fmt(summary.totalRevenue)}
                        subtitle="All time platform"
                        icon={<DollarSign size={22} color="#22c55e" />}
                        accent="rgba(34,197,94,0.85)"
                        style={{ flex: 1, minWidth: 150 }}
                    />
                    <GlassStatCard
                        label="This Month"
                        value={fmt(summary.monthRevenue)}
                        subtitle="Current period"
                        icon={<TrendingUp size={22} color="#3b82f6" />}
                        accent="rgba(59,130,246,0.85)"
                        style={{ flex: 1, minWidth: 150 }}
                    />
                    <GlassStatCard
                        label="Marketplace"
                        value={fmt(summary.marketplaceRevenue)}
                        subtitle="Platform commission"
                        icon={<DollarSign size={22} color="#f59e0b" />}
                        accent="rgba(245,158,11,0.85)"
                        style={{ flex: 1, minWidth: 150 }}
                    />
                    <GlassStatCard
                        label="RevShare"
                        value={fmt(summary.totalRevSharePaid)}
                        subtitle="Paid to partners"
                        icon={<DollarSign size={22} color="#8b5cf6" />}
                        accent="rgba(139,92,246,0.85)"
                        style={{ flex: 1, minWidth: 150 }}
                    />
                </View>

                {/* Section 2: Revenue Breakdown Chart */}
                <View style={styles.tableCard}>
                    <Text style={styles.tableTitle}>Revenue Breakdown</Text>
                    <View style={styles.incomeChartRow}>
                        <View style={[styles.incomeDonutWrap, { position: 'relative' }]}>
                            <Svg width={140} height={140} viewBox="0 0 100 100">
                                {donutPaths.map((p, i) => (
                                    <Path key={i} d={p.d} fill={p.color} />
                                ))}
                                <Circle cx={50} cy={50} r={18} fill={colors.modalBg ?? colors.glassBg} />
                            </Svg>
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{fmtShort(summary.totalRevenue)}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 10 }}>total</Text>
                            </View>
                        </View>
                        <View style={[styles.incomeLegend, { flex: 1 }]}>
                            {donutPaths.map((p) => (
                                <View key={p.label} style={[styles.incomeLegendRow, { marginBottom: 10 }]}>
                                    <View style={[styles.incomeLegendDot, { backgroundColor: p.color, width: 10, height: 10, borderRadius: 5 }]} />
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={[styles.incomeLegendLabel, { color: colors.text, fontSize: 13, fontWeight: '600' }]}>{p.label}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.pct}% of total</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Section 3: Per-Client Revenue Table */}
                <View style={styles.tableCard}>
                    <View style={{ padding: 16, paddingBottom: 0 }}>
                        <Text style={styles.tableTitle}>Client Revenue Breakdown</Text>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginTop: 12,
                            marginBottom: 12,
                        }}>
                            <Search size={14} color={colors.textMuted} />
                            <TextInput
                                style={{
                                    flex: 1,
                                    marginLeft: 8,
                                    fontSize: 14,
                                    color: colors.text,
                                    backgroundColor: 'transparent',
                                    paddingVertical: 0,
                                    // @ts-ignore
                                    outlineStyle: 'none',
                                }}
                                placeholder="Search clients..."
                                placeholderTextColor={colors.textMuted}
                                value={incomeClientSearch}
                                onChangeText={setIncomeClientSearch}
                            />
                        </View>
                    </View>

                    {!isMobile && (
                        <View style={[styles.tableRowHeader, { backgroundColor: colors.glassBg }]}>
                            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Community</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Plan</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Members</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Marketplace Rev</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>RevShare Paid</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, fontWeight: '700' }]}>Total</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>MoM</Text>
                        </View>
                    )}

                    {clientRows.length === 0 && (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <DollarSign size={32} color={colors.textMuted} />
                            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 10 }}>
                                No client revenue data yet
                            </Text>
                        </View>
                    )}

                    {clientRows.map((row: any) => {
                        const isExpanded = expandedClientId === row.clientId;
                        const momColor = row.momChange >= 0 ? colors.successText : colors.dangerText;
                        return (
                            <View key={row.clientId}>
                                <TouchableOpacity
                                    style={[styles.tableRow, { borderBottomColor: colors.glassBorder, borderBottomWidth: 1 }]}
                                    onPress={() => setExpandedClientId(isExpanded ? null : row.clientId)}
                                    activeOpacity={0.7}
                                >
                                    {isMobile ? (
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.mobileCardRow}>
                                                <Text style={[styles.customerName, { flex: 1 }]} numberOfLines={1}>{row.name}</Text>
                                                <Text style={[styles.tableCell, { color: momColor }]}>{row.momChange >= 0 ? '+' : ''}{row.momChange}%</Text>
                                            </View>
                                            <View style={styles.mobileCardRow}>
                                                <Text style={styles.mobileCardLabel}>{row.plan} · {row.members} members</Text>
                                                <Text style={[styles.tableCell, { fontWeight: '600' }]}>${row.total.toLocaleString()}</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={[styles.tableCell, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>{row.name}</Text>
                                            <Text style={[styles.tableCell, { flex: 1 }]}>{row.plan}</Text>
                                            <Text style={[styles.tableCell, { flex: 1 }]}>{(row.members ?? 0).toLocaleString()}</Text>
                                            <Text style={[styles.tableCell, { flex: 1 }]}>{fmtShort(row.marketplaceRev ?? 0)}</Text>
                                            <Text style={[styles.tableCell, { flex: 1, color: '#8b5cf6' }]}>{fmtShort(row.partnerRev ?? 0)}</Text>
                                            <Text style={[styles.tableCell, { flex: 1, fontWeight: '700', color: colors.text }]}>{fmtShort(row.total ?? 0)}</Text>
                                            <View style={{ flex: 1, alignItems: 'flex-start' }}>
                                                <View style={{ backgroundColor: (row.momChange >= 0 ? '#10B981' : colors.error) + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                    <Text style={{ color: row.momChange >= 0 ? '#10B981' : colors.error, fontSize: 12, fontWeight: '700' }}>
                                                        {row.momChange >= 0 ? '▲' : '▼'} {Math.abs(row.momChange)}%
                                                    </Text>
                                                </View>
                                            </View>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={[styles.incomeExpandedPanel, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                                        <Text style={styles.incomeExpandedTitle}>6-Month Trend</Text>
                                        <View style={styles.incomeSparkline}>
                                            {[40, 55, 48, 62, 70, Math.min(row.total / 40, 80)].map((v, i) => (
                                                <View
                                                    key={i}
                                                    style={[styles.incomeSparkBar, {
                                                        height: v,
                                                        backgroundColor: i === 5 ? colors.primary : colors.glassBorder,
                                                    }]}
                                                />
                                            ))}
                                        </View>
                                        {/* Agent Assignment — local only */}
                                        <View style={{ marginBottom: 10 }}>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Assigned Agent</Text>
                                            <TextInput
                                                style={{
                                                    backgroundColor: colors.glassBg,
                                                    borderWidth: 1,
                                                    borderColor: colors.glassBorder,
                                                    borderRadius: 8,
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 8,
                                                    fontSize: 13,
                                                    color: colors.text,
                                                }}
                                                placeholder="e.g. Jane Smith"
                                                placeholderTextColor={colors.textMuted}
                                                value={agentAssignments[row.clientId] ?? ''}
                                                onChangeText={(text) =>
                                                    setAgentAssignments((prev: Record<string, string>) => ({ ...prev, [row.clientId]: text }))
                                                }
                                            />
                                        </View>
                                        <View style={styles.incomeExpandedActions}>
                                            <GlassButton
                                                label="Revenue Details"
                                                onPress={() => {
                                                    // Find matching incomeData client for the modal
                                                    const match = incomeData?.clients?.find((c: any) => c.cuId === row.clientId || c.cuName === row.name);
                                                    setSelectedClient(match ?? { cuId: row.clientId, cuName: row.name, platformAmount: row.marketplaceRev, cuAmount: 0, partnerAmount: row.partnerRev, transactionCount: 0, memberCount: row.members });
                                                }}
                                                variant="primary"
                                                size="sm"
                                                icon={<DollarSign size={14} color={colors.primaryText} />}
                                            />
                                            <GlassButton
                                                label="View Full Profile"
                                                onPress={() => setActiveNav('customers')}
                                                variant="secondary"
                                                size="sm"
                                            />
                                            <GlassButton
                                                label="Export Data"
                                                onPress={() => {}}
                                                variant="ghost"
                                                size="sm"
                                                icon={<Download size={14} color={colors.textMuted} />}
                                            />
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Section 4: RevShare Payouts Queue */}
                <View style={[styles.tableCard, { marginBottom: 32 }]}>
                    <Text style={styles.tableTitle}>RevShare Payouts Queue</Text>

                    <View style={[styles.settingsTabs, { marginTop: 12, marginBottom: 0 }]}>
                        {(['All', 'Pending', 'Processing', 'Paid'] as const).map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.settingsTab, revShareFilter === f && styles.settingsTabActive]}
                                onPress={() => setRevShareFilter(f)}
                            >
                                <Text style={[styles.settingsTabText, revShareFilter === f && styles.settingsTabTextActive]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {queueItems.length === 0 ? (
                        <Text style={[styles.emptyText, { marginVertical: 24 }]}>No payouts match this filter.</Text>
                    ) : (
                        queueItems.map((item) => {
                            const sc = queueStatusColor(item.status);
                            return (
                                <View
                                    key={item._id}
                                    style={[styles.tableRow, { borderBottomColor: colors.glassBorder, borderBottomWidth: 1, alignItems: 'center', gap: 8 }]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.customerName, { fontSize: 14 }]} numberOfLines={1}>{item.partnerName}</Text>
                                        <Text style={[styles.customerEmail, { fontSize: 12 }]} numberOfLines={1}>{item.clientName}</Text>
                                    </View>
                                    <Text style={[styles.tableCell, { fontWeight: '700', minWidth: 80, color: colors.text }]}>{fmt(item.amount)}</Text>
                                    <View style={{ backgroundColor: sc + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: sc + '44', minWidth: 90, alignItems: 'center' }}>
                                        <Text style={{ color: sc, fontSize: 12, fontWeight: '700' }}>{item.status}</Text>
                                    </View>
                                    {item.status === 'Pending' && (
                                        <GlassButton
                                            label="Mark Paid"
                                            onPress={() => handleMarkRevSharePaid(item._id)}
                                            variant="primary"
                                            size="sm"
                                        />
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
                {/* Client Detail Modal */}
                <GlassModal
                    visible={!!selectedClient}
                    onClose={() => setSelectedClient(null)}
                    title={selectedClient?.cuName ?? ''}
                    scrollable
                    animationType="slide"
                >
                    {/* Revenue stat cards 2-up */}
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                        <GlassStatCard
                            label="Platform"
                            value={`${(selectedClient?.platformAmount ?? 0).toLocaleString()}`}
                            icon={<DollarSign size={18} color={colors.primary} />}
                            accent={colors.primary}
                            style={{ flex: 1 }}
                        />
                        <GlassStatCard
                            label="CU Revenue"
                            value={`${(selectedClient?.cuAmount ?? 0).toLocaleString()}`}
                            icon={<DollarSign size={18} color="#22C55E" />}
                            accent="#22C55E"
                            style={{ flex: 1 }}
                        />
                    </View>
                    <GlassStatCard
                        label="Partner Revenue"
                        value={`${(selectedClient?.partnerAmount ?? 0).toLocaleString()}`}
                        icon={<DollarSign size={18} color="#F59E0B" />}
                        accent="#F59E0B"
                        style={{ marginBottom: 12 }}
                    />
                    {/* Detail rows */}
                    <View style={{ backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                        {([
                            { label: 'Transactions', value: String(selectedClient?.transactionCount ?? 0) },
                            { label: 'Members', value: String(selectedClient?.memberCount ?? 0) },
                        ] as { label: string; value: string }[]).map(({ label, value }, idx, arr) => (
                            <View
                                key={label}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                                    borderBottomColor: colors.glassBorder,
                                }}
                            >
                                <Text style={{ fontSize: 14, color: colors.textMuted }}>{label}</Text>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{value}</Text>
                            </View>
                        ))}
                    </View>
                    {/* Agent assignment in modal */}
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Assigned Agent</Text>
                    <TextInput
                        style={{
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 14,
                            color: colors.text,
                            marginBottom: 6,
                        }}
                        placeholder="e.g. Jane Smith"
                        placeholderTextColor={colors.textMuted}
                        value={selectedClient ? (agentAssignments[selectedClient.cuId ?? selectedClient.clientId ?? ''] ?? '') : ''}
                        onChangeText={(text) => {
                            if (selectedClient) {
                                const key = selectedClient.cuId ?? selectedClient.clientId ?? '';
                                setAgentAssignments((prev: Record<string, string>) => ({ ...prev, [key]: text }));
                            }
                        }}
                    />
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        Assignment stored locally — not yet synced to the server.
                    </Text>
                </GlassModal>
            </ScrollView>
        );
    };

    // Partnership Applications view
    const renderPartnershipAppsView = () => {
        const statusColor = (status: string) => {
            if (status === 'pending') return '#F59E0B';
            if (status === 'under_review') return '#3B82F6';
            if (status === 'approved') return '#10B981';
            if (status === 'rejected') return colors.error;
            return colors.textMuted;
        };

        const filtered = partnershipAppsFilter === 'all'
            ? partnershipApps
            : partnershipApps.filter((a) => a.status === partnershipAppsFilter);

        const countBy = (status: string) => partnershipApps.filter((a) => a.status === status).length;

        // Group by community
        const grouped: Record<string, any[]> = {};
        for (const app of filtered) {
            const key = app.communityName ?? app.community?.name ?? 'Unknown Community';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(app);
        }

        const handleAction = async (appId: string, status: string) => {
            try {
                await communityPatch('/partnership-forum/applications/' + appId, { status });
                setPartnershipApps((prev) =>
                    prev.map((a) => (a._id === appId ? { ...a, status } : a))
                );
            } catch (err) {
                console.error('[SuperAdmin] partnership app action error:', err);
            }
        };

        return (
            <ScrollView
                style={styles.pageContent}
                contentContainerStyle={[isMobile && styles.pageContentMobile, { paddingBottom: 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                    <Handshake size={24} color={colors.primary} />
                    <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginLeft: 8 }}>
                        Partnership Applications
                    </Text>
                    <View style={{
                        backgroundColor: colors.glassBg,
                        borderWidth: 1,
                        borderColor: colors.glassBorder,
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        marginLeft: 8,
                    }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>
                            {partnershipApps.length} total
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={fetchPartnershipApps}
                        style={{
                            marginLeft: 'auto' as any,
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                        }}
                    >
                        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Refresh</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary stat row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Pending', status: 'pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
                        { label: 'Under Review', status: 'under_review', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                        { label: 'Approved', status: 'approved', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
                        { label: 'Rejected', status: 'rejected', color: colors.error, bg: 'rgba(239,68,68,0.12)' },
                    ].map((s) => (
                        <View key={s.status} style={{
                            flex: 1,
                            minWidth: 100,
                            backgroundColor: s.bg,
                            borderWidth: 1,
                            borderColor: s.color + '44',
                            borderRadius: 12,
                            padding: 14,
                            alignItems: 'center',
                        }}>
                            <Text style={{ fontSize: 22, fontWeight: '700', color: s.color }}>{countBy(s.status)}</Text>
                            <Text style={{ fontSize: 12, color: s.color, marginTop: 2, fontWeight: '600' }}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Filter pills */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map((f) => {
                        const label = f === 'all' ? 'All' : f === 'under_review' ? 'Under Review' : f.charAt(0).toUpperCase() + f.slice(1);
                        const isActive = partnershipAppsFilter === f;
                        return (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setPartnershipAppsFilter(f)}
                                style={{
                                    backgroundColor: isActive ? colors.primary : colors.glassBg,
                                    borderWidth: 1,
                                    borderColor: isActive ? colors.primary : colors.glassBorder,
                                    borderRadius: 20,
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#fff' : colors.textMuted }}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Loading */}
                {partnershipAppsLoading && (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12 }}>Loading applications…</Text>
                    </View>
                )}

                {/* Empty state */}
                {!partnershipAppsLoading && filtered.length === 0 && (
                    <View style={{
                        alignItems: 'center',
                        paddingVertical: 48,
                        backgroundColor: colors.modalBg,
                        borderWidth: 1,
                        borderColor: colors.glassBorder,
                        borderRadius: 16,
                    }}>
                        <Handshake size={40} color={colors.textMuted} />
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textMuted, marginTop: 12 }}>
                            No applications found
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                            {partnershipAppsFilter === 'all' ? 'No partnership applications yet.' : `No ${partnershipAppsFilter.replace('_', ' ')} applications.`}
                        </Text>
                    </View>
                )}

                {/* Grouped applications */}
                {!partnershipAppsLoading && Object.entries(grouped).map(([communityName, apps]) => (
                    <View key={communityName} style={{ marginBottom: 24 }}>
                        {/* Community header row */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 10,
                            marginBottom: 8,
                        }}>
                            <Users size={15} color={colors.primary} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginLeft: 8 }}>
                                {communityName}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>
                                ({apps.length} {apps.length === 1 ? 'application' : 'applications'})
                            </Text>
                        </View>

                        {/* Application rows */}
                        {apps.map((app) => (
                            <View key={app._id} style={{
                                backgroundColor: colors.modalBg,
                                borderWidth: 1,
                                borderColor: colors.glassBorder,
                                borderRadius: 12,
                                padding: 14,
                                marginBottom: 8,
                            }}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                                    {/* Business Name */}
                                    <View style={{ flex: 1, minWidth: 120 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Business</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                                            {app.businessName ?? app.business?.name ?? '—'}
                                        </Text>
                                    </View>
                                    {/* Partner Name */}
                                    <View style={{ flex: 1, minWidth: 120 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Partner</Text>
                                        <Text style={{ fontSize: 14, color: colors.text, marginTop: 2 }}>
                                            {app.partnerName ?? app.applicant?.name ?? '—'}
                                        </Text>
                                    </View>
                                    {/* Category */}
                                    <View style={{ flex: 1, minWidth: 100 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Category</Text>
                                        <Text style={{ fontSize: 14, color: colors.text, marginTop: 2 }}>
                                            {app.category ?? '—'}
                                        </Text>
                                    </View>
                                    {/* Status */}
                                    <View style={{ flex: 1, minWidth: 100 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Status</Text>
                                        <View style={{
                                            marginTop: 4,
                                            alignSelf: 'flex-start',
                                            backgroundColor: statusColor(app.status) + '22',
                                            borderWidth: 1,
                                            borderColor: statusColor(app.status) + '55',
                                            borderRadius: 8,
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                        }}>
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor(app.status) }}>
                                                {app.status === 'under_review' ? 'Under Review' : app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : '—'}
                                            </Text>
                                        </View>
                                    </View>
                                    {/* Date */}
                                    <View style={{ flex: 1, minWidth: 100 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Date</Text>
                                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                                            {formatDate(app.createdAt)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Action buttons */}
                                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                    {app.status !== 'approved' && (
                                        <TouchableOpacity
                                            onPress={() => handleAction(app._id, 'approved')}
                                            style={{
                                                backgroundColor: 'rgba(16,185,129,0.15)',
                                                borderWidth: 1,
                                                borderColor: '#10B98155',
                                                borderRadius: 8,
                                                paddingHorizontal: 14,
                                                paddingVertical: 7,
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#10B981' }}>Approve</Text>
                                        </TouchableOpacity>
                                    )}
                                    {app.status !== 'under_review' && (
                                        <TouchableOpacity
                                            onPress={() => handleAction(app._id, 'under_review')}
                                            style={{
                                                backgroundColor: 'rgba(59,130,246,0.15)',
                                                borderWidth: 1,
                                                borderColor: '#3B82F655',
                                                borderRadius: 8,
                                                paddingHorizontal: 14,
                                                paddingVertical: 7,
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#3B82F6' }}>Under Review</Text>
                                        </TouchableOpacity>
                                    )}
                                    {app.status !== 'rejected' && (
                                        <TouchableOpacity
                                            onPress={() => handleAction(app._id, 'rejected')}
                                            style={{
                                                backgroundColor: 'rgba(239,68,68,0.15)',
                                                borderWidth: 1,
                                                borderColor: colors.error + '55',
                                                borderRadius: 8,
                                                paddingHorizontal: 14,
                                                paddingVertical: 7,
                                            }}
                                        >
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.error }}>Reject</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                ))}
            </ScrollView>
        );
    };

    // Render mobile bottom navigation
    const renderMobileBottomNav = () => (
        <View style={[styles.mobileBottomNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 4 }}>
            {([
                { key: 'overview', Icon: LayoutDashboard, label: 'Overview' },
                { key: 'customers', Icon: Users, label: 'Customers' },
                { key: 'moderation', Icon: Shield, label: 'Moderation' },
                { key: 'income', Icon: TrendingUp, label: 'Income' },
                { key: 'configuration', Icon: Settings, label: 'Settings' },
                { key: 'partnerships', Icon: Handshake, label: 'Partners' },
            ] as { key: NavItem; Icon: any; label: string }[]).map((item) => (
                <TouchableOpacity
                    key={item.key}
                    style={[styles.mobileNavItem, activeNav === item.key && styles.mobileNavItemActive]}
                    onPress={() => { setActiveNav(item.key); setViewingCustomer(null); if (item.key === 'partnerships') fetchPartnershipApps(); }}
                >
                    <item.Icon
                        size={22}
                        color={activeNav === item.key ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.mobileNavLabel, activeNav === item.key && styles.mobileNavLabelActive]}>
                        {item.label}
                    </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        </View>
    );

    // Main render - no loading states, data loads seamlessly in background
    return (
        <View style={[styles.container, isMobile && styles.containerMobile, isMobile && styles.containerMobileSafe]}>
            {/* Sidebar */}
            {!isMobile && renderSidebar()}

            {/* Main Content */}
            <View style={styles.mainContent}>
                {/* Top Bar */}
                {renderTopBar()}

                {/* Page Content */}
                {viewingCustomer ? (
                    renderCustomerDetailsView()
                ) : (
                    <>
                        {activeNav === 'overview' && renderOverviewPage()}
                        {activeNav === 'customers' && renderCustomersPage()}
                        {activeNav === 'moderation' && renderModerationPage()}
                        {activeNav === 'configuration' && renderConfigurationPage()}
                        {activeNav === 'income' && renderIncomeSection()}
                        {activeNav === 'partnerships' && renderPartnershipAppsView()}
                    </>
                )}

                {/* Error Message */}
                {error ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={() => setError('')}>
                            <X size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {/* Mobile Bottom Navigation */}
            {isMobile && renderMobileBottomNav()}

            {/* Add Customer Modal */}
            {renderAddCustomerModal()}

            {/* Suspend Account Modal */}
            {renderSuspendModal()}

            {/* Delete Account Modal */}
            {renderDeleteModal()}

            {/* Invite Team Member Modal */}
            {renderInviteModal()}

            {/* Team Member Suspend Modal */}
            {renderTeamSuspendModal()}

            {/* Team Member Delete Modal */}
            {renderTeamDeleteModal()}

            {/* Action Menu — centered modal for both web and native */}
            {actionMenuOpen && actionMenuCustomer && (
                <Modal visible transparent animationType="fade" onRequestClose={closeActionMenu}>
                    <Pressable style={styles.actionMenuOverlay} onPress={closeActionMenu}>
                        <Pressable style={styles.actionMenuCentered} onPress={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                                    {actionMenuCustomer.name || actionMenuCustomer.email}
                                </Text>
                                <TouchableOpacity onPress={closeActionMenu}>
                                    <X size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.actionMenuItem}
                                onPress={() => { handleViewCustomer(actionMenuCustomer); closeActionMenu(); }}
                            >
                                <Eye size={18} color={colors.text} style={{ marginRight: 10 }} />
                                <Text style={styles.actionMenuText}>View Customer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionMenuItem}
                                onPress={() => {
                                    if (actionMenuCustomer.status === 'active') {
                                        openSuspendModal(actionMenuCustomer._id);
                                    } else {
                                        handleRevokeSuspension(actionMenuCustomer._id);
                                    }
                                    closeActionMenu();
                                }}
                            >
                                {actionMenuCustomer.status === 'active' ? (
                                    <PauseCircle size={18} color={colors.text} style={{ marginRight: 10 }} />
                                ) : (
                                    <PlayCircle size={18} color={colors.text} style={{ marginRight: 10 }} />
                                )}
                                <Text style={styles.actionMenuText}>
                                    {actionMenuCustomer.status === 'active' ? 'Suspend Customer' : 'Activate Customer'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionMenuItem, { borderTopWidth: 1, borderTopColor: colors.glassBorder }]}
                                onPress={() => { openDeleteModal(actionMenuCustomer._id); closeActionMenu(); }}
                            >
                                <Trash2 size={18} color={colors.error} style={{ marginRight: 10 }} />
                                <Text style={[styles.actionMenuText, { color: colors.error }]}>Delete Account</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                    </Modal>
            )}

            {/* Team Action Menu Overlay */}
            {teamActionMenuOpen && (
                <Pressable
                    style={styles.actionMenuOverlay}
                    onPress={closeTeamMemberActionMenu}
                />
            )}
        </View>
    );
};

const createStyles = (colors: any, bottomInset: number = 0, topInset: number = 0) =>
    StyleSheet.create({
        container: {
            flex: 1,
            flexDirection: 'row',
            backgroundColor: 'transparent',
            padding: 16,
            gap: 16,
        },
        containerMobile: {
            flexDirection: 'column',
            padding: 0,
            paddingBottom: 0,
            gap: 0,
        },

        // Mobile Bottom Navigation
        mobileBottomNav: {
            flexDirection: 'row',
            backgroundColor: colors.glassNavBg,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
            paddingTop: 8,
            paddingHorizontal: 4,
        },
        mobileNavItem: {
            minWidth: 68,
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 8,
        },
        mobileNavItemActive: {},
        mobileNavLabel: {
            fontSize: 10,
            color: colors.textMuted,
            marginTop: 3,
            textAlign: 'center',
        },
        mobileNavLabelActive: {
            color: colors.primary,
            fontWeight: '600',
        },

        // Mobile Card Layout (replaces tables)
        mobileCardList: {
            padding: 12,
            gap: 12,
        },
        mobileCustomerCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            gap: 12,
        },
        mobileCardRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        mobileCardField: {
            flex: 1,
        },
        mobileCardLabel: {
            fontSize: 11,
            color: colors.textMuted,
            marginBottom: 2,
        },
        mobileCardValue: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },

        // Charts row mobile
        chartsRowMobile: {
            flexDirection: 'column',
        },

        // Customers header mobile
        customersHeaderMobile: {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 12,
        },

        // Customers table header mobile
        customersTableHeaderMobile: {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 12,
        },

        // Table controls mobile
        tableControlsMobile: {
            flexDirection: 'column',
            gap: 8,
            width: '100%',
        },

        // Pagination mobile
        paginationMobile: {
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
        },

        // Customer detail header mobile
        customerDetailHeaderMobile: {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 12,
        },
        customerDetailTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        customerDetailActionsMobile: {
            flexWrap: 'wrap',
        },

        // Settings form row mobile
        settingsFormRowMobile: {
            flexDirection: 'column',
            gap: 16,
        },

        // Team header mobile
        teamHeaderMobile: {
            flexDirection: 'column',
            gap: 12,
        },

        // Invite form row mobile
        inviteFormRowMobile: {
            flexDirection: 'column',
            gap: 12,
        },
        // Sidebar
        sidebar: {
            width: 240,
            backgroundColor: colors.sidebarBg,
            paddingVertical: 24,
            paddingHorizontal: 18,
            borderRadius: 24,
            overflow: 'hidden',
        },
        logoContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            marginBottom: 40,
            gap: 10,
        },
        logoIcon: {
            width: 34,
            height: 34,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        logoText: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.sidebarText,
            letterSpacing: 1,
        },
        navItems: {
            flex: 1,
        },
        navItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            marginBottom: 8,
        },
        navItemActive: {
            backgroundColor: colors.sidebarActiveBg,
        },
        navItemText: {
            fontSize: 14,
            color: colors.sidebarTextMuted,
            marginLeft: 12,
        },
        navItemTextActive: {
            color: colors.sidebarActiveText,
            fontWeight: '600',
        },
        sidebarFooter: {
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.1)',
        },
        logoutButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        logoutText: {
            fontSize: 14,
            color: colors.sidebarTextMuted,
            marginLeft: 12,
        },

        // Top Bar
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: colors.glassNavBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 24,
            marginHorizontal: 24,
            marginTop: 12,
            marginBottom: 18,
        },
        topBarMobile: {
            marginHorizontal: 0,
            marginTop: 0,
            marginBottom: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 0,
            borderLeftWidth: 0,
            borderRightWidth: 0,
            flexDirection: 'column',
            gap: 12,
        },
        // Mobile header branding row
        mobileHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
        },
        mobileLogoContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        mobileLogoIcon: {
            width: 32,
            height: 32,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        mobileLogoText: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
            letterSpacing: 1,
        },
        mobileHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flex: 1,
            maxWidth: 520,
        },
        searchContainerMobile: {
            maxWidth: '100%',
            width: '100%',
            flex: 1,
            paddingVertical: Platform.OS === 'web' ? 6 : 8,
            paddingHorizontal: Platform.OS === 'web' ? 12 : 14,
            height: Platform.OS === 'web' ? undefined : 42,
        },
        searchInput: {
            flex: 1,
            marginLeft: 8,
            fontSize: Platform.OS === 'web' ? 14 : 16,
            color: colors.text,
            backgroundColor: 'transparent',
            paddingVertical: 0,
            minHeight: Platform.OS === 'web' ? 20 : 26,
            // @ts-ignore
            outlineStyle: 'none',
        },
        topBarRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        topBarIconGroup: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        topBarIconButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        topBarDivider: {
            width: 1,
            height: 32,
            backgroundColor: colors.glassBorder,
            marginHorizontal: 12,
        },
        profileSection: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        profileAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.glassActiveBg,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        profileAvatarText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primaryText,
        },
        profileInfo: {
            alignItems: 'flex-start',
        },
        profileName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        profileRole: {
            fontSize: 12,
            color: colors.textMuted,
        },

        // Main Content
        mainContent: {
            flex: 1,
            position: 'relative',
            backgroundColor: 'transparent',
        },
        pageContent: {
            flex: 1,
            paddingHorizontal: 24,
            paddingBottom: 24,
        },
        pageContentMobile: {
            paddingHorizontal: 16,
            paddingBottom: 16,
        },
        pageHeader: {
            marginBottom: 24,
        },
        pageHeaderMobile: {
            marginBottom: 16,
        },
        pageTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        pageTitleMobile: {
            fontSize: 20,
        },
        pageSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
        },

        // Stats Cards (Overview)
        statsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24,
        },
        statCard: {
            flex: 1,
            minWidth: 150,
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        statIcon: {
            width: 44,
            height: 44,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statInfo: {
            flex: 1,
        },
        statLabel: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 4,
        },
        statValue: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },

        // Customer Stats Cards
        customerStatsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24,
        },
        customerStatCard: {
            flex: 1,
            minWidth: 140,
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        customerStatIcon: {
            width: 44,
            height: 44,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        customerStatInfo: {
            flex: 1,
        },
        customerStatLabel: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 2,
        },
        customerStatValue: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
        },

        // Customers Header
        customersHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
        },
        addCustomerButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 8,
        },
        addCustomerButtonMobile: {
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        addCustomerButtonText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '500',
        },

        // Table
        tableCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        tableHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 0,
        },
        tableTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        viewAllLink: {
            fontSize: 14,
            color: colors.primary,
            fontWeight: '500',
        },

        // Customers Table
        customersTableCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            overflow: 'visible',
        },
        customersTableHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            zIndex: 50,
        },
        customerTableTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        tableControls: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            zIndex: 50,
        },
        tableSearchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flex: 1,
            minWidth: 0,
        },
        tableSearchInput: {
            flex: 1,
            marginLeft: 8,
            fontSize: 14,
            color: colors.text,
        },
        filterDropdownWrapper: {
            position: 'relative',
            zIndex: 100,
        },
        filterDropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
        },
        filterDropdownText: {
            fontSize: 14,
            color: colors.text,
        },
        filterDropdownMenu: {
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 1000,
            minWidth: 140,
        },
        filterDropdownItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        filterDropdownItemActive: {
            backgroundColor: colors.glassActiveBg,
        },
        filterDropdownItemText: {
            fontSize: 14,
            color: colors.text,
        },
        filterDropdownItemTextActive: {
            fontWeight: '600',
            color: colors.primary,
        },
        exportButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
        },
        exportButtonText: {
            fontSize: 14,
            color: colors.text,
        },

        table: {
            padding: 0,
            overflow: 'visible',
        },
        tableRowHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: colors.glassNavBg,
        },
        tableRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            overflow: 'visible',
            zIndex: 1,
        },
        tableHeaderCell: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
        },
        tableCell: {
            fontSize: 14,
            color: colors.text,
        },
        checkbox: {
            width: 16,
            height: 16,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            justifyContent: 'center',
            alignItems: 'center',
        },
        checkboxChecked: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        customerName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        customerEmail: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
            flexShrink: 1,
        },
        planBadge: {
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
            alignSelf: 'flex-start',
        },
        planTrial: {
            borderColor: colors.glassBorder,
        },
        planActive: {
            borderColor: colors.glassBorder,
        },
        planBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            alignSelf: 'flex-start',
            gap: 6,
        },
        statusActive: {
            backgroundColor: colors.successBg,
        },
        statusPending: {
            backgroundColor: colors.warningBg,
        },
        statusSuspended: {
            backgroundColor: colors.dangerBg,
        },
        statusDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        statusDotActive: {
            backgroundColor: colors.successText,
        },
        statusDotPending: {
            backgroundColor: colors.warningText,
        },
        statusDotSuspended: {
            backgroundColor: colors.dangerText,
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '600',
        },
        statusTextActive: {
            color: colors.successText,
        },
        statusTextPending: {
            color: colors.warningText,
        },
        statusTextSuspended: {
            color: colors.dangerText,
        },

        // Action Menu
        actionMenuButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actionMenu: {
            position: 'absolute',
            top: '100%',
            right: 0,
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 20,
            minWidth: 180,
            zIndex: 9999,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            overflow: 'visible',
        },
        actionMenuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        actionMenuItemDanger: {
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        actionMenuItemText: {
            fontSize: 14,
            color: colors.text,
            marginLeft: 8,
        },
        actionMenuText: {
            fontSize: 14,
            color: colors.text,
        },
        actionMenuDropdown: {
            position: 'absolute',
            top: '100%',
            right: 0,
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
            minWidth: 150,
            zIndex: 9999,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            paddingVertical: 4,
        },
        actionMenuOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        actionMenuCentered: {
            backgroundColor: colors.modalBg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            width: 300,
            paddingHorizontal: 20,
            paddingVertical: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 24,
            elevation: 25,
        },
        floatingActionMenu: {
            backgroundColor: colors.modalBg,
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 25,
            minWidth: 200,
            zIndex: 9999,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            paddingVertical: 8,
        },

        // Pagination
        pagination: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        paginationInfo: {
            fontSize: 14,
            color: colors.textMuted,
        },
        paginationControls: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        paginationLabel: {
            fontSize: 14,
            color: colors.textMuted,
        },
        rowsDropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.successBg,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 4,
            gap: 4,
        },
        rowsDropdownText: {
            fontSize: 14,
            color: colors.text,
        },
        rowsPerPageSelector: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginRight: 12,
        },
        rowsPerPageOption: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 4,
            backgroundColor: colors.glassBg,
        },
        rowsPerPageOptionActive: {
            backgroundColor: colors.primary,
        },
        rowsPerPageText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        rowsPerPageTextActive: {
            color: colors.primaryText,
            fontWeight: '600',
        },
        paginationButton: {
            width: 32,
            height: 32,
            borderRadius: 4,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
        },
        paginationButtonActive: {
            backgroundColor: colors.primary,
        },
        paginationButtonDisabled: {
            opacity: 0.5,
        },

        emptyState: {
            alignItems: 'center',
            paddingVertical: 48,
        },
        emptyStateText: {
            marginTop: 12,
            fontSize: 14,
            color: colors.textMuted,
        },

        // Customer Details
        customerDetailHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
        },
        backButton: {
            marginRight: 16,
        },
        customerDetailTitle: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
            flex: 1,
        },
        customerDetailActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        statusLabel: {
            fontSize: 14,
            color: colors.textMuted,
        },
        suspendButton: {
            backgroundColor: 'rgba(239,68,68,0.85)',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.5)',
        },
        suspendButtonText: {
            color: colors.glassActiveText,
            fontSize: 14,
            fontWeight: '500',
        },
        detailCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        detailCardTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 20,
        },
        detailGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: 16,
        },
        detailGridItem: {
            flex: 1,
            minWidth: 140,
            marginBottom: 16,
        },
        detailLabel: {
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: 4,
        },
        detailValue: {
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
        },

        // Activity Items
        activityItem: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        activityDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
            marginTop: 6,
            marginRight: 12,
        },
        activityContent: {
            flex: 1,
        },
        activityTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 2,
        },
        activityDescription: {
            fontSize: 13,
            color: colors.textMuted,
        },
        activityTime: {
            fontSize: 12,
            color: colors.textMuted,
        },
        noActivityText: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            paddingVertical: 24,
        },

        // Charts
        chartsRow: {
            flexDirection: 'row',
            gap: 16,
        },
        chartCard: {
            flex: 1,
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        chartTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 12,
        },
        chartContainer: {
            minHeight: 180,
            gap: 10,
        },
        chartGraphic: {
            height: 130,
            position: 'relative',
        },
        chartBars: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 4,
        },
        chartBarWrapper: {
            flex: 1,
            height: '100%',
            justifyContent: 'flex-end',
        },
        chartBar: {
            borderRadius: 4,
            minHeight: 4,
        },
        chartLabels: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 10,
        },
        chartLabel: {
            fontSize: 11,
            color: colors.textMuted,
            flex: 1,
            textAlign: 'center',
        },
        uptimeChart: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 2,
        },
        uptimeBar: {
            flex: 1,
            height: 120,
            backgroundColor: colors.glassBorder,
            borderRadius: 2,
            overflow: 'hidden',
            justifyContent: 'flex-end',
        },
        uptimeBarFill: {
            backgroundColor: colors.successText,
            borderRadius: 2,
        },
        noDataText: {
            textAlign: 'center',
            color: colors.textMuted,
            paddingVertical: 40,
        },

        // Filters
        filtersRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
        },
        filterButtons: {
            flexDirection: 'row',
            gap: 8,
        },
        filterButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        filterButtonActive: {
            backgroundColor: colors.glassActiveBg,
        },
        filterButtonText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        filterButtonTextActive: {
            color: colors.primaryText,
            fontWeight: '500',
        },

        // Moderation
        contentTypeBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        contentTypeText: {
            fontSize: 12,
            color: colors.text,
            textTransform: 'capitalize',
        },
        actionButton: {
            padding: 6,
            borderRadius: 6,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        actionButtonDanger: {
            backgroundColor: colors.dangerBg,
        },
        actionButtonSuccess: {
            backgroundColor: colors.successBg,
        },

        // Configuration
        configSections: {
            gap: 24,
        },
        configSection: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        configSectionHeader: {
            marginBottom: 16,
        },
        configSectionTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        configSectionSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 4,
        },
        configGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
        },
        configItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 0,
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
        },
        configItemLabel: {
            fontSize: 14,
            color: colors.text,
        },
        toggle: {
            width: 44,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.glassBorder,
            padding: 2,
        },
        toggleActive: {
            backgroundColor: colors.primary,
        },
        toggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.glassActiveText,
        },
        toggleKnobActive: {
            marginLeft: 'auto',
        },
        configInput: {
            fontSize: 14,
            color: colors.text,
            textAlign: 'right',
            minWidth: 80,
        },
        configActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 8,
        },
        configButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 8,
        },
        configButtonPrimary: {
            backgroundColor: colors.primary,
        },
        configButtonSecondary: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        configButtonPrimaryText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.primaryText,
        },
        configButtonSecondaryText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },

        // Modal
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
        },
        addCustomerModal: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            width: '90%',
            maxWidth: 480,
            padding: 24,
        },
        addCustomerHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        addCustomerTitle: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
        },
        addCustomerSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
        },
        addCustomerForm: {},
        formGroup: {
            marginBottom: 20,
        },
        formLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        formInput: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.text,
        },
        addCustomerSubmitButton: {
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 8,
        },
        addCustomerSubmitText: {
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: '500',
        },

        // Error & Loading
        errorBanner: {
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            backgroundColor: 'rgba(239,68,68,0.85)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.5)',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
        },
        errorText: {
            color: colors.glassActiveText,
            fontSize: 14,
        },

        // Confirm Modal (Suspend/Delete)
        confirmModal: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            width: '90%',
            maxWidth: 400,
            padding: 24,
        },
        confirmModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        confirmModalTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
        },
        confirmModalSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
            lineHeight: 20,
        },
        confirmCheckboxRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.successBg,
            borderRadius: 8,
            marginBottom: 24,
        },
        confirmCheckbox: {
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.glassBorder,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
            backgroundColor: colors.glassBg,
        },
        confirmCheckboxChecked: {
            borderColor: colors.successText,
            backgroundColor: colors.glassBg,
        },
        confirmCheckboxText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '500',
        },
        confirmModalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
        },
        confirmCancelButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        confirmCancelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        confirmProceedButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.primary,
            minWidth: 100,
            alignItems: 'center',
        },
        confirmProceedButtonDisabled: {
            backgroundColor: colors.textSubtle,
        },
        confirmProceedText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.primaryText,
        },

        // Upgrade Modal
        upgradeModal: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            width: '90%',
            maxWidth: 400,
            padding: 24,
        },
        planOptions: {
            marginBottom: 24,
        },
        planOptionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            marginBottom: 8,
        },
        planCheckbox: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: colors.glassBorder,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
            backgroundColor: colors.glassBg,
        },
        planCheckboxChecked: {
            borderColor: colors.primary,
            backgroundColor: colors.primary,
        },
        planOptionText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '500',
        },
        upgradeCancelButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        upgradeCancelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        upgradeSubmitButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.primary,
            minWidth: 120,
            alignItems: 'center',
        },
        upgradeSubmitButtonDisabled: {
            backgroundColor: colors.textSubtle,
        },
        upgradeSubmitText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.primaryText,
        },

        // Revoke Suspension Button
        revokeButton: {
            backgroundColor: colors.successText,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
        },
        revokeButtonText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '500',
        },

        // Moderation & Safety Page
        moderationCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        moderationCardContent: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
        },
        moderationCardContentVertical: {
            padding: 20,
        },
        moderationCardInfo: {
            flex: 1,
        },
        moderationCardTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        moderationCardDescription: {
            fontSize: 14,
            color: colors.textMuted,
        },
        prohibitedList: {
            marginTop: 12,
        },
        prohibitedItem: {
            fontSize: 14,
            color: colors.textMuted,
            paddingVertical: 6,
        },

        // Settings Page
        settingsTabs: {
            flexDirection: 'row',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 10,
            padding: 4,
            marginBottom: 24,
            alignSelf: 'flex-start',
        },
        settingsTab: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 6,
        },
        settingsTabActive: {
            backgroundColor: colors.glassActiveBg,
        },
        settingsTabText: {
            fontSize: 14,
            color: colors.textMuted,
            fontWeight: '500',
        },
        settingsTabTextActive: {
            color: colors.text,
        },
        settingsContent: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        settingsSectionTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        settingsSectionSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
        },
        settingsFormRow: {
            flexDirection: 'row',
            gap: 24,
            marginBottom: 20,
        },
        settingsFormGroup: {
            flex: 1,
        },
        settingsLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        settingsInput: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.text,
        },
        settingsInputDisabled: {
            backgroundColor: colors.glassBg,
            color: colors.textMuted,
        },
        settingsSaveSection: {
            marginTop: 24,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        saveAdminInfoButton: {
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            alignSelf: 'flex-start',
            minWidth: 140,
            alignItems: 'center',
        },
        saveAdminInfoButtonDisabled: {
            opacity: 0.7,
        },
        saveAdminInfoButtonText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '500',
        },

        // Team Tab
        teamHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
        },
        teamHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        teamSettingsButton: {
            width: 40,
            height: 40,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
            justifyContent: 'center',
            alignItems: 'center',
        },
        addTeamMemberButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            gap: 8,
        },
        addTeamMemberButtonText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '500',
        },
        teamTable: {
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 12,
            overflow: 'hidden',
        },
        teamTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassNavBg,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        teamTableHeaderCell: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.textMuted,
        },
        teamTableRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        teamTableCell: {
            fontSize: 14,
            color: colors.text,
        },
        teamCheckboxCell: {
            width: 40,
        },
        teamMemberAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.warningText,
            justifyContent: 'center',
            alignItems: 'center',
        },
        teamMemberAvatarText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primaryText,
        },
        teamMemberName: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        teamStatusBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            alignSelf: 'flex-start',
        },
        teamStatusText: {
            fontSize: 12,
            fontWeight: '500',
        },
        teamActionButton: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },

        // Notification Cards
        notificationCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        notificationCardContent: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
        },
        notificationCardInfo: {
            flex: 1,
        },
        notificationCardTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        notificationCardDescription: {
            fontSize: 14,
            color: colors.textMuted,
        },

        // Invite Modal
        inviteModal: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            width: '90%',
            maxWidth: 520,
            padding: 24,
            overflow: 'visible',
        },
        inviteModalMobile: {
            width: '95%',
            maxWidth: '100%',
            padding: 16,
            maxHeight: '90%',
        },
        inviteModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
        },
        inviteIconContainer: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.successBg,
            justifyContent: 'center',
            alignItems: 'center',
        },
        inviteCloseButton: {
            padding: 4,
        },
        inviteModalTitle: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        inviteModalSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
        },
        inviteForm: {
            zIndex: 100,
        },
        inviteFormRow: {
            flexDirection: 'row',
            gap: 16,
            marginBottom: 16,
            overflow: 'visible',
            zIndex: 100,
        },
        inviteEmailGroup: {
            flex: 2,
        },
        inviteRoleGroup: {
            flex: 1,
            position: 'relative',
            zIndex: 1000,
            overflow: 'visible',
        },
        inviteLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        inviteInput: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.text,
        },
        inviteRoleDropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        inviteRoleText: {
            fontSize: 14,
            color: colors.text,
        },
        inviteRoleDropdownMenu: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
            overflow: 'hidden',
            zIndex: 9999,
        },
        inviteRoleOption: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        inviteRoleOptionActive: {
            backgroundColor: colors.successBg,
        },
        inviteRoleOptionText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        inviteRoleOptionDesc: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        addAnotherButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
        },
        addAnotherText: {
            fontSize: 14,
            color: colors.textMuted,
        },
        inviteModalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 24,
            zIndex: 1,
            position: 'relative',
        },
        inviteModalActionsMobile: {
            flexDirection: 'column-reverse',
            gap: 10,
            marginTop: 20,
        },
        inviteCancelButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
        },
        inviteCancelButtonMobile: {
            alignItems: 'center',
        },
        inviteCancelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        inviteSubmitButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.primary,
            minWidth: 120,
            alignItems: 'center',
        },
        inviteSubmitButtonMobile: {
            minWidth: 'auto',
            width: '100%',
        },
        inviteSubmitButtonDisabled: {
            backgroundColor: colors.textSubtle,
        },
        inviteSubmitText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.primaryText,
        },

        // Invite Code Section (Customer Details)
        inviteCodeSection: {
            marginTop: 20,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: colors.glassBorder,
        },
        inviteCodeBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginTop: 8,
        },
        inviteCodeText: {
            flex: 1,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: 3,
            color: colors.text,
            fontFamily: 'monospace',
        },
        copyCodeButton: {
            padding: 8,
            borderRadius: 6,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        inviteCodeHint: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 8,
        },

        // See All Button
        seeAllButton: {
            backgroundColor: colors.glassBg,
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        seeAllButtonText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },

        // Chart Header & Dropdown
        chartHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
        },
        chartDropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.glassBg,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        chartDropdownWrapper: {
            position: 'relative',
        },
        chartDropdownMenu: {
            position: 'absolute',
            top: 40,
            right: 0,
            backgroundColor: colors.glassBg,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            minWidth: 120,
            zIndex: 5,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
        },
        chartDropdownItem: {
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        chartDropdownItemActive: {
            backgroundColor: colors.glassActiveBg,
        },
        chartDropdownItemText: {
            fontSize: 13,
            color: colors.text,
        },
        chartDropdownItemTextActive: {
            fontWeight: '600',
        },
        chartDropdownText: {
            fontSize: 13,
            color: colors.text,
        },

        // Chart Legend
        chartLegend: {
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 16,
            gap: 24,
        },
        chartLegendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        chartLegendDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        chartLegendText: {
            fontSize: 12,
            color: colors.successText,
        },

        // ── Additional Mobile Responsive Styles ──
        statsGridMobile: {
            gap: 12,
        },
        customerStatsGridMobile: {
            gap: 12,
        },
        detailGridMobile: {
            flexDirection: 'column',
        },
        settingsTabsMobile: {
            alignSelf: 'stretch',
        },
        settingsContentMobile: {
            padding: 16,
        },
        moderationCardMobile: {
            marginBottom: 12,
        },
        detailCardMobile: {
            padding: 16,
        },
        topBarMobileCompact: {
            borderRadius: 0,
            marginHorizontal: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'column',
            gap: 10,
        },
        mobileBottomNavSafe: {
            paddingBottom: bottomInset,
        },
        actionMenuMobile: {
            backgroundColor: colors.modalBg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.glassBorder,
            width: '100%',
            paddingVertical: 12,
            paddingHorizontal: 8,
            paddingBottom: bottomInset + 16,
        },
        containerMobileSafe: {
            paddingTop: topInset,
        },

        // Suspend / Delete Team Member Modal
        suspendModal: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 16,
            width: '90%',
            maxWidth: 400,
            padding: 24,
        },
        suspendModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
        },
        suspendIconContainer: {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.warningBg,
            justifyContent: 'center',
            alignItems: 'center',
        },
        suspendCloseButton: {
            padding: 4,
        },
        suspendModalTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        suspendModalSubtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
            lineHeight: 20,
        },
        suspendConfirmRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.warningBg,
            borderRadius: 8,
            marginBottom: 24,
        },
        suspendCheckbox: {
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.glassBorder,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
            backgroundColor: colors.glassBg,
        },
        suspendCheckboxChecked: {
            borderColor: colors.primary,
            backgroundColor: colors.primary,
        },
        suspendConfirmText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '500',
            flex: 1,
        },
        suspendModalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12,
        },
        suspendCancelButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        suspendCancelText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text,
        },
        suspendSubmitButton: {
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.dangerText,
            minWidth: 100,
            alignItems: 'center',
        },
        suspendSubmitButtonDisabled: {
            backgroundColor: colors.textSubtle,
        },
        suspendSubmitText: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.primaryText,
        },

        // ─── Income & RevShare styles ────────────────────────────────────────
        emptyText: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
        },
        incomeChartRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 16,
            gap: 24,
            flexWrap: 'wrap',
        },
        incomeDonutWrap: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        incomeLegend: {
            flex: 1,
            gap: 10,
            minWidth: 180,
        },
        incomeLegendRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        incomeLegendDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
        incomeLegendLabel: {
            flex: 1,
            fontSize: 13,
            color: colors.text,
        },
        incomeLegendPct: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.textMuted,
        },
        incomeExpandedPanel: {
            borderWidth: 1,
            borderRadius: 10,
            padding: 16,
            marginHorizontal: 8,
            marginBottom: 8,
            gap: 12,
        },
        incomeExpandedTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 4,
        },
        incomeSparkline: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            height: 80,
            gap: 6,
        },
        incomeSparkBar: {
            flex: 1,
            borderRadius: 4,
            minWidth: 16,
        },
        incomeExpandedActions: {
            flexDirection: 'row',
            gap: 10,
            flexWrap: 'wrap',
        },
    });

export default SuperAdminDashboard;
