
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    useWindowDimensions,
} from 'react-native';
import {
    Search,
    Plus,
    ArrowUpDown,
    Pencil,
    Trash2,
    X,
    ChevronDown,
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type Campaign = {
    _id: string;
    name?: string;
    channel?: string;
    status?: string;
    audienceCount?: number;
    scheduledAt?: string | null;
    createdAt?: string;
};

const CAMPAIGN_TABS = [
    { key: 'all', label: 'All Campaigns', status: null },
    { key: 'active', label: 'Active', status: 'active' },
    { key: 'draft', label: 'Draft', status: 'draft' },
    { key: 'completed', label: 'Completed', status: 'completed' },
];

const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'mixed', label: 'Mixed' },
];

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft', bg: '#FEF3C7', text: '#B45309' },
    { value: 'active', label: 'Active', bg: '#DCFCE7', text: '#166534' },
    { value: 'paused', label: 'Paused', bg: '#E5E7EB', text: '#374151' },
    { value: 'completed', label: 'Completed', bg: '#DBEAFE', text: '#1D4ED8' },
];

const toDateTimeInput = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

const CampaignScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const modalWidth = Math.min(width - 32, 520);

    const [tenantId, setTenantId] = useState(getTenantId());
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState(CAMPAIGN_TABS[0].key);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        channel: 'email',
        status: 'draft',
        audienceCount: '0',
        scheduledAt: '',
    });

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

    const loadCampaigns = async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(`/crm/tenants/${tenantId}/campaigns`);
            setCampaigns(res?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load campaigns.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCampaigns();
    }, [tenantId]);

    const filteredCampaigns = useMemo(() => {
        let list = [...campaigns];
        const active = CAMPAIGN_TABS.find((tab) => tab.key === activeTab);
        if (active?.status) {
            list = list.filter((campaign) => campaign.status === active.status);
        }
        if (query) {
            const lowered = query.toLowerCase();
            list = list.filter((campaign) =>
                [campaign.name, campaign.channel, campaign.status]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(lowered))
            );
        }
        list.sort((a, b) => {
            const dateA = new Date(a.scheduledAt || a.createdAt || '').getTime() || 0;
            const dateB = new Date(b.scheduledAt || b.createdAt || '').getTime() || 0;
            return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return list;
    }, [campaigns, activeTab, query, sortDir]);

    const openCreate = () => {
        setActiveCampaign(null);
        setFormData({
            name: '',
            channel: 'email',
            status: 'draft',
            audienceCount: '0',
            scheduledAt: '',
        });
        setModalOpen(true);
    };

    const openEdit = (campaign: Campaign) => {
        setActiveCampaign(campaign);
        setFormData({
            name: campaign.name || '',
            channel: campaign.channel || 'email',
            status: campaign.status || 'draft',
            audienceCount: String(campaign.audienceCount ?? 0),
            scheduledAt: toDateTimeInput(campaign.scheduledAt),
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        if (!formData.name.trim()) {
            setError('Campaign name is required.');
            return;
        }
        setSaving(true);
        setError('');

        const scheduledDate = formData.scheduledAt ? new Date(formData.scheduledAt) : null;
        if (formData.scheduledAt && scheduledDate && Number.isNaN(scheduledDate.getTime())) {
            setError('Scheduled date is invalid.');
            setSaving(false);
            return;
        }
        const scheduledAt = scheduledDate ? scheduledDate.toISOString() : null;

        const payload = {
            name: formData.name.trim(),
            channel: formData.channel,
            status: formData.status,
            audienceCount: Number(formData.audienceCount) || 0,
            scheduledAt,
        };

        try {
            if (activeCampaign?._id) {
                const res = await apiFetch(`/crm/tenants/${tenantId}/campaigns/${activeCampaign._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setCampaigns((prev) => prev.map((item) => (item._id === updated?._id ? updated : item)));
            } else {
                const res = await apiFetch(`/crm/tenants/${tenantId}/campaigns`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const created = res?.data;
                if (created) {
                    setCampaigns((prev) => [created, ...prev]);
                }
            }
            setModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save campaign.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (campaign: Campaign) => {
        if (!tenantId || !campaign._id) return;
        Alert.alert('Delete campaign', `Delete "${campaign.name || campaign._id}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setError('');
                    try {
                        await apiFetch(`/crm/tenants/${tenantId}/campaigns/${campaign._id}`, { method: 'DELETE' });
                        setCampaigns((prev) => prev.filter((item) => item._id !== campaign._id));
                    } catch (err: any) {
                        setError(err.message || 'Failed to delete campaign.');
                    }
                },
            },
        ]);
    };
    return (
        <ResponsiveLayout>
            <View style={styles.container}>
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <Text style={styles.pageTitle}>Campaigns</Text>
                    <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
                        <View style={[styles.searchBar, isCompact && styles.searchBarCompact]}>
                            <Search size={16} color="#9CA3AF" />
                            <TextInput
                                placeholder="Search campaigns..."
                                placeholderTextColor="#9CA3AF"
                                style={styles.searchInput}
                                value={query}
                                onChangeText={setQuery}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.primaryBtn, isCompact && styles.primaryBtnCompact]}
                            onPress={openCreate}
                        >
                            <Plus size={16} color="#FFF" />
                            <Text style={styles.primaryBtnText}>Create Campaign</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.toolbar, isCompact && styles.toolbarCompact]}>
                    <View style={styles.tabs}>
                        {CAMPAIGN_TABS.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[styles.toolActions, isCompact && styles.toolActionsCompact]}>
                        <TouchableOpacity style={styles.toolBtn} onPress={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
                            <ArrowUpDown size={16} color="#374151" />
                            <Text style={styles.toolBtnText}>Sort</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {loading ? <Text style={styles.helperText}>Loading campaigns...</Text> : null}

                <ScrollView
                    horizontal={isCompact}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={isCompact ? styles.tableScrollCompact : undefined}
                    style={styles.tableScroll}
                >
                    <View style={styles.tableCard}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, styles.colName]}>Campaign Name</Text>
                            <Text style={[styles.headerCell, styles.colType]}>Channel</Text>
                            <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
                            <Text style={[styles.headerCell, styles.colLeads]}>Leads</Text>
                            <Text style={[styles.headerCell, styles.colDate]}>Scheduled</Text>
                            <Text style={[styles.headerCell, styles.colActions]}>Actions</Text>
                        </View>
                        {filteredCampaigns.length === 0 ? (
                            <View style={styles.emptyRow}>
                                <Text style={styles.emptyText}>No campaigns found.</Text>
                            </View>
                        ) : (
                            filteredCampaigns.map((row) => {
                                const status = STATUS_OPTIONS.find((option) => option.value === row.status);
                                return (
                                    <View key={row._id} style={styles.tableRow}>
                                        <Text style={[styles.cellText, styles.colName]}>{row.name || 'Untitled'}</Text>
                                        <Text style={[styles.cellText, styles.colType]}>
                                            {CHANNEL_OPTIONS.find((option) => option.value === row.channel)?.label || 'Email'}
                                        </Text>
                                        <View style={[styles.statusPill, { backgroundColor: status?.bg || '#E5E7EB' }]}
                                        >
                                            <Text style={[styles.statusText, { color: status?.text || '#374151' }]}>
                                                {status?.label || row.status || 'Draft'}
                                            </Text>
                                        </View>
                                        <Text style={[styles.cellText, styles.colLeads]}>{row.audienceCount ?? 0}</Text>
                                        <Text style={[styles.cellText, styles.colDate]}>{formatDate(row.scheduledAt)}</Text>
                                        <View style={[styles.colActions, styles.actionRow]}>
                                            <TouchableOpacity onPress={() => openEdit(row)}>
                                                <Pencil size={14} color="#6B7280" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(row)}>
                                                <Trash2 size={14} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                <Modal
                    visible={modalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={closeModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalDialog, { width: modalWidth }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{activeCampaign ? 'Edit Campaign' : 'Create Campaign'}</Text>
                                <TouchableOpacity onPress={closeModal}>
                                    <X size={18} color="#111827" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalContent}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Campaign Name*</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Luxury buyers"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.name}
                                        onChangeText={(name) => setFormData({ ...formData, name })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Channel</Text>
                                    <View style={styles.statusRow}>
                                        {CHANNEL_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[styles.statusChip, formData.channel === option.value && styles.statusChipActive]}
                                                onPress={() => setFormData({ ...formData, channel: option.value })}
                                            >
                                                <Text
                                                    style={[styles.statusChipText, formData.channel === option.value && styles.statusChipTextActive]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Status</Text>
                                    <View style={styles.statusRow}>
                                        {STATUS_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[styles.statusChip, formData.status === option.value && styles.statusChipActive]}
                                                onPress={() => setFormData({ ...formData, status: option.value })}
                                            >
                                                <Text
                                                    style={[styles.statusChipText, formData.status === option.value && styles.statusChipTextActive]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Audience Count</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="numeric"
                                        value={formData.audienceCount}
                                        onChangeText={(audienceCount) => setFormData({ ...formData, audienceCount })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Scheduled At (YYYY-MM-DDTHH:MM)</Text>
                                    <View style={styles.selectInput}>
                                        <Text style={styles.selectText}>{formData.scheduledAt || 'Not scheduled'}</Text>
                                        <ChevronDown size={18} color="#6B7280" />
                                    </View>
                                    <TextInput
                                        style={[styles.input, styles.inputSmall]}
                                        placeholder="2026-01-12T09:00"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.scheduledAt}
                                        onChangeText={(scheduledAt) => setFormData({ ...formData, scheduledAt })}
                                    />
                                </View>
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
                                    <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.secondaryBtn} onPress={closeModal}>
                                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </ResponsiveLayout>
    );
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FCFCFC',
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
    pageTitle: {
        fontSize: 24,
        fontWeight: '700',
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
        width: 220,
        gap: 8,
    },
    searchBarCompact: {
        width: '100%',
    },
    searchInput: {
        fontSize: 14,
        flex: 1,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 8,
    },
    primaryBtnCompact: {
        justifyContent: 'center',
    },
    primaryBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFF',
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    toolbarCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 12,
        paddingHorizontal: 16,
    },
    tabs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tabBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    tabBtnActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    tabText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#FFF',
    },
    toolActions: {
        flexDirection: 'row',
        gap: 8,
    },
    toolActionsCompact: {
        flexWrap: 'wrap',
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    toolBtnText: {
        fontSize: 12,
        color: '#374151',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    helperText: {
        color: '#6B7280',
        fontSize: 12,
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    tableScroll: {
        paddingHorizontal: 24,
    },
    tableScrollCompact: {
        paddingRight: 16,
    },
    tableCard: {
        minWidth: 820,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#FFF',
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerCell: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        alignItems: 'center',
    },
    cellText: {
        fontSize: 12,
        color: '#111827',
    },
    colName: { width: 180 },
    colType: { width: 100 },
    colStatus: { width: 120 },
    colLeads: { width: 80 },
    colDate: { width: 140 },
    colActions: { width: 90 },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        width: 110,
        alignItems: 'center',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    emptyRow: {
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#9CA3AF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalDialog: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    modalContent: {
        padding: 20,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: 999,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFF',
    },
    secondaryBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 13,
        color: '#111827',
        backgroundColor: '#FFF',
    },
    inputSmall: {
        marginTop: 8,
    },
    selectInput: {
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
    },
    selectText: {
        fontSize: 13,
        color: '#111827',
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statusChipActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    statusChipText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    statusChipTextActive: {
        color: '#FFF',
    },
});

export default CampaignScreen;
