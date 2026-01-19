
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
    Calendar,
    ChevronDown,
    X,
    LayoutGrid,
    List,
    Pencil,
    Trash2,
} from 'lucide-react-native';
import ResponsiveLayout from '../../../components/ResponsiveLayout';
import { apiFetch, getTenantId, resolveTenantId } from '../../../lib/api';

type Task = {
    _id: string;
    title?: string;
    type?: string;
    priority?: string;
    status?: string;
    dueDate?: string | null;
    reminderAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'review', label: 'Review' },
    { value: 'completed', label: 'Completed' },
];

const COLUMNS = [
    { key: 'todo', title: 'To do', color: '#F59E0B' },
    { key: 'in_progress', title: 'In progress', color: '#3B82F6' },
    { key: 'review', title: 'In review', color: '#8B5CF6' },
    { key: 'completed', title: 'Completed', color: '#22C55E' },
];

const toDateInput = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

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

const TasksScreen = () => {
    const { width } = useWindowDimensions();
    const isCompact = width < 768;
    const columnWidth = Math.min(Math.max(width - 64, 240), 320);
    const slideOverWidth = Math.min(width, 520);

    const [tenantId, setTenantId] = useState(getTenantId());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [view, setView] = useState<'kanban' | 'table'>('kanban');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        type: 'to-do',
        priority: 'normal',
        status: 'todo',
        dueDate: '',
        reminderAt: '',
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
        const loadTasks = async () => {
            if (!tenantId) return;
            setLoading(true);
            setError('');
            try {
                const res = await apiFetch(`/crm/tenants/${tenantId}/tasks`);
                setTasks(res?.data || []);
            } catch (err: any) {
                setError(err.message || 'Failed to load tasks.');
            } finally {
                setLoading(false);
            }
        };
        loadTasks();
    }, [tenantId]);

    const tasksByStatus = useMemo(() => {
        const map: Record<string, Task[]> = {
            todo: [],
            in_progress: [],
            review: [],
            completed: [],
        };
        tasks.forEach((task) => {
            const key = task.status || 'todo';
            if (!map[key]) {
                map[key] = [];
            }
            map[key].push(task);
        });
        return map;
    }, [tasks]);

    const openCreate = () => {
        setActiveTask(null);
        setFormData({
            title: '',
            type: 'to-do',
            priority: 'normal',
            status: 'todo',
            dueDate: '',
            reminderAt: '',
        });
        setCreateModalOpen(true);
    };

    const openEdit = (task: Task) => {
        setActiveTask(task);
        setFormData({
            title: task.title || '',
            type: task.type || 'to-do',
            priority: task.priority || 'normal',
            status: task.status || 'todo',
            dueDate: toDateInput(task.dueDate),
            reminderAt: toDateTimeInput(task.reminderAt),
        });
        setCreateModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setCreateModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        if (!formData.title.trim()) {
            setError('Task title is required.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            title: formData.title.trim(),
            type: formData.type.trim() || 'to-do',
            priority: formData.priority,
            status: formData.status,
            dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
            reminderAt: formData.reminderAt ? new Date(formData.reminderAt).toISOString() : null,
        };
        try {
            if (activeTask?._id) {
                const res = await apiFetch(`/crm/tenants/${tenantId}/tasks/${activeTask._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setTasks((prev) => prev.map((task) => (task._id === updated?._id ? updated : task)));
            } else {
                const res = await apiFetch(`/crm/tenants/${tenantId}/tasks`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const created = res?.data;
                if (created) {
                    setTasks((prev) => [created, ...prev]);
                }
            }
            setCreateModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save task.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (task: Task) => {
        if (!tenantId || !task._id) return;
        Alert.alert('Delete task', `Delete "${task.title || task._id}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setError('');
                    try {
                        await apiFetch(`/crm/tenants/${tenantId}/tasks/${task._id}`, { method: 'DELETE' });
                        setTasks((prev) => prev.filter((item) => item._id !== task._id));
                    } catch (err: any) {
                        setError(err.message || 'Failed to delete task.');
                    }
                },
            },
        ]);
    };

    return (
        <ResponsiveLayout>
            <View style={[styles.container, isCompact && styles.containerCompact]}>
                <View style={[styles.header, isCompact && styles.headerCompact]}>
                    <Text style={styles.pageTitle}>Tasks</Text>
                    <View style={styles.headerActions}>
                        <View style={styles.viewToggle}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, view === 'kanban' && styles.toggleBtnActive]}
                                onPress={() => setView('kanban')}
                            >
                                <LayoutGrid size={16} color={view === 'kanban' ? '#111827' : '#6B7280'} />
                                <Text style={[styles.toggleText, view === 'kanban' && styles.toggleTextActive]}>Kanban</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, view === 'table' && styles.toggleBtnActive]}
                                onPress={() => setView('table')}
                            >
                                <List size={16} color={view === 'table' ? '#111827' : '#6B7280'} />
                                <Text style={[styles.toggleText, view === 'table' && styles.toggleTextActive]}>Table</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
                            <Plus size={16} color="#FFF" />
                            <Text style={styles.createBtnText}>New Task</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {loading ? <Text style={styles.helperText}>Loading tasks...</Text> : null}

                {view === 'kanban' ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.boardContainer, isCompact && styles.boardContainerCompact]}
                    >
                        {COLUMNS.map((column) => {
                            const columnTasks = tasksByStatus[column.key] || [];
                            return (
                                <View key={column.key} style={[styles.column, { width: columnWidth }]}>
                                    <View style={styles.columnHeader}>
                                        <View style={styles.columnTitleRow}>
                                            <View style={[styles.dot, { backgroundColor: column.color }]} />
                                            <Text style={styles.columnTitle}>{column.title}</Text>
                                        </View>
                                        <Text style={styles.columnMeta}>{columnTasks.length} tasks</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.createTaskInline}
                                        onPress={openCreate}
                                    >
                                        <Plus size={16} color="#111827" />
                                        <Text style={styles.createTaskText}>Create Task</Text>
                                    </TouchableOpacity>

                                    <View style={styles.taskList}>
                                        {columnTasks.length === 0 ? (
                                            <View style={styles.emptyState}>
                                                <Text style={styles.emptyTitle}>No Tasks</Text>
                                                <Text style={styles.emptySub}>Create one to get started.</Text>
                                            </View>
                                        ) : (
                                            columnTasks.map((task) => (
                                                <View key={task._id} style={styles.taskCard}>
                                                    <View style={styles.taskHeader}>
                                                        <View style={styles.priorityTag}>
                                                            <Text style={styles.priorityText}>
                                                                {PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label || 'Normal'}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.cardActions}>
                                                            <TouchableOpacity onPress={() => openEdit(task)}>
                                                                <Pencil size={14} color="#6B7280" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={() => handleDelete(task)}>
                                                                <Trash2 size={14} color="#EF4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.taskTitle}>{task.title || 'Untitled Task'}</Text>
                                                    <View style={styles.taskMeta}>
                                                        <Calendar size={14} color="#9CA3AF" />
                                                        <Text style={styles.taskMetaText}>{formatDate(task.dueDate)}</Text>
                                                    </View>
                                                </View>
                                            ))
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={[styles.tableScroll, isCompact && styles.tableScrollCompact]}
                    >
                        <View style={styles.tableContainer}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={styles.tableHeaderText}>Subject</Text>
                                <Text style={styles.tableHeaderText}>Due Date</Text>
                                <Text style={styles.tableHeaderText}>Priority</Text>
                                <Text style={styles.tableHeaderText}>Status</Text>
                                <Text style={styles.tableHeaderText}>Actions</Text>
                            </View>
                            {tasks.length === 0 ? (
                                <View style={styles.emptyRow}>
                                    <Text style={styles.emptyText}>No tasks yet.</Text>
                                </View>
                            ) : (
                                tasks.map((task) => (
                                    <View key={task._id} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, styles.tableCellWide]}>{task.title || 'Untitled Task'}</Text>
                                        <Text style={styles.tableCell}>{formatDate(task.dueDate)}</Text>
                                        <Text style={styles.tableCell}>
                                            {PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label || 'Normal'}
                                        </Text>
                                        <Text style={styles.tableCell}>
                                            {STATUS_OPTIONS.find((option) => option.value === task.status)?.label || 'To Do'}
                                        </Text>
                                        <View style={styles.tableActions}>
                                            <TouchableOpacity onPress={() => openEdit(task)}>
                                                <Pencil size={14} color="#6B7280" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(task)}>
                                                <Trash2 size={14} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                )}

                <Modal
                    visible={createModalOpen}
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
                                <Text style={styles.slideTitle}>{activeTask ? 'Edit Task' : 'Create Task'}</Text>
                                <TouchableOpacity onPress={closeModal}>
                                    <X size={20} color="#111827" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Task Title*</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Follow up with lead"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.title}
                                        onChangeText={(t) => setFormData({ ...formData, title: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Task Type</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="to-do"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.type}
                                        onChangeText={(t) => setFormData({ ...formData, type: t })}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Priority</Text>
                                    <View style={styles.selectInput}>
                                        <Text style={styles.selectText}>
                                            {PRIORITY_OPTIONS.find((option) => option.value === formData.priority)?.label || 'Normal'}
                                        </Text>
                                        <ChevronDown size={18} color="#6B7280" />
                                    </View>
                                    <View style={styles.statusRow}>
                                        {PRIORITY_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[styles.statusChip, formData.priority === option.value && styles.statusChipActive]}
                                                onPress={() => setFormData({ ...formData, priority: option.value })}
                                            >
                                                <Text style={[styles.statusChipText, formData.priority === option.value && styles.statusChipTextActive]}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Status</Text>
                                    <View style={styles.selectInput}>
                                        <Text style={styles.selectText}>
                                            {STATUS_OPTIONS.find((option) => option.value === formData.status)?.label || 'To Do'}
                                        </Text>
                                        <ChevronDown size={18} color="#6B7280" />
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
                                <View style={styles.rowGroup}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="2026-01-20"
                                            placeholderTextColor="#9CA3AF"
                                            value={formData.dueDate}
                                            onChangeText={(t) => setFormData({ ...formData, dueDate: t })}
                                        />
                                    </View>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Reminder (YYYY-MM-DDTHH:MM)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="2026-01-20T09:00"
                                            placeholderTextColor="#9CA3AF"
                                            value={formData.reminderAt}
                                            onChangeText={(t) => setFormData({ ...formData, reminderAt: t })}
                                        />
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.createBtnPrimary} onPress={handleSave} disabled={saving}>
                                    <Text style={styles.createBtnTextPrimary}>{saving ? 'Saving...' : 'Save'}</Text>
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
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    headerCompact: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#E5E7EB',
        padding: 4,
        borderRadius: 10,
        gap: 4,
    },
    toggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    toggleBtnActive: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    toggleText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    toggleTextActive: {
        color: '#111827',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#000',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    createBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFF',
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

    boardContainer: {
        gap: 16,
        paddingBottom: 24,
    },
    boardContainerCompact: {
        paddingRight: 16,
    },
    column: {
        backgroundColor: '#FFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 12,
    },
    columnHeader: {
        marginBottom: 12,
        gap: 4,
    },
    columnTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    columnTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    columnMeta: {
        fontSize: 11,
        color: '#6B7280',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    createTaskInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#D1D5DB',
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        marginBottom: 12,
    },
    createTaskText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    taskList: {
        gap: 12,
    },
    taskCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 8,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priorityTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: '#FEF3C7',
    },
    priorityText: {
        fontSize: 10,
        color: '#B45309',
        fontWeight: '700',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    taskTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    taskMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    taskMetaText: {
        fontSize: 11,
        color: '#6B7280',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    emptySub: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 4,
    },

    tableScroll: {
        flex: 1,
    },
    tableScrollCompact: {
        paddingRight: 16,
    },
    tableContainer: {
        minWidth: 760,
        backgroundColor: '#FFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        minWidth: 140,
    },
    tableRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        alignItems: 'center',
    },
    tableCell: {
        fontSize: 12,
        color: '#111827',
        minWidth: 140,
    },
    tableCellWide: {
        minWidth: 220,
    },
    tableActions: {
        minWidth: 140,
        flexDirection: 'row',
        gap: 10,
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
    rowGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
    },
    createBtnPrimary: {
        flex: 1,
        backgroundColor: '#000',
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
    },
    createBtnTextPrimary: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 13,
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

export default TasksScreen;
