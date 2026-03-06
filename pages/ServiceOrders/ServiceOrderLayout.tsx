
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    WrenchIcon,
    ClipboardListIcon,
    LayoutGrid,
    Settings,
    ChevronLeftIcon,
    DollarSign,
    BarChart2,
    Package,
    Smartphone,
    UserCircleIcon,
    ReceiptText
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.tsx';

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/service-orders', icon: LayoutGrid },
    { label: 'Ordens de Serviço', path: '/service-orders/list', icon: ClipboardListIcon },
    { label: 'Nova OS', path: '/service-orders/new', icon: WrenchIcon },
    { label: 'Clientes e Fornecedores', path: '/service-orders/customers', icon: UserCircleIcon },
    { label: 'Eletrônicos Cadastrados', path: '/service-orders/devices', icon: Smartphone },
    { label: 'Peças e Serviços', path: '/service-orders/products', icon: Package },
    { label: 'Financeiro', path: '/service-orders/financial', icon: DollarSign },
    { label: 'Relatórios', path: '/service-orders/reports', icon: BarChart2 },
    { label: 'Fiscal (Em Breve)', path: '#', icon: ReceiptText },
    { label: 'Configurações', path: '/service-orders/settings', icon: Settings },
];

const ServiceOrderLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const isActive = (path: string) => {
        if (path === '/service-orders' && location.pathname === '/service-orders') return true;
        if (path !== '/service-orders' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="flex h-screen bg-[#F6F5FB] overflow-hidden font-sans text-primary">
            {/* Sidebar */}
            <aside className="w-16 lg:w-64 bg-[#1a1b23] text-white flex flex-col flex-shrink-0 transition-all duration-300 z-50 shadow-2xl">
                {/* Brand */}
                <div className="h-16 flex items-center justify-center lg:justify-start px-0 lg:px-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/50">
                            <WrenchIcon className="text-white" size={18} strokeWidth={2} />
                        </div>
                        <div className="hidden lg:block">
                            <h1 className="font-bold text-base tracking-tight leading-tight">iStore OS</h1>
                            <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Workstation</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    if (item.label === 'Fiscal (Em Breve)') {
                                        showToast('As funcionalidades dessa página estão em desenvolvimento. Aguarde...', 'warning');
                                    } else {
                                        navigate(item.path);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                                    ${active
                                        ? 'bg-accent text-white shadow-lg shadow-accent/25 font-semibold'
                                        : 'text-white/60 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <Icon size={20} className={`flex-shrink-0 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="hidden lg:block text-sm whitespace-nowrap">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Back to ERP */}
                <div className="p-3 border-t border-white/10">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                        title="Voltar ao ERP"
                    >
                        <ChevronLeftIcon size={20} />
                        <span className="hidden lg:block text-sm font-medium">Voltar ao ERP</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#F6F5FB] relative overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default ServiceOrderLayout;
