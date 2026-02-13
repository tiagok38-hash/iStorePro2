import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Squares2x2Icon, ArchiveBoxIcon, CashRegisterIcon, ChartBarIcon,
    UsersIcon, BuildingOffice2Icon, BanknotesIcon, LogoutIcon, WrenchIcon, ShoppingCartIcon, WalletIcon
} from './icons.tsx';
import { useUser } from '../contexts/UserContext.tsx';
import { PermissionSet } from '../types.ts';

const BottomNav: React.FC = () => {
    const { permissions, logout, user } = useUser();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { name: 'Dashboard', to: '/', icon: <Squares2x2Icon />, permissionKey: 'canAccessDashboard' },
        { name: 'Estoque', to: '/products', icon: <ArchiveBoxIcon />, permissionKey: 'canAccessEstoque' },
        { name: 'Vendas', to: '/vendas', icon: <BanknotesIcon />, permissionKey: 'canAccessVendas' },
        { name: 'Catálogo', to: '/catalog', icon: <ShoppingCartIcon />, permissionKey: 'canAccessDashboard' },
        { name: 'PDV', to: '/pos', icon: <CashRegisterIcon />, permissionKey: 'canAccessPOS' },
        { name: 'Clientes', to: '/customers', icon: <UsersIcon />, permissionKey: 'canAccessClientes' },
        { name: 'Ordem de Serviço', to: '/service-orders', icon: <WrenchIcon />, permissionKey: 'canAccessDashboard' },
        { name: 'Relatórios', to: '/reports', icon: <ChartBarIcon />, permissionKey: 'canAccessRelatorios' },
        { name: 'Financeiro', to: '/financeiro', icon: <WalletIcon />, permissionKey: 'canAccessFinanceiro' },
        { name: 'Empresa', to: '/company', icon: <BuildingOffice2Icon />, permissionKey: ['canAccessEmpresa', 'canEditOwnProfile', 'canManageMarcasECategorias'] },
    ];

    const visibleNavItems = useMemo(() => {
        if (!permissions) return [];
        return navItems.filter(item => {
            if (item.name === 'Clientes') {
                return permissions.canAccessClientes || permissions.canAccessFornecedores;
            }
            const keys = Array.isArray(item.permissionKey) ? item.permissionKey : [item.permissionKey];
            return keys.some(key => permissions[key as keyof PermissionSet]);
        });
    }, [permissions]);

    if (!visibleNavItems.length && !user) return null;

    const itemWidthClass = "flex-none w-[20%] min-w-[20%]";

    return (
        <div
            className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#9c89ff] to-[#7B61FF] border-t border-white/20 lg:hidden z-[100] pt-3 shadow-[0_-10px_30px_rgba(123,97,255,0.2)]"
            style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)',
                minHeight: 'calc(env(safe-area-inset-bottom, 12px) + 64px)',
                touchAction: 'manipulation'
            }}
        >
            <div className="flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] px-2">
                {visibleNavItems.map((item) => {
                    const isPDV = item.name === 'PDV';
                    const linkClasses = ({ isActive }: { isActive: boolean }) => `
                        flex flex-col items-center justify-center py-2 transition-all duration-200 ${itemWidthClass} rounded-xl
                        ${isActive ? 'text-white bg-white/20 shadow-lg ring-1 ring-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'}
                    `;

                    if (isPDV) {
                        return (
                            <a
                                key={item.to}
                                href={`#${item.to}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(`#${item.to}`, '_blank');
                                }}
                                className={`flex flex-col items-center justify-center py-2 transition-all duration-200 ${itemWidthClass} text-white/70 hover:text-white hover:bg-white/10 rounded-xl`}
                            >
                                {React.cloneElement(item.icon, { className: 'h-5 w-5 mb-1.5' })}
                                <span className="text-[10px] truncate w-full text-center px-1 font-bold uppercase tracking-tighter">{item.name}</span>
                            </a>
                        );
                    }

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={linkClasses}
                        >
                            {React.cloneElement(item.icon, { className: 'h-5 w-5 mb-1.5' })}
                            <span className="text-[10px] truncate w-full text-center px-1 font-bold uppercase tracking-tighter">{item.name}</span>
                        </NavLink>
                    );
                })}

                {/* Logout Action */}
                <button
                    onClick={handleLogout}
                    className={`flex flex-col items-center justify-center py-2 transition-all duration-200 ${itemWidthClass} text-red-100/80 hover:text-white hover:bg-red-500/20 rounded-xl`}
                >
                    <LogoutIcon className="h-5 w-5 mb-1.5" />
                    <span className="text-[10px] truncate w-full text-center px-1 font-bold uppercase tracking-tighter">Sair</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
