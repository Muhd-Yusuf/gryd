import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

type Lead = {
    _id: string;
    name?: string;
    email?: string;
};

type Task = {
    _id: string;
    title?: string;
    leadId?: string | null;
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

const CrmTasksPage = () => {
    const [tenantId, setTenantId] = useState(getTenantId());
    const [tasks, setTasks] = useState<Task[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({
        title: '',
        leadId: '',
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

    const loadTasks = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const [tasksRes, leadsRes] = await Promise.all([
                apiFetch(`/crm/tenants/${tenantId}/tasks`),
                apiFetch(`/crm/tenants/${tenantId}/leads`),
            ]);
            setTasks(tasksRes?.data || []);
            setLeads(leadsRes?.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load tasks.');
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const leadLookup = useMemo(() => {
        const map = new Map<string, Lead>();
        leads.forEach((lead) => {
            map.set(lead._id, lead);
        });
        return map;
    }, [leads]);

    const openCreate = () => {
        setActiveTask(null);
        setForm({
            title: '',
            leadId: '',
            type: 'to-do',
            priority: 'normal',
            status: 'todo',
            dueDate: '',
            reminderAt: '',
        });
        setIsModalOpen(true);
    };

    const openEdit = (task: Task) => {
        setActiveTask(task);
        setForm({
            title: task.title || '',
            leadId: task.leadId || '',
            type: task.type || 'to-do',
            priority: task.priority || 'normal',
            status: task.status || 'todo',
            dueDate: toDateInput(task.dueDate),
            reminderAt: toDateTimeInput(task.reminderAt),
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setIsModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        if (!form.title.trim()) {
            setError('Task title is required.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            title: form.title.trim(),
            leadId: form.leadId || null,
            type: form.type.trim() || 'to-do',
            priority: form.priority,
            status: form.status,
            dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
            reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
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
            setIsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save task.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (task: Task) => {
        if (!tenantId || !task._id) return;
        const confirmed = window.confirm(`Delete task "${task.title || task._id}"?`);
        if (!confirmed) return;
        setError('');
        try {
            await apiFetch(`/crm/tenants/${tenantId}/tasks/${task._id}`, { method: 'DELETE' });
            setTasks((prev) => prev.filter((item) => item._id !== task._id));
        } catch (err: any) {
            setError(err.message || 'Failed to delete task.');
        }
    };

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
                            <p className="text-sm text-gray-500">Create and track CRM tasks across your team.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="flex items-center gap-2 text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={loadTasks}
                                disabled={loading}
                            >
                                <RefreshCw size={16} />
                                Refresh
                            </button>
                            <button
                                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl font-bold hover:bg-gray-800"
                                onClick={openCreate}
                            >
                                <Plus size={16} />
                                New Task
                            </button>
                        </div>
                    </header>

                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-gray-500 bg-gray-50">
                            <div className="col-span-3">Task</div>
                            <div className="col-span-2">Lead</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Priority</div>
                            <div className="col-span-2">Due</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {loading ? (
                            <div className="px-6 py-6 text-sm text-gray-500">Loading tasks...</div>
                        ) : tasks.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-gray-500">
                                No tasks yet. Add your first task to get started.
                                <div className="mt-4">
                                    <button
                                        className="bg-black text-white px-5 py-2 rounded-xl font-semibold"
                                        onClick={openCreate}
                                    >
                                        Create Task
                                    </button>
                                </div>
                            </div>
                        ) : (
                            tasks.map((task) => {
                                const lead = task.leadId ? leadLookup.get(task.leadId) : null;
                                return (
                                    <div
                                        key={task._id}
                                        className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 border-t border-gray-100 items-center"
                                    >
                                        <div className="md:col-span-3">
                                            <p className="font-semibold text-gray-900">{task.title || 'Untitled Task'}</p>
                                            <p className="text-xs text-gray-500">Type: {task.type || 'to-do'}</p>
                                        </div>
                                        <div className="md:col-span-2 text-sm text-gray-700">
                                            {lead ? (
                                                <>
                                                    <p>{lead.name || 'Unnamed Lead'}</p>
                                                    <p className="text-xs text-gray-400">{lead.email || '-'}</p>
                                                </>
                                            ) : (
                                                <p className="text-xs text-gray-400">Unassigned</p>
                                            )}
                                        </div>
                                        <div className="md:col-span-2 text-sm text-gray-600">
                                            {STATUS_OPTIONS.find((option) => option.value === task.status)?.label || 'To Do'}
                                        </div>
                                        <div className="md:col-span-2 text-sm text-gray-600">
                                            {PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label || 'Normal'}
                                        </div>
                                        <div className="md:col-span-2 text-sm text-gray-600">
                                            {formatDate(task.dueDate)}
                                        </div>
                                        <div className="md:col-span-1 flex items-center justify-start md:justify-end gap-2">
                                            <button
                                                className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                                onClick={() => openEdit(task)}
                                            >
                                                <Pencil size={14} />
                                                Edit
                                            </button>
                                            <button
                                                className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                                                onClick={() => handleDelete(task)}
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {activeTask ? 'Edit Task' : 'Create Task'}
                                </h2>
                                <p className="text-sm text-gray-500">Assign tasks and keep your pipeline on track.</p>
                            </div>
                            <button
                                className="text-sm text-gray-400 hover:text-gray-600"
                                onClick={closeModal}
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="text-sm font-semibold text-gray-800">Title</label>
                                <input
                                    value={form.title}
                                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Follow up with lead"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Lead</label>
                                <select
                                    value={form.leadId}
                                    onChange={(event) => setForm({ ...form, leadId: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-black"
                                >
                                    <option value="">Unassigned</option>
                                    {leads.map((lead) => (
                                        <option key={lead._id} value={lead._id}>
                                            {lead.name || lead.email || lead._id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Type</label>
                                <input
                                    value={form.type}
                                    onChange={(event) => setForm({ ...form, type: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Priority</label>
                                <select
                                    value={form.priority}
                                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-black"
                                >
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-black"
                                >
                                    {STATUS_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Due date</label>
                                <input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Reminder</label>
                                <input
                                    type="datetime-local"
                                    value={form.reminderAt}
                                    onChange={(event) => setForm({ ...form, reminderAt: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex items-center justify-end gap-3">
                            <button
                                className="text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={closeModal}
                            >
                                Cancel
                            </button>
                            <button
                                className="text-sm font-semibold bg-black text-white px-5 py-2 rounded-xl hover:bg-gray-800"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CrmTasksPage;
