import { useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch, resolveTenantId } from '../lib/api';

const PropertiesNewPage = () => {
    const navigate = useNavigate();
    const [mlsId, setMlsId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const propertyType = 'Residential Listing';

    const handleGenerate = async () => {
        if (!mlsId) {
            setError('MLS ID is required.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const tenantId = await resolveTenantId();
            if (!tenantId) {
                throw new Error('Missing tenant configuration.');
            }
            const propertyRes = await apiFetch(
                `/properties/tenants/${tenantId}/properties/mls/${encodeURIComponent(mlsId)}`,
                { method: 'POST' }
            );
            const property = propertyRes?.data;
            if (!property?._id) {
                throw new Error('Failed to create property.');
            }
            const pageRes = await apiFetch(`/properties/tenants/${tenantId}/landing-pages`, {
                method: 'POST',
                body: JSON.stringify({
                    propertyId: property._id,
                    title: property.title || `MLS ${mlsId}`,
                }),
            });
            const landingPage = pageRes?.data;
            if (!landingPage?._id) {
                throw new Error('Failed to create landing page.');
            }
            navigate(`/properties/generating?propertyId=${property._id}&landingPageId=${landingPage._id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to generate landing page.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="p-4 lg:p-10">
                <div className="max-w-[1200px] mx-auto">
                    <button
                        className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-6 hover:text-black"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    <div className="max-w-xl bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                        <h1 className="text-xl font-bold text-gray-900">New property page</h1>
                        <p className="text-sm text-gray-500 mt-1 mb-8">Create landing page to promote your property</p>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">Type of property</label>
                                <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800">
                                    <span>{propertyType}</span>
                                    <ChevronDown size={16} className="text-gray-500" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">MLS ID</label>
                                <input
                                    type="text"
                                    value={mlsId}
                                    onChange={(event) => setMlsId(event.target.value)}
                                    placeholder="Enter property MLS ID"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-black"
                                />
                            </div>

                            {error && <p className="text-xs text-red-500">{error}</p>}

                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full bg-black text-white py-3 rounded-full font-bold hover:bg-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Generating...' : 'Generate Landing page'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default PropertiesNewPage;
