import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Platform,
    useWindowDimensions
} from 'react-native';
import {
    Search,
    ChevronLeft,
    Plus,
    MoreHorizontal,
    Mail,
    Phone,
    FileText,
    Calendar,
    CheckSquare,
    PenTool,
    MessageSquare,
    ArrowLeft
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import UserAvatar from '../../../components/UserAvatar';

const LeadDetailScreen = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState('Overview');
    const { width } = useWindowDimensions();
    const isCompact = width < 768;

    const TABS = ['Overview', 'Engagement', 'Activities', 'Notes', 'Tasks', 'Meetings'];

    return (
        <ResponsiveLayout>
            <View style={styles.container}>
                {/* Top Header */}
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <ArrowLeft size={20} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.pageTitle}>Leads</Text>
                    </View>

                    <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
                        <View style={[styles.searchBar, isCompact && styles.searchBarCompact]}>
                            <Search size={16} color="#9CA3AF" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search List..."
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <TouchableOpacity style={[styles.newLeadBtn, isCompact && styles.newLeadBtnCompact]}>
                            <Plus size={16} color="#FFF" />
                            <Text style={styles.newLeadText}>New Lead</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Profile Header Block */}
                <View style={[styles.profileBlock, isCompact && styles.profileBlockCompact]}>
                    <View style={styles.profileRow}>
                        <UserAvatar name="Carissa Kidman" style={styles.avatar} />
                        <Text style={styles.profileName}>Carissa Kidman</Text>
                    </View>

                    <View style={[styles.actionTools, isCompact && styles.actionToolsCompact]}>
                        <TouchableOpacity style={styles.toolBtn}><FileText size={16} color="#6B7280" /><Text style={styles.toolText}>Note</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn}><Mail size={16} color="#6B7280" /><Text style={styles.toolText}>Email</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn}><Phone size={16} color="#6B7280" /><Text style={styles.toolText}>Call</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn}><CheckSquare size={16} color="#6B7280" /><Text style={styles.toolText}>Task</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.toolBtn}><MoreHorizontal size={16} color="#6B7280" /><Text style={styles.toolText}>More</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Tab Bar */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.tabBar, isCompact && styles.tabBarCompact]}
                >
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Content Area */}
                <ScrollView contentContainerStyle={[styles.contentArea, isCompact && styles.contentAreaCompact]}>
                    {activeTab === 'Overview' && <OverviewTab />}
                    {activeTab === 'Engagement' && <EngagementTab />}
                    {activeTab === 'Activities' && <ActivitiesTab />}
                    {activeTab === 'Notes' && <EmptyTab message="No activity yet" sub="All notes will appear here" icon={FileText} />}
                    {activeTab === 'Tasks' && <TasksTab />}
                    {activeTab === 'Meetings' && <MeetingsTab />}
                </ScrollView>
            </View>
        </ResponsiveLayout>
    );
};

const EmptyTab = ({ message, sub, icon: Icon }: any) => (
    <View style={styles.emptyContainer}>
        {Icon && <Icon size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />}
        <Text style={styles.emptyTitle}>{message}</Text>
        <Text style={styles.emptySub}>{sub}</Text>
    </View>
);

const EngagementTab = () => (
    <View style={styles.listContainer}>
        <Text style={styles.listHeader}>Engagement (2)</Text>

        <View style={styles.listItem}>
            <View style={styles.iconBox}><Mail size={20} color="#F59E0B" /></View>
            <View style={styles.listContent}>
                <Text style={styles.listTitle}>4 Bedroom Penthouse with BQ, Victoria Island</Text>
                <Text style={styles.listSub}>Carissa Kidman submitted inquiry form for this property</Text>
            </View>
            <Text style={styles.listDate}>Dec 7</Text>
        </View>

        <View style={styles.listItem}>
            <View style={styles.iconBox}><Phone size={20} color="#22C55E" /></View>
            <View style={styles.listContent}>
                <Text style={styles.listTitle}>5 Bedroom Fully Detached Duplex, Guzape Hills, Abuja</Text>
                <Text style={styles.listSub}>Carissa Kidman submitted inquiry form for this property</Text>
            </View>
            <Text style={styles.listDate}>Dec 7</Text>
        </View>
    </View>
);

const ActivitiesTab = () => (
    <View style={styles.listContainer}>
        <Text style={styles.listHeader}>Activities (10)</Text>

        {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.listItem}>
                <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Phone size={18} color="#3B82F6" />
                </View>
                <View style={styles.listContent}>
                    <Text style={styles.listTitle}>Follow Up - Carissa Kidman</Text>
                    <Text style={styles.listSub}>Email sent to Carissa Kidman by AI Agent</Text>
                </View>
                <Text style={styles.listDate}>Dec 7</Text>
            </View>
        ))}
    </View>
);

