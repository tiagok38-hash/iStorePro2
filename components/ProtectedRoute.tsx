import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../contexts/UserContext.tsx';
import { SpinnerIcon } from './icons.tsx';
import { PermissionSet } from '../types.ts';

/** Retorna a primeira rota que o usuário tem permissão de acessar. */
export const getFirstAvailablePage = (p: Partial<PermissionSet> | null): string => {
    if (!p) return '/login';
    if (p.canAccessDashboard) return '/';
    if (p.canAccessServiceOrders) return '/service-orders/list';
    if (p.canAccessVendas) return '/vendas';
    if (p.canAccessEstoque) return '/products';
    if (p.canAccessClientes || p.canAccessFornecedores) return '/customers';
    if (p.canAccessRelatorios) return '/reports';
    if (p.canAccessFinanceiro) return '/financeiro';
    if (p.canAccessCatalog) return '/catalog';
    if (p.canAccessPOS) return '/pos';
    if (p.canEditOwnProfile || p.canAccessEmpresa) return '/company';
    return '/login';
};

/** Retorna a primeira rota do ERP padrão (ignorando submódulos como OS ou Catálogo) que o usuário pode acessar. */
export const getErpHomePage = (p: Partial<PermissionSet> | null): string | null => {
    if (!p) return null;
    if (p.canAccessDashboard) return '/';
    if (p.canAccessVendas) return '/vendas';
    if (p.canAccessEstoque) return '/products';
    if (p.canAccessClientes || p.canAccessFornecedores) return '/customers';
    if (p.canAccessRelatorios) return '/reports';
    if (p.canAccessFinanceiro) return '/financeiro';
    if (p.canAccessPOS) return '/pos';
    if (p.canEditOwnProfile || p.canAccessEmpresa) return '/company';
    return null;
};

interface ProtectedRouteProps {
    permissionKey?: keyof PermissionSet | (keyof PermissionSet)[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ permissionKey }) => {
    const { isAuthenticated, loading, permissions, user } = useUser();

    const effectivePermissions = React.useMemo(() => {
        if (permissions !== null) return permissions;
        if (user?.permissionProfileId === 'profile-admin') return new Proxy({}, { get: () => true }) as any;
        return {} as any;
    }, [permissions, user]);

    const hasPermission = React.useMemo(() => {
        if (!permissionKey) return true;
        return Array.isArray(permissionKey)
            ? permissionKey.some(key => effectivePermissions[key])
            : !!effectivePermissions[permissionKey];
    }, [permissionKey, effectivePermissions]);


    if (loading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-background">
                <SpinnerIcon />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (permissions === null) {
        console.warn('ProtectedRoute: Permissions are null. Access denied as Deny-by-Default fallback used for:', user?.email);
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                <SpinnerIcon />
                <p className="text-muted mt-4 text-sm font-medium">Carregando permissões, por favor aguarde...</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs"
                >
                    Recarregar se demorar muito
                </button>
            </div>
        );
    }

    if (!hasPermission) {
        const dest = getFirstAvailablePage(effectivePermissions);
        return <Navigate to={dest} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
