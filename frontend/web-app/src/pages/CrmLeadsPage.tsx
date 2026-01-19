import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

type Lead = {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    score?: number;
    source?: string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
};

const STATUS_OPTIONS = [
    { value: 'new', label: 'New' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'nurturing', label: 'Nurturing' },
    { value: 'active_buyer', label: 'Active Buyer' },
    { value: 'closed', label: 'Closed' },
];

const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

const statusBadge = (status?: string) => {
    switch (status) {
        case 'qualified':
            return 'bg-blue-50 text-blue-700';
        case 'nurturing':
            return 'bg-amber-50 text-amber-700';
        case 'active_buyer':
            return 'bg-green-50 text-green-700';
        case 'closed':
            return 'bg-gray-200 text-gray-700';
        default:
            return 'bg-purple-50 text-purple-700';
    }
};

const CrmLeadsPage = () => {
    const navigate = useNavigate();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [leads, setLeads] = useState<Lead[]>([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeLead, setActiveLead] = useState<Lead | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        status: 'new',
        score: 0,
        source: '',
        tags: '',
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

    const loadLeads = useCallback(async () => {
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
    }, [tenantId]);

    useEffect(() => {
        loadLeads();
    }, [loadLeads]);

    const filteredLeads = useMemo(() => {
        if (!query) return leads;
        const lowered = query.toLowerCase();
        return leads.filter((lead) => {
            const tags = Array.isArray(lead.tags) ? lead.tags.join(', ') : '';
            return [
                lead.name,
                lead.email,
                lead.phone,
                lead.status,
                lead.source,
                tags,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(lowered));
        });
    }, [leads, query]);

    const openCreate = () => {
        setActiveLead(null);
        setForm({
            name: '',
            email: '',
            phone: '',
            status: 'new',
            score: 0,
            source: '',
            tags: '',
        });
        setIsModalOpen(true);
    };

    const openEdit = (lead: Lead) => {
        setActiveLead(lead);
        setForm({
            name: lead.name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            status: lead.status || 'new',
            score: lead.score ?? 0,
            source: lead.source || '',
            tags: Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setIsModalOpen(false);
    };

    const handleSave = async () => {
        if (!tenantId) return;
        setSaving(true);
        setError('');
        const payload = {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            status: form.status,
            score: Number(form.score) || 0,
            source: form.source.trim(),
            tags: form.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
        };
        try {
            if (activeLead?._id) {
                const res = await apiFetch(`/crm/tenants/${tenantId}/leads/${activeLead._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setLeads((prev) => prev.map((item) => (item._id === updated?._id ? updated : item)));
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
            setIsModalOpen(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save lead.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (lead: Lead) => {
        if (!tenantId || !lead._id) return;
        const confirmed = window.confirm(`Delete lead ${lead.name || lead.email || lead._id}?`);
        if (!confirmed) return;
        setError('');
        try {
            await apiFetch(`/crm/tenants/${tenantId}/leads/${lead._id}`, { method: 'DELETE' });
            setLeads((prev) => prev.filter((item) => item._id !== lead._id));
        } catch (err: any) {
            setError(err.message || 'Failed to delete lead.');
        }
    };

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Lead CRM</h1>
                            <p className="text-sm text-gray-500">Manage and qualify your pipeline leads.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="flex items-center gap-2 text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={loadLeads}
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
                                New Lead
                            </button>
                        </div>
                    </header>

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                        <div className="relative w-full lg:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search leads by name, email, phone, or status"
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                            />
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600">
                            Total Leads: <span className="font-semibold text-gray-900">{leads.length}</span>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-gray-500 bg-gray-50">
                            <div className="col-span-3">Lead</div>
                            <div className="col-span-2">Contact</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-1">Score</div>
                            <div className="col-span-2">Source</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {loading ? (
                            <div className="px-6 py-6 text-sm text-gray-500">Loading leads...</div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-gray-500">
                                No leads found yet. Create your first lead to get started.
                                <div className="mt-4">
                                    <button
                                        className="bg-black text-white px-5 py-2 rounded-xl font-semibold"
                                        onClick={openCreate}
                                    >
                                        Create Lead
                                    </button>
                                </div>
                            </div>
                        ) : (
                            filteredLeads.map((lead) => (
                                <div
                                    key={lead._id}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 border-t border-gray-100 items-center"
                                >
                                    <div className="md:col-span-3">
                                        <p className="font-semibold text-gray-900">{lead.name || 'Unnamed Lead'}</p>
                                        <p className="text-xs text-gray-500">Last update: {formatDate(lead.updatedAt)}</p>
                                    </div>
                                    <div className="md:col-span-2 text-sm text-gray-700">
                                        <p>{lead.email || '-'}</p>
                                        <p className="text-xs text-gray-400">{lead.phone || '-'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span
                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(lead.status)}`}
                                        >
                                            {STATUS_OPTIONS.find((option) => option.value === lead.status)?.label || 'New'}
                                        </span>
                                    </div>
                                    <div className="md:col-span-1 text-sm font-semibold text-gray-900">
                                        {lead.score ?? 0}
                                    </div>
                                    <div className="md:col-span-2 text-sm text-gray-600">
                                        {lead.source || '-'}
                                    </div>
                                    <div className="md:col-span-2 flex items-center justify-start md:justify-end gap-2">
                                        <button
                                            className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                            onClick={() => openEdit(lead)}
                                        >
                                            <Pencil size={14} />
                                            Edit
                                        </button>
                                        <button
                                            className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                                            onClick={() => handleDelete(lead)}
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {activeLead ? 'Edit Lead' : 'Create Lead'}
                                </h2>
                                <p className="text-sm text-gray-500">Fill in the lead details to update your pipeline.</p>
                            </div>
                            <button
                                className="text-sm text-gray-400 hover:text-gray-600"
                                onClick={closeModal}
                            >
                                Close
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Name</label>
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Lead name"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Email</label>
                                <input
                                    value={form.email}
                                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Lead email"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Phone</label>
                                <input
                                    value={form.phone}
                                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Lead phone"
                                />
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
                                <label className="text-sm font-semibold text-gray-800">Score</label>
                                <input
                                    type="number"
                                    value={form.score}
                                    onChange={(event) => setForm({ ...form, score: Number(event.target.value) })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="0"
                                    min={0}
                                    max={100}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Source</label>
                                <input
                                    value={form.source}
                                    onChange={(event) => setForm({ ...form, source: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Referral, Website, etc."
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-sm font-semibold text-gray-800">Tags</label>
                                <input
                                    value={form.tags}
                                    onChange={(event) => setForm({ ...form, tags: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Comma separated tags"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex items-center justify-between">
                            <button
                                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                                onClick={() => navigate('/dashboard')}
                            >
                                Back to dashboard
                            </button>
                            <div className="flex items-center gap-3">
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
                                    {saving ? 'Saving...' : 'Save Lead'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CrmLeadsPage;
