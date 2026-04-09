import React, { useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import {
    Plus,
    DollarSign,
    MousePointerClick,
    Users,
    CreditCard,
    ChevronDown
} from 'lucide-react-native';
import ResponsiveLayout from '../../components/ResponsiveLayout';
import { useTheme } from '../../lib/theme';

const RewardsScreen = () => {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const s = useMemo(() => createStyles(colors), [colors]);
    const gridLineStyle = isCompact ? [s.gridLine, s.gridLineCompact] : s.gridLine;

    return (
        <ResponsiveLayout>
            <View style={[s.container, isCompact && s.containerCompact]}>
                {/* Header */}
                <View style={[s.header, isCompact && s.headerCompact]}>
                    <Text style={s.pageTitle}>Affiliate Program</Text>
                    <TouchableOpacity style={[s.addBtn, isCompact && s.addBtnCompact]}>
                        <Plus size={16} color="#FFF" />
                        <Text style={s.addBtnText}>Add Payment method</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

                    <Text style={s.sectionTitle}>Your Referral Stats</Text>

                    {/* Stats Row */}
                    <View style={[s.statsRow, isCompact && s.statsRowCompact]}>
                        <StatsCard
                            colors={colors}
                            title="Total Earnings"
                            value="$250.00"
                            icon={DollarSign}
                            iconBg={colors.primary}
                            iconColor="#FFF"
                            isCompact={isCompact}
                        />
                        <StatsCard
                            colors={colors}
                            title="Clicks"
                            value="120"
                            icon={MousePointerClick}
                            iconBg={colors.glassBg}
                            iconColor={colors.text}
                            isCompact={isCompact}
                        />
                        <StatsCard
                            colors={colors}
                            title="Total Referrals"
                            value="50"
                            icon={Users}
                            iconBg={colors.glassBg}
                            iconColor={colors.text}
                            isCompact={isCompact}
                        />
                        <StatsCard
                            colors={colors}
                            title="Next Payout"
                            value="$50.00"
                            icon={CreditCard}
                            iconBg={colors.glassBg}
                            iconColor={colors.text}
                            isCompact={isCompact}
                        />
                    </View>

                    {/* Main Grid */}
                    <View style={[s.gridRow, !isCompact && s.gridRowTall, isCompact && s.gridRowCompact]}>
                        {/* Left: Referral Chart Mock */}
                        <View style={[s.card, isCompact && s.cardCompact, !isCompact && { flex: 1.5 }]}>
                            <View style={[s.cardHeader, isCompact && s.cardHeaderCompact]}>
                                <Text style={s.cardTitle}>Referral Overview</Text>
                                <TouchableOpacity style={s.dropdownBtn}>
                                    <Text style={s.dropdownText}>This week</Text>
                                    <ChevronDown size={14} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={[s.chartContainer, isCompact && s.chartContainerCompact]}>
                                {/* Y-Axis Labels */}
                                <View style={s.yAxis}>
                                    <Text style={s.axisText}>25</Text>
                                    <Text style={s.axisText}>20</Text>
                                    <Text style={s.axisText}>15</Text>
                                    <Text style={s.axisText}>10</Text>
                                    <Text style={s.axisText}>5</Text>
                                    <Text style={s.axisText}>0</Text>
                                </View>
                                {/* Chart Area */}
                                <View style={s.graphArea}>
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />
                                    <View style={gridLineStyle} />

                                    {/* Mock Line */}
                                    <View style={[s.mockLine, isCompact && s.mockLineCompact]} />

                                    {/* X-Axis Labels */}
                                    <View style={s.xAxis}>
                                        <Text style={s.axisText}>Mon</Text>
                                        <Text style={s.axisText}>Tue</Text>
                                        <Text style={s.axisText}>Wed</Text>
                                        <Text style={s.axisText}>Thu</Text>
                                        <Text style={s.axisText}>Fri</Text>
                                        <Text style={s.axisText}>Sat</Text>
                                        <Text style={s.axisText}>Sun</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Right: Payout History */}
                        <View style={[s.card, isCompact && s.cardCompact, !isCompact && { flex: 1 }]}>
                            <View style={[s.cardHeader, isCompact && s.cardHeaderCompact]}>
                                <Text style={s.cardTitle}>Payout History</Text>
                            </View>
                            <View style={s.historyList}>
                                <HistoryItem colors={colors} amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Pending" isCompact={isCompact} />
                                <HistoryItem colors={colors} amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem colors={colors} amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem colors={colors} amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem colors={colors} amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                                <HistoryItem colors={colors} amount="$50.00" date="10 Nov 2025, 11:48 AM" status="Paid" isCompact={isCompact} />
                            </View>
                        </View>
                    </View>

                    {/* Invite Link Footer */}
                    <View style={s.inviteSection}>
                        <Text style={s.inviteTitle}>Invite a friend and earn up to $200</Text>
                        <Text style={s.inviteSub}>
                            Earn $200 through our referral program./ Invite your friends and get $5 for each referral when they verify their account.
                        </Text>

                        <View style={[s.copyRow, isCompact && s.copyRowCompact]}>
                            <Text style={s.copyLabel}>Referral Link</Text>
                            <View style={[s.linkBox, isCompact && s.linkBoxCompact]}>
                                <Text style={s.linkText}>https://referral.syphor.com/wiz80/?referral_code=prugbol2120</Text>
                            </View>
                            <TouchableOpacity style={[s.copyBtn, isCompact && s.copyBtnCompact]}>
                                <Text style={s.copyBtnText}>Copy</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>
            </View>
        </ResponsiveLayout>
    );
};

