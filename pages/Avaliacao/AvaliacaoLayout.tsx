import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Settings, List, ArrowLeft, Smartphone } from 'lucide-react';
import { useUser } from '../../contexts/UserContext.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { getErpHomePage } from '../../components/ProtectedRoute.tsx';

const SidebarItem: React.FC<{ to: string; icon: React.ReactNode; label: string; end?: boolean }> = ({ to, icon, label, end }) => (
    <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                ? 'bg-white/20 text-white shadow-lg ring-1 ring-white/20'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`
        }
    >
        {icon}
        <span>{label}</span>
    </NavLink>
);

const AvaliacaoLayout: React.FC = () => {
    const navigate = useNavigate();
    const { permissions } = useUser();
    const { showToast } = useToast();

    const handleBack = () => {
        const erpHome = getErpHomePage(permissions);
        if (erpHome) navigate(erpHome);
        else showToast('Nenhum outro módulo disponível.', 'warning');
    };

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex fixed inset-y-0 left-4 top-4 bottom-4 z-40 w-64 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl flex-col h-[calc(100vh-32px)] shadow-2xl">
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-6">
                    <div className="p-2.5 bg-white/20 rounded-2xl">
                        <Smartphone size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg">Avaliação</h1>
                        <p className="text-white/60 text-xs">Trade-In</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    <SidebarItem to="/avaliacao/config" icon={<Settings size={20} />} label="Configurações" />
                    <SidebarItem to="/avaliacao/leads" icon={<List size={20} />} label="Avaliações Recebidas" />
                </nav>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-white/20">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors w-full px-3 py-2 rounded-xl hover:bg-white/10"
                    >
                        <ArrowLeft size={18} />
                        <span>Voltar ao ERP</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-violet-600 to-indigo-700 px-4 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <button onClick={handleBack} className="p-2 rounded-xl bg-white/20 text-white">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Smartphone size={20} className="text-white" />
                        <h1 className="text-white font-bold">Avaliação</h1>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <NavLink to="/avaliacao/config" className={({ isActive }) => `p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/70'}`}>
                        <Settings size={18} />
                    </NavLink>
                    <NavLink to="/avaliacao/leads" className={({ isActive }) => `p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/70'}`}>
                        <List size={18} />
                    </NavLink>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 lg:ml-72 pt-16 lg:pt-0">
                <main className="p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AvaliacaoLayout;
