import { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Bell,
    Bot,
    DollarSign,
    LayoutDashboard,
    LogOut,
    Menu,
    Search,
    Settings,
    Shield,
    Users,
    X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SyphorLogo } from '../components/Sidebar';

type DashboardData = {
    kpis: {
        activeUsers: { value: number; delta: number };
        landingPageViews: { value: number; delta: number };
        aiRequests: { value: number; delta: number };
        responseTimeMs: { value: number; delta: number };
    };
    userGrowth: {
        labels: string[];
        users: number[];
        revenue: number[];
    };
    aiCost: {
        total: number;
        breakdown: Array<{ label: string; value: number }>;
    };
    leadPipeline: {
        labels: string[];
        values: number[];
    };
    services: Array<{
        name: string;
        requests: number;
        avgResponseMs: number;
        errorRate: number;
        status: string;
    }>;
    systemUpdates: {
        labels: string[];
        values: number[];
    };
    alerts: Array<{
        id: string;
        title: string;
        detail: string;
        severity: string;
    }>;
};

const formatNumber = (value: number) => {
    return value.toLocaleString('en-US');
};

const formatCurrency = (value: number) => {
    if (!value) {
        return '$0';
    }
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatDelta = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded >= 0 ? '+' : ''}${rounded}%`;
};

const buildLinePath = (values: number[], width: number, height: number, max: number) => {
    const safeMax = Math.max(max, 1);
    return values
        .map((value, index) => {
            const x = (index / Math.max(values.length - 1, 1)) * width;
            const y = height - (value / safeMax) * (height - 12) - 6;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
};

const LineChart = ({
    labels,
    series,
    colors,
    height = 160,
}: {
    labels: string[];
    series: number[][];
    colors: string[];
    height?: number;
}) => {
    const width = 320;
    const hasData = series.some((values) => values.some((value) => value > 0));

    if (!hasData) {
        return (
            <div className="h-[160px] flex items-center justify-center text-xs text-gray-400">
                No data yet.
            </div>
        );
    }

    const max = Math.max(...series.flat(), 1);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
            {series.map((values, idx) => (
                <path
                    key={colors[idx]}
                    d={buildLinePath(values, width, height, max)}
                    stroke={colors[idx]}
                    strokeWidth="2"
                    fill="none"
                />
            ))}
            {labels.length > 0 && (
                <line x1="0" y1={height - 6} x2={width} y2={height - 6} stroke="#E5E7EB" strokeWidth="1" />
            )}
        </svg>
    );
};

const BarChart = ({ labels, values }: { labels: string[]; values: number[] }) => {
    const max = Math.max(...values, 1);
    return (
        <div className="flex items-end gap-3 h-[160px]">
            {labels.map((label, idx) => (
                <div key={label} className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-full bg-[#EDE9FE] rounded-full flex items-end h-[120px]">
                        <div
                            className="w-full bg-[#7C3AED] rounded-full"
                            style={{ height: `${(values[idx] / max) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
                </div>
            ))}
        </div>
    );
};