const StatsCard = ({ title, value, icon: Icon, iconBg, iconColor, isCompact, colors }: any) => {
    const s = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={[s.statCard, isCompact && s.statCardCompact]}>
            <View style={[s.statIcon, { backgroundColor: iconBg }]}>
                <Icon size={20} color={iconColor} />
            </View>
            <View>
                <Text style={s.statTitle}>{title}</Text>
                <Text style={s.statValue}>{value}</Text>
            </View>
        </View>
    );
};

const HistoryItem = ({ amount, date, status, isCompact, colors }: any) => {
    const s = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={[s.historyItem, isCompact && s.historyItemCompact]}>
            <Text style={[s.histAmount, isCompact && s.histAmountCompact]}>{amount}</Text>
            <Text style={[s.histDate, isCompact && s.histDateCompact]}>{date}</Text>
            <View style={[s.badge, status === 'Pending' ? s.badgePending : s.badgePaid]}>
                <Text style={[s.badgeText, status === 'Pending' ? s.textPending : s.textPaid]}>
                    {status}
                </Text>
            </View>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
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
        color: colors.text,
    },
    addBtn: {
        backgroundColor: colors.primary,
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
    addBtnText: { color: colors.primaryText, fontWeight: 'bold', fontSize: 13 },

    scrollContent: { paddingBottom: 40 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 16 },

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
        backgroundColor: colors.glassBg,
        borderRadius: 12,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    statCardCompact: {
        width: '100%',
        flexBasis: '100%',
    },
    statIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    statTitle: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold', color: colors.text },

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
        backgroundColor: colors.glassBg,
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.glassBorder,
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
    cardTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text },
    dropdownBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
        gap: 6,
        backgroundColor: colors.glassBg,
    },
    dropdownText: { fontSize: 12, color: colors.textMuted },

    // Chart
    chartContainer: { flex: 1, flexDirection: 'row' },
    chartContainerCompact: {
        minHeight: 220,
    },
    yAxis: { justifyContent: 'space-between', paddingRight: 12, paddingBottom: 24 },
    axisText: { fontSize: 10, color: colors.textSubtle },
    graphArea: { flex: 1, position: 'relative' },
    gridLine: {
        height: 1,
        backgroundColor: colors.glassBorder,
        width: '100%',
        marginBottom: (300 - 24) / 6,
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
        borderColor: colors.primary,
        borderRadius: 100,
        opacity: 0.4,
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
        borderBottomColor: colors.glassBorder,
    },
    historyItemCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
    },
    histAmount: { width: 80, fontSize: 13, fontWeight: '600', color: colors.text },
    histAmountCompact: {
        width: 'auto',
    },
    histDate: { flex: 1, fontSize: 12, color: colors.textMuted },
    histDateCompact: {
        flex: 0,
    },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
    badgePaid: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
    textPending: { fontSize: 10, color: '#F59E0B', fontWeight: '600' },
    textPaid: { fontSize: 10, color: '#22C55E', fontWeight: '600' },

    // Footer
    inviteSection: {
        marginTop: 8,
    },
    inviteTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    inviteSub: { fontSize: 12, color: colors.textMuted, marginBottom: 16 },
    copyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    copyRowCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    copyLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    linkBox: {
        flex: 1,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    linkBoxCompact: {
        width: '100%',
    },
    linkText: { fontSize: 12, color: colors.textMuted },
    copyBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    copyBtnCompact: {
        width: '100%',
        alignItems: 'center',
    },
    copyBtnText: { color: colors.primaryText, fontSize: 12, fontWeight: 'bold' },
});

export default RewardsScreen;
