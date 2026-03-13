import React, { useEffect, useMemo, useState } from 'react';
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
    Image,
} from 'react-native';
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
} from '../lib/api';
import { useTheme } from '../lib/theme';
import { useSuperAdminDashboard } from '../hooks/useSuperAdminData';

type NavItem = 'overview' | 'customers' | 'moderation' | 'configuration';

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

type SettingsTab = 'admin' | 'team' | 'notifications';

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

    // UI state
    const [growthDropdownOpen, setGrowthDropdownOpen] = useState(false);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
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

    // Load initial admin user data
    useEffect(() => {
        loadInitialData();
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
        if (settingsTab === 'notifications') {
            loadNotificationPreferences();
        }
    }, [settingsTab]);

    const loadInitialData = async () => {
        try {
            const user = await getAuthUser();
            setAdminUser(user);
            // Set admin info for settings
            setAdminFirstName(user?.firstName || '');
            setAdminLastName(user?.lastName || '');
            setAdminEmail(user?.email || '');
            setAdminUsername(user?.username || user?.email?.split('@')[0] || '');
            // Team members are now loaded via React Query (useSuperAdminDashboard)
        } catch (err: any) {
            console.error('Failed to load initial data:', err.message);
        }
    };

    // Load notification preferences from API
    const loadNotificationPreferences = async () => {
        try {
            const response = await getNotificationPreferences();
            if (response?.data) {
                setNotificationSettings({
                    systemAlerts: response.data.systemAlerts ?? true,
                    securityEvents: response.data.securityEvents ?? true,
                    dailyReports: response.data.dailyReports ?? true,
                    weeklyReports: response.data.weeklyReports ?? true,
                });
            }
        } catch (err: any) {
            console.error('Failed to load notification preferences:', err.message);
        }
    };

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

        const member = teamMembers.find(m => m._id === teamSuspendMemberId);
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

    const toggleCustomerSelection = (customerId: string) => {
        setSelectedCustomers(prev =>
            prev.includes(customerId)
                ? prev.filter(id => id !== customerId)
                : [...prev, customerId]
        );
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
                const fileUri = FileSystem.documentDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                    encoding: FileSystem.EncodingType.UTF8,
                });

                // Check if sharing is available
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
            }
        } catch (err: any) {
            console.error('Failed to export CSV:', err);
            setError('Failed to export CSV');
        }
    };

    // Handle opening action menu with position
    const handleOpenActionMenu = (event: any, customer: Customer) => {
        event.stopPropagation();
        if (actionMenuOpen === customer._id) {
            setActionMenuOpen(null);
            setActionMenuCustomer(null);
            return;
        }

        // Get position from event target for web
        const target = event.currentTarget || event.target;
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
                                stroke="#e5e7eb"
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
                                stroke="#e5e7eb"
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
                <TouchableOpacity
                    style={[styles.navItem, activeNav === 'overview' && styles.navItemActive]}
                    onPress={() => { setActiveNav('overview'); setViewingCustomer(null); }}
                >
                    <LayoutDashboard size={20} color={activeNav === 'overview' ? colors.sidebarActiveText : colors.sidebarTextMuted} />
                    <Text style={[styles.navItemText, activeNav === 'overview' && styles.navItemTextActive]}>Overview</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navItem, activeNav === 'customers' && styles.navItemActive]}
                    onPress={() => { setActiveNav('customers'); setViewingCustomer(null); }}
                >
                    <Users size={20} color={activeNav === 'customers' ? colors.sidebarActiveText : colors.sidebarTextMuted} />
                    <Text style={[styles.navItemText, activeNav === 'customers' && styles.navItemTextActive]}>Customers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navItem, activeNav === 'moderation' && styles.navItemActive]}
                    onPress={() => { setActiveNav('moderation'); setViewingCustomer(null); }}
                >
                    <Shield size={20} color={activeNav === 'moderation' ? colors.sidebarActiveText : colors.sidebarTextMuted} />
                    <Text style={[styles.navItemText, activeNav === 'moderation' && styles.navItemTextActive]}>Moderations & Safety</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navItem, activeNav === 'configuration' && styles.navItemActive]}
                    onPress={() => { setActiveNav('configuration'); setViewingCustomer(null); }}
                >
                    <Settings size={20} color={activeNav === 'configuration' ? colors.sidebarActiveText : colors.sidebarTextMuted} />
                    <Text style={[styles.navItemText, activeNav === 'configuration' && styles.navItemTextActive]}>Configuration</Text>
                </TouchableOpacity>
            </View>

            {/* Logout */}
            <View style={styles.sidebarFooter}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <LogOut size={20} color={colors.sidebarTextMuted} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
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
                        <TouchableOpacity style={styles.topBarIconButton}>
                            <Bell size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topBarIconButton} onPress={toggleTheme}>
                            {mode === 'dark' ? <Sun size={18} color={colors.textMuted} /> : <Moon size={18} color={colors.textMuted} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topBarIconButton} onPress={handleLogout}>
                            <LogOut size={18} color={colors.textMuted} />
                        </TouchableOpacity>
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
                        <TouchableOpacity style={styles.topBarIconButton}>
                            <Bell size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.topBarIconButton} onPress={toggleTheme}>
                            {mode === 'dark' ? <Sun size={20} color={colors.textMuted} /> : <Moon size={20} color={colors.textMuted} />}
                        </TouchableOpacity>
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
        <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false}>
            {/* Stats Cards */}
            <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
                        <Users size={22} color="#3b82f6" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statLabel}>All Customers</Text>
                        <Text style={styles.statValue}>{stats.totalCustomers.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#fce7f3' }]}>
                        <MessageSquare size={22} color="#ec4899" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statLabel}>Active Channels</Text>
                        <Text style={styles.statValue}>{stats.activeChannels.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#ede9fe' }]}>
                        <Users size={22} color="#8b5cf6" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statLabel}>Total Members</Text>
                        <Text style={styles.statValue}>{stats.totalMembers.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#22c55e' }]}>
                        <DollarSign size={22} color="#fff" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statLabel}>Active Subscription</Text>
                        <Text style={styles.statValue}>{stats.activeSubscriptions.toLocaleString()}</Text>
                    </View>
                </View>
            </View>

            {/* Recent Customers Table */}
            <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                    <Text style={styles.tableTitle}>Recent Customer</Text>
                    <TouchableOpacity style={styles.seeAllButton} onPress={() => setActiveNav('customers')}>
                        <Text style={styles.seeAllButtonText}>See all</Text>
                    </TouchableOpacity>
                </View>

                {isMobile ? (
                    <View style={styles.mobileCardList}>
                        {filteredRecentCustomers.map((customer) => (
                            <TouchableOpacity
                                key={customer._id}
                                style={styles.mobileCustomerCard}
                                onPress={() => handleViewCustomer(customer)}
                            >
                                <View style={styles.mobileCardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.customerName} numberOfLines={1}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                        <Text style={styles.customerEmail} numberOfLines={1}>{customer.owner?.email || ''}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.actionMenuButton}
                                        onPress={(e) => handleOpenActionMenu(e, customer)}
                                    >
                                        <MoreHorizontal size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
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
                                    <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : customer.status === 'pending' ? styles.statusPending : styles.statusSuspended]}>
                                        <View style={[styles.statusDot, customer.status === 'active' ? styles.statusDotActive : customer.status === 'pending' ? styles.statusDotPending : styles.statusDotSuspended]} />
                                        <Text style={[styles.statusBadgeText, customer.status === 'active' ? styles.statusTextActive : customer.status === 'pending' ? styles.statusTextPending : styles.statusTextSuspended]}>
                                            {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.table}>
                        <View style={styles.tableRowHeader}>
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
                                    <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : customer.status === 'pending' ? styles.statusPending : styles.statusSuspended]}>
                                        <View style={[styles.statusDot, customer.status === 'active' ? styles.statusDotActive : customer.status === 'pending' ? styles.statusDotPending : styles.statusDotSuspended]} />
                                        <Text style={[styles.statusBadgeText, customer.status === 'active' ? styles.statusTextActive : customer.status === 'pending' ? styles.statusTextPending : styles.statusTextSuspended]}>
                                            {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.tableCell, { width: 50 }]}>
                                    <TouchableOpacity
                                        style={styles.actionMenuButton}
                                        onPress={(e) => handleOpenActionMenu(e, customer)}
                                    >
                                        <MoreHorizontal size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Charts Row */}
            <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <Text style={styles.chartTitle}>Customer Growth</Text>
                        <View style={styles.chartDropdownWrapper}>
                            <TouchableOpacity
                                style={styles.chartDropdown}
                                onPress={() => setGrowthDropdownOpen((prev) => !prev)}
                            >
                                <Text style={styles.chartDropdownText}>{growthRange} Days</Text>
                                <ChevronDown size={18} color={colors.text} />
                            </TouchableOpacity>
                            {growthDropdownOpen && (
                                <View style={styles.chartDropdownMenu}>
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

                <View style={styles.chartCard}>
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
        <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false}>
            <View style={[styles.customersHeader, isMobile && styles.customersHeaderMobile]}>
                <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Customers</Text>
                <TouchableOpacity style={[styles.addCustomerButton, isMobile && styles.addCustomerButtonMobile]} onPress={() => setAddCustomerModalOpen(true)}>
                    <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.addCustomerButtonText}>{isMobile ? 'Add' : 'Add New Customer'}</Text>
                </TouchableOpacity>
            </View>

            {/* Customer Stats Cards */}
            <View style={[styles.customerStatsGrid, isMobile && styles.customerStatsGridMobile]}>
                <View style={styles.customerStatCard}>
                    <View style={[styles.customerStatIcon, { backgroundColor: '#e0f2fe' }]}>
                        <Users size={24} color="#0284c7" />
                    </View>
                    <View style={styles.customerStatInfo}>
                        <Text style={styles.customerStatLabel}>All Customers</Text>
                        <Text style={styles.customerStatValue}>{customerStats.totalCustomers}</Text>
                    </View>
                </View>

                <View style={styles.customerStatCard}>
                    <View style={[styles.customerStatIcon, { backgroundColor: '#fce7f3' }]}>
                        <Users size={24} color="#db2777" />
                    </View>
                    <View style={styles.customerStatInfo}>
                        <Text style={styles.customerStatLabel}>Active Customers</Text>
                        <Text style={styles.customerStatValue}>{customerStats.activeCustomers}</Text>
                    </View>
                </View>
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

                        <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV}>
                            <Download size={18} color={colors.text} />
                            <Text style={styles.exportButtonText}>Export CSV</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {isMobile ? (
                    <View style={styles.mobileCardList}>
                        {customers.map((customer) => (
                            <TouchableOpacity
                                key={customer._id}
                                style={styles.mobileCustomerCard}
                                onPress={() => handleViewCustomer(customer)}
                            >
                                <View style={styles.mobileCardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.customerName} numberOfLines={1}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                        <Text style={styles.customerEmail} numberOfLines={1}>{customer.owner?.email || ''}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.actionMenuButton}
                                        onPress={(e) => { e.stopPropagation(); handleOpenActionMenu(e, customer); }}
                                    >
                                        <MoreHorizontal size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
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
                                    <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : customer.status === 'pending' ? styles.statusPending : styles.statusSuspended]}>
                                        <View style={[styles.statusDot, customer.status === 'active' ? styles.statusDotActive : customer.status === 'pending' ? styles.statusDotPending : styles.statusDotSuspended]} />
                                        <Text style={[styles.statusBadgeText, customer.status === 'active' ? styles.statusTextActive : customer.status === 'pending' ? styles.statusTextPending : styles.statusTextSuspended]}>
                                            {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        </Text>
                                    </View>
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
                        <View style={styles.tableRowHeader}>
                            <View style={[styles.tableHeaderCell, { width: 40 }]}>
                                <TouchableOpacity style={styles.checkbox} />
                            </View>
                            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Customer Details</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Server Name</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Server members</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                            <View style={[styles.tableHeaderCell, { width: 50 }]} />
                        </View>

                        {customers.map((customer) => (
                            <TouchableOpacity key={customer._id} style={styles.tableRow} onPress={() => handleViewCustomer(customer)}>
                                <View style={[styles.tableCell, { width: 40 }]}>
                                    <TouchableOpacity
                                        style={[styles.checkbox, selectedCustomers.includes(customer._id) && styles.checkboxChecked]}
                                        onPress={(e) => { e.stopPropagation(); toggleCustomerSelection(customer._id); }}
                                    >
                                        {selectedCustomers.includes(customer._id) && (
                                            <Check size={14} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.tableCell, { flex: 2 }]}>
                                    <Text style={styles.customerName}>{customer.clientName || customer.owner?.name || '-'}</Text>
                                    <Text style={styles.customerEmail}>{customer.owner?.email || ''}</Text>
                                </View>
                                <Text style={[styles.tableCell, { flex: 1.5 }]}>{customer.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 1 }]}>{customer.memberCount}</Text>
                                <View style={[styles.tableCell, { flex: 1 }]}>
                                    <View style={[styles.statusBadge, customer.status === 'active' ? styles.statusActive : customer.status === 'pending' ? styles.statusPending : styles.statusSuspended]}>
                                        <View style={[styles.statusDot, customer.status === 'active' ? styles.statusDotActive : customer.status === 'pending' ? styles.statusDotPending : styles.statusDotSuspended]} />
                                        <Text style={[styles.statusBadgeText, customer.status === 'active' ? styles.statusTextActive : customer.status === 'pending' ? styles.statusTextPending : styles.statusTextSuspended]}>
                                            {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.tableCell, { width: 50 }]}>
                                    <TouchableOpacity
                                        style={styles.actionMenuButton}
                                        onPress={(e) => handleOpenActionMenu(e, customer)}
                                    >
                                        <MoreHorizontal size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
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

                        <TouchableOpacity
                            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                            onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft size={20} color={currentPage === 1 ? colors.textMuted : colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.paginationButton,
                                currentPage * rowsPerPage < customersTotal ? styles.paginationButtonActive : styles.paginationButtonDisabled
                            ]}
                            onPress={() => setCurrentPage(prev => prev + 1)}
                            disabled={currentPage * rowsPerPage >= customersTotal}
                        >
                            <ChevronRight size={20} color={currentPage * rowsPerPage >= customersTotal ? colors.textMuted : '#fff'} />
                        </TouchableOpacity>
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
                        <TouchableOpacity style={styles.backButton} onPress={handleBackToCustomers}>
                            <ArrowLeft size={24} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.customerDetailTitle}>Customer Details</Text>
                    </View>

                    <View style={[styles.customerDetailActions, isMobile && styles.customerDetailActionsMobile]}>
                        <Text style={styles.statusLabel}>Status</Text>
                        <View style={[styles.statusBadge, viewingCustomer.status === 'active' ? styles.statusActive : styles.statusSuspended]}>
                            <View style={[styles.statusDot, viewingCustomer.status === 'active' ? styles.statusDotActive : styles.statusDotSuspended]} />
                            <Text style={[styles.statusBadgeText, viewingCustomer.status === 'active' ? styles.statusTextActive : styles.statusTextSuspended]}>
                                {viewingCustomer.status.charAt(0).toUpperCase() + viewingCustomer.status.slice(1)}
                            </Text>
                        </View>
                        {viewingCustomer.status === 'active' ? (
                            <TouchableOpacity
                                style={styles.suspendButton}
                                onPress={() => openSuspendModal(viewingCustomer._id)}
                            >
                                <Text style={styles.suspendButtonText}>Suspend Account</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.revokeButton}
                                onPress={() => handleRevokeSuspension(viewingCustomer._id)}
                            >
                                <Text style={styles.revokeButtonText}>Revoke Suspension</Text>
                            </TouchableOpacity>
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
                                    <TouchableOpacity style={styles.copyCodeButton}>
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
        <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false}>
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
                        <Text style={styles.prohibitedItem}>Allos stickers in your autocomplete results.</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    // Render Configuration/Settings Page
    const renderConfigurationPage = () => {
        const getStatusColor = (status: string) => {
            switch (status.toLowerCase()) {
                case 'active': return { bg: '#dcfce7', text: '#16a34a' };
                case 'suspended': return { bg: '#fee2e2', text: '#dc2626' };
                case 'pending': return { bg: '#fef3c7', text: '#d97706' };
                default: return { bg: '#f3f4f6', text: '#6b7280' };
            }
        };

        return (
            <ScrollView style={[styles.pageContent, isMobile && styles.pageContentMobile]} showsVerticalScrollIndicator={false}>
                <View style={[styles.pageHeader, isMobile && styles.pageHeaderMobile]}>
                    <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Settings</Text>
                </View>

                {/* Settings Tabs */}
                <View style={[styles.settingsTabs, isMobile && styles.settingsTabsMobile]}>
                    <TouchableOpacity
                        style={[styles.settingsTab, settingsTab === 'admin' && styles.settingsTabActive]}
                        onPress={() => setSettingsTab('admin')}
                    >
                        <Text style={[styles.settingsTabText, settingsTab === 'admin' && styles.settingsTabTextActive]}>Admin Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.settingsTab, settingsTab === 'team' && styles.settingsTabActive]}
                        onPress={() => setSettingsTab('team')}
                    >
                        <Text style={[styles.settingsTabText, settingsTab === 'team' && styles.settingsTabTextActive]}>Team</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.settingsTab, settingsTab === 'notifications' && styles.settingsTabActive]}
                        onPress={() => setSettingsTab('notifications')}
                    >
                        <Text style={[styles.settingsTabText, settingsTab === 'notifications' && styles.settingsTabTextActive]}>Notifications</Text>
                    </TouchableOpacity>
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
                                    placeholder="admin@syphor.com"
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
                            <TouchableOpacity
                                style={[styles.saveAdminInfoButton, savingAdminInfo && styles.saveAdminInfoButtonDisabled]}
                                onPress={handleSaveAdminInfo}
                                disabled={savingAdminInfo}
                            >
                                {savingAdminInfo ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveAdminInfoButtonText}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Team Tab */}
                {settingsTab === 'team' && (
                    <View style={[styles.settingsContent, isMobile && styles.settingsContentMobile]}>
                        <View style={[styles.teamHeader, isMobile && styles.teamHeaderMobile]}>
                            <View>
                                <Text style={styles.settingsSectionTitle}>Team</Text>
                                <Text style={styles.settingsSectionSubtitle}>Manage you team members here</Text>
                            </View>
                            <View style={styles.teamHeaderActions}>
                                <TouchableOpacity style={styles.teamSettingsButton}>
                                    <Settings size={20} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.addTeamMemberButton}
                                    onPress={() => setInviteModalOpen(true)}
                                >
                                    <Plus size={20} color="#fff" />
                                    <Text style={styles.addTeamMemberButtonText}>Add Team member</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Team Table */}
                        {isMobile ? (
                            <View style={styles.mobileCardList}>
                                {teamMembers.map((member) => {
                                    const statusColors = getStatusColor(member.status);
                                    return (
                                        <View key={member._id} style={styles.mobileCustomerCard}>
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
                                                                <Trash2 size={16} color="#EF4444" />
                                                                <Text style={[styles.actionMenuItemText, { color: '#EF4444' }]}>Delete</Text>
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
                                                <View style={[styles.teamStatusBadge, { backgroundColor: statusColors.bg }]}>
                                                    <Text style={[styles.teamStatusText, { color: statusColors.text }]}>
                                                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                                    </Text>
                                                </View>
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
                                                            <Trash2 size={16} color="#EF4444" />
                                                            <Text style={[styles.actionMenuItemText, { color: '#EF4444' }]}>Delete</Text>
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
                                <ActivityIndicator size="small" color="#fff" />
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
                            {suspendConfirmChecked && <Check size={16} color="#16a34a" />}
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
                                <ActivityIndicator size="small" color="#fff" />
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
                            {deleteConfirmChecked && <Check size={16} color="#16a34a" />}
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
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.confirmProceedText}>Proceed</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );

    // Role dropdown state for invite modal
    const [inviteRoleDropdownOpen, setInviteRoleDropdownOpen] = useState(false);

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
                                    <ActivityIndicator size="small" color="#fff" />
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
        const member = teamMembers.find(m => m._id === teamSuspendMemberId);
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
                                    isSuspended && { backgroundColor: '#22c55e' }
                                ]}
                                onPress={handleSuspendTeamMember}
                                disabled={!teamSuspendConfirmChecked || suspendingTeamMember}
                            >
                                {suspendingTeamMember ? (
                                    <ActivityIndicator size="small" color="#fff" />
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
                            <View style={[styles.suspendCheckbox, teamDeleteConfirmChecked && styles.suspendCheckboxChecked, teamDeleteConfirmChecked && { backgroundColor: '#EF4444' }]}>
                                {teamDeleteConfirmChecked && <Check size={14} color="#fff" />}
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
                                    { backgroundColor: '#EF4444' },
                                    !teamDeleteConfirmChecked && styles.suspendSubmitButtonDisabled
                                ]}
                                onPress={handleDeleteTeamMember}
                                disabled={!teamDeleteConfirmChecked || deletingTeamMember}
                            >
                                {deletingTeamMember ? (
                                    <ActivityIndicator size="small" color="#fff" />
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

    // Render mobile bottom navigation
    const renderMobileBottomNav = () => (
        <View style={[styles.mobileBottomNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {([
                { key: 'overview', Icon: LayoutDashboard, label: 'Overview' },
                { key: 'customers', Icon: Users, label: 'Customers' },
                { key: 'moderation', Icon: Shield, label: 'Moderation' },
                { key: 'configuration', Icon: Settings, label: 'Settings' },
            ] as { key: NavItem; Icon: any; label: string }[]).map((item) => (
                <TouchableOpacity
                    key={item.key}
                    style={[styles.mobileNavItem, activeNav === item.key && styles.mobileNavItemActive]}
                    onPress={() => { setActiveNav(item.key); setViewingCustomer(null); }}
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

            {/* Action Menu Overlay and Dropdown */}
            {actionMenuOpen && actionMenuCustomer && (
                Platform.OS === 'web' ? (
                    <>
                        <Pressable
                            style={styles.actionMenuOverlay}
                            onPress={closeActionMenu}
                        />
                        <View style={[styles.floatingActionMenu, { top: actionMenuPosition.top, right: actionMenuPosition.right }]}>
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
                                style={styles.actionMenuItem}
                                onPress={() => { openDeleteModal(actionMenuCustomer._id); closeActionMenu(); }}
                            >
                                <Trash2 size={18} color={colors.error} style={{ marginRight: 10 }} />
                                <Text style={[styles.actionMenuText, { color: colors.error }]}>Delete Account</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <Modal visible transparent animationType="slide" onRequestClose={closeActionMenu}>
                        <Pressable style={[styles.modalOverlay, { justifyContent: 'flex-end' }]} onPress={closeActionMenu}>
                            <Pressable style={styles.actionMenuMobile} onPress={(e) => e.stopPropagation()}>
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
                                    style={styles.actionMenuItem}
                                    onPress={() => { openDeleteModal(actionMenuCustomer._id); closeActionMenu(); }}
                                >
                                    <Trash2 size={18} color={colors.error} style={{ marginRight: 10 }} />
                                    <Text style={[styles.actionMenuText, { color: colors.error }]}>Delete Account</Text>
                                </TouchableOpacity>
                            </Pressable>
                        </Pressable>
                    </Modal>
                )
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
            backgroundColor: colors.appBg,
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
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 8,
            paddingHorizontal: 4,
        },
        mobileNavItem: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 6,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderWidth: 2,
            borderColor: colors.sidebarText,
            justifyContent: 'center',
            alignItems: 'center',
        },
        logoHash: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.sidebarText,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderWidth: 2,
            borderColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.primary + '15',
        },
        mobileLogoHash: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.primary,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            paddingVertical: 0,
            minHeight: Platform.OS === 'web' ? 20 : 26,
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
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        topBarDivider: {
            width: 1,
            height: 32,
            backgroundColor: colors.border,
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
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.surface,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'visible',
        },
        customersTableHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderBottomColor: colors.border,
        },
        filterDropdownItemActive: {
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        tableRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            borderColor: colors.border,
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
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignSelf: 'flex-start',
        },
        planTrial: {
            borderColor: colors.border,
        },
        planActive: {
            borderColor: colors.border,
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
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actionMenu: {
            position: 'absolute',
            top: '100%',
            right: 0,
            backgroundColor: colors.surface,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 20,
            minWidth: 180,
            zIndex: 9999,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderTopColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
            minWidth: 150,
            zIndex: 9999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 4,
        },
        actionMenuOverlay: {
            position: 'fixed' as any,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
            backgroundColor: 'transparent',
        },
        floatingActionMenu: {
            position: 'fixed' as any,
            backgroundColor: colors.surface,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 25,
            minWidth: 200,
            zIndex: 9999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 8,
        },

        // Pagination
        pagination: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
        },
        rowsPerPageOptionActive: {
            backgroundColor: colors.primary,
        },
        rowsPerPageText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        rowsPerPageTextActive: {
            color: '#FFFFFF',
            fontWeight: '600',
        },
        paginationButton: {
            width: 32,
            height: 32,
            borderRadius: 4,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: '#991b1b',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
        },
        suspendButtonText: {
            color: '#fff',
            fontSize: 14,
            fontWeight: '500',
        },
        detailCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            borderBottomColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
        },
        filterButtonActive: {
            backgroundColor: colors.primary,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceHover,
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
            backgroundColor: colors.border,
            padding: 2,
        },
        toggleActive: {
            backgroundColor: colors.primary,
        },
        toggleKnob: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.surface,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: '#ef4444',
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
        },
        errorText: {
            color: '#fff',
            fontSize: 14,
        },

        // Confirm Modal (Suspend/Delete)
        confirmModal: {
            backgroundColor: colors.surface,
            borderRadius: 12,
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
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
            backgroundColor: colors.surface,
        },
        confirmCheckboxChecked: {
            borderColor: colors.successText,
            backgroundColor: colors.surface,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
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
            backgroundColor: colors.surfaceHover,
            borderRadius: 8,
            marginBottom: 8,
        },
        planCheckbox: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
            backgroundColor: colors.surface,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
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
            backgroundColor: colors.surface,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.text,
        },
        settingsInputDisabled: {
            backgroundColor: colors.surfaceMuted,
            color: colors.textMuted,
        },
        settingsSaveSection: {
            marginTop: 24,
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopColor: colors.border,
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
            borderColor: colors.border,
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
            borderColor: colors.border,
            borderRadius: 8,
            overflow: 'hidden',
        },
        teamTableHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceHover,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
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
            borderBottomColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderRadius: 12,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        inviteRoleText: {
            fontSize: 14,
            color: colors.text,
        },
        inviteRoleDropdownMenu: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
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
            borderBottomColor: colors.border,
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
            borderColor: colors.border,
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
            borderTopColor: colors.border,
        },
        inviteCodeBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceHover,
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        inviteCodeHint: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 8,
        },

        // See All Button
        seeAllButton: {
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
        },
        chartDropdownWrapper: {
            position: 'relative',
        },
        chartDropdownMenu: {
            position: 'absolute',
            top: 40,
            right: 0,
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            width: '100%',
            paddingVertical: 12,
            paddingHorizontal: 8,
            paddingBottom: bottomInset + 16,
        },
        containerMobileSafe: {
            paddingTop: topInset,
        },
    });

export default SuperAdminDashboard;
