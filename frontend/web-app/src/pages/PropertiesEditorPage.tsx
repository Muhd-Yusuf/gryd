import {
    ArrowLeft,
    Sun,
    Undo2,
    Redo2,
    Monitor,
    Tablet,
    Smartphone,
    Search,
    Globe,
    Eye,
    Upload,
    Wrench,
    ChevronDown,
    Type,
    Image as ImageIcon,
    Square,
    LayoutGrid,
    List,
    Video,
    Share2,
    Menu
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

const ELEMENT_CATEGORIES = [
    { label: 'Text', icon: Type },
    { label: 'Image', icon: ImageIcon },
    { label: 'Button', icon: Square },
    { label: 'Strip', icon: LayoutGrid },
    { label: 'Box', icon: Menu },
    { label: 'Gallery', icon: Share2 },
    { label: 'Menu', icon: List },
    { label: 'Forms', icon: Square },
    { label: 'Video', icon: Video },
    { label: 'List', icon: List },
    { label: 'Embed', icon: Globe },
    { label: 'Social', icon: Share2 }
];

const HEADING_ITEMS = ['Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5'];
const PARAGRAPH_ITEMS = ['Paragraph 1', 'Paragraph 2', 'Paragraph 3', 'Paragraph 4', 'Paragraph 5', 'Paragraph 6'];
const TITLE_ITEMS = ['Title 1', 'Title 2', 'Title 3', 'Title 4', 'Title 5', 'Title 6'];
const NAV_ITEMS = ['Home', 'Product', 'Services', 'Blog', 'Pricing'];

const PropertiesEditorPage = () => {
    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const [tenantId, setTenantId] = useState(getTenantId());
    const [landingPage, setLandingPage] = useState<any | null>(null);
    const [property, setProperty] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState('');
    const [searchParams] = useSearchParams();
    const landingPageId = searchParams.get('landingPageId') || '';
    const propertyIdParam = searchParams.get('propertyId') || '';

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
        const loadLandingPage = async () => {
            if (!tenantId || !landingPageId) {
                return;
            }
            setLoading(true);
            setError('');
            try {
                const pageRes = await apiFetch(`/properties/tenants/${tenantId}/landing-pages/${landingPageId}`);
                const page = pageRes?.data || null;
                setLandingPage(page);
                const resolvedPropertyId = propertyIdParam || page?.propertyId;
                if (resolvedPropertyId) {
                    const propertyRes = await apiFetch(
                        `/properties/tenants/${tenantId}/properties/${resolvedPropertyId}`
                    );
                    setProperty(propertyRes?.data || null);
                } else {
                    setProperty(null);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load landing page.');
            } finally {
                setLoading(false);
            }
        };

        loadLandingPage();
    }, [tenantId, landingPageId, propertyIdParam]);

    const heroSection = useMemo(() => {
        if (!landingPage?.sections) {
            return null;
        }
        return landingPage.sections.find((section: any) => section?.type === 'hero') || null;
    }, [landingPage]);

    const heroHeadline = heroSection?.headline || landingPage?.title || 'Landing Page';
    const heroDescription = heroSection?.description || landingPage?.description || 'Add a description to your landing page.';
    const heroHighlights = useMemo(() => {
        if (Array.isArray(heroSection?.highlights) && heroSection.highlights.length > 0) {
            return heroSection.highlights;
        }
        if (Array.isArray(property?.features) && property.features.length > 0) {
            return property.features;
        }
        return [];
    }, [heroSection, property]);

    const reportStats = useMemo(
        () => ([
            { label: 'Views', value: String(landingPage?.viewCount ?? 0), delta: '' },
            { label: 'Leads', value: String(landingPage?.leadCount ?? 0), delta: '' },
            { label: 'Status', value: landingPage?.status || 'draft', delta: '' },
            {
                label: 'Generated',
                value: landingPage?.lastGeneratedAt
                    ? new Date(landingPage.lastGeneratedAt).toLocaleDateString()
                    : 'Not yet',
                delta: '',
            },
        ]),
        [landingPage]
    );

    const logoItems = useMemo(() => {
        if (Array.isArray(property?.images) && property.images.length > 0) {
            return property.images.slice(0, 4);
        }
        if (Array.isArray(landingPage?.seoKeywords) && landingPage.seoKeywords.length > 0) {
            return landingPage.seoKeywords.slice(0, 4);
        }
        return [];
    }, [property, landingPage]);

    const featureItems = useMemo(
        () => heroHighlights.map((text: string, index: number) => ({
            title: text,
            text: index === 0 && property?.addressLine1 ? property.addressLine1 : '',
        })),
        [heroHighlights, property]
    );

    const displayUrl = landingPage?.publishedUrl || (landingPage?.slug ? `https://www.syphor.com/${landingPage.slug}` : 'Connect your domain');

    const handleSave = async () => {
        if (!tenantId || !landingPage) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await apiFetch(`/properties/tenants/${tenantId}/landing-pages/${landingPage._id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    title: landingPage.title,
                    description: landingPage.description,
                    sections: landingPage.sections || [],
                }),
            });
            setLandingPage(response?.data || landingPage);
        } catch (err: any) {
            setError(err.message || 'Failed to save landing page.');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!tenantId || !landingPage) {
            return;
        }
        setPublishing(true);
        setError('');
        try {
            const response = await apiFetch(
                `/properties/tenants/${tenantId}/landing-pages/${landingPage._id}/publish`,
                { method: 'POST' }
            );
            setLandingPage(response?.data || landingPage);
        } catch (err: any) {
            setError(err.message || 'Failed to publish landing page.');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <Layout>
            <div className="relative">
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="border-b border-gray-200 px-4 py-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    className="flex items-center gap-2 text-xs font-semibold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                                    onClick={() => setSelectedElement('Back to Dashboard')}
                                >
                                    <ArrowLeft size={14} />
                                    Back to Dashboard
                                </button>
                                <button
                                    className="flex items-center gap-2 border border-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold"
                                    onClick={() => setSelectedElement('Light Mode')}
                                >
                                    <Sun size={14} />
                                    Light Mode
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="flex items-center gap-2 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    className="flex items-center gap-2 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                                    onClick={() => setSelectedElement('Preview')}
                                >
                                    <Eye size={14} />
                                    Preview
                                </button>
                                <button
                                    className="flex items-center gap-2 text-xs font-semibold bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-900"
                                    onClick={handlePublish}
                                    disabled={publishing}
                                >
                                    <Upload size={14} />
                                    {publishing ? 'Publishing...' : 'Publish'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    className="flex items-center gap-1 text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg"
                                    onClick={() => setSelectedElement('Home Menu')}
                                >
                                    Home
                                    <ChevronDown size={14} className="text-gray-400" />
                                </button>
                                <div className="flex items-center gap-2 text-gray-400">
                                    <button
                                        className={`w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center ${selectedElement === 'Desktop' ? 'bg-gray-100 text-gray-800' : 'hover:bg-gray-50'}`}
                                        onClick={() => setSelectedElement('Desktop')}
                                    >
                                        <Monitor size={16} />
                                    </button>
                                    <button
                                        className={`w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center ${selectedElement === 'Tablet' ? 'bg-gray-100 text-gray-800' : 'hover:bg-gray-50'}`}
                                        onClick={() => setSelectedElement('Tablet')}
                                    >
                                        <Tablet size={16} />
                                    </button>
                                    <button
                                        className={`w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center ${selectedElement === 'Mobile' ? 'bg-gray-100 text-gray-800' : 'hover:bg-gray-50'}`}
                                        onClick={() => setSelectedElement('Mobile')}
                                    >
                                        <Smartphone size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-w-[260px] items-center gap-2 border border-gray-200 px-3 py-1.5 rounded-xl bg-white">
                                <button className="text-gray-400" onClick={() => setSelectedElement('Domain')}>
                                    <Globe size={14} />
                                </button>
                                <button
                                    className="text-xs text-gray-500 flex-1 text-left"
                                    onClick={() => setSelectedElement('Domain')}
                                >
                                    {displayUrl}
                                </button>
                                <button
                                    className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full"
                                    onClick={() => setSelectedElement('Connect Domain')}
                                >
                                    Connect Your Domain
                                </button>
                            </div>

                            <div className="flex items-center gap-2 text-gray-400">
                                <button
                                    className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
                                    onClick={() => setSelectedElement('Undo')}
                                >
                                    <Undo2 size={14} />
                                </button>
                                <button
                                    className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
                                    onClick={() => setSelectedElement('Redo')}
                                >
                                    <Redo2 size={14} />
                                </button>
                                <button
                                    className="text-xs font-semibold text-gray-800 border border-gray-200 px-3 py-1 rounded-lg"
                                    onClick={() => setSelectedElement('Zoom')}
                                >
                                    100%
                                </button>
                                <button
                                    className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
                                    onClick={() => setSelectedElement('Tools')}
                                >
                                    <Wrench size={14} />
                                </button>
                                <button
                                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1 rounded-lg"
                                    onClick={() => setSelectedElement('Search')}
                                >
                                    <Search size={14} />
                                    Search
                                </button>
                            </div>
                        </div>
                        {(error || loading) && (
                            <div className={`text-xs ${error ? 'text-red-500' : 'text-gray-500'}`}>
                                {error || 'Loading landing page...'}
                            </div>
                        )}
                    </div>

                    <div className="flex min-h-[75vh] bg-gray-100">
                        <div className="flex border-r border-gray-200 bg-white">
                            <aside className="w-24 bg-gray-50 border-r border-gray-200 py-4">
                                <div className="flex flex-col items-center gap-2 text-[10px] font-semibold text-gray-500">
                                    {ELEMENT_CATEGORIES.map(({ label, icon: Icon }) => (
                                        <button
                                            key={label}
                                            className={`w-16 rounded-xl py-2 flex flex-col items-center gap-1 ${selectedElement === label ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100'}`}
                                            onClick={() => setSelectedElement(label)}
                                        >
                                            <Icon size={16} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </aside>

                            <aside className="w-72 p-4 border-r border-gray-200 bg-white">
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        className="text-sm font-bold text-gray-900"
                                        onClick={() => setSelectedElement('Add Elements')}
                                    >
                                        Add Elements
                                    </button>
                                    <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedElement('Panel Menu')}>
                                        <Menu size={16} />
                                    </button>
                                </div>
                                <button
                                    className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 mb-4 w-full"
                                    onClick={() => setSelectedElement('Panel Search')}
                                >
                                    <Search size={14} />
                                    Search
                                </button>
                                <div className="space-y-4 text-xs">
                                    <div>
                                        <button
                                            className="text-[11px] font-bold text-gray-500 mb-2"
                                            onClick={() => setSelectedElement('Headings')}
                                        >
                                            Headings
                                        </button>
                                        <div className="space-y-1 text-gray-800 font-semibold">
                                            {HEADING_ITEMS.map((item) => (
                                                <button
                                                    key={item}
                                                    className={`text-left w-full rounded-md px-2 py-1 ${selectedElement === item ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                                                    onClick={() => setSelectedElement(item)}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-200 pt-3">
                                        <button
                                            className="text-[11px] font-bold text-gray-500 mb-2"
                                            onClick={() => setSelectedElement('Paragraphs')}
                                        >
                                            Paragraphs
                                        </button>
                                        <div className="space-y-1 text-gray-800 font-semibold">
                                            {PARAGRAPH_ITEMS.map((item) => (
                                                <button
                                                    key={item}
                                                    className={`text-left w-full rounded-md px-2 py-1 ${selectedElement === item ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                                                    onClick={() => setSelectedElement(item)}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-200 pt-3">
                                        <button
                                            className="text-[11px] font-bold text-gray-500 mb-2"
                                            onClick={() => setSelectedElement('Titles')}
                                        >
                                            Titles
                                        </button>
                                        <div className="space-y-1 text-gray-800 font-semibold">
                                            {TITLE_ITEMS.map((item) => (
                                                <button
                                                    key={item}
                                                    className={`text-left w-full rounded-md px-2 py-1 ${selectedElement === item ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                                                    onClick={() => setSelectedElement(item)}
                                                >
                                                    {item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <main className="flex-1 p-6">
                            <div className="mb-5">
                                <button
                                    className="text-lg font-bold text-gray-900"
                                    onClick={() => setSelectedElement('Canvas Title')}
                                >
                                    Landing Page Builder
                                </button>
                                <button
                                    className="text-xs text-gray-500"
                                    onClick={() => setSelectedElement('Canvas Subtitle')}
                                >
                                    Preview your generated site
                                </button>
                                {selectedElement && (
                                    <p className="text-xs text-indigo-600 font-semibold mt-2">Selected: {selectedElement}</p>
                                )}
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                    <button
                                        className="text-xs font-bold text-gray-800"
                                        onClick={() => setSelectedElement('Site Logo')}
                                    >
                                        slothui
                                    </button>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        {NAV_ITEMS.map((item) => (
                                            <button
                                                key={item}
                                                className={`hover:text-gray-700 ${selectedElement === `Nav: ${item}` ? 'text-indigo-600 font-semibold' : ''}`}
                                                onClick={() => setSelectedElement(`Nav: ${item}`)}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        className="text-[10px] font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-full"
                                        onClick={() => setSelectedElement('Header CTA')}
                                    >
                                        Go Pro Today
                                    </button>
                                </div>

                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedElement('Hero')}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') setSelectedElement('Hero');
                                    }}
                                    className={`border border-gray-200 rounded-2xl p-5 bg-indigo-50/40 cursor-pointer ${selectedElement === 'Hero' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                >
                                    <button
                                        className={`text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full mb-3 ${selectedElement === 'Hero Tag' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedElement('Hero Tag');
                                        }}
                                    >
                                        A Design Breakthrough
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">{heroHeadline}</h2>
                                    <p className="text-xs text-gray-500 mb-4">
                                        {heroDescription}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            className={`text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-full bg-white ${selectedElement === 'Hero Button' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedElement('Hero Button');
                                            }}
                                        >
                                            Download For Free
                                        </button>
                                        <button
                                            className={`text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-full ${selectedElement === 'Hero Button' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedElement('Hero Button');
                                            }}
                                        >
                                            Sign In Today
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedElement('Section Card 1')}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') setSelectedElement('Section Card 1');
                                        }}
                                        className={`h-28 rounded-xl bg-gray-100 cursor-pointer ${selectedElement === 'Section Card 1' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                    />
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedElement('Section Card 2')}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') setSelectedElement('Section Card 2');
                                        }}
                                        className={`h-28 rounded-xl bg-gray-100 cursor-pointer ${selectedElement === 'Section Card 2' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                    />
                                </div>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedElement('Section Wide')}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') setSelectedElement('Section Wide');
                                    }}
                                    className={`h-40 rounded-xl bg-gray-100 cursor-pointer ${selectedElement === 'Section Wide' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                />
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedElement('Report Card')}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') setSelectedElement('Report Card');
                                    }}
                                    className={`border border-gray-200 rounded-2xl p-5 space-y-4 ${selectedElement === 'Report Card' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <button
                                            className="text-sm font-bold text-gray-900"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedElement('Report Header');
                                            }}
                                        >
                                            Demographics Report
                                        </button>
                                        <button
                                            className={`text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full ${selectedElement === 'Report Button' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedElement('Report Button');
                                            }}
                                        >
                                            Customize
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {reportStats.map((stat) => (
                                            <button
                                                key={stat.label}
                                                className={`border border-gray-200 rounded-xl p-3 text-left ${selectedElement === `Stat ${stat.label}` ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedElement(`Stat ${stat.label}`);
                                                }}
                                            >
                                                <p className="text-[10px] font-semibold text-gray-500">{stat.label}</p>
                                                <p className="text-base font-bold text-gray-900 mt-1">{stat.value}</p>
                                                {stat.delta ? (
                                                    <p className="text-[10px] font-semibold text-emerald-600 mt-1">{stat.delta}</p>
                                                ) : null}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-col lg:flex-row gap-3">
                                        <button
                                            className={`flex-1 h-28 rounded-2xl bg-gray-100 border border-gray-200 ${selectedElement === 'Report Map' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedElement('Report Map');
                                            }}
                                        />
                                        <div className="w-full lg:w-40 space-y-2">
                                            {['United States', 'Brazil', 'Japan'].map((label, index) => (
                                                <button
                                                    key={label}
                                                    className="flex items-center gap-2 text-[11px] text-gray-500"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedElement(`Legend ${label}`);
                                                    }}
                                                >
                                                    <span
                                                        className="h-1.5 w-10 rounded-full"
                                                        style={{ backgroundColor: index === 0 ? '#4F46E5' : index === 1 ? '#10B981' : '#F59E0B' }}
                                                    />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {logoItems.length > 0 && (
                                    <>
                                        <button
                                            className="text-xs font-semibold text-gray-500 text-center"
                                            onClick={() => setSelectedElement('Trusted By')}
                                        >
                                            Trusted by 100+ Companies Worldwide.
                                        </button>
                                        <div className="flex flex-wrap items-center justify-center gap-3">
                                            {logoItems.map((logo: string, index: number) => (
                                                <button
                                                    key={`${logo}-${index}`}
                                                    className={`border border-gray-200 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase text-gray-800 ${selectedElement === `Logo ${logo}` ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                                    onClick={() => setSelectedElement(`Logo ${logo}`)}
                                                >
                                                    {logo.startsWith('http') ? (
                                                        <img src={logo} alt="Logo" className="h-4 w-auto" />
                                                    ) : (
                                                        logo
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {featureItems.map((feature: { title: string; text: string }) => (
                                        <button
                                            key={feature.title}
                                            className={`border border-gray-200 rounded-2xl p-4 text-left space-y-2 ${selectedElement === feature.title ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                            onClick={() => setSelectedElement(feature.title)}
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-gray-200" />
                                            <p className="text-sm font-bold text-gray-900">{feature.title}</p>
                                            {feature.text ? <p className="text-xs text-gray-500">{feature.text}</p> : null}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </main>
                    </div>
                </div>

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4 lg:hidden">
                        <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
                        <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                            <span className="text-red-500 text-2xl">!</span>
                        </div>
                        <h2 className="text-base font-bold text-gray-900 mb-2">Your Browser Is Too Small!</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Please resize your browser to be at least 1200px. We don't support mobile browser.
                        </p>
                        <button
                            className="bg-black text-white rounded-full py-2 text-xs font-bold w-full"
                            onClick={() => setSelectedElement('Warning Button')}
                        >
                            Understood, thanks!
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default PropertiesEditorPage;
