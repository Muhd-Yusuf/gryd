import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import {
    LayoutDashboard,
    Home,
    Users,
    Bot,
    Globe,
    Bell,
    Gift,
    Settings,
    ChevronDown,
    ChevronUp,
    X,
    PieChart,
    Contact,
    KanbanSquare,
    CheckSquare,
    Calendar,
    Megaphone,
    FileText,
    Shield,
    Sun,
    Moon
} from 'lucide-react-native';
import { isFeatureEnabled, type FeatureKey } from '../lib/featureFlags';
import { useTheme } from '../lib/theme';
import { getAuthUser } from '../lib/api';
import UserAvatar from './UserAvatar';

interface SidebarProps {
    onClose?: () => void;
    isMobile?: boolean;
}

const Sidebar = ({ onClose, isMobile }: SidebarProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('User');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const { colors, mode, toggleTheme } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Load user info on mount
    useEffect(() => {
        const loadUserInfo = async () => {
            const user = await getAuthUser();
            if (user) {
                setUserRole(user.role);
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
                setUserName(name || user.email || 'User');
                setUserAvatar(user.avatarUrl || null);
            }
        };
        loadUserInfo();
    }, [pathname]);

    // Check if user is admin (super_admin or admin role)
    const isAdmin = userRole === 'super_admin' || userRole === 'admin';

    const TheGrydLogo = () => (
        <View style={styles.logoRow}>
            <Image source={require('../assets/icon.png')} style={{ width: 32, height: 32, borderRadius: 6 }} />
            <Text style={styles.brandName}>THE GRYD</Text>
        </View>
    );

    type MenuItem = {
        icon: any;
        label: string;
        path: string;
        feature: FeatureKey;
        badge?: string;
        hasSubmenu?: boolean;
        submenu?: Array<{ icon: any; label: string; path: string }>;
        adminOnly?: boolean; // Only show to admin users
    };

    const menuItems: MenuItem[] = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/(main)', feature: 'dashboard' },
        { icon: Shield, label: 'Admin Dashboard', path: '/admin', feature: 'adminDashboard', adminOnly: true },
        {
            icon: Users,
            label: 'Lead CRM',
            path: '/(main)/leads',
            feature: 'leadCrm',
            hasSubmenu: true,
            submenu: [
                { icon: PieChart, label: 'Overview', path: '/(main)/leads/overview' },
                { icon: Contact, label: 'Contacts', path: '/(main)/leads/contacts' },
                { icon: KanbanSquare, label: 'Pipeline', path: '/(main)/leads/pipeline' },
                { icon: CheckSquare, label: 'Tasks', path: '/(main)/leads/tasks' },
                { icon: Calendar, label: 'Calendar', path: '/(main)/leads/calendar' },
                { icon: Megaphone, label: 'Campaign', path: '/(main)/leads/campaign' },
                { icon: FileText, label: 'Reports', path: '/(main)/leads/reports' },
            ]
        },
        { icon: Globe, label: 'Community', path: '/(main)', feature: 'community' },
        { icon: Bell, label: 'Notifications', path: '/(main)/notifications', badge: '20', feature: 'notifications' },
        { icon: Gift, label: 'Rewards', path: '/(main)/rewards', feature: 'rewards' },
        { icon: Settings, label: 'Settings', path: '/(main)/settings', feature: 'settings' },
    ];

    // Filter menu items by feature flag AND admin role if required
    const visibleMenuItems = menuItems.filter((item) => {
        if (!isFeatureEnabled(item.feature)) return false;
        if (item.adminOnly && !isAdmin) return false;
        return true;
    });

    const handlePress = (item: any) => {
        if (item.hasSubmenu) {
            setExpandedMenu(expandedMenu === item.label ? null : item.label);
        } else {
            router.push(item.path);
            if (onClose) onClose();
        }
    };

    const handleSubPress = (path: string) => {
        router.push(path as any);
        if (onClose) onClose();
    };

    return (
        <View style={styles.container}>
            {/* Header / Logo */}
            <View style={styles.header}>
                <TheGrydLogo />
                {isMobile && (
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.menuSection}>
                    {visibleMenuItems.map((item, idx) => {
                        // High-level active check
                        const isMainActive = item.path === '/(main)'
                            ? pathname === '/(main)' || pathname === '/'
                            : pathname.startsWith(item.path);

                        const isExpanded = expandedMenu === item.label;

                        return (
                            <View key={idx}>
                                <TouchableOpacity
                                    style={[
                                        styles.menuItem,
                                        isMainActive && !item.hasSubmenu && styles.menuItemActive
                                    ]}
                                    onPress={() => handlePress(item)}
                                >
                                    <View style={styles.menuLeft}>
                                        <item.icon
                                            size={20}
                                            color={isMainActive && !item.hasSubmenu ? colors.primaryText : colors.textSubtle}
                                        />
                                        <Text style={[
                                            styles.menuLabel,
                                            isMainActive && !item.hasSubmenu && styles.menuLabelActive
                                        ]}>
                                            {item.label}
                                        </Text>
                                    </View>
                                    {item.hasSubmenu && (
                                        isExpanded
                                            ? <ChevronUp size={16} color={colors.textSubtle} />
                                            : <ChevronDown size={16} color={colors.textSubtle} />
                                    )}
                                    {item.badge && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{item.badge}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Submenu */}
                                {item.hasSubmenu && isExpanded && (
                                    <View style={styles.submenuContainer}>
                                        {item.submenu?.map((sub, subIdx) => {
                                            const isSubActive = pathname === sub.path;
                                            return (
                                                <TouchableOpacity
                                                    key={subIdx}
                                                    style={[styles.submenuItem, isSubActive && styles.submenuItemActive]}
                                                    onPress={() => handleSubPress(sub.path)}
                                                >
                                                    <sub.icon
                                                        size={18}
                                                        color={isSubActive ? colors.text : colors.textSubtle}
                                                    />
                                                    <Text style={[
                                                        styles.submenuLabel,
                                                        isSubActive && styles.submenuLabelActive
                                                    ]}>
                                                        {sub.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Footer Profile */}
            <View style={styles.footer}>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                    {mode === 'dark' ? (
                        <Sun size={16} color={colors.text} />
                    ) : (
                        <Moon size={16} color={colors.text} />
                    )}
                    <Text style={styles.themeToggleText}>
                        {mode === 'dark' ? 'Light mode' : 'Dark mode'}
                    </Text>
                </TouchableOpacity>
                <View style={styles.profileRow}>
                    <UserAvatar
                        uri={userAvatar}
                        name={userName}
                        style={styles.avatar}
                        accessibilityLabel={`${userName} avatar`}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{userName}</Text>
                        <Text style={styles.profileRole}>{isAdmin ? 'Admin' : 'Member'}</Text>
                    </View>
                    {!isAdmin && (
                        <TouchableOpacity style={styles.upgradeBtn}>
                            <Text style={styles.upgradeText}>Upgrade</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeBtn: {
        padding: 4,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoContainer: {
        width: 32,
        height: 32,
    },
    brandName: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
        color: colors.text,
    },
    scrollContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuSection: {
        gap: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    menuItemActive: {
        backgroundColor: colors.primary,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.textMuted,
    },
    menuLabelActive: {
        color: colors.primaryText,
        fontWeight: '600',
    },
    submenuContainer: {
        paddingLeft: 16,
        marginBottom: 8,
    },
    submenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    submenuItemActive: {
        backgroundColor: colors.surfaceMuted,
    },
    submenuLabel: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '500',
    },
    submenuLabelActive: {
        color: colors.text,
        fontWeight: '600',
    },
    badge: {
        backgroundColor: colors.surfaceMuted,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        color: colors.text,
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        paddingBottom: 24,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginBottom: 16,
    },
    themeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    themeToggleText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
    },
    profileRole: {
        fontSize: 12,
        color: colors.textMuted,
    },
    upgradeBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    upgradeText: {
        color: colors.primaryText,
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default Sidebar;
