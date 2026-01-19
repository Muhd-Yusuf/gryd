
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
    List,
    LayoutGrid,
    ChevronDown,
    Pencil,
    Trash2,
    X,
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type Report = {
    _id: string;
    name?: string;
    description?: string;
    status?: 'draft' | 'generated';
    generatedAt?: string | null;
    createdAt?: string;
};

const REPORT_FILTERS = [
    { key: 'all', label: 'All Reports', status: null },
    { key: 'draft', label: 'Draft', status: 'draft' },
    { key: 'generated', label: 'Generated', status: 'generated' },
];

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft', bg: '#FEF3C7', text: '#B45309' },
    { value: 'generated', label: 'Generated', bg: '#DBEAFE', text: '#1D4ED8' },
];

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

const ReportsScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const modalWidth = Math.min(width - 32, 520);

    const [tenantId, setTenantId] = useState(getTenantId());
    const [reports, setReports] = useState<Report[]>([]);
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState(REPORT_FILTERS[0]);
    const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [activeReport, setActiveReport] = useState<Report | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'generated' as 'draft' | 'generated',
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

    const loadReports = async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(`/crm/tenants/${tenantId}/reports`);
            setReports(res?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load reports.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, [tenantId]);

    const filteredReports = useMemo(() => {
        let list = [...reports];
        if (activeFilter.status) {
            list = list.filter((report) => report.status === activeFilter.status);
        }
        if (query) {
            const lowered = query.toLowerCase();
            list = list.filter((report) =>
                [report.name, report.description, report.status]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(lowered))
            );
        }
        list.sort((a, b) => {
            const dateA = new Date(a.generatedAt || a.createdAt || '').getTime() || 0;
            const dateB = new Date(b.generatedAt || b.createdAt || '').getTime() || 0;
            return dateB - dateA;
        });
        return list;
    }, [reports, activeFilter, query]);

    const openCreate = () => {
        setActiveReport(null);
        setFormData({ name: '', description: '', status: 'generated' });
        setModalOpen(true);
    };

    const openEdit = (report: Report) => {
        setActiveReport(report);
        setFormData({
            name: report.name || '',
            description: report.description || '',
            status: report.status || 'generated',
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
            setError('Report name is required.');
            return;
        }
        setSaving(true);
        setError('');

        try {
            if (activeReport?._id) {
                const payload: any = {
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    status: formData.status,
                };
                if (formData.status === 'generated') {
                    payload.generatedAt = new Date().toISOString();
                }
                const res = await apiFetch(`/crm/tenants/${tenantId}/reports/${activeReport._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setReports((prev) => prev.map((item) => (item._id === updated?._id ? updated : item)));
            } else {
                const createRes = await apiFetch(`/crm/tenants/${tenantId}/reports`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: formData.name.trim(),
                        description: formData.description.trim(),
                    }),
                });
                let created = createRes?.data;
                if (created && formData.status === 'draft') {
                    const updateRes = await apiFetch(`/crm/tenants/${tenantId}/reports/${created._id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'draft', generatedAt: null }),
                    });
                    created = updateRes?.data || created;
                }
                if (created) {
                    setReports((prev) => [created, ...prev]);
                }
            }
            setModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save report.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (report: Report) => {
        if (!tenantId || !report._id) return;
        Alert.alert('Delete report', `Delete "${report.name || report._id}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setError('');
                    try {
                        await apiFetch(`/crm/tenants/${tenantId}/reports/${report._id}`, { method: 'DELETE' });
                        setReports((prev) => prev.filter((item) => item._id !== report._id));
                    } catch (err: any) {
                        setError(err.message || 'Failed to delete report.');
                    }
                },
            },
        ]);
    };

    const cycleFilter = () => {
        const index = REPORT_FILTERS.findIndex((filter) => filter.key === activeFilter.key);
        const next = REPORT_FILTERS[(index + 1) % REPORT_FILTERS.length];
        setActiveFilter(next);
    };
    return (
        <ResponsiveLayout>
            <View style={styles.container}>
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <View>
                        <Text style={styles.pageTitle}>My Reports</Text>
                        <Text style={styles.pageSub}>Track and export insights across your CRM.</Text>
                    </View>
                    <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
                        <View style={[styles.searchBar, isCompact && styles.searchBarCompact]}>
                            <Search size={16} color="#9CA3AF" />
                            <TextInput
                                placeholder="Search reports..."
                                placeholderTextColor="#9CA3AF"
                                style={styles.searchInput}
                                value={query}
                                onChangeText={setQuery}
                            />
                        </View>
                        <TouchableOpacity style={[styles.primaryBtn, isCompact && styles.primaryBtnCompact]} onPress={openCreate}>
                            <Plus size={16} color="#FFF" />
                            <Text style={styles.primaryBtnText}>Create Report</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={[styles.bodyRow, isCompact && styles.bodyRowCompact]}>
                    <View style={[styles.sidePanel, isCompact && styles.sidePanelCompact]}>
                        <TouchableOpacity style={styles.createTile} onPress={openCreate}>
                            <Plus size={16} color="#111827" />
                            <Text style={styles.createTileText}>Create Report</Text>
                        </TouchableOpacity>
                        <Text style={styles.panelLabel}>Status</Text>
                        {REPORT_FILTERS.map((filter) => (
                            <TouchableOpacity
                                key={filter.key}
                                style={[styles.panelItem, activeFilter.key === filter.key && styles.panelItemActive]}
                                onPress={() => setActiveFilter(filter)}
                            >
                                <Text style={[styles.panelItemText, activeFilter.key === filter.key && styles.panelItemTextActive]}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.tableShell}>
                        <View style={[styles.tableToolbar, isCompact && styles.tableToolbarCompact]}>
                            <View style={styles.viewToggle}>
                                <TouchableOpacity
                                    style={[styles.viewBtn, viewMode === 'table' && styles.viewBtnActive]}
                                    onPress={() => setViewMode('table')}
                                >
                                    <List size={16} color={viewMode === 'table' ? '#111827' : '#9CA3AF'} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
                                    onPress={() => setViewMode('list')}
                                >
                                    <LayoutGrid size={16} color={viewMode === 'list' ? '#111827' : '#9CA3AF'} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.filterBtn} onPress={cycleFilter}>
                                <Text style={styles.filterText}>{activeFilter.label}</Text>
                                <ChevronDown size={14} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        {loading ? <Text style={styles.helperText}>Loading reports...</Text> : null}

                        {viewMode === 'list' ? (
                            <View style={styles.cardList}>
                                {filteredReports.length === 0 ? (
                                    <Text style={styles.emptyText}>No reports found.</Text>
                                ) : (
                                    filteredReports.map((report) => {
                                        const status = STATUS_OPTIONS.find((option) => option.value === report.status);
                                        return (
                                            <View key={report._id} style={styles.reportCard}>
                                                <View style={styles.reportCardHeader}>
                                                    <Text style={styles.reportTitle}>{report.name || 'Untitled Report'}</Text>
                                                    {status ? (
                                                        <View style={[styles.statusPill, { backgroundColor: status.bg }]}
                                                        >
                                                            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <Text style={styles.reportDescription}>{report.description || 'No description.'}</Text>
                                                <Text style={styles.reportMeta}>Generated: {formatDate(report.generatedAt)}</Text>
                                                <View style={styles.cardActions}>
                                                    <TouchableOpacity onPress={() => openEdit(report)}>
                                                        <Pencil size={14} color="#6B7280" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleDelete(report)}>
                                                        <Trash2 size={14} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        ) : (
                            <ScrollView horizontal={isCompact} showsHorizontalScrollIndicator={false}>
                                <View style={styles.tableCard}>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.headerCell, styles.colName]}>Report Name</Text>
                                        <Text style={[styles.headerCell, styles.colDesc]}>Description</Text>
                                        <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
                                        <Text style={[styles.headerCell, styles.colGenerated]}>Generated</Text>
                                        <Text style={[styles.headerCell, styles.colActions]}>Actions</Text>
                                    </View>
                                    {filteredReports.length === 0 ? (
                                        <View style={styles.emptyRow}>
                                            <Text style={styles.emptyText}>No reports found.</Text>
                                        </View>
                                    ) : (
                                        filteredReports.map((row) => {
                                            const status = STATUS_OPTIONS.find((option) => option.value === row.status);
                                            return (
                                                <View key={row._id} style={styles.tableRow}>
                                                    <Text style={[styles.cellText, styles.colName]}>{row.name || 'Untitled Report'}</Text>
                                                    <Text style={[styles.cellText, styles.colDesc]}>{row.description || '-'}</Text>
                                                    <View style={[styles.statusPill, { backgroundColor: status?.bg || '#E5E7EB' }]}
                                                    >
                                                        <Text style={[styles.statusText, { color: status?.text || '#374151' }]}>
                                                            {status?.label || row.status || 'Draft'}
                                                        </Text>
                                                    </View>
                                                    <Text style={[styles.cellText, styles.colGenerated]}>{formatDate(row.generatedAt)}</Text>
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
                        )}
                    </View>
                </View>

                <Modal
                    visible={modalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={closeModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalDialog, { width: modalWidth }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{activeReport ? 'Edit Report' : 'Create Report'}</Text>
                                <TouchableOpacity onPress={closeModal}>
                                    <X size={18} color="#111827" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalContent}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Report Name*</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Engagement summary"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.name}
                                        onChangeText={(name) => setFormData({ ...formData, name })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Description</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Describe what this report measures"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.description}
                                        onChangeText={(description) => setFormData({ ...formData, description })}
                                        multiline
                                    />
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
                                                <Text style={[styles.statusChipText, formData.status === option.value && styles.statusChipTextActive]}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
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
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        gap: 16,
    },
    headerCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingHorizontal: 0,
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
    },
    pageSub: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
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
    bodyRow: {
        flexDirection: 'row',
        gap: 16,
        flex: 1,
    },
    bodyRowCompact: {
        flexDirection: 'column',
    },
    sidePanel: {
        width: 220,
        backgroundColor: '#FFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
        gap: 12,
    },
    sidePanelCompact: {
        width: '100%',
    },
    createTile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#F9FAFB',
    },
    createTileText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    panelLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6B7280',
        marginTop: 8,
    },
    panelItem: {
        paddingVertical: 6,
        borderRadius: 8,
        paddingHorizontal: 8,
    },
    panelItemActive: {
        backgroundColor: '#111827',
    },
    panelItemText: {
        fontSize: 12,
        color: '#374151',
    },
    panelItemTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
    tableShell: {
        flex: 1,
    },
    tableToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    tableToolbarCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
    },
    viewToggle: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 4,
        gap: 4,
        backgroundColor: '#FFF',
    },
    viewBtn: {
        padding: 6,
        borderRadius: 6,
    },
    viewBtnActive: {
        backgroundColor: '#F3F4F6',
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        backgroundColor: '#FFF',
    },
    filterText: {
        fontSize: 12,
        color: '#111827',
        fontWeight: '600',
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
    tableCard: {
        minWidth: 760,
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
    colDesc: { width: 240 },
    colStatus: { width: 120 },
    colGenerated: { width: 140 },
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
    cardList: {
        gap: 12,
    },
    reportCard: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#FFF',
    },
    reportCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reportTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    reportDescription: {
        fontSize: 12,
        color: '#6B7280',
    },
    reportMeta: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 6,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
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
    textArea: {
        height: 90,
        textAlignVertical: 'top',
        paddingTop: 10,
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

export default ReportsScreen;
