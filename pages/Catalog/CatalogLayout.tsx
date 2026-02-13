import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
    LayoutGrid, Package, Settings, ChevronLeft, ShoppingBag, ExternalLink, Copy, List,
    BarChart3, ArrowLeft
} from 'lucide-react';

const CatalogSidebarItem: React.FC<{ to: string; icon: React.ReactNode; label: string; end?: boolean }> = ({ to, icon, label, end }) => (
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

const CatalogLayout: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="hidden lg:flex fixed inset-y-0 left-4 top-4 bottom-4 z-40 w-64 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex-col h-[calc(100vh-32px)] shadow-2xl">
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-6">
                    <div className="p-2.5 bg-white/20 rounded-2xl">
                        <ShoppingBag size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg">Catálogo</h1>
                        <p className="text-white/60 text-xs">Vitrine Virtual</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    <CatalogSidebarItem to="/catalog" icon={<LayoutGrid size={20} />} label="Meus Produtos" end />
                    <CatalogSidebarItem to="/catalog/settings" icon={<Settings size={20} />} label="Configurações" />
                </nav>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-white/20">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors w-full px-3 py-2 rounded-xl hover:bg-white/10"
                    >
                        <ArrowLeft size={18} />
                        <span>Voltar ao ERP</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-2 rounded-xl bg-white/20 text-white">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={20} className="text-white" />
                        <h1 className="text-white font-bold">Catálogo</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <NavLink to="/catalog" end className={({ isActive }) => `p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/70'}`}>
                        <List size={18} />
                    </NavLink>
                    <NavLink to="/catalog/settings" className={({ isActive }) => `p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/70'}`}>
                        <Settings size={18} />
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

export default CatalogLayout;
