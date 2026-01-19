import { Search, Plus, Globe, List, LayoutGrid, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

const PropertiesPage = () => {
    const navigate = useNavigate();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [landingPages, setLandingPages] = useState<any[]>([]);
    const [properties, setProperties] = useState<Record<string, any>>({});
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [deletingId, setDeletingId] = useState<string | null>(null);

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
        const loadPages = async () => {
            if (!tenantId) {
                return;
            }
            setLoading(true);
            setError('');
            try {
                const [pagesRes, propsRes] = await Promise.all([
                    apiFetch(`/properties/tenants/${tenantId}/landing-pages`),
                    apiFetch(`/properties/tenants/${tenantId}/properties`),
                ]);
                const pageList = pagesRes?.data || [];
                const propertyList = propsRes?.data || [];
                const propertyMap: Record<string, any> = {};
                propertyList.forEach((item: any) => {
                    propertyMap[item._id] = item;
                });
                setLandingPages(pageList);
                setProperties(propertyMap);
            } catch (err: any) {
                setError(err.message || 'Failed to load landing pages.');
            } finally {
                setLoading(false);
            }
        };

        loadPages();
    }, [tenantId]);

    const filteredPages = useMemo(() => {
        if (!query) {
            return landingPages;
        }
        const lowered = query.toLowerCase();
        return landingPages.filter((page) => {
            const property = properties[page.propertyId];
            const address = property
                ? `${property.addressLine1 || ''} ${property.city || ''} ${property.state || ''}`.trim()
                : '';
            return (
                (page.title || '').toLowerCase().includes(lowered) ||
                (page.slug || '').toLowerCase().includes(lowered) ||
                address.toLowerCase().includes(lowered)
            );
        });
    }, [landingPages, properties, query]);

    const handleDelete = async (page: any) => {
        if (!tenantId || !page?.propertyId) {
            return;
        }
        const confirmed = window.confirm('Delete this property and its landing pages?');
        if (!confirmed) {
            return;
        }
        setDeletingId(page.propertyId);
        setError('');
        try {
            await apiFetch(`/properties/tenants/${tenantId}/properties/${page.propertyId}`, { method: 'DELETE' });
            setLandingPages((prev) => prev.filter((item) => item.propertyId !== page.propertyId));
            setProperties((prev) => {
                const next = { ...prev };
                delete next[page.propertyId];
                return next;
            });
        } catch (err: any) {
            setError(err.message || 'Failed to delete property.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Layout>
            <div className="p-4 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    {/* Header */}
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">My Sites</h1>

                        <div className="flex items-center gap-3 flex-1 max-w-2xl justify-end">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search Properties..."
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-black transition-all bg-white shadow-sm"
                                />
                            </div>
                            <button
                                className="bg-black text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-sm"
                                onClick={() => navigate('/properties/new')}
                            >
                                <Plus size={20} />
                                <span className="hidden sm:inline">New page</span>
                            </button>
                        </div>
                    </header>

                    {/* Filters & View Toggles */}
                    <div className="flex items-center gap-4 mb-12">
                        <div className="relative group">
                            <button className="flex items-center gap-6 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 transition-colors">
                                <span>All Sites ({landingPages.length})</span>
                                <span className="text-[10px] text-gray-400">▼</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-lg shadow-sm">
                            <button
                                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50 transition-colors'}`}
                                onClick={() => setViewMode('list')}
                            >
                                <List size={18} />
                            </button>
                            <button
                                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50 transition-colors'}`}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500 mb-6">{error}</p>}

                    {loading && (
                        <p className="text-sm text-gray-500 mb-6">Loading landing pages...</p>
                    )}

                    {filteredPages.length > 0 ? (
                        viewMode === 'list' ? (
                            <div className="grid gap-4">
                                {filteredPages.map((page) => {
                                    const property = properties[page.propertyId];
                                    const address = property
                                        ? `${property.addressLine1 || ''}, ${property.city || ''} ${property.state || ''}`.trim()
                                        : 'Property details pending';
                                    const status = page.status || 'draft';
                                    const isDeleting = deletingId === page.propertyId;
                                    return (
                                        <div
                                            key={page._id}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    navigate(`/properties/editor?landingPageId=${page._id}&propertyId=${page.propertyId}`);
                                                }
                                            }}
                                            onClick={() =>
                                                navigate(`/properties/editor?landingPageId=${page._id}&propertyId=${page.propertyId}`)
                                            }
                                            className="w-full text-left bg-white border border-gray-200 rounded-2xl px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-all cursor-pointer"
                                        >
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-gray-900">{page.title || address || 'Landing Page'}</h3>
                                                <p className="text-sm text-gray-500 mt-1">{address}</p>
                                                {page.publishedUrl && (
                                                    <p className="text-xs text-indigo-600 mt-2">{page.publishedUrl}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                        status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}
                                                >
                                                    {status}
                                                </span>
                                                <span className="text-xs text-gray-400">{page.viewCount ?? 0} views</span>
                                                <button
                                                    className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate(`/properties/editor?landingPageId=${page._id}&propertyId=${page.propertyId}`);
                                                    }}
                                                >
                                                    <Pencil size={14} />
                                                    Edit
                                                </button>
                                                <button
                                                    className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDelete(page);
                                                    }}
                                                    disabled={isDeleting}
                                                >
                                                    <Trash2 size={14} />
                                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredPages.map((page) => {
                                    const property = properties[page.propertyId];
                                    const address = property
                                        ? `${property.addressLine1 || ''}, ${property.city || ''} ${property.state || ''}`.trim()
                                        : 'Property details pending';
                                    const status = page.status || 'draft';
                                    const isDeleting = deletingId === page.propertyId;
                                    return (
                                        <div key={page._id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{page.title || address || 'Landing Page'}</h3>
                                                    <p className="text-sm text-gray-500 mt-1">{address}</p>
                                                </div>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                        status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}
                                                >
                                                    {status}
                                                </span>
                                            </div>
                                            {page.publishedUrl && (
                                                <p className="text-xs text-indigo-600 mt-3 break-all">{page.publishedUrl}</p>
                                            )}
                                            <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                                                <span>{page.viewCount ?? 0} views</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                                        onClick={() =>
                                                            navigate(`/properties/editor?landingPageId=${page._id}&propertyId=${page.propertyId}`)
                                                        }
                                                    >
                                                        <Pencil size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60"
                                                        onClick={() => handleDelete(page)}
                                                        disabled={isDeleting}
                                                    >
                                                        <Trash2 size={14} />
                                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-center animate-[fadeIn_0.4s_ease-out]">
                            <div className="w-20 h-20 bg-gray-100/50 rounded-full flex items-center justify-center mb-6">
                                <Globe size={40} className="text-gray-300" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Landing Page Catalog Empty</h2>
                            <p className="text-gray-500 mb-10 max-w-sm">Click the button to add a new landing page for your home listing</p>

                            <button
                                className="bg-black text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-3 hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                                onClick={() => navigate('/properties/new')}
                            >
                                <Plus size={22} className="stroke-[3]" />
                                <span>Create New Website</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </Layout>
    );
};

export default PropertiesPage;
