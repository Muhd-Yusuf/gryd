import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch, resolveTenantId } from '../lib/api';

const PropertiesGeneratingPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState('');
    const propertyId = searchParams.get('propertyId') || '';
    const landingPageId = searchParams.get('landingPageId') || '';

    useEffect(() => {
        let isActive = true;
        const generate = async () => {
            if (!propertyId || !landingPageId) {
                setError('Missing property context.');
                return;
            }
            try {
                const tenantId = await resolveTenantId();
                if (!tenantId) {
                    throw new Error('Missing tenant configuration.');
                }
                const contentRes = await apiFetch(
                    `/properties/tenants/${tenantId}/properties/${propertyId}/generate`,
                    { method: 'POST' }
                );
                const content = contentRes?.data;
                const sections = content
                    ? [
                          {
                              type: 'hero',
                              headline: content.headline,
                              description: content.description,
                              highlights: content.highlights || [],
                          },
                      ]
                    : [];
                await apiFetch(`/properties/tenants/${tenantId}/landing-pages/${landingPageId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        title: content?.headline || '',
                        description: content?.description || '',
                        sections,
                        lastGeneratedAt: new Date().toISOString(),
                    }),
                });
                if (isActive) {
                    navigate(`/properties/editor?landingPageId=${landingPageId}&propertyId=${propertyId}`, { replace: true });
                }
            } catch (err: any) {
                if (isActive) {
                    setError(err.message || 'Failed to generate landing page.');
                }
            }
        };

        generate();
        return () => {
            isActive = false;
        };
    }, [navigate, propertyId, landingPageId]);

    return (
        <Layout>
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                    <div className="mx-auto w-10 h-10 border-2 border-gray-900 rounded-lg rotate-45 mb-3" />
                    <p className="text-xs tracking-[0.3em] font-bold text-gray-900 mb-8">SYPHOR</p>

                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full w-1/4 bg-black rounded-full" />
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                        {error ? error : 'Generating Landing page 20%'}
                    </p>
                </div>
            </div>
        </Layout>
    );
};

export default PropertiesGeneratingPage;
