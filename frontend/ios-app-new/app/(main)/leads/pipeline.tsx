import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    useWindowDimensions,
} from 'react-native';
import {
    Plus,
    RefreshCw,
    Pencil,
    Trash2,
    X,
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type Stage = {
    _id: string;
    name?: string;
    order?: number;
    isDefault?: boolean;
};

type Lead = {
    _id: string;
    status?: string;
};

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    qualified: 'Qualified',
    nurturing: 'Nurturing',
    active_buyer: 'Active Buyer',
    closed: 'Closed',
};

const PipelineScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const slideOverWidth = Math.min(width, 520);

    const [tenantId, setTenantId] = useState(getTenantId());
    const [stages, setStages] = useState<Stage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeStage, setActiveStage] = useState<Stage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [form, setForm] = useState({ name: '', order: '0' });

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

    const loadPipeline = async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const [stagesRes, leadsRes] = await Promise.all([
                apiFetch(`/crm/tenants/${tenantId}/pipeline-stages`),
                apiFetch(`/crm/tenants/${tenantId}/leads`),
            ]);
            const stageList = stagesRes?.data || [];
            stageList.sort((a: Stage, b: Stage) => (a.order ?? 0) - (b.order ?? 0));
            setStages(stageList);
            setLeads(leadsRes?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load pipeline.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPipeline();
    }, [tenantId]);

    const leadSummary = useMemo(() => {
        const summary: Record<string, number> = {
            new: 0,
            qualified: 0,
            nurturing: 0,
            active_buyer: 0,
            closed: 0,
        };
        leads.forEach((lead) => {
            const key = lead.status || 'new';
            summary[key] = (summary[key] || 0) + 1;
        });
        return summary;
    }, [leads]);

    const openCreate = () => {
        setActiveStage(null);
        setForm({ name: '', order: String(stages.length) });
        setIsModalOpen(true);
    };

    const openEdit = (stage: Stage) => {
        setActiveStage(stage);
        setForm({
            name: stage.name || '',
            order: String(stage.order ?? 0),
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setIsModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        if (!form.name.trim()) {
            setError('Stage name is required.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            name: form.name.trim(),
            order: Number(form.order) || 0,
        };
        try {
            if (activeStage?._id) {
                const res = await apiFetch(`/crm/tenants/${tenantId}/pipeline-stages/${activeStage._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setStages((prev) => prev.map((stage) => (stage._id === updated?._id ? updated : stage)));
            } else {
                const res = await apiFetch(`/crm/tenants/${tenantId}/pipeline-stages`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const created = res?.data;
                if (created) {
                    setStages((prev) => [...prev, created].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
                }
            }
            setIsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save pipeline stage.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (stage: Stage) => {
        if (!tenantId || !stage._id) return;
        Alert.alert('Delete stage', `Delete "${stage.name || stage._id}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setError('');
                    try {
                        await apiFetch(`/crm/tenants/${tenantId}/pipeline-stages/${stage._id}`, { method: 'DELETE' });
                        setStages((prev) => prev.filter((item) => item._id !== stage._id));
                    } catch (err: any) {
                        setError(err.message || 'Failed to delete pipeline stage.');
                    }
                },
            },
        ]);
    };

    return (
        <ResponsiveLayout>
            <View style={[styles.container, isCompact && styles.containerCompact]}>
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <View>
                        <Text style={styles.pageTitle}>Pipeline</Text>
                        <Text style={styles.pageSubtitle}>Manage your CRM pipeline stages and lead flow.</Text>
                    </View>
                    <View style={[styles.headerActions, isCompact && styles.headerActionsCompact]}>
                        <TouchableOpacity
                            style={styles.refreshBtn}
                            onPress={loadPipeline}
                            disabled={loading}
                        >
                            <RefreshCw size={16} color="#111827" />
                            <Text style={styles.refreshText}>{loading ? 'Loading...' : 'Refresh'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
                            <Plus size={16} color="#FFF" />
                            <Text style={styles.primaryBtnText}>New Stage</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={[styles.contentRow, isCompact && styles.contentRowCompact]}>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Pipeline Stages</Text>
                        {loading ? (
                            <Text style={styles.helperText}>Loading stages...</Text>
                        ) : stages.length === 0 ? (
                            <Text style={styles.helperText}>No stages yet. Create your first stage.</Text>
                        ) : (
                            <ScrollView contentContainerStyle={styles.stageList}>
                                {stages.map((stage) => (
                                    <View key={stage._id} style={styles.stageRow}>
                                        <View style={styles.stageInfo}>
                                            <Text style={styles.stageName}>{stage.name || 'Untitled Stage'}</Text>
                                            <Text style={styles.stageMeta}>Order: {stage.order ?? 0}</Text>
                                        </View>
                                        <View style={styles.stageActions}>
                                            {stage.isDefault ? (
                                                <View style={styles.defaultBadge}>
                                                    <Text style={styles.defaultBadgeText}>Default</Text>
                                                </View>
                                            ) : null}
                                            <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(stage)}>
                                                <Pencil size={14} color="#6B7280" />
                                                <Text style={styles.actionText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(stage)}>
                                                <Trash2 size={14} color="#EF4444" />
                                                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Lead Status Summary</Text>
                        <View style={styles.summaryList}>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <View key={key} style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>{label}</Text>
                                    <Text style={styles.summaryValue}>{leadSummary[key] || 0}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                <Modal
                    visible={isModalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={closeModal}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity
                            style={styles.modalBackdrop}
                            activeOpacity={1}
                            onPress={closeModal}
                        />
                        <View style={[styles.slideOver, { width: slideOverWidth }]}>
                            <View style={styles.slideHeader}>
                                <Text style={styles.slideTitle}>{activeStage ? 'Edit Stage' : 'Create Stage'}</Text>
                                <TouchableOpacity onPress={closeModal}>
                                    <X size={20} color="#111827" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.formContent}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Stage name*</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Qualification"
                                        placeholderTextColor="#9CA3AF"
                                        value={form.name}
                                        onChangeText={(t) => setForm({ ...form, name: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Order</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="0"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="numeric"
                                        value={form.order}
                                        onChangeText={(t) => setForm({ ...form, order: t })}
                                    />
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
                                    <Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save Stage'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
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
        backgroundColor: '#F3F4F6',
        padding: 24,
    },
    containerCompact: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
    },
    headerCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
    },
    pageSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerActionsCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    refreshText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#000',
    },
    primaryBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
        marginBottom: 12,
    },
    helperText: {
        color: '#6B7280',
        fontSize: 12,
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 16,
    },
    contentRowCompact: {
        flexDirection: 'column',
    },
    card: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    stageList: {
        gap: 12,
        paddingBottom: 8,
    },
    stageRow: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        gap: 10,
        backgroundColor: '#F9FAFB',
    },
    stageInfo: {
        gap: 4,
    },
    stageName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    stageMeta: {
        fontSize: 11,
        color: '#6B7280',
    },
    stageActions: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    defaultBadge: {
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    defaultBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6B7280',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    actionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    deleteBtn: {
        borderColor: '#FECACA',
        backgroundColor: '#FEF2F2',
    },
    deleteText: {
        color: '#EF4444',
    },
    summaryList: {
        gap: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 13,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.45)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    slideOver: {
        height: '100%',
        backgroundColor: '#FFF',
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    slideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    slideTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    formContent: {
        paddingBottom: 24,
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 6,
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
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#111827',
        fontWeight: '600',
        fontSize: 13,
    },
});

export default PipelineScreen;
