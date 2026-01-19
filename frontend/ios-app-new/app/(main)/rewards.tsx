import React from 'react';
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
    Plus,
    DollarSign,
    MousePointerClick,
    Users,
    CreditCard,
    Copy,
    ChevronDown
} from 'lucide-react-native';
import ResponsiveLayout from '../../components/ResponsiveLayout';

const RewardsScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const gridLineStyle = isCompact ? [styles.gridLine, styles.gridLineCompact] : styles.gridLine;

    return (
        <ResponsiveLayout>
            <View style={[styles.container, isCompact && styles.containerCompact]}>
                {/* Header */}
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <Text style={styles.pageTitle}>Affiliate Program</Text>
                    <TouchableOpacity style={[styles.addBtn, isCompact && styles.addBtnCompact]}>
                        <Plus size={16} color="#FFF" />
                        <Text style={styles.addBtnText}>Add Payment method</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <Text style={styles.sectionTitle}>Your Referral Stats</Text>

                    {/* Stats Row */}
                    <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
                        <StatsCard
                            title="Total Earnings"
                            value="$250.00"
                            icon={DollarSign}
                            iconBg="#000"
                            iconColor="#FFF"
                            isCompact={isCompact}
                        />
                        <StatsCard
                            title="Clicks"
                            value="120"
                            icon={MousePointerClick}
                            iconBg="#F3F4F6"
                            iconColor="#374151"
                            isCompact={isCompact}
                        />
                        <StatsCard
                            title="Total Referrals"
                            value="50"
                            icon={Users}
                            iconBg="#F3F4F6"
                            iconColor="#374151"
                            isCompact={isCompact}
                        />
                        <StatsCard
                            title="Next Payout"
                            value="$50.00"
                            icon={CreditCard}
                            iconBg="#F3F4F6"
                            iconColor="#374151"
                            isCompact={isCompact}
                        />
                    </View>

                    {/* Main Grid */}
                    <View style={[styles.gridRow, !isCompact && styles.gridRowTall, isCompact && styles.gridRowCompact]}>
                        {/* Left: Referral Chart Mock */}
                        <View style={[styles.card, isCompact && styles.cardCompact, !isCompact && { flex: 1.5 }]}>
                            <View style={[styles.cardHeader, isCompact && styles.cardHeaderCompact]}>
                                <Text style={styles.cardTitle}>Referral Overview</Text>
                                <TouchableOpacity style={styles.dropdownBtn}>
                                    <Text style={styles.dropdownText}>This week</Text>
                                    <ChevronDown size={14} color="#374151" />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.chartContainer, isCompact && styles.chartContainerCompact]}>
                                {/* Y-Axis Labels */}
                                <View style={styles.yAxis}>
                                    <Text style={styles.axisText}>25</Text>
                                    <Text style={styles.axisText}>20</Text>
                                    <Text style={styles.axisText}>15</Text>
                                    <Text style={styles.axisText}>10</Text>
                                    <Text style={styles.axisText}>5</Text>
                                    <Text style={styles.axisText}>0</Text>
                                </View>
                                {/* Chart Area */}
                                <View style={styles.graphArea}>
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />

                                    {/* Mock Line */}
                                    <View style={[styles.mockLine, isCompact && styles.mockLineCompact]} />

                                    {/* X-Axis Labels */}
                                    <View style={styles.xAxis}>
                                        <Text style={styles.axisText}>Mon</Text>
                                        <Text style={styles.axisText}>Tue</Text>
                                        <Text style={styles.axisText}>Wed</Text>
                                        <Text style={styles.axisText}>Thu</Text>
                                        <Text style={styles.axisText}>Fri</Text>
                                        <Text style={styles.axisText}>Sat</Text>
                                        <Text style={styles.axisText}>Sun</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Right: Payout History */}
                        <View style={[styles.card, isCompact && styles.cardCompact, !isCompact && { flex: 1 }]}>
                            <View style={[styles.cardHeader, isCompact && styles.cardHeaderCompact]}>
                                <Text style={styles.cardTitle}>Payout History</Text>
                            </View>
                            <View style={styles.historyList}>
                                <HistoryItem amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Pending" isCompact={isCompact} />
                                <HistoryItem amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                            </View>
                        </View>
                    </View>

                    {/* Invite Link Footer */}
                    <View style={styles.inviteSection}>
                        <Text style={styles.inviteTitle}>Invite a friend and earn up to $200</Text>
                        <Text style={styles.inviteSub}>
                            Earn $200 through our referral program./ Invite your friends and get $5 for each referral when they verify their account.
                        </Text>

                        <View style={[styles.copyRow, isCompact && styles.copyRowCompact]}>
                            <Text style={styles.copyLabel}>Referral Link</Text>
                            <View style={[styles.linkBox, isCompact && styles.linkBoxCompact]}>
                                <Text style={styles.linkText}>https://referral.syphor.com/wiz80/?referral_code=prugbol2120</Text>
                            </View>
                            <TouchableOpacity style={[styles.copyBtn, isCompact && styles.copyBtnCompact]}>
                                <Text style={styles.copyBtnText}>Copy</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>
            </View>
        </ResponsiveLayout>
    );
};

