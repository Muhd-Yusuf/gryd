import React, { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
    DollarSign,
    TrendingUp,
    Users,
    ShoppingBag,
    Calendar,
    AlertCircle,
    ArrowUpRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
    GlassCard,
    GlassStatCard,
    GlassButton,
    GlassHeader,
    GradientBackground,
    GlassBadge,
} from '@/components/glass';
import { SafeBlurView as BlurView } from '@/components/SafeBlurView';
import { useTheme } from '@/lib/theme';
import { apiFetch } from '@/lib/api';
import { useCurrentUser } from '@/hooks/queries/useAuthQueries';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'month' | '3months' | 'all';

interface RevSharePartner {
    id: string;
    name: string;
    category: string;
    revenue: number;
    revShare: number;
    redemptions: number;
    lastActivity: string;
}

interface RevShareData {
    totalRevenue: number;
    totalRevShare: number;
    activePartners: number;
    totalRedemptions: number;
    partners: RevSharePartner[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string => {
    if (amount >= 1_000_000) {
        return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount >= 1_000) {
        return `$${(amount / 1_000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
};

const formatDate = (isoDate: string): string => {
    try {
        const d = new Date(isoDate);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return isoDate;
    }
};

const categoryBadgeVariant = (
    category: string,
): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' => {
    const lower = category.toLowerCase();
    if (lower.includes('retail') || lower.includes('shop')) return 'info';
    if (lower.includes('food') || lower.includes('dining')) return 'success';
    if (lower.includes('travel') || lower.includes('hotel')) return 'warning';
    if (lower.includes('health') || lower.includes('medical')) return 'danger';
    return 'default';
};

// ─── Period Filter Pill ───────────────────────────────────────────────────────

interface PeriodPillProps {
    label: string;
    active: boolean;
    onPress: () => void;
}

const PeriodPill: React.FC<PeriodPillProps> = ({ label, active, onPress }) => {
    const { colors, mode } = useTheme();

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
            <BlurView
                intensity={active ? colors.glassBlurIntensity : 18}
                tint={mode === 'dark' ? 'dark' : 'light'}
                style={[styles.pillBlur, active && styles.pillBlurActive]}
            >
                {active && (
                    <LinearGradient
                        colors={
                            mode === 'dark'
                                ? ['rgba(120,175,255,0.45)', 'rgba(59,130,246,0.30)']
                                : ['rgba(59,130,246,0.85)', 'rgba(37,99,235,0.75)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}
                {/* Top highlight */}
                <View style={styles.pillHighlight} />
                <Text
                    style={[
                        styles.pillLabel,
                        {
                            color: active
                                ? '#FFFFFF'
                                : colors.textMuted,
                            fontWeight: active ? '700' : '500',
                        },
                    ]}
                >
                    {label}
                </Text>
            </BlurView>
        </TouchableOpacity>
    );
};

// ─── Partner Row ──────────────────────────────────────────────────────────────

interface PartnerRowProps {
    partner: RevSharePartner;
    isLast: boolean;
}

const PartnerRow: React.FC<PartnerRowProps> = ({ partner, isLast }) => {
    const { colors } = useTheme();
    const revSharePct =
        partner.revenue > 0
            ? ((partner.revShare / partner.revenue) * 100).toFixed(1)
            : '0.0';

    return (
        <View
            style={[
                styles.partnerRow,
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
            ]}
        >
            {/* Partner name + category */}
            <View style={styles.partnerInfo}>
                <Text style={[styles.partnerName, { color: colors.text }]} numberOfLines={1}>
                    {partner.name}
                </Text>
                <GlassBadge
                    label={partner.category}
                    variant={categoryBadgeVariant(partner.category)}
                    style={styles.categoryBadge}
                />
            </View>

            {/* Revenue & RevShare */}
            <View style={styles.partnerMetrics}>
                <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>Revenue</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                        {formatCurrency(partner.revenue)}
                    </Text>
                </View>
                <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>RevShare</Text>
                    <View style={styles.revShareCell}>
                        <Text style={[styles.metricValue, { color: '#22C55E' }]}>
                            {formatCurrency(partner.revShare)}
                        </Text>
                        <Text style={[styles.revSharePct, { color: colors.textSubtle }]}>
                            {revSharePct}%
                        </Text>
                    </View>
                </View>
                <View style={styles.metricCol}>
                    <Text style={[styles.metricLabel, { color: colors.textSubtle }]}>Redeemed</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>
                        {partner.redemptions.toLocaleString()}
                    </Text>
                </View>
            </View>

            {/* Last activity */}
            <View style={styles.partnerFooter}>
                <Calendar size={12} color={colors.textSubtle} />
                <Text style={[styles.lastActivity, { color: colors.textSubtle }]}>
                    {formatDate(partner.lastActivity)}
                </Text>
            </View>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RevShareScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [period, setPeriod] = useState<Period>('month');

    // Auth guard
    const { data: currentUser, isLoading: authLoading } = useCurrentUser();

    const isAuthorized =
        currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

    // RevShare data query
    const {
        data: revShareData,
        isLoading: dataLoading,
        isError,
        refetch,
    } = useQuery<RevShareData>({
        queryKey: ['admin', 'revshare', period],
        queryFn: async () => {
            const result = await apiFetch(`/admin/revshare?period=${period}`);
            return result as RevShareData;
        },
        enabled: isAuthorized,
        staleTime: 5 * 60 * 1000,
    });

    const isLoading = authLoading || dataLoading;

    // ── Render: access denied ──────────────────────────────────────────────────
    if (!authLoading && !isAuthorized) {
        return (
            <GradientBackground>
                <GlassHeader title="Revenue Share" onBack={() => router.back()} />
                <View style={styles.centerState}>
                    <GlassCard style={styles.accessDeniedCard}>
                        <View style={styles.accessDeniedInner}>
                            <AlertCircle size={40} color={colors.dangerText} />
                            <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
                                Access Denied
                            </Text>
                            <Text style={[styles.accessDeniedMsg, { color: colors.textMuted }]}>
                                You need Admin or Super Admin privileges to view revenue share data.
                            </Text>
                            <GlassButton
                                label="Go Back"
                                variant="secondary"
                                onPress={() => router.back()}
                                style={{ marginTop: 8 }}
                            />
                        </View>
                    </GlassCard>
                </View>
            </GradientBackground>
        );
    }

    // ── Render: loading ────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <GradientBackground>
                <GlassHeader title="Revenue Share" onBack={() => router.back()} />
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                        Loading revenue data…
                    </Text>
                </View>
            </GradientBackground>
        );
    }

    // ── Render: error ──────────────────────────────────────────────────────────
    if (isError || !revShareData) {
        return (
            <GradientBackground>
                <GlassHeader title="Revenue Share" onBack={() => router.back()} />
                <View style={styles.centerState}>
                    <GlassCard style={styles.accessDeniedCard}>
                        <View style={styles.accessDeniedInner}>
                            <AlertCircle size={40} color={colors.dangerText} />
                            <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
                                Failed to Load
                            </Text>
                            <Text style={[styles.accessDeniedMsg, { color: colors.textMuted }]}>
                                Could not fetch revenue share data. Please try again.
                            </Text>
                            <GlassButton
                                label="Retry"
                                variant="primary"
                                onPress={() => refetch()}
                                style={{ marginTop: 8 }}
                            />
                        </View>
                    </GlassCard>
                </View>
            </GradientBackground>
        );
    }

    const { totalRevenue, totalRevShare, activePartners, totalRedemptions, partners } = revShareData;

    // ── Render: main ───────────────────────────────────────────────────────────
    return (
        <GradientBackground>
            <GlassHeader
                title="Revenue Share"
                subtitle="Marketplace earnings overview"
                onBack={() => router.back()}
                rightSlot={
                    <TouchableOpacity
                        onPress={() => refetch()}
                        style={[styles.refreshBtn, { backgroundColor: colors.glassBg }]}
                        activeOpacity={0.7}
                    >
                        <ArrowUpRight size={16} color={colors.icon} />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Period filter ─────────────────────────────────────── */}
                <GlassCard style={styles.filterCard}>
                    <View style={styles.filterInner}>
                        <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
                            Date Range
                        </Text>
                        <View style={styles.pillRow}>
                            <PeriodPill
                                label="This Month"
                                active={period === 'month'}
                                onPress={() => setPeriod('month')}
                            />
                            <PeriodPill
                                label="Last 3 Months"
                                active={period === '3months'}
                                onPress={() => setPeriod('3months')}
                            />
                            <PeriodPill
                                label="All Time"
                                active={period === 'all'}
                                onPress={() => setPeriod('all')}
                            />
                        </View>
                    </View>
                </GlassCard>

                {/* ── Summary stats ─────────────────────────────────────── */}
                <View style={styles.statsGrid}>
                    <GlassStatCard
                        label="Total Revenue"
                        value={formatCurrency(totalRevenue)}
                        icon={<DollarSign size={20} color="#3B82F6" />}
                        accent="rgba(59,130,246,0.85)"
                        style={styles.statCard}
                    />
                    <GlassStatCard
                        label="RevShare Earned"
                        value={formatCurrency(totalRevShare)}
                        icon={<TrendingUp size={20} color="#22C55E" />}
                        accent="rgba(34,197,94,0.85)"
                        style={styles.statCard}
                    />
                </View>

                <View style={styles.statsGrid}>
                    <GlassStatCard
                        label="Active Partners"
                        value={activePartners}
                        icon={<Users size={20} color="#A78BFA" />}
                        accent="rgba(167,139,250,0.85)"
                        style={styles.statCard}
                    />
                    <GlassStatCard
                        label="Redemptions"
                        value={totalRedemptions.toLocaleString()}
                        icon={<ShoppingBag size={20} color="#F59E0B" />}
                        accent="rgba(245,158,11,0.85)"
                        style={styles.statCard}
                    />
                </View>

                {/* ── Partner breakdown ─────────────────────────────────── */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Partner Breakdown
                    </Text>
                    <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
                        {partners.length} partner{partners.length !== 1 ? 's' : ''}
                    </Text>
                </View>

                {partners.length === 0 ? (
                    <GlassCard style={styles.emptyCard}>
                        <View style={styles.emptyInner}>
                            <ShoppingBag size={36} color={colors.textSubtle} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                No partner data for this period
                            </Text>
                        </View>
                    </GlassCard>
                ) : (
                    <GlassCard style={styles.partnerTableCard}>
                        {/* Table header */}
                        <View style={[styles.tableHeader, { borderBottomColor: colors.glassBorder }]}>
                            <Text style={[styles.tableHeaderText, { color: colors.textSubtle }]}>
                                PARTNER / CATEGORY
                            </Text>
                            <Text style={[styles.tableHeaderTextRight, { color: colors.textSubtle }]}>
                                REV · SHARE · REDEEMED
                            </Text>
                        </View>

                        {partners.map((partner, index) => (
                            <PartnerRow
                                key={partner.id}
                                partner={partner}
                                isLast={index === partners.length - 1}
                            />
                        ))}
                    </GlassCard>
                )}

                {/* Bottom spacer */}
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </GradientBackground>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
        gap: 14,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        marginTop: 8,
    },

    // Refresh button
    refreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Access denied
    accessDeniedCard: {
        width: '100%',
        maxWidth: 360,
    },
    accessDeniedInner: {
        padding: 28,
        alignItems: 'center',
        gap: 12,
    },
    accessDeniedTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    accessDeniedMsg: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Period filter
    filterCard: {
        marginBottom: 2,
    },
    filterInner: {
        padding: 16,
        gap: 10,
    },
    filterLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    pillBlur: {
        borderRadius: 20,
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        position: 'relative',
    },
    pillBlurActive: {
        borderColor: 'rgba(100,168,255,0.55)',
    },
    pillHighlight: {
        position: 'absolute',
        top: 0,
        left: 8,
        right: 8,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.40)',
        borderRadius: 1,
    },
    pillLabel: {
        fontSize: 13,
        letterSpacing: 0.2,
    },

    // Stats
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
    },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 2,
        paddingHorizontal: 2,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    sectionCount: {
        fontSize: 13,
    },

    // Partner table
    partnerTableCard: {
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    tableHeaderText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    tableHeaderTextRight: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    // Partner row
    partnerRow: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 8,
    },
    partnerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    partnerName: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        minWidth: 100,
    },
    categoryBadge: {
        flexShrink: 0,
    },
    partnerMetrics: {
        flexDirection: 'row',
        gap: 0,
        justifyContent: 'space-between',
    },
    metricCol: {
        flex: 1,
        gap: 2,
    },
    metricLabel: {
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    revShareCell: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    revSharePct: {
        fontSize: 11,
        fontWeight: '500',
    },
    partnerFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    lastActivity: {
        fontSize: 12,
    },

    // Empty state
    emptyCard: {},
    emptyInner: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
    },

    // Bottom
    bottomSpacer: {
        height: 24,
    },
});
