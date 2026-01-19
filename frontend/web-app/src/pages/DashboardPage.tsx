import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    Check,
    Home,
    Globe,
    Users,
    Gift
} from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch, getTenantId, resolveTenantId } from '../lib/api';

type Lead = {
    _id: string;
    name?: string;
    email?: string;
    status?: string;
    source?: string;
    createdAt?: string;
};

type LandingPage = {
    _id: string;
    propertyId?: string;
    title?: string;
    slug?: string;
    status?: string;
    viewCount?: number;
    leadCount?: number;
    createdAt?: string;
    updatedAt?: string;
};

type Task = {
    _id: string;
    title?: string;
    status?: string;
    dueDate?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

type Campaign = {
    _id: string;
    name?: string;
    status?: string;
    scheduledAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
};

const DashboardPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(location.state?.showSuccessModal || false);
    const [tenantId, setTenantId] = useState(getTenantId());
    const [metrics, setMetrics] = useState({
        propertyCount: 0,
        viewCount: 0,
        leadCount: 0,
        referralCount: 0,
    });
    const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
    const [recentPages, setRecentPages] = useState<LandingPage[]>([]);
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const stats = useMemo(
        () => [
            { icon: Home, label: 'Total Property', value: String(metrics.propertyCount), color: 'bg-[#ECFDF5]', iconColor: 'text-[#10B981]' },
            { icon: Globe, label: 'Page views', value: String(metrics.viewCount), color: 'bg-[#EFF6FF]', iconColor: 'text-[#3B82F6]' },
            { icon: Users, label: 'Total leads', value: String(metrics.leadCount), color: 'bg-[#F5F3FF]', iconColor: 'text-[#8B5CF6]' },
            { icon: Gift, label: 'Total Referrals', value: String(metrics.referralCount), color: 'bg-[#FDF2F8]', iconColor: 'text-[#EC4899]' },
        ],
        [metrics]
    );

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
        const loadDashboard = async () => {
            if (!tenantId) return;
            setLoading(true);
            setError('');
            try {
                const [propertiesRes, pagesRes, leadsRes, tasksRes, campaignsRes] = await Promise.all([
                    apiFetch(`/properties/tenants/${tenantId}/properties`),
                    apiFetch(`/properties/tenants/${tenantId}/landing-pages`),
                    apiFetch(`/crm/tenants/${tenantId}/leads`),
                    apiFetch(`/crm/tenants/${tenantId}/tasks`),
                    apiFetch(`/crm/tenants/${tenantId}/campaigns`),
                ]);
                const properties = propertiesRes?.data || [];
                const pages = pagesRes?.data || [];
                const leads = leadsRes?.data || [];
                const tasks = tasksRes?.data || [];
                const campaigns = campaignsRes?.data || [];

                const viewCount = pages.reduce((total: number, page: LandingPage) => total + (page.viewCount || 0), 0);
                const referralCount = leads.filter((lead: Lead) =>
                    String(lead.source || '').toLowerCase().includes('referral')
                ).length;

                setMetrics({
                    propertyCount: properties.length,
                    viewCount,
                    leadCount: leads.length,
                    referralCount,
                });
                setRecentPages(pages.slice(0, 5));
                setRecentLeads(leads.slice(0, 5));
                setRecentTasks(tasks.slice(0, 5));
                setRecentCampaigns(campaigns.slice(0, 5));
            } catch (err: any) {
                setError(err.message || 'Failed to load dashboard metrics.');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [tenantId]);

    const leadStatusLabel = (status?: string) => {
        switch (status) {
            case 'qualified':
                return 'Qualified';
            case 'nurturing':
                return 'Nurturing';
            case 'active_buyer':
                return 'Active Buyer';
            case 'closed':
                return 'Closed';
            default:
                return 'New';
        }
    };

    const taskStatusLabel = (status?: string) => {
        switch (status) {
            case 'in_progress':
                return 'In Progress';
            case 'review':
                return 'Review';
            case 'completed':
                return 'Completed';
            default:
                return 'To Do';
        }
    };

    const formatDate = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString();
    };

    const activityItems = useMemo(() => {
        const items: { id: string; label: string; meta: string; date?: string; target: string }[] = [];
        recentLeads.forEach((lead) => {
            items.push({
                id: `lead-${lead._id}`,
                label: lead.name || lead.email || 'New lead',
                meta: `Lead • ${leadStatusLabel(lead.status)}`,
                date: lead.createdAt,
                target: '/crm/leads',
            });
        });
        recentPages.forEach((page) => {
            items.push({
                id: `page-${page._id}`,
                label: page.title || page.slug || 'Landing page updated',
                meta: `Landing Page • ${page.status || 'draft'}`,
                date: page.updatedAt || page.createdAt,
                target: '/properties',
            });
        });
        recentTasks.forEach((task) => {
            items.push({
                id: `task-${task._id}`,
                label: task.title || 'Task updated',
                meta: `Task • ${taskStatusLabel(task.status)}`,
                date: task.updatedAt || task.createdAt,
                target: '/crm/tasks',
            });
        });
        recentCampaigns.forEach((campaign) => {
            items.push({
                id: `campaign-${campaign._id}`,
                label: campaign.name || 'Campaign updated',
                meta: `Campaign • ${campaign.status || 'draft'}`,
                date: campaign.updatedAt || campaign.createdAt,
                target: '/crm/campaigns',
            });
        });
        return items
            .filter((item) => item.date)
            .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
            .slice(0, 6);
    }, [recentLeads, recentPages, recentTasks, recentCampaigns]);

    const leadStatusSummary = useMemo(() => {
        const summary: Record<string, number> = {
            new: 0,
            qualified: 0,
            nurturing: 0,
            active_buyer: 0,
            closed: 0,
        };
        recentLeads.forEach((lead) => {
            const key = lead.status || 'new';
            summary[key] = (summary[key] || 0) + 1;
        });
        return summary;
    }, [recentLeads]);

    const topLandingPages = useMemo(() => {
        return [...recentPages].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4);
    }, [recentPages]);

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto">
                    {/* Header */}
                    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                className="text-sm font-semibold border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"
                                onClick={() => navigate('/crm/leads')}
                            >
                                View all leads
                            </button>
                            <button
                                className="text-sm font-semibold bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800"
                                onClick={() => navigate('/admin')}
                            >
                                Admin Dashboard
                            </button>
                        </div>
                    </header>

                    {(error || loading) && (
                        <p className={`text-sm mb-4 ${error ? 'text-red-500' : 'text-gray-500'}`}>
                            {error || 'Loading dashboard...'}
                        </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center`}>
                                        <stat.icon className={stat.iconColor} size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 mb-1">{stat.label}</p>
                                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                    </div>
                                </div>
                                <div className="bg-[#ECFDF5] p-1.5 rounded-lg">
                                    <TrendingUp size={16} className="text-[#10B981]" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Activity Card */}
                        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-8 min-h-[400px] shadow-sm relative overflow-hidden">
                            <h3 className="font-bold text-lg mb-6 text-gray-900">Activity</h3>
                            {activityItems.length === 0 ? (
                                <div className="absolute inset-x-8 top-24 bottom-8 flex items-center justify-center">
                                    <div className="text-gray-300 flex flex-col items-center">
                                        <div className="w-1 h-32 bg-gray-50 rounded-full mb-4"></div>
                                        <p className="text-sm font-medium">No activity data yet</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activityItems.map((item) => (
                                        <button
                                            key={item.id}
                                            className="w-full flex items-center justify-between border border-gray-100 rounded-2xl px-4 py-3 text-left hover:border-gray-200"
                                            onClick={() => navigate(item.target)}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                                                <p className="text-xs text-gray-500">{item.meta}</p>
                                            </div>
                                            <div className="text-xs text-gray-400">{formatDate(item.date)}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Leads Card */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                            <h3 className="font-bold text-lg mb-6 text-gray-900">Leads</h3>
                            {recentLeads.length === 0 ? (
                                <p className="text-sm text-gray-400">No leads captured yet.</p>
                            ) : (
                                <div className="space-y-4">
                                    {recentLeads.map((lead) => (
                                        <div key={lead._id} className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{lead.name || 'Unnamed Lead'}</p>
                                                <p className="text-xs text-gray-400">{lead.email || 'No email'}</p>
                                            </div>
                                            <span className="text-xs font-semibold text-gray-500">{leadStatusLabel(lead.status)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                className="mt-6 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                onClick={() => navigate('/crm/leads')}
                            >
                                Manage leads
                            </button>
                        </div>

                        {/* Agent Performance */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 min-h-[300px] shadow-sm text-gray-300">
                            <h3 className="font-bold text-lg mb-6 text-gray-900">Agent Performance</h3>
                            {recentLeads.length === 0 ? (
                                <p className="text-sm text-gray-400">No lead activity yet. Agent performance will appear here.</p>
                            ) : (
                                <div className="space-y-3 text-sm text-gray-600">
                                    <div className="flex items-center justify-between">
                                        <span>New Leads</span>
                                        <span className="font-semibold text-gray-900">{leadStatusSummary.new}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Qualified</span>
                                        <span className="font-semibold text-gray-900">{leadStatusSummary.qualified}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Nurturing</span>
                                        <span className="font-semibold text-gray-900">{leadStatusSummary.nurturing}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Active Buyers</span>
                                        <span className="font-semibold text-gray-900">{leadStatusSummary.active_buyer}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* My Task */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 min-h-[300px] shadow-sm">
                            <h3 className="font-bold text-lg mb-6 text-gray-900">My Task</h3>
                            {recentTasks.length === 0 ? (
                                <p className="text-sm text-gray-400">No tasks yet. Tasks created in CRM will show here.</p>
                            ) : (
                                <div className="space-y-3">
                                    {recentTasks.map((task) => (
                                        <div key={task._id} className="flex items-center justify-between text-sm text-gray-600">
                                            <div>
                                                <p className="font-semibold text-gray-900">{task.title || 'Task'}</p>
                                                <p className="text-xs text-gray-400">Status: {taskStatusLabel(task.status)}</p>
                                            </div>
                                            <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                className="mt-6 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                onClick={() => navigate('/crm/tasks')}
                            >
                                Manage tasks
                            </button>
                        </div>

                        {/* User Tracking */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 min-h-[300px] shadow-sm">
                            <h3 className="font-bold text-lg mb-6 text-gray-900">User Tracking</h3>
                            {topLandingPages.length === 0 ? (
                                <p className="text-sm text-gray-400">Connect landing pages to start tracking user behavior.</p>
                            ) : (
                                <div className="space-y-3">
                                    {topLandingPages.map((page) => (
                                        <div key={page._id} className="flex items-center justify-between text-sm text-gray-600">
                                            <div>
                                                <p className="font-semibold text-gray-900">{page.title || page.slug || 'Landing Page'}</p>
                                                <p className="text-xs text-gray-400">{page.leadCount ?? 0} leads</p>
                                            </div>
                                            <span className="text-xs text-gray-400">{page.viewCount ?? 0} views</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                className="mt-6 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                onClick={() => navigate('/properties')}
                            >
                                View properties
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-[40px] p-12 max-w-lg w-full text-center shadow-2xl relative animate-[scaleUp_0.3s_ease-out]">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
                            <Check size={32} className="text-white" strokeWidth={3} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Created Successfully...</h2>
                        <p className="text-gray-500 mb-10 text-[17px]">Launch your first Landing page</p>
                        <button
                            onClick={() => setShowModal(false)}
                            className="bg-black text-white w-full py-4 rounded-2xl font-bold text-[17px] hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </Layout>
    );
};

export default DashboardPage;