const StatsCard = ({ title, value, icon: Icon, iconBg, iconColor, isCompact }: any) => (
    <View style={[styles.statCard, isCompact && styles.statCardCompact]}>
        <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
            <Icon size={20} color={iconColor} />
        </View>
        <View>
            <Text style={styles.statTitle}>{title}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    </View>
);

const HistoryItem = ({ amount, date, status, isCompact }: any) => (
    <View style={[styles.historyItem, isCompact && styles.historyItemCompact]}>
        <Text style={[styles.histAmount, isCompact && styles.histAmountCompact]}>{amount}</Text>
        <Text style={[styles.histDate, isCompact && styles.histDateCompact]}>{date}</Text>
        <View style={[styles.badge, status === 'Pending' ? styles.badgePending : styles.badgePaid]}>
            <Text style={[styles.badgeText, status === 'Pending' ? styles.textPending : styles.textPaid]}>
                {status}
            </Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: 32,
    },
    containerCompact: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    headerCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    addBtn: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    addBtnCompact: {
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

    scrollContent: { paddingBottom: 40 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 16 },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 32,
    },
    statsRowCompact: {
        flexDirection: 'column',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statCardCompact: {
        width: '100%',
        flexBasis: '100%',
    },
    statIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    statTitle: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },

    // Grid
    gridRow: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 32,
    },
    gridRowTall: {
        height: 360,
    },
    gridRowCompact: {
        flexDirection: 'column',
        gap: 16,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardCompact: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    cardHeaderCompact: {
        alignItems: 'flex-start',
        flexDirection: 'column',
        gap: 8,
    },
    cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
    dropdownBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4, gap: 6 },
    dropdownText: { fontSize: 12, color: '#374151' },

    // Chart
    chartContainer: { flex: 1, flexDirection: 'row' },
    chartContainerCompact: {
        minHeight: 220,
    },
    yAxis: { justifyContent: 'space-between', paddingRight: 12, paddingBottom: 24 },
    axisText: { fontSize: 10, color: '#9CA3AF' },
    graphArea: { flex: 1, position: 'relative' },
    gridLine: {
        height: 1,
        backgroundColor: '#F3F4F6',
        width: '100%',
        marginBottom: (300 - 24) / 6 // approx spacing
    },
    gridLineCompact: {
        marginBottom: 20,
    },
    mockLine: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        height: 100,
        borderTopWidth: 2,
        borderColor: '#000',
        borderRadius: 100, // curve
        opacity: 0.2, // faint line for demo
    },
    mockLineCompact: {
        height: 70,
    },
    xAxis: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    // History
    historyList: { gap: 12 },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    historyItemCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
    },
    histAmount: { width: 80, fontSize: 13, fontWeight: '600', color: '#111827' },
    histAmountCompact: {
        width: 'auto',
    },
    histDate: { flex: 1, fontSize: 12, color: '#6B7280' },
    histDateCompact: {
        flex: 0,
    },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    badgePending: { backgroundColor: '#FEF3C7' },
    badgePaid: { backgroundColor: '#DCFCE7' },
    textPending: { fontSize: 10, color: '#D97706', fontWeight: '600' },
    textPaid: { fontSize: 10, color: '#166534', fontWeight: '600' },

    // Footer
    inviteSection: {
        marginTop: 8,
    },
    inviteTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
    inviteSub: { fontSize: 12, color: '#6B7280', marginBottom: 16 },
    copyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    copyRowCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    copyLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
    linkBox: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    linkBoxCompact: {
        width: '100%',
    },
    linkText: { fontSize: 12, color: '#6B7280' },
    copyBtn: { backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    copyBtnCompact: {
        width: '100%',
        alignItems: 'center',
    },
    copyBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

});

export default RewardsScreen;