const PieChart = ({ breakdown }: { breakdown: Array<{ label: string; value: number }> }) => {
    const total = breakdown.reduce((sum, item) => sum + item.value, 0);
    if (!total) {
        return (
            <div className="h-[160px] flex items-center justify-center text-xs text-gray-400">
                No AI cost data yet.
            </div>
        );
    }

    const palette = ['#60A5FA', '#22C55E', '#F97316', '#A855F7', '#F43F5E', '#0EA5E9'];
    let current = 0;
    const segments = breakdown.map((item, idx) => {
        const start = current;
        const percent = (item.value / total) * 100;
        current += percent;
        return `${palette[idx % palette.length]} ${start}% ${current}%`;
    });

    return (
        <div className="flex items-center gap-6">
            <div
                className="w-40 h-40 rounded-full"
                style={{ background: `conic-gradient(${segments.join(', ')})` }}
            />
            <div className="space-y-3 text-xs text-gray-600">
                {breakdown.map((item, idx) => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: palette[idx % palette.length] }}
                            />
                            <span>{item.label || 'Other'}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminDashboardPage = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await apiFetch('/admin/dashboard');
                setData(response?.data || null);
            } catch (err: any) {
                setError(err.message || 'Failed to load admin dashboard.');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    const kpis = data?.kpis;

    const kpiCards = useMemo(
        () => [
            {
                label: 'Active Users',
                value: kpis?.activeUsers.value || 0,
                delta: kpis?.activeUsers.delta || 0,
                icon: Users,
                color: 'bg-[#E0F2FE]',
                iconColor: 'text-[#0284C7]',
            },
            {
                label: 'Landing Page Views',
                value: kpis?.landingPageViews.value || 0,
                delta: kpis?.landingPageViews.delta || 0,
                icon: LayoutDashboard,
                color: 'bg-[#EDE9FE]',
                iconColor: 'text-[#7C3AED]',
            },
            {
                label: 'AI Agent Requests',
                value: kpis?.aiRequests.value || 0,
                delta: kpis?.aiRequests.delta || 0,
                icon: Bot,
                color: 'bg-[#DCFCE7]',
                iconColor: 'text-[#16A34A]',
            },
            {
                label: 'Response Time',
                value: Math.round(kpis?.responseTimeMs.value || 0),
                delta: kpis?.responseTimeMs.delta || 0,
                icon: Activity,
                color: 'bg-[#FEE2E2]',
                iconColor: 'text-[#DC2626]',
                suffix: 'ms',
            },
        ],
        [kpis]
    );

    const services = data?.services || [];
    const alerts = data?.alerts || [];

    return (
        <div className="min-h-screen bg-[#F5F5F5]">
            <div className="flex min-h-screen">
                <aside className="hidden lg:flex w-64 bg-black text-white flex-col p-6">
                    <div className="flex items-center gap-3 mb-10">
                        <SyphorLogo className="w-8 h-8 text-white" />
                        <span className="text-lg font-bold tracking-widest">SYPHA~R</span>
                    </div>
                    <nav className="space-y-2 text-sm">
                        {[
                            { label: 'Overview', icon: LayoutDashboard },
                            { label: 'Users', icon: Users },
                            { label: 'Billing & Finance', icon: DollarSign },
                            { label: 'System Health', icon: Activity },
                            { label: 'AI Agents', icon: Bot },
                            { label: 'Community', icon: Shield },
                            { label: 'Settings', icon: Settings },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl ${item.label === 'Overview'
                                    ? 'bg-white text-black'
                                    : 'text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                <item.icon size={16} />
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </nav>
                    <div className="mt-auto flex items-center gap-3 px-3 py-2 text-gray-400">
                        <LogOut size={16} />
                        <span className="text-sm">Logout</span>
                    </div>
                </aside>

                <div className="flex-1 flex flex-col">
                    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                className="lg:hidden p-2 rounded-lg border border-gray-200"
                                onClick={() => setMobileMenuOpen(true)}
                            >
                                <Menu size={18} />
                            </button>
                            <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 text-sm text-gray-500">
                                <Search size={14} />
                                <input
                                    placeholder="Search anything here"
                                    className="outline-none bg-transparent w-48"
                                />
                            </div>
                            <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center">
                                <Bell size={16} className="text-gray-500" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-full bg-gray-200" />
                                <div className="hidden sm:block text-sm">
                                    <p className="font-semibold text-gray-900">Admin</p>
                                    <p className="text-xs text-gray-400">System</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 p-4 lg:p-6 space-y-6">
                        {(loading || error) && (
                            <div className={`text-sm ${error ? 'text-red-500' : 'text-gray-500'}`}>
                                {error || 'Loading admin dashboard...'}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {kpiCards.map((card) => (
                                <div key={card.label} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                            {card.label}
                                        </span>
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                                            <card.icon size={16} className={card.iconColor} />
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatNumber(card.value)}
                                            {card.suffix ? <span className="text-sm ml-1">{card.suffix}</span> : null}
                                        </div>
                                        <span
                                            className={`text-xs font-semibold ${card.delta >= 0 ? 'text-emerald-600' : 'text-red-500'
                                                }`}
                                        >
                                            {formatDelta(card.delta)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 xl:col-span-2">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-semibold text-gray-900">User Growth & Revenue</h2>
                                    <span className="text-xs text-gray-400">Last 7 days</span>
                                </div>
                                <LineChart
                                    labels={data?.userGrowth.labels || []}
                                    series={[data?.userGrowth.users || [], data?.userGrowth.revenue || []]}
                                    colors={['#22C55E', '#7C3AED']}
                                />
                                <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                                        Users
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                                        Revenue
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-semibold text-gray-900">AI Cost & Distribution</h2>
                                    <span className="text-xs text-gray-400">Total {formatCurrency(data?.aiCost.total || 0)}</span>
                                </div>
                                <PieChart breakdown={data?.aiCost.breakdown || []} />
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-semibold text-gray-900">Lead Conversion Pipeline</h2>
                                <span className="text-xs text-gray-400">All time</span>
                            </div>
                            <BarChart
                                labels={(data?.leadPipeline.labels || []).map((label) => label.split(' ')[0])}
                                values={data?.leadPipeline.values || []}
                            />
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-gray-900">Microservices Health</h2>
                                <span className="text-xs text-gray-400">Last 24 hours</span>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-4 text-xs text-gray-400 uppercase tracking-wider">
                                    <span>Service</span>
                                    <span>Requests</span>
                                    <span>Response</span>
                                    <span>Status</span>
                                </div>
                                {services.length === 0 && (
                                    <div className="text-xs text-gray-400">No service data yet.</div>
                                )}
                                {services.map((service) => (
                                    <div key={service.name} className="grid grid-cols-4 items-center">
                                        <span className="text-gray-900 font-medium">{service.name}</span>
                                        <span className="text-gray-500">{formatNumber(service.requests)}</span>
                                        <span className="text-gray-500">{Math.round(service.avgResponseMs)}ms</span>
                                        <span
                                            className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${service.status === 'Healthy'
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : service.status === 'Degraded'
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            {service.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 xl:col-span-2">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-semibold text-gray-900">System Update (last 24 hours)</h2>
                                    <span className="text-xs text-gray-400">Requests</span>
                                </div>
                                <LineChart
                                    labels={data?.systemUpdates.labels || []}
                                    series={[data?.systemUpdates.values || []]}
                                    colors={['#16A34A']}
                                />
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-semibold text-gray-900">Recent Alerts</h2>
                                    <span className="text-xs text-gray-400">System</span>
                                </div>
                                <div className="space-y-3 text-sm">
                                    {alerts.length === 0 && (
                                        <div className="text-xs text-gray-400">No alerts right now.</div>
                                    )}
                                    {alerts.map((alert) => (
                                        <div key={alert.id} className="border border-gray-200 rounded-xl p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-gray-900">{alert.title}</span>
                                                <span
                                                    className={`text-[10px] uppercase tracking-wider ${alert.severity === 'critical'
                                                        ? 'text-red-500'
                                                        : alert.severity === 'warning'
                                                            ? 'text-amber-600'
                                                            : 'text-gray-400'
                                                        }`}
                                                >
                                                    {alert.severity}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{alert.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileMenuOpen(false)}>
                    <div
                        className="bg-black text-white w-64 h-full p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <SyphorLogo className="w-8 h-8 text-white" />
                                <span className="text-lg font-bold tracking-widest">SYPHA~R</span>
                            </div>
                            <button className="text-white" onClick={() => setMobileMenuOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <nav className="space-y-2 text-sm">
                            {[
                                { label: 'Overview', icon: LayoutDashboard },
                                { label: 'Users', icon: Users },
                                { label: 'Billing & Finance', icon: DollarSign },
                                { label: 'System Health', icon: Activity },
                                { label: 'AI Agents', icon: Bot },
                                { label: 'Community', icon: Shield },
                                { label: 'Settings', icon: Settings },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl ${item.label === 'Overview'
                                        ? 'bg-white text-black'
                                        : 'text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    <item.icon size={16} />
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </nav>
                        <div className="mt-auto flex items-center gap-3 px-3 py-2 text-gray-400">
                            <LogOut size={16} />
                            <span className="text-sm">Logout</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboardPage;