const TASK_ITEMS = [
    { title: 'Follow Up - Carissa Kidman', sub: 'Send listing deck', date: 'Dec 7', status: 'Done' },
    { title: 'Schedule tour', sub: 'Coordinate viewing time', date: 'Dec 9', status: 'In review' },
    { title: 'Prepare offer draft', sub: 'Review pricing strategy', date: 'Dec 10', status: 'In progress' },
    { title: 'Share contract updates', sub: 'Await feedback from client', date: 'Dec 12', status: 'Completed' },
];

const MEETING_ITEMS = [
    { title: 'Meeting with Carissa Kidman', sub: 'Property walkthrough', date: 'Dec 7' },
    { title: 'Meeting with Carissa Kidman', sub: 'Offer review call', date: 'Dec 10' },
    { title: 'Meeting with Carissa Kidman', sub: 'Follow-up Q&A', date: 'Dec 12' },
];

const TasksTab = () => (
    <View style={styles.listContainer}>
        <View style={styles.listHeaderRow}>
            <Text style={styles.listHeader}>Tasks ({TASK_ITEMS.length})</Text>
            <TouchableOpacity style={styles.actionPill}>
                <Text style={styles.actionPillText}>New Task</Text>
            </TouchableOpacity>
        </View>

        {TASK_ITEMS.map((task) => (
            <View key={task.title} style={styles.listItem}>
                <View style={[styles.iconBox, { backgroundColor: '#F8FAFC' }]}>
                    <CheckSquare size={18} color="#111827" />
                </View>
                <View style={styles.listContent}>
                    <Text style={styles.listTitle}>{task.title}</Text>
                    <Text style={styles.listSub}>{task.sub}</Text>
                    <View style={styles.taskMetaRow}>
                        <Text style={styles.taskMetaText}>{task.date}</Text>
                        <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>{task.status}</Text>
                        </View>
                    </View>
                </View>
            </View>
        ))}
    </View>
);

const MeetingsTab = () => (
    <View style={styles.listContainer}>
        <View style={styles.listHeaderRow}>
            <Text style={styles.listHeader}>Meetings ({MEETING_ITEMS.length})</Text>
            <TouchableOpacity style={styles.actionPill}>
                <Text style={styles.actionPillText}>New Meeting</Text>
            </TouchableOpacity>
        </View>

        {MEETING_ITEMS.map((meeting) => (
            <View key={meeting.title + meeting.date} style={styles.listItem}>
                <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Calendar size={18} color="#EF4444" />
                </View>
                <View style={styles.listContent}>
                    <Text style={styles.listTitle}>{meeting.title}</Text>
                    <Text style={styles.listSub}>{meeting.sub}</Text>
                </View>
                <Text style={styles.listDate}>{meeting.date}</Text>
            </View>
        ))}
    </View>
);

