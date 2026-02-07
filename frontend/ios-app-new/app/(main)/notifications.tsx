import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    useWindowDimensions
} from 'react-native';
import {
    Bell,
    MessageSquare,
    CheckSquare,
    Gift,
    Users,
    Phone,
    Video,
    AtSign,
    Calendar,
    Megaphone,
    Settings,
    Trash2,
    CheckCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import ResponsiveLayout from '../../components/ResponsiveLayout';
import { useTheme } from '../../lib/theme';
import {
    getNotificationInbox,
    markNotificationsAsRead,
    deleteNotifications,
    getUnreadNotificationCount,
} from '../../lib/api';

interface NotificationItem {
    _id: string;
    type: string;
    title: string;
    body: string;
    imageUrl?: string;
    data?: {
        subgridId?: string;
        channelId?: string;
        messageId?: string;
        senderId?: string;
        senderName?: string;
        callId?: string;
        callType?: string;
    };
    read: boolean;
    createdAt: string;
}

const NotificationsScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('All');
    const { width } = useWindowDimensions();
    const isCompact = width < 768;

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);

    const TABS = ['All', 'Messages', 'Mentions', 'Calls', 'System'];

    const getTypeFilter = (tab: string): string | undefined => {
        switch (tab) {
            case 'Messages': return 'message,dm';
            case 'Mentions': return 'mention';
            case 'Calls': return 'call';
            case 'System': return 'system,invite,event,announcement';
            default: return undefined;
        }
    };

    const loadNotifications = useCallback(async (refresh = false) => {
        try {
            if (refresh) {
                setRefreshing(true);
                setOffset(0);
            } else if (!refresh && !loading) {
                setLoading(true);
            }

            const typeFilter = getTypeFilter(activeTab);
            const currentOffset = refresh ? 0 : offset;

            const res = await getNotificationInbox({
                limit: 30,
                offset: currentOffset,
                type: typeFilter,
            });

            if (res.success && res.data) {
                if (refresh || currentOffset === 0) {
                    setNotifications(res.data.notifications);
                } else {
                    setNotifications(prev => [...prev, ...res.data.notifications]);
                }
                setUnreadCount(res.data.unreadCount);
                setHasMore(res.data.hasMore);
                setOffset(currentOffset + res.data.notifications.length);
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, offset]);

    useEffect(() => {
        setOffset(0);
        setLoading(true);
        loadNotifications(true);
    }, [activeTab]);

    const handleRefresh = () => {
        loadNotifications(true);
    };

    const handleMarkAllRead = async () => {
        try {
            await markNotificationsAsRead(undefined, true);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markNotificationsAsRead([notificationId]);
            setNotifications(prev =>
                prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            await deleteNotifications([notificationId]);
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const handleNotificationPress = (notification: NotificationItem) => {
        // Mark as read
        if (!notification.read) {
            handleMarkAsRead(notification._id);
        }

        // Navigate based on type
        const { data } = notification;
        if (!data) return;

        switch (notification.type) {
            case 'message':
            case 'mention':
                if (data.subgridId && data.channelId) {
                    router.push(`/(main)/sub-channel?subgridId=${data.subgridId}&channelId=${data.channelId}`);
                }
                break;
            case 'dm':
                if (data.senderId) {
                    router.push(`/(main)/direct-messages/${data.senderId}`);
                }
                break;
            case 'call':
                // Calls don't navigate, just show the notification
                break;
            case 'invite':
                router.push('/(main)/direct-messages');
                break;
            default:
                break;
        }
    };

    const getIcon = (type: string, callType?: string) => {
        switch (type) {
            case 'message':
                return { icon: MessageSquare, color: '#3B82F6', bg: '#EFF6FF' };
            case 'dm':
                return { icon: MessageSquare, color: '#8B5CF6', bg: '#EDE9FE' };
            case 'mention':
                return { icon: AtSign, color: '#F59E0B', bg: '#FEF3C7' };
            case 'call':
                return callType === 'video'
                    ? { icon: Video, color: '#10B981', bg: '#D1FAE5' }
                    : { icon: Phone, color: '#10B981', bg: '#D1FAE5' };
            case 'invite':
                return { icon: Users, color: '#EC4899', bg: '#FCE7F3' };
            case 'member_join':
            case 'member_leave':
                return { icon: Users, color: '#6366F1', bg: '#E0E7FF' };
            case 'event':
                return { icon: Calendar, color: '#0EA5E9', bg: '#E0F2FE' };
            case 'announcement':
                return { icon: Megaphone, color: '#EF4444', bg: '#FEE2E2' };
            case 'system':
                return { icon: Settings, color: '#6B7280', bg: '#F3F4F6' };
            default:
                return { icon: Bell, color: '#6B7280', bg: '#F3F4F6' };
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const styles = createStyles(colors, isCompact);

    return (
        <ResponsiveLayout>
            <View style={styles.container}>
                {/* Header with Tabs */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Text style={styles.pageCount}>Unread ({unreadCount})</Text>
                        {unreadCount > 0 && (
                            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
                                <CheckCircle size={14} color={colors.primary} />
                                <Text style={styles.markAllText}>Mark all read</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Notifications List */}
                <ScrollView
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                >
                    {loading && notifications.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.loadingText}>Loading notifications...</Text>
                        </View>
                    ) : notifications.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Bell size={48} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No notifications</Text>
                            <Text style={styles.emptyText}>You're all caught up!</Text>
                        </View>
                    ) : (
                        notifications.map((item) => {
                            const { icon: Icon, color, bg } = getIcon(item.type, item.data?.callType);
                            return (
                                <TouchableOpacity
                                    key={item._id}
                                    style={[styles.itemRow, !item.read && styles.itemRowUnread]}
                                    onPress={() => handleNotificationPress(item)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: bg }]}>
                                        <Icon size={18} color={color} />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <View style={styles.titleRow}>
                                            <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]}>
                                                {item.title}
                                            </Text>
                                            <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
                                        </View>
                                        <Text style={styles.itemDesc} numberOfLines={2}>{item.body}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.deleteBtn}
                                        onPress={() => handleDeleteNotification(item._id)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Trash2 size={16} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })
                    )}

                    {hasMore && !loading && (
                        <TouchableOpacity
                            style={styles.loadMoreBtn}
                            onPress={() => loadNotifications(false)}
                        >
                            <Text style={styles.loadMoreText}>Load more</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>
        </ResponsiveLayout>
    );
};

const createStyles = (colors: any, isCompact: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.appBg,
        padding: isCompact ? 16 : 24,
    },
    header: {
        marginBottom: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    pageCount: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    markAllText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '500',
    },
    tabsScroll: {
        flexDirection: 'row',
    },
    tabBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: colors.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabBtnActive: {
        backgroundColor: colors.text,
        borderColor: colors.text,
    },
    tabText: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: '500',
    },
    tabTextActive: {
        color: colors.surface,
    },

    // List
    listContainer: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 200,
    },
    itemRow: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'flex-start',
        gap: 12,
    },
    itemRowUnread: {
        backgroundColor: colors.primaryBg || '#EFF6FF',
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemContent: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    itemTitleUnread: {
        fontWeight: '700',
    },
    itemTime: {
        fontSize: 12,
        color: colors.textMuted,
    },
    itemDesc: {
        fontSize: 13,
        color: colors.textSubtle,
        lineHeight: 18,
    },
    deleteBtn: {
        padding: 4,
    },

    // Empty & Loading states
    loadingContainer: {
        padding: 48,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: colors.textMuted,
    },
    emptyContainer: {
        padding: 48,
        alignItems: 'center',
    },
    emptyTitle: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    emptyText: {
        marginTop: 4,
        fontSize: 14,
        color: colors.textMuted,
    },
    loadMoreBtn: {
        padding: 16,
        alignItems: 'center',
    },
    loadMoreText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '500',
    },
});

export default NotificationsScreen;
