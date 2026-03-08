
import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    LogoIcon, ChevronLeftIcon, ChevronDownIcon,
    UserCircleIcon, LogoutIcon,
    Squares2x2Icon, ArchiveBoxIcon, ShoppingCartIcon, CashRegisterIcon, ChartBarIcon,
    UsersIcon, BuildingOffice2Icon, BanknotesIcon, WrenchIcon, WalletIcon, DocumentTextIcon, ReceiptIcon
} from './icons.tsx';

type NavItemDefinition = {
    name: string;
    to?: string;
    icon: React.ReactElement<{ className?: string }>;
    permissionKey: string | string[];
    target?: string;
    subItems?: {
        name: string;
        to: string;
        permissionKey: string | string[];
        target?: React.HTMLAttributeAnchorTarget;
        isComingSoon?: boolean;
    }[];
};

const NAV_ITEMS: NavItemDefinition[] = [
    { name: 'Dashboard', to: '/', icon: <Squares2x2Icon />, permissionKey: 'canAccessDashboard' },
    { name: 'Estoque', to: '/products', icon: <ArchiveBoxIcon />, permissionKey: 'canAccessEstoque' },
    {
        name: 'Vendas',
        icon: <ShoppingCartIcon />,
        permissionKey: ['canAccessVendas', 'canAccessOrcamentos', 'canAccessPOS', 'canAccessCatalog'],
        subItems: [
            { name: 'Vendas', to: '/vendas', permissionKey: 'canAccessVendas' },
            { name: 'Orçamentos', to: '/orcamentos', permissionKey: 'canAccessOrcamentos' },
            { name: 'PDV (Frente de Caixa)', to: '/pos', permissionKey: 'canAccessPOS', target: '_blank' },
            { name: 'Catálogo', to: '/catalog', permissionKey: 'canAccessCatalog' },
        ]
    },
    { name: 'Clientes e Fornecedores', to: '/customers', icon: <UsersIcon />, permissionKey: 'canAccessClientes' },
    { name: 'Ordem de Serviço', to: '/service-orders', icon: <WrenchIcon />, permissionKey: 'canAccessServiceOrders', target: '_blank' },
    { name: 'Relatórios', to: '/reports', icon: <ChartBarIcon />, permissionKey: 'canAccessRelatorios' },
    {
        name: 'Financeiro',
        icon: <WalletIcon />,
        permissionKey: ['canAccessFinanceiro', 'canAccessEmpresa'],
        subItems: [
            { name: 'Contas a pagar', to: '/financeiro', permissionKey: 'canAccessFinanceiro' },
            { name: 'Crediários', to: '/financeiro?tab=crediarios', permissionKey: 'canAccessFinanceiro' },
            { name: 'Fiscal (Em Breve)', to: '#', permissionKey: 'canAccessEmpresa', isComingSoon: true },
        ]
    },
    { name: 'Empresa', to: '/company', icon: <BuildingOffice2Icon />, permissionKey: ['canAccessEmpresa', 'canEditOwnProfile', 'canManageMarcasECategorias'] },
];

import { User, PermissionSet } from '../types.ts';
import { getPermissionProfiles } from '../services/mockApi.ts';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