const OverviewTab = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;

    return (
        <View style={[styles.gridContainer, isCompact && styles.gridContainerCompact]}>
        {/* Left Col: Key Info + AI Summary */}
        <View style={styles.colLeft}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Key Information</Text>
                    <TouchableOpacity><PenTool size={14} color="#9CA3AF" /></TouchableOpacity>
                </View>
                <View style={styles.infoRow}><Text style={styles.label}>Email</Text><Text style={styles.value}>carissa.kidman@gmail.com</Text></View>
                <View style={styles.infoRow}><Text style={styles.label}>Phone</Text><Text style={styles.value}>555-555-5555</Text></View>
                <View style={styles.infoRow}><Text style={styles.label}>Company details</Text><Text style={styles.valueLink}>Oh My Goodness Inc.</Text></View>
                <View style={styles.infoRow}><Text style={styles.label}>Lead Source</Text><Text style={styles.value}>Property name</Text></View>
                <View style={styles.infoRow}><Text style={styles.label}>Lead status</Text><Text style={styles.value}>New</Text></View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>AI Summary</Text>
                <Text style={styles.aiText}>
                    Carissa appears to be a warm lead with growing intent. She has expressed interest in viewing
                    properties that match her criteria and responds positively to detailed information.
                    She may need additional clarity on local market conditions.
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>AI Automated Tasks</Text>
                    <TouchableOpacity><Text style={styles.linkText}>See all</Text></TouchableOpacity>
                </View>
                <View style={styles.taskItem}>
                    <CheckSquare size={16} color="#9CA3AF" />
                    <View style={{ flex: 1 }}><Text style={styles.taskText}>Follow up: Carissa Kidman</Text><Text style={styles.taskSub}>Dec 7</Text></View>
                </View>
                <View style={styles.taskItem}>
                    <CheckSquare size={16} color="#9CA3AF" />
                    <View style={{ flex: 1 }}><Text style={styles.taskText}>Send Brochure</Text><Text style={styles.taskSub}>Dec 8</Text></View>
                </View>
            </View>
        </View>

        {/* Right Col: Interactions + Meetings */}
        <View style={styles.colRight}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Last Interactions</Text>
                    <TouchableOpacity style={styles.composeBtn}><Text style={styles.composeText}>Compose</Text></TouchableOpacity>
                </View>

                <View style={styles.interactionItem}>
                    <View style={styles.interIconInfo}><Text style={styles.interLabel}>Budget</Text></View>
                    <Text style={styles.interDesc}>Hi, I saw your listing on Maple Street, is it still available?</Text>
                    <Text style={styles.interTime}>Dec 5, 2025 3:00PM</Text>
                </View>

                <View style={styles.interactionItem}>
                    <View style={styles.interIconInfo}><Text style={styles.interLabel}>Sophia (AI Assistant)</Text></View>
                    <Text style={styles.interDesc}>Yes, currently available. Would you like to schedule a viewing?</Text>
                    <Text style={styles.interTime}>Yesterday</Text>
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Past Meetings</Text>
                    <TouchableOpacity><Text style={styles.linkText}>See all</Text></TouchableOpacity>
                </View>
                <View style={styles.meetingItem}>
                    <Calendar size={16} color="#EF4444" />
                    <View><Text style={styles.meetingText}>Meeting with Carissa Kidman</Text><Text style={styles.meetingSub}>Carissa has an active thread</Text></View>
                    <Text style={styles.meetingDate}>Dec 7</Text>
                </View>
                <View style={styles.meetingItem}>
                    <Calendar size={16} color="#EF4444" />
                    <View><Text style={styles.meetingText}>Meeting with Carissa Kidman</Text><Text style={styles.meetingSub}>Carissa has an active thread</Text></View>
                    <Text style={styles.meetingDate}>Dec 7</Text>
                </View>
            </View>
        </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        marginBottom: 20,
    },
    headerCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    headerRightCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 36,
        width: 200,
        gap: 8,
    },
    searchBarCompact: {
        width: '100%',
    },
    searchInput: { flex: 1, fontSize: 13 },
    newLeadBtn: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 8,
        gap: 8,
    },
    newLeadBtnCompact: {
        justifyContent: 'center',
    },
    newLeadText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

    // Profile Block
    profileBlock: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    profileBlockCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        paddingHorizontal: 16,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    profileName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },

    actionTools: { flexDirection: 'row', gap: 16 },
    actionToolsCompact: {
        flexWrap: 'wrap',
        gap: 12,
    },
    toolBtn: { alignItems: 'center', gap: 4 },
    toolText: { fontSize: 10, color: '#6B7280' },

    // Tabs
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 4,
        gap: 8,
    },
    tabBarCompact: {
        paddingHorizontal: 16,
    },
    tabItem: {
        paddingVertical: 12,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: { borderBottomColor: '#000' },
    tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
    tabTextActive: { color: '#000', fontWeight: '600' },

    // Content
    contentArea: { padding: 24 },
    contentAreaCompact: { padding: 16 },
    gridContainer: { flexDirection: 'row', gap: 24 },
    gridContainerCompact: { flexDirection: 'column', gap: 16 },
    colLeft: { flex: 1, gap: 24 },
    colRight: { flex: 1.5, gap: 24 },

    // Lists (Engagement/Activities)
    listContainer: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    listHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
    },
    actionPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    actionPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#111827',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingVertical: 16,
        gap: 16,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: { flex: 1 },
    listTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
    listSub: { fontSize: 13, color: '#6B7280' },
    listDate: { fontSize: 12, color: '#9CA3AF' },
    taskMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    taskMetaText: {
        fontSize: 11,
        color: '#6B7280',
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: '#EEF2FF',
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#4F46E5',
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    emptySub: { fontSize: 13, color: '#6B7280' },

    // Cards
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
    infoRow: { flexDirection: 'row', marginBottom: 12 },
    label: { flex: 1, fontSize: 13, color: '#6B7280' },
    value: { flex: 2, fontSize: 13, color: '#111827', fontWeight: '500' },
    valueLink: { flex: 2, fontSize: 13, color: '#2563EB', fontWeight: '500' },

    aiText: { fontSize: 13, color: '#374151', lineHeight: 20 },
    linkText: { fontSize: 12, color: '#6B7280' },

    // Tasks Info
    taskItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    taskText: { fontSize: 13, color: '#374151' },
    taskSub: { fontSize: 11, color: '#9CA3AF' },

    // Interaction
    composeBtn: { borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    composeText: { fontSize: 12, color: '#374151' },
    interactionItem: {
        marginBottom: 16,
        paddingLeft: 12,
        borderLeftWidth: 2,
        borderLeftColor: '#E5E7EB'
    },
    interIconInfo: { flexDirection: 'row', marginBottom: 4 },
    interLabel: { fontSize: 11, fontWeight: 'bold', color: '#374151' },
    interDesc: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
    interTime: { fontSize: 11, color: '#9CA3AF' },

    // Meetings
    meetingItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    meetingText: { fontSize: 13, fontWeight: '500' },
    meetingSub: { fontSize: 11, color: '#9CA3AF' },
    meetingDate: { fontSize: 12, color: '#6B7280', marginLeft: 'auto' },
});

export default LeadDetailScreen;
