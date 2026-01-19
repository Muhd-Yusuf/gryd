import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

type Campaign = {
    _id: string;
    name?: string;
    channel?: string;
    status?: string;
    audienceCount?: number;
    scheduledAt?: string | null;
    metrics?: {
        sent?: number;
        delivered?: number;
        replied?: number;
    };
    createdAt?: string;
    updatedAt?: string;
};

const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'mixed', label: 'Mixed' },
];

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
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

const CrmCampaignsPage = () => {
    const [tenantId, setTenantId] = useState(getTenantId());
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [channelFilter, setChannelFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        channel: 'email',
        status: 'draft',
        audienceCount: 0,
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

    const loadCampaigns = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', String(limit));
            if (query.trim()) {
                params.set('q', query.trim());
            }
            if (statusFilter !== 'all') {
                params.set('status', statusFilter);
            }
            if (channelFilter !== 'all') {
                params.set('channel', channelFilter);
            }
            const res = await apiFetch(`/crm/tenants/${tenantId}/campaigns?${params.toString()}`);
            setCampaigns(res?.data || []);
            setTotal(res?.meta?.total ?? 0);
            setPages(res?.meta?.pages ?? 1);
        } catch (err: any) {
            setError(err.message || 'Failed to load campaigns.');
        } finally {
            setLoading(false);
        }
    }, [tenantId, page, limit, query, statusFilter, channelFilter]);

    useEffect(() => {
        loadCampaigns();
    }, [loadCampaigns]);

    useEffect(() => {
        setPage(1);
    }, [query, statusFilter, channelFilter, limit]);

    useEffect(() => {
        if (page > pages && pages > 0) {
            setPage(pages);
        }
    }, [page, pages]);

    const openCreate = () => {
        setActiveCampaign(null);
        setForm({
            name: '',
            channel: 'email',
            status: 'draft',
            audienceCount: 0,
            scheduledAt: '',
        });
        setIsModalOpen(true);
    };

    const openEdit = (campaign: Campaign) => {
        setActiveCampaign(campaign);
        setForm({
            name: campaign.name || '',
            channel: campaign.channel || 'email',
            status: campaign.status || 'draft',
            audienceCount: campaign.audienceCount ?? 0,
            scheduledAt: toDateTimeInput(campaign.scheduledAt),
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
            setError('Campaign name is required.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            name: form.name.trim(),
            channel: form.channel,
            status: form.status,
            audienceCount: Number(form.audienceCount) || 0,
            scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
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
            setIsModalOpen(false);
            await loadCampaigns();
        } catch (err: any) {
            setError(err.message || 'Failed to save campaign.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (campaign: Campaign) => {
        if (!tenantId || !campaign._id) return;
        const confirmed = window.confirm(`Delete campaign "${campaign.name || campaign._id}"?`);
        if (!confirmed) return;
        setError('');
        try {
            await apiFetch(`/crm/tenants/${tenantId}/campaigns/${campaign._id}`, { method: 'DELETE' });
            setCampaigns((prev) => prev.filter((item) => item._id !== campaign._id));
            await loadCampaigns();
        } catch (err: any) {
            setError(err.message || 'Failed to delete campaign.');
        }
    };

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
                            <p className="text-sm text-gray-500">Run email and SMS campaigns from your CRM.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="flex items-center gap-2 text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={loadCampaigns}
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
                                New Campaign
                            </button>
                        </div>
                    </header>

                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                className="w-full md:w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                                placeholder="Search campaigns"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <select
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-black"
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                            >
                                <option value="all">All statuses</option>
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-black"
                                value={channelFilter}
                                onChange={(event) => setChannelFilter(event.target.value)}
                            >
                                <option value="all">All channels</option>
                                {CHANNEL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>{total} total</span>
                            <select
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-black"
                                value={limit}
                                onChange={(event) => setLimit(Number(event.target.value))}
                            >
                                {[10, 20, 50].map((size) => (
                                    <option key={size} value={size}>
                                        {size} / page
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-gray-500 bg-gray-50">
                            <div className="col-span-4">Campaign</div>
                            <div className="col-span-2">Channel</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Audience</div>
                            <div className="col-span-1">Scheduled</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {loading ? (
                            <div className="px-6 py-6 text-sm text-gray-500">Loading campaigns...</div>
                        ) : campaigns.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-gray-500">
                                No campaigns yet. Create one to engage your audience.
                                <div className="mt-4">
                                    <button
                                        className="bg-black text-white px-5 py-2 rounded-xl font-semibold"
                                        onClick={openCreate}
                                    >
                                        Create Campaign
                                    </button>
                                </div>
                            </div>
                        ) : (
                            campaigns.map((campaign) => (
                                <div
                                    key={campaign._id}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 border-t border-gray-100 items-center"
                                >
                                    <div className="md:col-span-4">
                                        <p className="font-semibold text-gray-900">{campaign.name || 'Untitled Campaign'}</p>
                                        <p className="text-xs text-gray-500">
                                            Sent {campaign.metrics?.sent ?? 0} • Delivered {campaign.metrics?.delivered ?? 0} • Replied {campaign.metrics?.replied ?? 0}
                                        </p>
                                    </div>
                                    <div className="md:col-span-2 text-sm text-gray-600">
                                        {CHANNEL_OPTIONS.find((option) => option.value === campaign.channel)?.label || 'Email'}
                                    </div>
                                    <div className="md:col-span-2 text-sm text-gray-600">
                                        {STATUS_OPTIONS.find((option) => option.value === campaign.status)?.label || 'Draft'}
                                    </div>
                                    <div className="md:col-span-2 text-sm text-gray-600">
                                        {campaign.audienceCount ?? 0}
                                    </div>
                                    <div className="md:col-span-1 text-sm text-gray-600">
                                        {formatDate(campaign.scheduledAt)}
                                    </div>
                                    <div className="md:col-span-1 flex items-center justify-start md:justify-end gap-2">
                                        <button
                                            className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                            onClick={() => openEdit(campaign)}
                                        >
                                            <Pencil size={14} />
                                            Edit
                                        </button>
                                        <button
                                            className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                                            onClick={() => handleDelete(campaign)}
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500 mt-4">
                        <span>
                            Page {page} of {pages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50"
                                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                disabled={page <= 1 || loading}
                            >
                                Prev
                            </button>
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50"
                                onClick={() => setPage((prev) => Math.min(prev + 1, pages))}
                                disabled={page >= pages || loading}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {activeCampaign ? 'Edit Campaign' : 'Create Campaign'}
                                </h2>
                                <p className="text-sm text-gray-500">Configure your campaign audience and schedule.</p>
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
                                <label className="text-sm font-semibold text-gray-800">Name</label>
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Holiday Open House"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Channel</label>
                                <select
                                    value={form.channel}
                                    onChange={(event) => setForm({ ...form, channel: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-black"
                                >
                                    {CHANNEL_OPTIONS.map((option) => (
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
                                <label className="text-sm font-semibold text-gray-800">Audience size</label>
                                <input
                                    type="number"
                                    value={form.audienceCount}
                                    onChange={(event) => setForm({ ...form, audienceCount: Number(event.target.value) })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Scheduled at</label>
                                <input
                                    type="datetime-local"
                                    value={form.scheduledAt}
                                    onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
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
                                {saving ? 'Saving...' : 'Save Campaign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CrmCampaignsPage;