const NavItem: React.FC<{ to: string, icon: React.ReactElement<{ className?: string }>, label: string, isCollapsed: boolean, onCloseSidebar: () => void; target?: React.HTMLAttributeAnchorTarget; isComingSoon?: boolean; pathname: string }> = ({ to, icon, label, isCollapsed, onCloseSidebar, target, isComingSoon, pathname }) => {
    const { showToast } = useToast();

    const isActive = React.useMemo(() => {
        if (isComingSoon || to === '#') return false;
        if (to === '/') return pathname === '/';
        return pathname === to || pathname.startsWith(`${to}/`);
    }, [pathname, to, isComingSoon]);

    return (
        <div className="relative group">
            <NavLink
                to={to}
                target={target}
                onClick={(e) => {
                    if (isComingSoon) {
                        e.preventDefault();
                        showToast('As funcionalidades dessa página estão em desenvolvimento. Aguarde...', 'warning');
                    } else {
                        onCloseSidebar();
                    }
                }}
                title={isCollapsed ? label : undefined}
                className={() => {
                    const baseClasses = "flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 font-medium";
                    const activeClasses = 'text-white bg-white/20 shadow-lg ring-1 ring-white/20';
                    const inactiveClasses = 'text-white/70 hover:text-white hover:bg-white/10';

                    if (isCollapsed) {
                        return `${baseClasses} justify-center ${isActive ? activeClasses : inactiveClasses}`;
                    }

                    return `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;
                }}
            >
                {React.cloneElement(icon, { className: 'h-6 w-6 flex-shrink-0' })}
                {!isCollapsed && <span className="ml-3 whitespace-nowrap">{label}</span>}
            </NavLink>
            {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-white text-accent text-xs rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-bold shadow-sm">
                    {label}
                </div>
            )}
        </div>
    );
};

const NavGroup: React.FC<{
    item: NavItemDefinition,
    isCollapsed: boolean,
    onCloseSidebar: () => void,
    pathname: string,
    permissions: any
}> = ({ item, isCollapsed, onCloseSidebar, pathname, permissions }) => {
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);

    const visibleSubItems = useMemo(() => {
        if (!permissions) return [];
        return item.subItems!.filter(sub => {
            const keys = Array.isArray(sub.permissionKey) ? sub.permissionKey : [sub.permissionKey];
            return keys.some(key => permissions[key as keyof PermissionSet]);
        });
    }, [item.subItems, permissions]);

    const isAnyActive = useMemo(() => {
        return visibleSubItems.some(sub => {
            if (sub.isComingSoon || sub.to === '#') return false;
            return pathname === sub.to || pathname.startsWith(`${sub.to}/`);
        });
    }, [pathname, visibleSubItems]);

    // Open by default if any sub-item is active
    useEffect(() => {
        if (isAnyActive && !isCollapsed) {
            setIsOpen(true);
        }
    }, [isAnyActive, isCollapsed]);

    // Close when collapsed
    useEffect(() => {
        if (isCollapsed) setIsOpen(false);
    }, [isCollapsed]);

    if (visibleSubItems.length === 0) return null;

    return (
        <div className="relative group">
            <button
                onClick={(e) => {
                    e.preventDefault();
                    if (!isCollapsed) {
                        setIsOpen(!isOpen);
                    }
                }}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 font-medium
                    ${isAnyActive ? 'text-white bg-white/20 shadow-lg ring-1 ring-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'}
                    ${isCollapsed ? 'justify-center cursor-default' : 'justify-between cursor-pointer'}
                `}
                title={isCollapsed ? item.name : undefined}
            >
                <div className="flex items-center">
                    {React.cloneElement(item.icon, { className: 'h-6 w-6 flex-shrink-0' })}
                    {!isCollapsed && <span className="ml-3 whitespace-nowrap">{item.name}</span>}
                </div>
                {!isCollapsed && (
                    <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Tooltip for collapsed mode */}
            {isCollapsed && (
                <div className="absolute left-full top-0 ml-4 py-2 bg-white text-accent text-sm rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-md min-w-[150px]">
                    <div className="px-4 py-1 font-bold border-b border-gray-100 mb-1">{item.name}</div>
                    {visibleSubItems.map(sub => (
                        <div key={sub.name} className="px-4 py-1 font-medium text-xs opacity-70">
                            {sub.name}
                        </div>
                    ))}
                </div>
            )}

            {/* Expanded items */}
            {!isCollapsed && isOpen && (
                <div className="ml-4 pl-3 border-l-2 border-white/20 flex flex-col space-y-1 mt-1">
                    {visibleSubItems.map(sub => {
                        const isSubActive = pathname === sub.to || (sub.to !== '/' && pathname.startsWith(`${sub.to}/`));
                        return (
                            <NavLink
                                key={sub.name}
                                to={sub.to}
                                target={sub.target}
                                className={() => `block px-3 py-2 rounded-lg text-sm transition-all duration-200 font-medium
                                    ${sub.isComingSoon || sub.to === '#' ? 'opacity-50' : ''}
                                    ${isSubActive && !sub.isComingSoon && sub.to !== '#' ? 'text-white bg-white/20 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}
                                `}
                                onClick={(e) => {
                                    if (sub.isComingSoon || sub.to === '#') {
                                        e.preventDefault();
                                        showToast('As funcionalidades dessa página estão em desenvolvimento. Aguarde...', 'warning');
                                    } else {
                                        if (window.innerWidth < 1024) {
                                            onCloseSidebar();
                                        }
                                    }
                                }}
                            >
                                {sub.name}
                            </NavLink>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface SidebarProps {
    isOpen: boolean;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    onCloseSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, isCollapsed, toggleCollapse, onCloseSidebar }) => {
    const { user, permissions, loading, logout } = useUser();
    const navigate = useNavigate();
    const [userProfileName, setUserProfileName] = useState('');
    const [isHovered, setIsHovered] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const effectiveIsCollapsed = isCollapsed && !isHovered;

    useEffect(() => {
        if (user && !loading) {
            getPermissionProfiles().then(profiles => {
                const profile = profiles.find(p => p.id === user.permissionProfileId);
                setUserProfileName(profile?.name || '');
            });
        }
    }, [user, loading]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        // Aguarda animação de saída
        await new Promise(resolve => setTimeout(resolve, 400));
        logout();
        navigate('/login');
    };

    const visibleNavItems = useMemo(() => {
        if (!permissions) {
            return [];
        }
        return NAV_ITEMS.filter(item => {
            if (item.name === 'Clientes e Fornecedores') {
                return permissions.canAccessClientes || permissions.canAccessFornecedores;
            }
            const keys = Array.isArray(item.permissionKey) ? item.permissionKey : [item.permissionKey];
            return keys.some(key => permissions[key as keyof PermissionSet]);
        });
    }, [permissions]);

    const location = useLocation();

    return (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`hidden lg:flex fixed inset-y-0 left-4 top-4 bottom-4 z-40 bg-gradient-to-br from-[#9c89ff] to-[#7B61FF] rounded-3xl flex-col h-[calc(100vh-32px)] shadow-2xl transform transition-all duration-300 ease-out lg:translate-x-0 lg:sticky lg:top-4 text-white ${effectiveIsCollapsed ? 'lg:w-24' : 'lg:w-72'} ${isLoggingOut ? 'opacity-0 -translate-x-full' : ''}`}
        >
            <div className="flex items-center h-[90px] overflow-hidden">
                {/* Fixed Logo Container - Matches collapsed sidebar width */}
                {/* Logo Container */}
                <div className={`flex items-center transition-all duration-200 ${effectiveIsCollapsed ? 'w-full justify-center' : 'w-full px-2'}`}>
                    <Link to="/" className="flex items-center overflow-hidden whitespace-nowrap transition-all duration-200 gap-0">
                        <img
                            src="/logo_sidebar_icon.png"
                            alt="Logo"
                            className="min-w-[80px] min-h-[80px] max-w-[80px] max-h-[80px] w-[80px] h-[80px] object-contain shrink-0 transition-all duration-200 relative z-10 brightness-0 invert"
                        />
                        <img
                            src="/logo_sidebar_text.png"
                            alt="iStore Pro"
                            className={`w-[140px] h-auto object-contain transition-all duration-200 ease-out origin-left translate-y-[4px] brightness-0 invert ${effectiveIsCollapsed ? 'ml-0 max-w-0 opacity-0' : '-ml-4 max-w-[140px] opacity-100'}`}
                        />
                    </Link>
                </div>

                {/* Toggle Button - Conditionally rendered: only visible when expanded (hover or persistent) */}
                {!effectiveIsCollapsed && (
                    <div className="flex items-center ml-auto pr-4 translate-y-[6px] animate-fade-in">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleCollapse();
                            }}
                            className="flex p-2 rounded-full bg-white/20 text-white hover:bg-white hover:text-accent transition-all shadow-sm active:scale-90"
                            title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
                        >
                            <ChevronLeftIcon className={`h-5 w-5 transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                )}
            </div>
            <nav className="flex-1 px-3 py-6 mt-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="space-y-1">
                    {visibleNavItems.map(item => (
                        item.subItems ? (
                            <NavGroup
                                key={item.name}
                                item={item}
                                isCollapsed={effectiveIsCollapsed}
                                onCloseSidebar={onCloseSidebar}
                                pathname={location.pathname}
                                permissions={permissions}
                            />
                        ) : (
                            <NavItem key={item.name} to={item.to!} icon={item.icon} label={item.name} isCollapsed={effectiveIsCollapsed} onCloseSidebar={onCloseSidebar} target={item.target as React.HTMLAttributeAnchorTarget} isComingSoon={item.name === 'Fiscal (Em Breve)'} pathname={location.pathname} />
                        )
                    ))}
                </div>
            </nav>
            <div className="px-4 py-4 border-t border-white/20 mt-auto">
                <div className="space-y-4">
                    {effectiveIsCollapsed ? (
                        <>
                            <div className="text-center">
                                {permissions?.canEditOwnProfile ? (
                                    <Link to="/company?tab=perfil" className="relative group inline-block" title="Editar Perfil">
                                        {user ? (
                                            user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30" />
                                            ) : (
                                                <UserCircleIcon className="h-9 w-9 text-white/70" />
                                            )
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-white/20 animate-pulse"></div>
                                        )}
                                        {user && (
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-white text-accent text-xs rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-bold">
                                                {user.name}
                                            </div>
                                        )}
                                    </Link>
                                ) : (
                                    <div className="relative group inline-block cursor-default">
                                        {user ? (
                                            user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30" />
                                            ) : (
                                                <UserCircleIcon className="h-9 w-9 text-white/70" />
                                            )
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-white/20 animate-pulse"></div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="text-center pt-4 border-t border-white/20">
                                <button onClick={handleLogout} title="Sair" className="text-white/60 hover:text-white p-1 rounded-xl transition-colors">
                                    <LogoutIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            {permissions?.canEditOwnProfile ? (
                                <Link to="/company?tab=perfil" title="Editar Perfil" className="flex items-center gap-3 flex-1 min-w-0 group">
                                    <div className="flex-shrink-0">
                                        {user ? (
                                            user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.name} className="h-9 w-9 rounded-full object-cover ring-1 ring-white/30 group-hover:ring-white transition-all" />
                                            ) : (
                                                <UserCircleIcon className="h-9 w-9 text-white/70 group-hover:text-white transition-colors" />
                                            )
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-white/20 animate-pulse"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {user ? (
                                            <div>
                                                <p className="font-semibold text-sm text-white truncate group-hover:text-white/90 transition-colors">{user.name}</p>
                                                <p className="text-[11px] text-white/60 truncate uppercase tracking-wider font-medium">{userProfileName}</p>
                                            </div>
                                        ) : (
                                            <div className="animate-pulse">
                                                <div className="h-4 bg-white/20 rounded w-3/4"></div>
                                                <div className="h-3 bg-white/20 rounded w-1/2 mt-1"></div>
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-default">
                                    <div className="flex-shrink-0">
                                        {user ? (
                                            user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.name} className="h-9 w-9 rounded-full object-cover ring-1 ring-white/30" />
                                            ) : (
                                                <UserCircleIcon className="h-9 w-9 text-white/70" />
                                            )
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-white/20 animate-pulse"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {user ? (
                                            <div>
                                                <p className="font-semibold text-sm text-white truncate">{user.name}</p>
                                                <p className="text-[11px] text-white/60 truncate uppercase tracking-wider font-medium">{userProfileName}</p>
                                            </div>
                                        ) : (
                                            <div className="animate-pulse">
                                                <div className="h-4 bg-white/20 rounded w-3/4"></div>
                                                <div className="h-3 bg-white/20 rounded w-1/2 mt-1"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <button onClick={handleLogout} title="Sair" className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
                                <LogoutIcon className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* Mobile Footer Gradient Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#7B61FF]/20 to-transparent pointer-events-none rounded-b-3xl" />
        </aside>
    );
};

export default Sidebar;
