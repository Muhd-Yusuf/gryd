import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { registerCommunityEmbed, type CommunityEmbedConfig } from '../embed/communityEmbed';
import { communityGet, communityPost, getTenantId, resolveTenantId } from '../lib/api';

interface EmbedElement extends HTMLElement {
    setConfig?: (config: CommunityEmbedConfig) => void;
    refreshToken?: () => Promise<void>;
}

const CommunityPage = () => {
    const [subgrids, setSubgrids] = useState<Array<{ _id: string; name: string }>>([]);
    const [activeSubgridId, setActiveSubgridId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const containerRef = useRef<HTMLDivElement | null>(null);
    const embedRef = useRef<EmbedElement | null>(null);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [tenantId, setTenantId] = useState(getTenantId());

    useEffect(() => {
        registerCommunityEmbed();
        if (containerRef.current && !embedRef.current) {
            const el = document.createElement('syphor-community-embed') as EmbedElement;
            containerRef.current.appendChild(el);
            embedRef.current = el;
        }
    }, []);

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
        const loadSubgrids = async () => {
            if (!tenantId) {
                return;
            }
            setLoading(true);
            setError('');
            try {
                const response = await communityGet(`/tenants/${tenantId}/subgrids`);
                const list = response?.data || [];
                setSubgrids(list);
                const querySubgrid = searchParams.get('subgrid');
                const initial = querySubgrid || list?.[0]?._id || '';
                if (initial) {
                    setActiveSubgridId(initial);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load subgrids.');
            } finally {
                setLoading(false);
            }
        };

        loadSubgrids();
    }, [tenantId, searchParams]);

    useEffect(() => {
        if (!activeSubgridId) {
            return;
        }
        setSearchParams({ subgrid: activeSubgridId });
    }, [activeSubgridId, setSearchParams]);

    useEffect(() => {
        if (!activeSubgridId) {
            return;
        }

        const tokenProvider = async () => {
            const response = await communityPost(`/subgrids/${activeSubgridId}/embed-token`, {});
            return response?.token || '';
        };

        const config: CommunityEmbedConfig = {
            subgridId: activeSubgridId,
            tokenProvider,
            baseUrl: import.meta.env.VITE_EMBED_BASE_URL || '',
            theme: 'light',
            readonly: true,
            refreshIntervalMs: 5 * 60 * 1000,
        };

        embedRef.current?.setConfig?.(config);
    }, [activeSubgridId]);

    const handleManualRefresh = () => {
        void embedRef.current?.refreshToken?.();
    };

    return (
        <Layout>
            <div className="p-4 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Community Subgrids</h1>
                            <p className="text-sm text-gray-500 mt-1">Embedded community spaces per realtor account.</p>
                            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                className="flex items-center gap-2 text-sm font-semibold border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50"
                                onClick={handleManualRefresh}
                            >
                                <RefreshCw size={16} />
                                Refresh Token
                            </button>
                            <button
                                className="text-sm font-semibold bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800"
                                onClick={() => navigate('/community/admin')}
                            >
                                Admin View
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
                        <aside className="bg-white border border-gray-200 rounded-2xl p-4">
                            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">Subgrids</h2>
                            <div className="space-y-2">
                                {loading && <p className="text-xs text-gray-400">Loading subgrids...</p>}
                                {subgrids.length === 0 && !loading && (
                                    <p className="text-xs text-gray-400">No subgrids yet.</p>
                                )}
                                {subgrids.map((subgrid) => (
                                    <button
                                        key={subgrid._id}
                                        className={`w-full text-left px-4 py-2 rounded-xl text-sm font-semibold ${activeSubgridId === subgrid._id ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                        onClick={() => setActiveSubgridId(subgrid._id)}
                                    >
                                        {subgrid.name}
                                    </button>
                                ))}
                            </div>
                        </aside>

                        <section className="bg-white border border-gray-200 rounded-2xl p-4">
                            <div ref={containerRef} />
                        </section>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default CommunityPage;
