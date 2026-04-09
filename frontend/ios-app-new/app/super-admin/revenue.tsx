import React, { useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
    DollarSign,
    ShoppingBag,
    Megaphone,
    Users,
    ChevronDown,
    ChevronUp,
    User,
    TrendingUp,
    Layers,
} from 'lucide-react-native';

import { superAdminGet, getAuthUser } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import {
    GradientBackground,
    GlassHeader,
    GlassCard,
    GlassStatCard,
    GlassButton,
    GlassBadge,
} from '../../components/glass';

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = 'month' | '3months' | 'ytd' | 'all';

interface RevenueClient {
    id: string;
    name: string;
    marketplaceRevShare: number;
    marketingRevShare: number;
    totalIncome: number;
    assignedAgent?: string;
}

interface RevenueBySource {
    source: string;
    amount: number;
    percent: number;
}

interface RevenueData {
    totalIncome: number;
    marketplaceRevShare: number;
    marketingRevShare: number;
    activeClients: number;
    clients: RevenueClient[];
    bySource: RevenueBySource[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);

const PERIOD_LABELS: Record<Period, string> = {
    month: 'This Month',
    '3months': 'Last 3 Months',
    ytd: 'Year to Date',
    all: 'All Time',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {};

function sourceIcon(source: string, color: string) {
    const s = source.toLowerCase();
    if (s.includes('market')) return <ShoppingBag size={18} color={color} />;
    if (s.includes('market') || s.includes('spend')) return <Megaphone size={18} color={color} />;
    if (s.includes('sub')) return <Layers size={18} color={color} />;
    return <TrendingUp size={18} color={color} />;
}

const SOURCE_ACCENT: Record<string, string> = {
    Marketplace: 'rgba(59,130,246,0.85)',
    'Marketing Spend': 'rgba(168,85,247,0.85)',
    'Subscription Fees': 'rgba(34,197,94,0.85)',
};

function accentForSource(source: string): string {
    const key = Object.keys(SOURCE_ACCENT).find((k) =>
        source.toLowerCase().includes(k.toLowerCase())
    );
    return key ? SOURCE_ACCENT[key] : 'rgba(251,191,36,0.85)';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface PeriodPillsProps {
    value: Period;
    onChange: (p: Period) => void;
}

const PeriodPills = ({ value, onChange }: PeriodPillsProps) => {
    const { colors, mode } = useTheme();
    const periods: Period[] = ['month', '3months', 'ytd', 'all'];

    return (
        <View style={styles.pillRow}>
            {periods.map((p) => {
                const active = p === value;
                return (
                    <Pressable
                        key={p}
                        onPress={() => onChange(p)}
                        style={[
                            styles.pill,
                            {
                                backgroundColor: active
                                    ? mode === 'dark'
                                        ? 'rgba(59,130,246,0.70)'
                                        : 'rgba(59,130,246,0.90)'
                                    : colors.glassBg,
                                borderColor: active
                                    ? 'rgba(100,168,255,0.55)'
                                    : colors.glassBorder,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.pillText,
                                {
                                    color: active ? '#FFFFFF' : colors.textMuted,
                                    fontWeight: active ? '700' : '500',
                                },
                            ]}
                        >
                            {PERIOD_LABELS[p]}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

interface TabBarProps {
    active: 'client' | 'source';
    onSelect: (t: 'client' | 'source') => void;
}

const TabBar = ({ active, onSelect }: TabBarProps) => {
    const { colors, mode } = useTheme();

    return (
        <View style={[styles.tabBar, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            {(['client', 'source'] as const).map((tab) => {
                const isActive = tab === active;
                return (
                    <Pressable
                        key={tab}
                        onPress={() => onSelect(tab)}
                        style={[
                            styles.tabItem,
                            isActive && {
                                backgroundColor: mode === 'dark'
                                    ? 'rgba(255,255,255,0.12)'
                                    : 'rgba(255,255,255,0.90)',
                                borderColor: colors.glassBorder,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                {
                                    color: isActive ? colors.text : colors.textMuted,
                                    fontWeight: isActive ? '700' : '500',
                                },
                            ]}
                        >
                            {tab === 'client' ? 'By Client' : 'By Source'}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

interface ClientCardProps {
    client: RevenueClient;
}

const ClientCard = ({ client }: ClientCardProps) => {
    const { colors, mode } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const rotateAnim = React.useRef(new Animated.Value(0)).current;

    const toggle = useCallback(() => {
        const toValue = expanded ? 0 : 1;
        Animated.spring(rotateAnim, {
            toValue,
            useNativeDriver: true,
            tension: 200,
            friction: 14,
        }).start();
        setExpanded((prev) => !prev);
    }, [expanded]);

    const chevronRotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <GlassCard style={styles.clientCard}>
            <Pressable onPress={toggle} style={styles.clientRow}>
                {/* Avatar placeholder */}
                <View style={[styles.clientAvatar, { backgroundColor: 'rgba(59,130,246,0.20)' }]}>
                    <Text style={[styles.clientAvatarText, { color: '#93C5FD' }]}>
                        {client.name.charAt(0).toUpperCase()}
                    </Text>
                </View>

                <View style={styles.clientMeta}>
                    <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
                        {client.name}
                    </Text>
                    <Text style={[styles.clientTotal, { color: '#86EFAC' }]}>
                        {fmt(client.totalIncome)} total
                    </Text>
                </View>

                <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                    <ChevronDown size={18} color={colors.textMuted} />
                </Animated.View>
            </Pressable>

            {/* Quick row */}
            <View style={[styles.clientQuickRow, { borderTopColor: colors.glassBorder }]}>
                <View style={styles.clientQuickItem}>
                    <ShoppingBag size={12} color={'rgba(59,130,246,0.85)'} />
                    <Text style={[styles.clientQuickLabel, { color: colors.textMuted }]}>Marketplace</Text>
                    <Text style={[styles.clientQuickValue, { color: colors.text }]}>
                        {fmt(client.marketplaceRevShare)}
                    </Text>
                </View>
                <View style={[styles.clientQuickDivider, { backgroundColor: colors.glassBorder }]} />
                <View style={styles.clientQuickItem}>
                    <Megaphone size={12} color={'rgba(168,85,247,0.85)'} />
                    <Text style={[styles.clientQuickLabel, { color: colors.textMuted }]}>Marketing</Text>
                    <Text style={[styles.clientQuickValue, { color: colors.text }]}>
                        {fmt(client.marketingRevShare)}
                    </Text>
                </View>
            </View>

            {/* Expanded details */}
            {expanded && (
                <View style={[styles.clientExpanded, { borderTopColor: colors.glassBorder }]}>
                    <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: colors.textSubtle }]}>Client ID</Text>
                        <Text style={[styles.expandedValue, { color: colors.textMuted }]}>{client.id}</Text>
                    </View>

                    <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: colors.textSubtle }]}>Total Income</Text>
                        <Text style={[styles.expandedValue, { color: '#86EFAC', fontWeight: '700' }]}>
                            {fmt(client.totalIncome)}
                        </Text>
                    </View>

                    <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: colors.textSubtle }]}>Marketplace RevShare</Text>
                        <Text style={[styles.expandedValue, { color: colors.text }]}>
                            {fmt(client.marketplaceRevShare)}
                        </Text>
                    </View>

                    <View style={styles.expandedRow}>
                        <Text style={[styles.expandedLabel, { color: colors.textSubtle }]}>Marketing RevShare</Text>
                        <Text style={[styles.expandedValue, { color: colors.text }]}>
                            {fmt(client.marketingRevShare)}
                        </Text>
                    </View>

                    {client.assignedAgent ? (
                        <View style={styles.expandedRow}>
                            <Text style={[styles.expandedLabel, { color: colors.textSubtle }]}>Assigned Agent</Text>
                            <View style={styles.agentRow}>
                                <User size={13} color={colors.textMuted} />
                                <Text style={[styles.expandedValue, { color: colors.text }]}>
                                    {client.assignedAgent}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.expandedRow}>
                            <Text style={[styles.expandedLabel, { color: colors.textSubtle }]}>Assigned Agent</Text>
                            <GlassBadge label="Unassigned" variant="muted" />
                        </View>
                    )}
                </View>
            )}
        </GlassCard>
    );
};

interface SourceRowProps {
    item: RevenueBySource;
    totalIncome: number;
}

const SourceRow = ({ item }: SourceRowProps) => {
    const { colors, mode } = useTheme();
    const accent = accentForSource(item.source);
    const barWidth = `${Math.min(100, Math.max(0, item.percent))}%` as any;

    return (
        <GlassCard style={styles.sourceCard}>
            <View style={styles.sourceHeader}>
                <View style={[styles.sourceIconWrap, { backgroundColor: accent + '22' }]}>
                    {sourceIcon(item.source, accent.replace(/,[^,]+\)$/, ',1)'))}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sourceName, { color: colors.text }]}>{item.source}</Text>
                    <Text style={[styles.sourceAmount, { color: accent.replace(/,[^,]+\)$/, ',1)') }]}>
                        {fmt(item.amount)}
                    </Text>
                </View>
                <GlassBadge label={`${item.percent.toFixed(1)}%`} variant="info" />
            </View>

            {/* Progress bar */}
            <View style={[styles.barTrack, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                <View
                    style={[
                        styles.barFill,
                        {
                            width: barWidth,
                            backgroundColor: accent.replace(/,[^,]+\)$/, ',0.70)'),
                        },
                    ]}
                />
            </View>
        </GlassCard>
    );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SuperAdminRevenue() {
    const router = useRouter();
    const { colors, mode } = useTheme();

    const [period, setPeriod] = useState<Period>('month');
    const [activeTab, setActiveTab] = useState<'client' | 'source'>('client');

    // Auth guard
    const authQuery = useQuery({
        queryKey: ['auth-user-revenue'],
        queryFn: getAuthUser,
        staleTime: Infinity,
    });

    const revenueQuery = useQuery<RevenueData>({
        queryKey: ['super-admin', 'revenue', period],
        queryFn: async () => {
            const res = await superAdminGet(`/revenue?period=${period}`);
            // superAdminGet wraps in { data } or returns direct — handle both shapes
            return (res?.data ?? res) as RevenueData;
        },
        enabled: authQuery.data?.role === 'super_admin',
        staleTime: 60 * 1000,
    });

    const user = authQuery.data;
    const data = revenueQuery.data;
    const loading = revenueQuery.isLoading;
    const error = revenueQuery.error;

    // Access denied
    if (authQuery.isSuccess && user?.role !== 'super_admin') {
        return (
            <GradientBackground>
                <GlassHeader title="Revenue" onBack={() => router.back()} />
                <View style={styles.centeredBox}>
                    <Text style={[styles.accessTitle, { color: colors.text }]}>Access Denied</Text>
                    <Text style={[styles.accessSubtitle, { color: colors.textMuted }]}>
                        Only super admins can view revenue data.
                    </Text>
                    <GlassButton label="Go Back" onPress={() => router.back()} variant="secondary" />
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            {/* Header */}
            <GlassHeader
                title="Platform Revenue"
                subtitle={PERIOD_LABELS[period]}
                onBack={() => router.back()}
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Period Filter */}
                <PeriodPills value={period} onChange={setPeriod} />

                {/* Loading state */}
                {loading && (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                            Loading revenue data…
                        </Text>
                    </View>
                )}

                {/* Error state */}
                {!loading && error && (
                    <GlassCard style={styles.errorCard}>
                        <Text style={[styles.errorTitle, { color: colors.dangerText }]}>Failed to load</Text>
                        <Text style={[styles.errorBody, { color: colors.textMuted }]}>
                            {(error as Error)?.message ?? 'An unexpected error occurred.'}
                        </Text>
                        <GlassButton
                            label="Retry"
                            onPress={() => revenueQuery.refetch()}
                            variant="secondary"
                            size="sm"
                            style={{ marginTop: 12, alignSelf: 'flex-start' }}
                        />
                    </GlassCard>
                )}

                {/* Summary Stats */}
                {!loading && !error && data && (
                    <>
                        <View style={styles.statsGrid}>
                            <GlassStatCard
                                label="Total Platform Income"
                                value={fmt(data.totalIncome)}
                                icon={<DollarSign size={20} color="#86EFAC" />}
                                accent="rgba(34,197,94,0.85)"
                                style={styles.statFull}
                            />
                        </View>

                        <View style={styles.statsRow}>
                            <GlassStatCard
                                label="Marketplace RevShare"
                                value={fmt(data.marketplaceRevShare)}
                                icon={<ShoppingBag size={18} color="#93C5FD" />}
                                accent="rgba(59,130,246,0.85)"
                                style={styles.statHalf}
                            />
                            <GlassStatCard
                                label="Marketing RevShare"
                                value={fmt(data.marketingRevShare)}
                                icon={<Megaphone size={18} color="#C4B5FD" />}
                                accent="rgba(168,85,247,0.85)"
                                style={styles.statHalf}
                            />
                        </View>

                        <GlassStatCard
                            label="Active CU Clients"
                            value={data.activeClients}
                            icon={<Users size={20} color="#FCD34D" />}
                            accent="rgba(251,191,36,0.85)"
                            style={styles.statFull}
                        />

                        {/* Tabs */}
                        <TabBar active={activeTab} onSelect={setActiveTab} />

                        {/* By Client tab */}
                        {activeTab === 'client' && (
                            <View style={styles.tabContent}>
                                {data.clients.length === 0 ? (
                                    <GlassCard style={styles.emptyCard}>
                                        <Users size={28} color={colors.textSubtle} />
                                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                            No client data for this period.
                                        </Text>
                                    </GlassCard>
                                ) : (
                                    data.clients.map((client) => (
                                        <ClientCard key={client.id} client={client} />
                                    ))
                                )}
                            </View>
                        )}

                        {/* By Source tab */}
                        {activeTab === 'source' && (
                            <View style={styles.tabContent}>
                                {data.bySource.length === 0 ? (
                                    <GlassCard style={styles.emptyCard}>
                                        <TrendingUp size={28} color={colors.textSubtle} />
                                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                                            No source breakdown for this period.
                                        </Text>
                                    </GlassCard>
                                ) : (
                                    data.bySource.map((item, idx) => (
                                        <SourceRow key={`${item.source}-${idx}`} item={item} totalIncome={data.totalIncome} />
                                    ))
                                )}
                            </View>
                        )}
                    </>
                )}

                {/* Bottom padding */}
                <View style={{ height: 40 }} />
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
        padding: 16,
        gap: 14,
    },

    // Period pills
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    pillText: {
        fontSize: 13,
        letterSpacing: 0.2,
    },

    // Stat grid
    statsGrid: {
        gap: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statFull: {
        flex: 1,
    },
    statHalf: {
        flex: 1,
    },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        padding: 4,
        gap: 4,
        marginTop: 4,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    tabText: {
        fontSize: 14,
        letterSpacing: 0.1,
    },
    tabContent: {
        gap: 12,
    },

    // Client card
    clientCard: {
        padding: 0,
        overflow: 'hidden',
    },
    clientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    clientAvatar: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clientAvatarText: {
        fontSize: 18,
        fontWeight: '700',
    },
    clientMeta: {
        flex: 1,
        gap: 2,
    },
    clientName: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    clientTotal: {
        fontSize: 13,
        fontWeight: '600',
    },
    clientQuickRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 0,
    },
    clientQuickItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    clientQuickLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    clientQuickValue: {
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 2,
    },
    clientQuickDivider: {
        width: 1,
        marginHorizontal: 8,
    },
    clientExpanded: {
        borderTopWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
    },
    expandedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    expandedLabel: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    expandedValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    agentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },

    // Source card
    sourceCard: {
        padding: 14,
        gap: 12,
    },
    sourceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sourceIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceName: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    sourceAmount: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    barTrack: {
        height: 6,
        borderRadius: 3,
        borderWidth: 1,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 3,
    },

    // Loading / error / empty
    loadingBox: {
        alignItems: 'center',
        paddingVertical: 48,
        gap: 14,
    },
    loadingText: {
        fontSize: 14,
    },
    errorCard: {
        padding: 20,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    errorBody: {
        fontSize: 14,
        lineHeight: 20,
    },
    emptyCard: {
        alignItems: 'center',
        padding: 36,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },

    // Access denied
    centeredBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    accessTitle: {
        fontSize: 22,
        fontWeight: '700',
    },
    accessSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 8,
    },
});
