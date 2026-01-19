import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Platform,
    Modal,
    useWindowDimensions
} from 'react-native';
import {
    Search,
    Plus,
    X,
    Pencil,
    Trash2,
    ChevronDown
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type Lead = {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    source?: string;
};

const STATUS_OPTIONS = [
    { value: 'new', label: 'New' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'nurturing', label: 'Nurturing' },
    { value: 'active_buyer', label: 'Active Buyer' },
    { value: 'closed', label: 'Closed' },
];

const ContactsScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const slideOverWidth = Math.min(width, 420);

    const [tenantId, setTenantId] = useState(getTenantId());
    const [leads, setLeads] = useState<Lead[]>([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [activeLead, setActiveLead] = useState<Lead | null>(null);

    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        source: '',
        status: 'new',
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

    useEffect(() => {
        const loadLeads = async () => {
            if (!tenantId) return;
            setLoading(true);
            setError('');
            try {
                const res = await apiFetch(`/crm/tenants/${tenantId}/leads`);
                setLeads(res?.data || []);
            } catch (err: any) {
                setError(err.message || 'Failed to load leads.');
            } finally {
                setLoading(false);
            }
        };
        loadLeads();
    }, [tenantId]);

    const filteredLeads = useMemo(() => {
        if (!query) return leads;
        const lowered = query.toLowerCase();
        return leads.filter((lead) => {
            return [lead.name, lead.email, lead.phone, lead.status, lead.source]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(lowered));
        });
    }, [leads, query]);

    const openCreate = () => {
        setActiveLead(null);
        setFormData({
            email: '',
            firstName: '',
            lastName: '',
            phone: '',
            source: '',
            status: 'new',
        });
        setCreateModalOpen(true);
    };

    const openEdit = (lead: Lead) => {
        const [firstName, ...rest] = (lead.name || '').split(' ');
        setActiveLead(lead);
        setFormData({
            email: lead.email || '',
            firstName: firstName || '',
            lastName: rest.join(' '),
            phone: lead.phone || '',
            source: lead.source || '',
            status: lead.status || 'new',
        });
        setCreateModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setCreateModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        if (!formData.email.trim() && !(formData.firstName.trim() || formData.lastName.trim())) {
            setError('Name or email is required.');
            return;
        }
        setSaving(true);
        setError('');
        const name = `${formData.firstName} ${formData.lastName}`.trim();
        const payload = {
            name,
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            status: formData.status,
            source: formData.source.trim(),
        };
        try {
            if (activeLead?._id) {
                const res = await apiFetch(`/crm/tenants/${tenantId}/leads/${activeLead._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setLeads((prev) => prev.map((lead) => (lead._id === updated?._id ? updated : lead)));
            } else {
                const res = await apiFetch(`/crm/tenants/${tenantId}/leads`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const created = res?.data;
                if (created) {
                    setLeads((prev) => [created, ...prev]);
                }
            }
            setCreateModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save contact.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (lead: Lead) => {
        if (!tenantId || !lead._id) return;
        Alert.alert('Delete contact', `Delete ${lead.name || lead.email || 'this contact'}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setError('');
                    try {
                        await apiFetch(`/crm/tenants/${tenantId}/leads/${lead._id}`, { method: 'DELETE' });
                        setLeads((prev) => prev.filter((item) => item._id !== lead._id));
                    } catch (err: any) {
                        setError(err.message || 'Failed to delete contact.');
                    }
                },
            },
        ]);
    };

    return (
        <ResponsiveLayout>
            <View style={[styles.container, isCompact && styles.containerCompact]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.pageTitle}>Contacts</Text>

                    {/* Action Bar */}
                    <View style={[styles.actionBar, isCompact && styles.actionBarCompact]}>
                        <View style={[styles.actionGroup, isCompact && styles.actionGroupCompact]}>
                            <View style={[styles.searchBar, isCompact && styles.searchBarCompact]}>
                                <Search size={16} color="#9CA3AF" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search contacts..."
                                    value={query}
                                    onChangeText={setQuery}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.createBtn, isCompact && styles.createBtnCompact]}
                            onPress={openCreate}
                        >
                            <Plus size={18} color="#FFF" />
                            <Text style={styles.createBtnText}>Create Contact</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {loading ? <Text style={styles.helperText}>Loading contacts...</Text> : null}

                {/* Table Header */}
                <View style={styles.tableContainer}>
                    <ScrollView
                        horizontal={isCompact}
                        scrollEnabled={isCompact}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={isCompact ? styles.tableContentCompact : undefined}
                    >
                        <View style={styles.tableInner}>
                            <View style={styles.tableHeader}>
                                <View style={styles.colName}>
                                    <Text style={styles.headerText}>Name</Text>
                                </View>
                                <View style={styles.colEmail}>
                                    <Text style={styles.headerText}>Email</Text>
                                </View>
                                <View style={styles.colStatus}>
                                    <Text style={styles.headerText}>Status</Text>
                                </View>
                                <View style={styles.colAction}>
                                    <Text style={styles.headerText}>Actions</Text>
                                </View>
                            </View>

                            {/* Table Rows */}
                            <ScrollView contentContainerStyle={styles.tableScroll}>
                                {filteredLeads.length === 0 ? (
                                    <View style={styles.emptyRow}>
                                        <Text style={styles.emptyText}>No contacts yet.</Text>
                                    </View>
                                ) : (
                                    filteredLeads.map((lead, idx) => (
                                        <View key={lead._id} style={[styles.row, idx % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                                            <View style={styles.colName}>
                                                <Text style={styles.cellText}>{lead.name || 'Unnamed Lead'}</Text>
                                            </View>
                                            <View style={styles.colEmail}>
                                                <Text style={styles.linkText}>{lead.email || '-'}</Text>
                                            </View>
                                            <View style={styles.colStatus}>
                                                <Text style={styles.cellText}>
                                                    {STATUS_OPTIONS.find((option) => option.value === lead.status)?.label || 'New'}
                                                </Text>
                                            </View>
                                            <View style={styles.colAction}>
                                                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(lead)}>
                                                    <Pencil size={16} color="#6B7280" />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(lead)}>
                                                    <Trash2 size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                {/* Create/Edit Contact Slide-Over */}
                <Modal
                    visible={createModalOpen}
                    transparent={true}
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
                                <Text style={styles.slideTitle}>{activeLead ? 'Edit Contact' : 'Create Contact'}</Text>
                                <TouchableOpacity onPress={closeModal}>
                                    <X size={24} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Email</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Email"
                                        value={formData.email}
                                        onChangeText={(t) => setFormData({ ...formData, email: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>First name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="First name"
                                        value={formData.firstName}
                                        onChangeText={(t) => setFormData({ ...formData, firstName: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Last name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Last name"
                                        value={formData.lastName}
                                        onChangeText={(t) => setFormData({ ...formData, lastName: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Phone number</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="+1 2345 2344"
                                        value={formData.phone}
                                        onChangeText={(t) => setFormData({ ...formData, phone: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Lead source</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Referral, Website"
                                        value={formData.source}
                                        onChangeText={(t) => setFormData({ ...formData, source: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Lead status</Text>
                                    <View style={styles.selectInput}>
                                        <Text style={styles.selectText}> {STATUS_OPTIONS.find((option) => option.value === formData.status)?.label || 'New'} </Text>
                                        <ChevronDown size={20} color="#6B7280" />
                                    </View>
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

                                <View style={[styles.modalFooter, isCompact && styles.modalFooterCompact]}>
                                    <TouchableOpacity style={styles.modalCreateBtn} onPress={handleSave} disabled={saving}>
                                        <Text style={styles.modalCreateBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={closeModal}
                                    >
                                        <Text style={styles.modalCancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
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
        padding: 24,
        backgroundColor: '#F3F4F6',
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
        marginBottom: 16,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    actionBarCompact: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    actionGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    actionGroupCompact: {
        flexWrap: 'wrap',
        gap: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
        width: 260,
        gap: 8,
    },
    searchBarCompact: {
        width: '100%'
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#000',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        gap: 8,
    },
    createBtnCompact: {
        justifyContent: 'center',
    },
    createBtnText: {
        color: '#FFF',
        fontSize: 14,
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

    // Table
    tableContainer: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    tableContentCompact: {
        paddingRight: 16,
    },
    tableInner: {
        minWidth: 620,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        height: 48,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    tableScroll: {
        flexGrow: 1,
    },
    row: {
        flexDirection: 'row',
        height: 52,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    rowEven: {
        backgroundColor: '#FFF',
    },
    rowOdd: {
        backgroundColor: '#F9FAFB',
    },
    emptyRow: {
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#9CA3AF',
    },

    // Columns
    colName: {
        flex: 2,
        paddingHorizontal: 16,
    },
    colEmail: {
        flex: 3,
        paddingHorizontal: 16,
    },
    colStatus: {
        flex: 2,
        paddingHorizontal: 16,
    },
    colAction: {
        width: 80,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingRight: 12,
        gap: 8,
    },
    cellText: {
        fontSize: 14,
        color: '#111827',
    },
    linkText: {
        fontSize: 14,
        color: '#1F2937',
        textDecorationLine: 'underline',
    },
    iconBtn: {
        padding: 4,
    },

    // Slide Over
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
        flexDirection: 'row',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    slideOver: {
        width: 400,
        height: '100%',
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        display: 'flex',
        flexDirection: 'column',
    },
    slideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    slideTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    formScroll: {
        padding: 24,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#000',
    },
    selectInput: {
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectText: {
        fontSize: 14,
        color: '#000',
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
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
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        marginBottom: 40,
    },
    modalFooterCompact: {
        flexDirection: 'column',
    },
    modalCreateBtn: {
        flex: 1,
        height: 44,
        backgroundColor: '#000',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCreateBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    modalCancelBtn: {
        flex: 1,
        height: 44,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCancelBtnText: {
        color: '#374151',
        fontWeight: 'bold',
        fontSize: 14,
    },
});

export default ContactsScreen;
