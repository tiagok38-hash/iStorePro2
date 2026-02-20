
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    WrenchIcon,
    ClipboardListIcon,
    LayoutGrid,
    Settings,
    SearchIcon,
    BellIcon,
    UserCircleIcon,
    ChevronLeftIcon,
    DollarSign,
    BarChart2,
    Package
} from 'lucide-react';

const ServiceOrderLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Navigation Items specific to OS Module
    const navItems = [
        { label: 'Dashboard', path: '/service-orders', icon: <LayoutGrid size={20} /> },
        { label: 'Ordens de Serviço', path: '/service-orders/list', icon: <ClipboardListIcon size={20} /> },
        { label: 'Nova OS', path: '/service-orders/new', icon: <WrenchIcon size={20} /> },
        { label: 'Clientes e fornecedores', path: '/service-orders/customers', icon: <UserCircleIcon size={20} /> },
        { label: 'Peças e Serviços', path: '/service-orders/products', icon: <Package size={20} /> },
        { label: 'Financeiro', path: '/service-orders/financial', icon: <DollarSign size={20} /> },
        { label: 'Relatórios', path: '/service-orders/reports', icon: <BarChart2 size={20} /> },
        { label: 'Configurações', path: '/service-orders/settings', icon: <Settings size={20} /> },
    ];

    const isActive = (path: string) => {
        if (path === '/service-orders' && location.pathname === '/service-orders') return true;
        if (path !== '/service-orders' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="flex h-screen bg-[#F6F5FB] overflow-hidden font-sans text-primary">
            {/* Immersive Sidebar - Dark Tech Style */}
            <aside className="w-20 lg:w-64 bg-[#1a1b23] text-white flex flex-col flex-shrink-0 transition-all duration-300 z-50 shadow-2xl">
                {/* Brand Area */}
                <div className="h-20 flex items-center justify-center lg:justify-start px-0 lg:px-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/50">
                            <WrenchIcon className="text-white" size={20} strokeWidth={2} />
                        </div>
                        <div className="hidden lg:block">
                            <h1 className="font-bold text-lg tracking-tight leading-tight">iStore OS</h1>
                            <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Workstation</p>
                        </div>
                    </div>
                </div>

                {/* Module Navigation */}
                <nav className="flex-1 py-8 px-3 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                                ${isActive(item.path)
                                    ? 'bg-accent text-white shadow-lg shadow-accent/25 font-semibold'
                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                }
                            `}
                        >
                            <span className={`flex-shrink-0 transition-transform duration-200 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`}>
                                {item.icon}
                            </span>
                            <span className="hidden lg:block text-sm whitespace-nowrap">{item.label}</span>

                            {isActive(item.path) && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full" />
                            )}
                        </button>
                    ))}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                        title="Voltar ao ERP"
                    >
                        <ChevronLeftIcon size={20} />
                        <span className="hidden lg:block text-sm font-medium">Voltar ao ERP</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area - Immersive Feel */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#F6F5FB] relative overflow-hidden">
                {/* Header - Glassmorphism */}
                <header className="h-20 px-6 flex items-center justify-between z-40 bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-md hidden md:block">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/50" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar OS, IMEI, Cliente..."
                                className="w-full h-10 pl-10 pr-4 bg-gray-100/50 border border-transparent focus:bg-white focus:border-accent/30 focus:ring-4 focus:ring-accent/10 rounded-xl text-sm transition-all outline-none placeholder:text-secondary/50"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-white transition-colors relative">
                            <BellIcon size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                        <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-primary">Técnico Principal</p>
                                <p className="text-[10px] text-secondary font-medium uppercase tracking-wider">Online</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                                <UserCircleIcon className="text-gray-400 w-full h-full p-1" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar relative">
                    {/* Background Elements for "Ultra Modern" feel */}
                    <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-50/50 to-transparent pointer-events-none -z-10" />

                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default ServiceOrderLayout;
