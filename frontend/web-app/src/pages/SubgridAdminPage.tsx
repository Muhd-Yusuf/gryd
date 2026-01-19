import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { communityGet, communityPost, getTenantId, resolveTenantId } from '../lib/api';

const SubgridAdminPage = () => {
    const [tenantId, setTenantId] = useState(getTenantId());
    const [searchParams, setSearchParams] = useSearchParams();
    const [subgridId, setSubgridId] = useState('');
    const [analytics, setAnalytics] = useState<any | null>(null);
    const [moderationQueue, setModerationQueue] = useState<any[]>([]);
    const [error, setError] = useState('');

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
        const loadSubgrid = async () => {
            if (!tenantId) {
                return;
            }
            try {
                const response = await communityGet(`/tenants/${tenantId}/subgrids`);
                const list = response?.data || [];
                const querySubgrid = searchParams.get('subgrid');
                const initial = querySubgrid || list?.[0]?._id || '';
                if (initial) {
                    setSubgridId(initial);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load subgrids.');
            }
        };

        loadSubgrid();
    }, [tenantId, searchParams]);

    useEffect(() => {
        if (!subgridId) {
            return;
        }
        setSearchParams({ subgrid: subgridId });
    }, [subgridId, setSearchParams]);

    useEffect(() => {
        const loadAdminData = async () => {
            if (!subgridId) {
                return;
            }
            try {
                const [analyticsRes, moderationRes] = await Promise.all([
                    communityGet(`/subgrids/${subgridId}/analytics`),
                    communityGet(`/subgrids/${subgridId}/moderation`),
                ]);
                setAnalytics(analyticsRes?.data || null);
                setModerationQueue(moderationRes?.data || []);
            } catch (err: any) {
                setError(err.message || 'Failed to load admin data.');
            }
        };

        loadAdminData();
    }, [subgridId]);

    const analyticsCards = useMemo(() => ([
        { label: 'Members', value: analytics?.members ?? 0 },
        { label: 'Channels', value: analytics?.channels ?? 0 },
        { label: 'Messages', value: analytics?.messages ?? 0 },
        { label: 'Flagged', value: analytics?.flagged ?? 0 },
    ]), [analytics]);

    const handleModerationAction = async (flagId: string, action: string) => {
        if (!subgridId) {
            return;
        }
        try {
            await communityPost(`/subgrids/${subgridId}/moderation/${flagId}/action`, { action });
            setModerationQueue((prev) => prev.filter((item) => item._id !== flagId));
        } catch (err: any) {
            setError(err.message || 'Failed to update moderation item.');
        }
    };
    return (
        <Layout>
            <div className="p-4 lg:p-8">
                <div className="max-w-[1200px] mx-auto space-y-8">
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Subgrid Admin</h1>
                            <p className="text-sm text-gray-500 mt-1">Moderation and analytics for a single subgrid.</p>
                            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                        </div>
                        {subgridId && (
                            <div className="text-sm font-semibold text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
                                Subgrid: {subgridId}
                            </div>
                        )}
                    </header>

                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {analyticsCards.map((card) => (
                            <div key={card.label} className="bg-white border border-gray-200 rounded-2xl p-5">
                                <p className="text-xs font-semibold text-gray-400">{card.label}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
                            </div>
                        ))}
                    </section>

                    <section className="bg-white border border-gray-200 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Moderation Queue</h2>
                            <button className="text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50">
                                View All
                            </button>
                        </div>
                        <div className="space-y-4">
                            {moderationQueue.length === 0 && (
                                <p className="text-xs text-gray-400">No flagged content.</p>
                            )}
                            {moderationQueue.map((item) => (
                                <div key={item._id} className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-gray-900">{item.content?.authorId || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500 mt-1">{item.content?.body || item.reason || 'Flagged item'}</p>
                                    </div>
                                    <div className="text-xs text-gray-400">{item.createdAt}</div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-full"
                                            onClick={() => handleModerationAction(item._id, 'remove')}
                                        >
                                            Remove
                                        </button>
                                        <button
                                            className="text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-full"
                                            onClick={() => handleModerationAction(item._id, 'approve')}
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </Layout>
    );
};

export default SubgridAdminPage;
