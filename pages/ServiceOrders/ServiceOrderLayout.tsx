
import React from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
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
import { useUser } from '../../contexts/UserContext.tsx';
import { PermissionSet } from '../../types.ts';
import { getErpHomePage } from '../../components/ProtectedRoute.tsx';

const NAV_ITEMS: { label: string; path: string; icon: any; permissionKey?: keyof PermissionSet | (keyof PermissionSet)[] }[] = [
    { label: 'Dashboard', path: '/service-orders', icon: LayoutGrid, permissionKey: 'osCanAccessDashboard' },
    { label: 'Ordens de Serviço', path: '/service-orders/list', icon: ClipboardListIcon, permissionKey: 'canAccessServiceOrders' },
    { label: 'Nova OS', path: '/service-orders/new', icon: WrenchIcon, permissionKey: 'canCreateServiceOrder' },
    { label: 'Clientes e Fornecedores', path: '/service-orders/customers', icon: UserCircleIcon, permissionKey: ['osCanAccessCustomers', 'osCanAccessSuppliers'] },
    { label: 'Eletrônicos Cadastrados', path: '/service-orders/devices', icon: Smartphone, permissionKey: 'osCanAccessElectronics' },
    { label: 'Peças e Serviços', path: '/service-orders/products', icon: Package, permissionKey: 'osCanEditParts' },
    { label: 'Financeiro', path: '/service-orders/financial', icon: DollarSign, permissionKey: 'osCanAccessFinance' },
    { label: 'Relatórios', path: '/service-orders/reports', icon: BarChart2, permissionKey: 'osCanAccessReports' },
    { label: 'Fiscal (Em Breve)', path: '#', icon: ReceiptText, permissionKey: 'osCanAccessFiscal' },
    { label: 'Configurações', path: '/service-orders/settings', icon: Settings, permissionKey: 'osCanAccessSettings' },
];

const ServiceOrderLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { permissions } = useUser();

    // Filter NAV_ITEMS based on user permissions
    const visibleNavItems = NAV_ITEMS.filter(item => {
        if (!item.permissionKey) return true;
        if (!permissions) return false;
        if (Array.isArray(item.permissionKey)) {
            // If it's an array, user must have at least ONE of the permissions to see the menu item
            return item.permissionKey.some(key => permissions[key]);
        }
        return permissions[item.permissionKey];
    });

    const isActive = (path: string) => {
        if (path === '/service-orders' && location.pathname === '/service-orders') return true;
        if (path !== '/service-orders' && location.pathname.startsWith(path)) return true;
        return false;
    };

    if (location.pathname === '/service-orders' && permissions) {
        const dashboardItem = visibleNavItems.find(i => i.path === '/service-orders');
        if (!dashboardItem && visibleNavItems.length > 0) {
            return <Navigate to={visibleNavItems[0].path} replace />;
        }
    }
    return (
        <div className="flex h-screen bg-[#F6F5FB] overflow-hidden font-sans text-primary">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 bg-[#1a1b23] text-white flex-col flex-shrink-0 transition-all duration-300 z-50 shadow-2xl">
                {/* Brand */}
                <div className="h-16 flex items-center justify-start px-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/50 flex-shrink-0">
                            <WrenchIcon className="text-white" size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-black text-base tracking-tight leading-none text-white whitespace-nowrap">iStore OS</h1>
                        </div>
                    </div>
                </div>

                {/* Navigation Desktop */}
                <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {visibleNavItems.map((item) => {
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
                                <span className="text-sm whitespace-nowrap">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Back to ERP Desktop */}
                <div className="p-3 border-t border-white/10">
                    <button
                        onClick={() => {
                            const erpHome = getErpHomePage(permissions);
                            if (erpHome) navigate(erpHome);
                            else showToast('Você não possui acesso a outros módulos do ERP.', 'warning');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                        title="Voltar ao ERP"
                    >
                        <ChevronLeftIcon size={20} />
                        <span className="text-sm font-medium">Voltar ao ERP</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <div
                className="fixed bottom-0 left-0 right-0 bg-[#1a1b23] border-t border-white/10 lg:hidden z-[100] pt-3 shadow-[0_-10px_30px_rgba(26,27,35,0.2)]"
                style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)',
                    minHeight: 'calc(env(safe-area-inset-bottom, 12px) + 64px)',
                    touchAction: 'manipulation'
                }}
            >
                <div className="flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] px-2">
                    {visibleNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        const itemWidthClass = "flex-none w-[20%] min-w-[20%]";
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
                                className={`flex flex-col items-center justify-center py-2 transition-all duration-200 ${itemWidthClass} rounded-xl
                                    ${active
                                        ? 'text-white bg-white/10 shadow-lg ring-1 ring-white/10'
                                        : 'text-white/50 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon className="h-5 w-5 mb-1.5" />
                                <span className="text-[10px] truncate w-full text-center px-1 font-bold uppercase tracking-tighter">{item.label}</span>
                            </button>
                        );
                    })}

                    {/* Back to ERP Mobile */}
                    <button
                        onClick={() => {
                            const erpHome = getErpHomePage(permissions);
                            if (erpHome) navigate(erpHome);
                            else showToast('Nenhum outro módulo disponível.', 'warning');
                        }}
                        className={`flex flex-col items-center justify-center py-2 transition-all duration-200 flex-none w-[20%] min-w-[20%] text-white/50 hover:text-white hover:bg-white/5 rounded-xl`}
                    >
                        <ChevronLeftIcon className="h-5 w-5 mb-1.5" />
                        <span className="text-[10px] truncate w-full text-center px-1 font-bold uppercase tracking-tighter">Voltar</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#F6F5FB] relative overflow-hidden lg:pb-0">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar relative pb-28 lg:pb-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default ServiceOrderLayout;
