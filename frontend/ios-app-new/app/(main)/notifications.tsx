import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    Platform,
    useWindowDimensions
} from 'react-native';
import {
    Search,
    Bell,
    MessageSquare,
    CheckSquare,
    Gift,
    FileText,
    Users,
    Settings
} from 'lucide-react-native';
import ResponsiveLayout from '../../components/ResponsiveLayout';

const NotificationsScreen = () => {
    const [activeTab, setActiveTab] = useState('All');
    const { width } = useWindowDimensions();
    const isCompact = width < 768;

    const TABS = ['All', 'Community', 'System'];

    const NOTIFICATIONS = [
        { type: 'community', title: 'New Message', desc: 'Sarah posted in General channel', time: '10:00AM', date: 'Today' },
        { type: 'sub', title: 'Subscription Alert', desc: 'Your monthly subscription will expire on the 3rd of December, 2025', time: 'Nov 25, 2025', date: 'Nov 25' },
        { type: 'task', title: 'To-do', desc: 'Follow up with member request', time: 'Nov 12, 2025', date: 'Nov 12' },
        { type: 'meet', title: 'Meeting Schedule', desc: 'Community event planning meeting', time: 'Nov 12, 2025', date: 'Nov 12' },
        { type: 'referral', title: 'Referral Bonus', desc: 'You\'ve earned $50 referral bonus from chloesovan@gmail.com', time: 'Nov 12, 2025', date: 'Nov 12' },
        { type: 'community', title: 'New Member', desc: 'John Smith joined the community', time: 'Nov 12, 2025', date: 'Nov 12' },
    ];

    const getIcon = (type: string) => {
        switch (type) {
            case 'community': return { icon: Users, color: '#3B82F6', bg: '#EFF6FF' };
            case 'form': return { icon: FileText, color: '#F59E0B', bg: '#FEF3C7' };
            case 'sub': return { icon: Bell, color: '#EF4444', bg: '#FEE2E2' };
            case 'task': return { icon: CheckSquare, color: '#10B981', bg: '#D1FAE5' };
            case 'referral': return { icon: Gift, color: '#EC4899', bg: '#FCE7F3' };
            case 'meet': return { icon: MessageSquare, color: '#6366F1', bg: '#E0E7FF' };
            default: return { icon: Bell, color: '#6B7280', bg: '#F3F4F6' };
        }
    };

    return (
        <ResponsiveLayout>
            <View style={[styles.container, isCompact && styles.containerCompact]}>
                {/* Header with Tabs */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <Text style={styles.pageCount}>Unread (0)</Text>
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
                <ScrollView contentContainerStyle={styles.listContainer}>
                    {NOTIFICATIONS.map((item, index) => {
                        const { icon: Icon, color, bg } = getIcon(item.type);
                        return (
                            <View key={index} style={styles.itemRow}>
                                <View style={[styles.iconBox, { backgroundColor: bg }]}>
                                    <Icon size={18} color={color} />
                                </View>
                                <View style={styles.itemContent}>
                                    <View style={styles.titleRow}>
                                        <Text style={styles.itemTitle}>{item.title}</Text>
                                        <Text style={styles.itemTime}>{item.time}</Text>
                                    </View>
                                    <Text style={styles.itemDesc}>{item.desc}</Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        </ResponsiveLayout>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: 24,
    },
    containerCompact: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
    },
    headerTop: {
        marginBottom: 16,
    },
    pageCount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    tabsScroll: {
        flexDirection: 'row',
    },
    tabBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#FFF',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tabBtnActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    tabText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#FFF',
    },

    // List
    listContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    itemRow: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        alignItems: 'flex-start',
        gap: 16,
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
        fontWeight: '600',
        color: '#111827',
    },
    itemTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    itemDesc: {
        fontSize: 13,
        color: '#6B7280',
    },
});

export default NotificationsScreen;
