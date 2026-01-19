import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

type Stage = {
    _id: string;
    name?: string;
    order?: number;
    isDefault?: boolean;
    createdAt?: string;
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

const CrmPipelinePage = () => {
    const [tenantId, setTenantId] = useState(getTenantId());
    const [stages, setStages] = useState<Stage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeStage, setActiveStage] = useState<Stage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ name: '', order: 0 });

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

    const loadPipeline = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const [stagesRes, leadsRes] = await Promise.all([
                apiFetch(`/crm/tenants/${tenantId}/pipeline-stages`),
                apiFetch(`/crm/tenants/${tenantId}/leads`),
            ]);
            const stageList = stagesRes?.data || [];
            const leadList = leadsRes?.data || [];
            stageList.sort((a: Stage, b: Stage) => (a.order ?? 0) - (b.order ?? 0));
            setStages(stageList);
            setLeads(leadList);
        } catch (err: any) {
            setError(err.message || 'Failed to load pipeline.');
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        loadPipeline();
    }, [loadPipeline]);

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
        setForm({ name: '', order: stages.length });
        setIsModalOpen(true);
    };

    const openEdit = (stage: Stage) => {
        setActiveStage(stage);
        setForm({
            name: stage.name || '',
            order: stage.order ?? 0,
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

    const handleDelete = async (stage: Stage) => {
        if (!tenantId || !stage._id) return;
        const confirmed = window.confirm(`Delete stage "${stage.name || stage._id}"?`);
        if (!confirmed) return;
        setError('');
        try {
            await apiFetch(`/crm/tenants/${tenantId}/pipeline-stages/${stage._id}`, { method: 'DELETE' });
            setStages((prev) => prev.filter((item) => item._id !== stage._id));
        } catch (err: any) {
            setError(err.message || 'Failed to delete pipeline stage.');
        }
    };

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
                            <p className="text-sm text-gray-500">Manage your CRM pipeline stages and lead flow.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="flex items-center gap-2 text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={loadPipeline}
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
                                New Stage
                            </button>
                        </div>
                    </header>

                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Pipeline Stages</h2>
                            {loading ? (
                                <p className="text-sm text-gray-500">Loading stages...</p>
                            ) : stages.length === 0 ? (
                                <p className="text-sm text-gray-500">No stages yet. Create your first stage.</p>
                            ) : (
                                <div className="space-y-3">
                                    {stages.map((stage) => (
                                        <div
                                            key={stage._id}
                                            className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{stage.name || 'Untitled Stage'}</p>
                                                <p className="text-xs text-gray-400">Order: {stage.order ?? 0}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {stage.isDefault && (
                                                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                                        Default
                                                    </span>
                                                )}
                                                <button
                                                    className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                                    onClick={() => openEdit(stage)}
                                                >
                                                    <Pencil size={14} />
                                                    Edit
                                                </button>
                                                <button
                                                    className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                                                    onClick={() => handleDelete(stage)}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Lead Status Summary</h2>
                            <div className="space-y-3">
                                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">{label}</span>
                                        <span className="font-semibold text-gray-900">{leadSummary[key] || 0}</span>
                                    </div>
                                ))}
                            </div>
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
                                    {activeStage ? 'Edit Stage' : 'Create Stage'}
                                </h2>
                                <p className="text-sm text-gray-500">Define the stages of your lead pipeline.</p>
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
                                <label className="text-sm font-semibold text-gray-800">Stage name</label>
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    placeholder="Qualification"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-800">Order</label>
                                <input
                                    type="number"
                                    value={form.order}
                                    onChange={(event) => setForm({ ...form, order: Number(event.target.value) })}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                    min={0}
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
                                {saving ? 'Saving...' : 'Save Stage'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CrmPipelinePage;
