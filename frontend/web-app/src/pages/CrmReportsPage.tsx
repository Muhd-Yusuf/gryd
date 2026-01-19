import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

type Report = {
    _id: string;
    name?: string;
    description?: string;
    status?: string;
    generatedAt?: string | null;
    createdAt?: string;
};

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'generated', label: 'Generated' },
];

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

const CrmReportsPage = () => {
    const [tenantId, setTenantId] = useState(getTenantId());
    const [reports, setReports] = useState<Report[]>([]);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeReport, setActiveReport] = useState<Report | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', status: 'generated' });

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

    const loadReports = useCallback(async () => {
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
            const res = await apiFetch(`/crm/tenants/${tenantId}/reports?${params.toString()}`);
            setReports(res?.data || []);
            setTotal(res?.meta?.total ?? 0);
            setPages(res?.meta?.pages ?? 1);
        } catch (err: any) {
            setError(err.message || 'Failed to load reports.');
        } finally {
            setLoading(false);
        }
    }, [tenantId, page, limit, query, statusFilter]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    useEffect(() => {
        setPage(1);
    }, [query, statusFilter, limit]);

    useEffect(() => {
        if (page > pages && pages > 0) {
            setPage(pages);
        }
    }, [page, pages]);

    const openCreate = () => {
        setActiveReport(null);
        setForm({ name: '', description: '', status: 'generated' });
        setIsModalOpen(true);
    };

    const openEdit = (report: Report) => {
        setActiveReport(report);
        setForm({
            name: report.name || '',
            description: report.description || '',
            status: report.status || 'generated',
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
            setError('Report name is required.');
            return;
        }
        setSaving(true);
        setError('');
        const payload = {
            name: form.name.trim(),
            description: form.description.trim(),
            status: form.status,
        };
        try {
            if (activeReport?._id) {
                const res = await apiFetch(`/crm/tenants/${tenantId}/reports/${activeReport._id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                const updated = res?.data;
                setReports((prev) => prev.map((item) => (item._id === updated?._id ? updated : item)));
            } else {
                const res = await apiFetch(`/crm/tenants/${tenantId}/reports`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const created = res?.data;
                if (created) {
                    setReports((prev) => [created, ...prev]);
                }
            }
            setIsModalOpen(false);
            await loadReports();
        } catch (err: any) {
            setError(err.message || 'Failed to save report.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (report: Report) => {
        if (!tenantId || !report._id) return;
        const confirmed = window.confirm(`Delete report "${report.name || report._id}"?`);
        if (!confirmed) return;
        setError('');
        try {
            await apiFetch(`/crm/tenants/${tenantId}/reports/${report._id}`, { method: 'DELETE' });
            setReports((prev) => prev.filter((item) => item._id !== report._id));
            await loadReports();
        } catch (err: any) {
            setError(err.message || 'Failed to delete report.');
        }
    };

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
                            <p className="text-sm text-gray-500">Generate reports for CRM insights and performance.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="flex items-center gap-2 text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={loadReports}
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
                                New Report
                            </button>
                        </div>
                    </header>

                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <input
                                className="w-full md:w-64 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black"
                                placeholder="Search reports"
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
                            <div className="col-span-4">Report</div>
                            <div className="col-span-4">Description</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-1">Generated</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        {loading ? (
                            <div className="px-6 py-6 text-sm text-gray-500">Loading reports...</div>
                        ) : reports.length === 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-gray-500">
                                No reports yet. Generate one to track CRM performance.
                                <div className="mt-4">
                                    <button
                                        className="bg-black text-white px-5 py-2 rounded-xl font-semibold"
                                        onClick={openCreate}
                                    >
                                        Create Report
                                    </button>
                                </div>
                            </div>
                        ) : (
                            reports.map((report) => (
                                <div
                                    key={report._id}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 border-t border-gray-100 items-center"
                                >
                                    <div className="md:col-span-4">
                                        <p className="font-semibold text-gray-900">{report.name || 'Untitled Report'}</p>
                                        <p className="text-xs text-gray-500">Created {formatDate(report.createdAt)}</p>
                                    </div>
                                    <div className="md:col-span-4 text-sm text-gray-600">
                                        {report.description || '-'}
                                    </div>
                                    <div className="md:col-span-2 text-sm text-gray-600">
                                        {report.status || 'generated'}
                                    </div>
                                    <div className="md:col-span-1 text-sm text-gray-600">
                                        {formatDate(report.generatedAt)}
                                    </div>
                                    <div className="md:col-span-1 flex items-center justify-start md:justify-end gap-2">
                                        <button
                                            className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                            onClick={() => openEdit(report)}
                                        >
                                            <Pencil size={14} />
                                            Edit
                                        </button>
                                        <button
                                            className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                                            onClick={() => handleDelete(report)}
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
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {activeReport ? 'Edit Report' : 'Create Report'}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {activeReport ? 'Update report details and status.' : 'Generate a new CRM report for your team.'}
                                </p>
                            </div>
                            <button
                                className="text-sm text-gray-400 hover:text-gray-600"
                                onClick={closeModal}
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Report name</label>
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Weekly lead performance"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    rows={4}
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
                                {saving ? 'Saving...' : activeReport ? 'Save Report' : 'Create Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CrmReportsPage;
