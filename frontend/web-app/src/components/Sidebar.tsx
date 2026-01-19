import {
    LayoutDashboard,
    Home,
    Users,
    Bot,
    Globe,
    Bell,
    Gift,
    Settings,
    PanelLeftClose,
    Shield
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const SyphorLogo = ({ className = "" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L36 12V28L20 38L4 28V12L20 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 8L28 13V23L20 28L12 23V13L20 8Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="18" r="3" fill="currentColor" />
    </svg>
);

interface SidebarProps {
    onNavigate?: () => void;
}

const Sidebar = ({ onNavigate }: SidebarProps = {}) => {
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = useMemo(
        () => [
            { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
            { icon: Shield, label: 'Admin Dashboard', path: '/admin' },
            { icon: Home, label: 'Properties', path: '/properties' },
            {
                icon: Users,
                label: 'Lead CRM',
                path: '/crm/leads',
                children: [
                    { label: 'Leads', path: '/crm/leads' },
                    { label: 'Pipeline', path: '/crm/pipeline' },
                    { label: 'Tasks', path: '/crm/tasks' },
                    { label: 'Campaigns', path: '/crm/campaigns' },
                    { label: 'Reports', path: '/crm/reports' },
                ],
            },
            { icon: Bot, label: 'AI Agent' },
            { icon: Globe, label: 'Community (The Gryd)', path: '/community' },
            { icon: Shield, label: 'Community Admin', path: '/community/admin' },
            { icon: Bell, label: 'Notifications', badge: 20 },
            { icon: Gift, label: 'Rewards' },
            { icon: Settings, label: 'Settings' },
        ],
        []
    );

    const [openGroup, setOpenGroup] = useState<string | null>(
        location.pathname.startsWith('/crm') ? 'Lead CRM' : null
    );

    useEffect(() => {
        if (location.pathname.startsWith('/crm')) {
            setOpenGroup('Lead CRM');
        }
    }, [location.pathname]);

    const handleNavigation = (path?: string) => {
        if (path) {
            navigate(path);
            onNavigate?.();
        }
    };

    return (
        <aside className="w-[280px] bg-white border-r border-gray-200 flex flex-col h-full z-20 shrink-0">
            <div className="p-6 flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <SyphorLogo className="w-8 h-8 text-black" />
                    <span className="font-bold text-lg tracking-widest uppercase">SyphA,r</span>
                </div>
                <PanelLeftClose size={20} className="text-gray-400 cursor-pointer hidden lg:block" />
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {menuItems.map((item, idx) => {
                    const isActive = item.path ? location.pathname === item.path : false;
                    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                    const isChildActive = hasChildren
                        ? item.children?.some((child) => location.pathname === child.path)
                        : false;
                    const isExpanded = openGroup === item.label;
                    const highlight = isActive || isChildActive;

                    return (
                        <div key={idx}>
                            <div
                                onClick={() => {
                                    if (hasChildren) {
                                        setOpenGroup(isExpanded ? null : item.label);
                                    }
                                    handleNavigation(item.path);
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${highlight
                                    ? 'bg-black text-white'
                                    : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {item.icon && <item.icon size={20} />}
                                    <span className="font-medium text-[15px]">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.badge && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${highlight ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] text-[#3B82F6]'
                                            }`}>
                                            {item.badge}
                                        </span>
                                    )}
                                    {hasChildren && (
                                        <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>ƒ-¬</span>
                                    )}
                                </div>
                            </div>
                            {hasChildren && isExpanded && (
                                <div className="ml-6 mt-1 space-y-1">
                                    {item.children?.map((child) => {
                                        const childActive = location.pathname === child.path;
                                        return (
                                            <div
                                                key={child.path}
                                                onClick={() => handleNavigation(child.path)}
                                                className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${childActive
                                                    ? 'bg-gray-900 text-white'
                                                    : 'text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {child.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <div className="bg-[#FAFAFA] rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=John&backgroundColor=ffd5dc"
                            alt="avatar"
                            className="w-10 h-10 rounded-full border border-gray-200"
                        />
                        <div>
                            <p className="font-bold text-sm">John Michael</p>
                            <p className="text-xs text-gray-400">Free</p>
                        </div>
                    </div>
                    <button className="bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-full hover:bg-gray-800">
                        Upgrade
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
