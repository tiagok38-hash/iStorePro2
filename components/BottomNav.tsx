import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Squares2x2Icon, ArchiveBoxIcon, CashRegisterIcon, ChartBarIcon,
    UsersIcon, BuildingOffice2Icon, BanknotesIcon, LogoutIcon
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
        { name: 'PDV', to: '/pos', icon: <CashRegisterIcon />, permissionKey: 'canAccessPOS' },
        { name: 'Clientes', to: '/customers', icon: <UsersIcon />, permissionKey: 'canAccessClientes' },
        { name: 'Relatórios', to: '/reports', icon: <ChartBarIcon />, permissionKey: 'canAccessRelatorios' },
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
        <div className="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-gray-800 lg:hidden z-50 pb-1">
            {/* User Name Bar - Ultra Small */}
            {/* User Name Bar removed as requested */}

            <div className="flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {visibleNavItems.map((item) => {
                    const isPDV = item.name === 'PDV';
                    const linkClasses = ({ isActive }: { isActive: boolean }) => `
                        flex flex-col items-center justify-center py-2 transition-colors ${itemWidthClass}
                        ${isActive ? 'text-blue-500' : 'text-gray-400 hover:text-gray-200'}
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
                                className={`flex flex-col items-center justify-center py-2 transition-colors ${itemWidthClass} text-gray-400 hover:text-gray-200`}
                            >
                                {React.cloneElement(item.icon, { className: 'h-6 w-6 mb-1' })}
                                <span className="text-[10px] truncate w-full text-center px-1 font-medium">{item.name}</span>
                            </a>
                        );
                    }

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={linkClasses}
                        >
                            {React.cloneElement(item.icon, { className: 'h-6 w-6 mb-1' })}
                            <span className="text-[10px] truncate w-full text-center px-1 font-medium">{item.name}</span>
                        </NavLink>
                    );
                })}

                {/* Logout Action */}
                <button
                    onClick={handleLogout}
                    className={`flex flex-col items-center justify-center py-2 transition-colors ${itemWidthClass} text-red-500/80 hover:text-red-400`}
                >
                    <LogoutIcon className="h-6 w-6 mb-1" />
                    <span className="text-[10px] truncate w-full text-center px-1 font-medium">Sair</span>
                </button>
            </div>
        </div>
    );
};

export default BottomNav;
