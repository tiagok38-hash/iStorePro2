import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../contexts/UserContext.tsx';
import { SpinnerIcon } from './icons.tsx';
import { PermissionSet } from '../types.ts';

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
        console.warn(`ProtectedRoute: Access denied for ${permissionKey}. Redirecting to first available page.`);
        // Find first available internal page
        if (effectivePermissions.canAccessDashboard) return <Navigate to="/" replace />;
        if (effectivePermissions.canAccessVendas) return <Navigate to="/vendas" replace />;
        if (effectivePermissions.canAccessEstoque) return <Navigate to="/products" replace />;
        if (effectivePermissions.canAccessClientes || effectivePermissions.canAccessFornecedores) return <Navigate to="/customers" replace />;
        if (effectivePermissions.canAccessRelatorios) return <Navigate to="/reports" replace />;
        if (effectivePermissions.canAccessEmpresa) return <Navigate to="/company" replace />;
        if (effectivePermissions.canAccessPOS) return <Navigate to="/pos" replace />;

        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
