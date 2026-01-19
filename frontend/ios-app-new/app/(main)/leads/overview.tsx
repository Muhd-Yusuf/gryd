import React, { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Image,
    useWindowDimensions
} from 'react-native';
import {
    MoreHorizontal,
    TrendingUp,
    TrendingDown
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type Lead = {
    _id: string;
    status?: string;
    source?: string;
    createdAt?: string;
};

type Task = {
    _id: string;
    status?: string;
    createdAt?: string;
};

type Campaign = {
    _id: string;
    status?: string;
    createdAt?: string;
};

type Property = {
    _id: string;
    title?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    price?: number;
    status?: string;
    images?: string[];
    createdAt?: string;
    updatedAt?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const buildLastNDays = (days: number) => {
    const today = startOfDay(new Date());
    return Array.from({ length: days }, (_, index) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (days - 1 - index));
        return day;
    });
};

const formatDayLabel = (date: Date) =>
    date.toLocaleDateString('en-US', {
        weekday: 'short',
    });

const formatCurrency = (value?: number) => {
    const amount = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `$${Math.round(amount).toLocaleString()}`;
    }
};

const percentChange = (current: number, previous: number) => {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }
    return Math.round(((current - previous) / previous) * 100);
};

const LeadOverviewScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const [tenantId, setTenantId] = useState(getTenantId());
    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let isActive = true;
        resolveTenantId()
            .then((id) => {
                if (isActive) {
                    setTenantId(id || '');
                }
            })
            .catch((err) => {
                if (isActive) {
                    setError(err.message || 'Failed to resolve tenant.');
                }
            });
        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        const loadOverview = async () => {
            if (!tenantId) return;
            setLoading(true);
            setError('');
            try {
                const [leadsRes, tasksRes, campaignsRes, propertiesRes] = await Promise.all([
                    apiFetch(`/crm/tenants/${tenantId}/leads`),
                    apiFetch(`/crm/tenants/${tenantId}/tasks`),
                    apiFetch(`/crm/tenants/${tenantId}/campaigns`),
                    apiFetch(`/properties/tenants/${tenantId}/properties`),
                ]);
                setLeads(leadsRes?.data || []);
                setTasks(tasksRes?.data || []);
                setCampaigns(campaignsRes?.data || []);
                setProperties(propertiesRes?.data || []);
            } catch (err: any) {
                setError(err.message || 'Failed to load overview.');
            } finally {
                setLoading(false);
            }
        };

        loadOverview();
    }, [tenantId]);

    const today = useMemo(() => startOfDay(new Date()), []);
    const last7Days = useMemo(() => buildLastNDays(7), []);

    const leadTotals = useMemo(() => {
        const total = leads.length;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const leadThisMonth = leads.filter((lead) => {
            const created = parseDate(lead.createdAt);
            return created ? created >= monthStart : false;
        }).length;
        const leadLastMonth = leads.filter((lead) => {
            const created = parseDate(lead.createdAt);
            return created ? created >= prevMonthStart && created < monthStart : false;
        }).length;
        return {
            total,
            leadThisMonth,
            leadLastMonth,
        };
    }, [leads]);

    const taskTotals = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter((task) => task.status === 'completed').length;
        return {
            total,
            completed,
            completionRate: total ? Math.round((completed / total) * 100) : 0,
        };
    }, [tasks]);

    const campaignTotals = useMemo(() => {
        const total = campaigns.length;
        const active = campaigns.filter((campaign) => campaign.status === 'active').length;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const currentMonth = campaigns.filter((campaign) => {
            const created = parseDate(campaign.createdAt);
            return created ? created >= monthStart : false;
        }).length;
        const lastMonth = campaigns.filter((campaign) => {
            const created = parseDate(campaign.createdAt);
            return created ? created >= prevMonthStart && created < monthStart : false;
        }).length;
        return {
            total,
            active,
            currentMonth,
            lastMonth,
        };
    }, [campaigns]);

    const leadDailyBuckets = useMemo(() => {
        const buckets = last7Days.map(() => ({
            nurturing: 0,
            activeBuyer: 0,
            closed: 0,
            total: 0,
        }));
        const todayStart = startOfDay(new Date());
        leads.forEach((lead) => {
            const created = parseDate(lead.createdAt);
            if (!created) return;
            const dayIndex = Math.floor((todayStart.getTime() - startOfDay(created).getTime()) / MS_PER_DAY);
            if (dayIndex < 0 || dayIndex > 6) return;
            const bucketIndex = 6 - dayIndex;
            const bucket = buckets[bucketIndex];
            bucket.total += 1;
            if (lead.status === 'nurturing') {
                bucket.nurturing += 1;
            } else if (lead.status === 'active_buyer') {
                bucket.activeBuyer += 1;
            } else if (lead.status === 'closed') {
                bucket.closed += 1;
            }
        });
        return buckets;
    }, [last7Days, leads]);

    const leadDailyTotals = useMemo(
        () => leadDailyBuckets.map((bucket) => bucket.total),
        [leadDailyBuckets]
    );

    const taskDailyTotals = useMemo(() => {
        const totals = last7Days.map(() => 0);
        const todayStart = startOfDay(new Date());
        tasks.forEach((task) => {
            const created = parseDate(task.createdAt);
            if (!created) return;
            const dayIndex = Math.floor((todayStart.getTime() - startOfDay(created).getTime()) / MS_PER_DAY);
            if (dayIndex < 0 || dayIndex > 6) return;
            const bucketIndex = 6 - dayIndex;
            totals[bucketIndex] += 1;
        });
        return totals;
    }, [last7Days, tasks]);

    const leadSources = useMemo(() => {
        if (!leads.length) return [];
        const counts: Record<string, number> = {};
        leads.forEach((lead) => {
            const source = (lead.source || 'Unknown').trim() || 'Unknown';
            counts[source] = (counts[source] || 0) + 1;
        });
        const total = leads.length || 1;
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([label, count]) => ({
                label,
                count,
                percent: Math.round((count / total) * 100),
            }));
    }, [leads]);

    const topProperty = useMemo(() => {
        if (!properties.length) return null;
        return [...properties].sort((a, b) => {
            const priceDelta = (b.price || 0) - (a.price || 0);
            if (priceDelta !== 0) return priceDelta;
            const dateA = parseDate(a.updatedAt || a.createdAt)?.getTime() || 0;
            const dateB = parseDate(b.updatedAt || b.createdAt)?.getTime() || 0;
            return dateB - dateA;
        })[0];
    }, [properties]);

    const pipelineStatuses = useMemo(() => ['nurturing', 'active_buyer', 'closed'], []);
    const pipelineCount = useMemo(
        () => leads.filter((lead) => pipelineStatuses.includes(lead.status || 'new')).length,
        [leads, pipelineStatuses]
    );

    const leadWeekStats = useMemo(() => {
        const currentEnd = new Date(today);
        currentEnd.setDate(today.getDate() + 1);
        const currentStart = new Date(today);
        currentStart.setDate(today.getDate() - 6);
        const prevEnd = new Date(currentStart);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevEnd.getDate() - 7);

        const countInRange = (start: Date, end: Date, statuses?: string[]) =>
            leads.filter((lead) => {
                const created = parseDate(lead.createdAt);
                if (!created) return false;
                if (created < start || created >= end) return false;
                if (statuses && !statuses.includes(lead.status || 'new')) return false;
                return true;
            }).length;

        const currentWeek = countInRange(currentStart, currentEnd);
        const prevWeek = countInRange(prevStart, prevEnd);
        const pipelineCurrent = countInRange(currentStart, currentEnd, pipelineStatuses);
        const pipelinePrev = countInRange(prevStart, prevEnd, pipelineStatuses);

        return {
            currentWeek,
            prevWeek,
            pipelineCurrent,
            pipelinePrev,
        };
    }, [leads, pipelineStatuses, today]);

    const leadTrend = percentChange(leadWeekStats.currentWeek, leadWeekStats.prevWeek);
    const pipelineTrend = percentChange(leadWeekStats.pipelineCurrent, leadWeekStats.pipelinePrev);
    const campaignTrend = percentChange(campaignTotals.currentMonth, campaignTotals.lastMonth);

    const maxLeadBucket = Math.max(
        1,
        ...leadDailyBuckets.map((bucket) => Math.max(bucket.nurturing, bucket.activeBuyer, bucket.closed))
    );
    const maxLeadDailyTotal = Math.max(1, ...leadDailyTotals);
    const maxTaskDailyTotal = Math.max(1, ...taskDailyTotals);

    const getBarHeight = (value: number, max: number, maxHeight: number) => {
        if (max <= 0) return 4;
        return Math.max(6, Math.round((value / max) * maxHeight));
    };

    const propertyAddress = topProperty
        ? [topProperty.addressLine1, topProperty.city, topProperty.state].filter(Boolean).join(', ')
        : '';

    return (
        <ResponsiveLayout>
            <View style={[styles.container, isCompact && styles.containerCompact]}>
                <View style={styles.header}>
                    <Text style={styles.pageTitle}>Overview</Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    {loading ? <Text style={styles.helperText}>Loading overview...</Text> : null}

                    {/* Top Stats Row */}
                    <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
                        {/* Leads Chart Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Total Leads</Text>
                                <TouchableOpacity><MoreHorizontal size={16} color="#9CA3AF" /></TouchableOpacity>
                            </View>
                            <View style={styles.pieStats}>
                                <View style={styles.pieChartMock}>
                                    <Text style={styles.pieCenterText}>{leadTotals.leadThisMonth}/{leadTotals.total}</Text>
                                    <Text style={styles.pieCenterSub}>This Month</Text>
                                </View>
                                <View style={styles.legend}>
                                    {[
                                        { label: 'Nurturing', value: leads.filter((lead) => lead.status === 'nurturing').length, color: '#F59E0B' },
                                        { label: 'Active Buyer', value: leads.filter((lead) => lead.status === 'active_buyer').length, color: '#A855F7' },
                                        { label: 'Closed Won', value: leads.filter((lead) => lead.status === 'closed').length, color: '#22C55E' },
                                    ].map((item) => (
                                        <View key={item.label} style={styles.legendItem}>
                                            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                                            <Text style={styles.legendLabel}>{item.label}</Text>
                                            <Text style={styles.legendValue}>{item.value}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Revenue Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Active Campaigns</Text>
                                <View style={campaignTrend >= 0 ? styles.badgeGreen : styles.badgeRed}>
                                    {campaignTrend >= 0 ? <TrendingUp size={12} color="green" /> : <TrendingDown size={12} color="red" />}
                                    <Text style={campaignTrend >= 0 ? styles.badgeTextGreen : styles.badgeTextRed}>
                                        {campaignTrend >= 0 ? '+' : ''}{campaignTrend}%
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.bigValue}>{campaignTotals.active}</Text>
                            <Text style={styles.subText}>{campaignTotals.total} total campaigns</Text>
                            <View style={styles.sparkLine}>
                                {leadDailyTotals.map((value, index) => (
                                    <View
                                        key={`campaign-spark-${index}`}
                                        style={[
                                            styles.sparkBar,
                                            { height: getBarHeight(value, maxLeadDailyTotal, 48) },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Task Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Lead Task</Text>
                                <TouchableOpacity><Text style={styles.linkText}>Month</Text></TouchableOpacity>
                            </View>
                            <Text style={styles.bigValue}>{taskTotals.total} Tasks</Text>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${taskTotals.completionRate}%` }]} />
                            </View>
                            <Text style={styles.subText}>{taskTotals.completionRate}% completed</Text>
                        </View>
                    </View>

                    {/* Middle Row */}
                    <View style={[styles.middleRow, isCompact && styles.middleRowCompact]}>
                        {/* Deals - Funnel Chart */}
                        <View style={[styles.card, { flex: 2 }]}>
                            <View style={styles.cardHeader}>
                                <View style={styles.titleRow}>
                                    <Text style={styles.cardTitle}>{pipelineCount} Leads in Pipeline</Text>
                                    <View style={pipelineTrend >= 0 ? styles.badgeGreen : styles.badgeRed}>
                                        {pipelineTrend >= 0 ? <TrendingUp size={12} color="green" /> : <TrendingDown size={12} color="red" />}
                                        <Text style={pipelineTrend >= 0 ? styles.badgeTextGreen : styles.badgeTextRed}>
                                            {pipelineTrend >= 0 ? '+' : ''}{pipelineTrend}%
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.legendRow}>
                                    <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>Nurturing</Text>
                                    <View style={[styles.dot, { backgroundColor: '#A855F7' }]} /><Text style={styles.legendText}>Active Buyer</Text>
                                    <View style={[styles.dot, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendText}>Closed Won</Text>
                                </View>
                            </View>

                            <View style={styles.barChartContainer}>
                                {leadDailyBuckets.map((bucket, i) => (
                                    <View key={i} style={styles.barGroup}>
                                        <View style={[styles.bar, { height: getBarHeight(bucket.nurturing, maxLeadBucket, 140), backgroundColor: '#F59E0B' }]} />
                                        <View style={[styles.bar, { height: getBarHeight(bucket.activeBuyer, maxLeadBucket, 140), backgroundColor: '#A855F7' }]} />
                                        <View style={[styles.bar, { height: getBarHeight(bucket.closed, maxLeadBucket, 140), backgroundColor: '#22C55E' }]} />
                                        <Text style={styles.barLabel}>{formatDayLabel(last7Days[i])}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Property Card */}
                        <View style={[styles.card, { flex: 1 }]}> 
                            <Text style={styles.cardTitle}>Top performing Property</Text>
                            {topProperty ? (
                                <>
                                    {topProperty.images?.[0] ? (
                                        <Image
                                            source={{ uri: topProperty.images[0] }}
                                            style={styles.propImage}
                                        />
                                    ) : (
                                        <View style={styles.propImagePlaceholder}>
                                            <Text style={styles.subText}>No image</Text>
                                        </View>
                                    )}
                                    <Text style={styles.propName}>{topProperty.title || propertyAddress || 'Untitled Property'}</Text>
                                    <Text style={styles.bigValue}>{formatCurrency(topProperty.price)}</Text>
                                    <Text style={styles.propMeta}>{propertyAddress || topProperty.status || 'No address on file'}</Text>
                                </>
                            ) : (
                                <View style={styles.propEmpty}>
                                    <Text style={styles.subText}>No properties yet</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Bottom Row */}
                    <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
                        {/* Money Value Chart */}
                        <View style={[styles.card, { flex: 1 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.bigValue}>{leadWeekStats.currentWeek}</Text>
                                <View style={leadTrend >= 0 ? styles.badgeGreen : styles.badgeRed}><Text style={leadTrend >= 0 ? styles.badgeTextGreen : styles.badgeTextRed}>{leadTrend >= 0 ? '+' : ''}{leadTrend}%</Text></View>
                            </View>
                            <Text style={styles.subText}>Leads created this week</Text>
                            <View style={styles.miniBars}>
                                {leadDailyTotals.map((value, index) => (
                                    <View
                                        key={`lead-mini-${index}`}
                                        style={[
                                            styles.miniBar,
                                            { height: getBarHeight(value, maxLeadDailyTotal, 60) },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Lead Source */}
                        <View style={[styles.card, { flex: 1 }]}>
                            <Text style={styles.bigValue}>{leadTotals.total}</Text>
                            <Text style={styles.subText}>Top lead sources</Text>
                            {leadSources.length === 0 ? (
                                <Text style={styles.helperText}>No lead sources yet</Text>
                            ) : (
                                leadSources.map((source) => (
                                    <View key={source.label} style={styles.horzBar}>
                                        <Text style={styles.barLabelLeft}>{source.label}</Text>
                                        <View style={[styles.barFill, { width: `${source.percent}%` }]} />
                                        <Text style={styles.barValue}>{source.count}</Text>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Task List */}
                        <View style={[styles.card, { flex: 1 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{taskTotals.total} Tasks</Text>
                                <TouchableOpacity><Text style={styles.linkText}>View All</Text></TouchableOpacity>
                            </View>
                            {/* Bar Chart Mock for Tasks */}
                            <View style={styles.barChartContainerSmall}>
                                {taskDailyTotals.map((value, i) => (
                                    <View
                                        key={`task-mini-${i}`}
                                        style={[
                                            styles.bar,
                                            { height: getBarHeight(value, maxTaskDailyTotal, 60), backgroundColor: '#000', width: 6 },
                                        ]}
                                    />
                                ))}
                            </View>
                            <Text style={styles.subText}>{taskTotals.completed} completed</Text>
                        </View>
                    </View>

                </ScrollView>
            </View>
        </ResponsiveLayout>
    );
};

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
        marginBottom: 24,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        marginBottom: 8,
    },
    helperText: {
        color: '#6B7280',
        fontSize: 12,
        marginBottom: 8,
    },
    scrollContent: {
        paddingBottom: 40,
        gap: 24,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 24,
    },
    statsRowCompact: {
        flexDirection: 'column',
        gap: 16,
    },
    middleRow: {
        flexDirection: 'row',
        gap: 24,
        height: 380,
    },
    middleRowCompact: {
        flexDirection: 'column',
        height: 'auto',
        gap: 16,
    },
    card: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    bigValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginVertical: 8,
    },
    subText: {
        fontSize: 12,
        color: '#6B7280',
    },
    linkText: {
        fontSize: 12,
        color: '#6B7280',
        textDecorationLine: 'underline',
    },

    // Badges
    badgeGreen: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    badgeTextGreen: { color: '#166534', fontSize: 11, fontWeight: 'bold' },
    badgeRed: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    badgeTextRed: { color: '#B91C1C', fontSize: 11, fontWeight: 'bold' },

    // Pie Chart Mock
    pieStats: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 120,
    },
    pieChartMock: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 8,
        borderColor: '#000',
        borderLeftColor: '#E5E7EB', // Simulating segment
        justifyContent: 'center',
        alignItems: 'center',
    },
    pieCenterText: { fontWeight: 'bold', fontSize: 14 },
    pieCenterSub: { fontSize: 10, color: '#6B7280' },
    legend: {
        marginTop: 12,
        gap: 6,
        alignSelf: 'stretch',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontSize: 11,
        color: '#6B7280',
        flex: 1,
    },
    legendValue: {
        fontSize: 11,
        color: '#111827',
        fontWeight: '600',
    },

    // Line Chart Mock Area
    sparkLine: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 60,
        marginTop: 12,
    },
    sparkBar: {
        width: 6,
        backgroundColor: '#111827',
        borderRadius: 3,
    },

    // Progress Bar
    progressBarBg: {
        height: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        marginTop: 8,
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#000',
        borderRadius: 4,
    },

    // Bar Chart
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    legendRow: { flexDirection: 'row', gap: 12 },
    legendText: { fontSize: 11, color: '#6B7280' },
    dot: { width: 8, height: 8, borderRadius: 4 },
    barChartContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 200,
        paddingTop: 24,
    },
    barGroup: {
        alignItems: 'center',
        gap: 4,
    },
    bar: {
        width: 8,
        borderRadius: 2,
    },
    barLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        marginTop: 8,
    },

    // Property Card
    propImage: {
        width: '100%',
        height: 180,
        borderRadius: 8,
        marginVertical: 16,
    },
    propImagePlaceholder: {
        width: '100%',
        height: 180,
        borderRadius: 8,
        marginVertical: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    propName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    propMeta: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 6,
    },
    propEmpty: {
        flex: 1,
        minHeight: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Bottom Charts
    miniBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 80,
        marginTop: 12,
    },
    miniBar: {
        width: 8,
        borderRadius: 3,
        backgroundColor: '#111827',
    },
    horzBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    barLabelLeft: {
        width: 90,
        fontSize: 11,
        color: '#6B7280',
    },
    barFill: {
        height: 8,
        backgroundColor: '#000',
        borderRadius: 4,
    },
    barValue: {
        fontSize: 11,
        color: '#111827',
    },
    barChartContainerSmall: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 60,
    }
});

export default LeadOverviewScreen;
