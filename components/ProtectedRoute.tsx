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

    if (loading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-background">
                <SpinnerIcon />
            </div>
        );
    }

    // If not authenticated at all, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // If permissions are still loading, show a loading/waiting state.
    // If we let a null permission pass below, effectivePermissions will be empty
    // which causes a redirect to /login, creating an infinite redirect loop.
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

    const effectivePermissions = permissions || (user?.permissionProfileId === 'profile-admin' ? new Proxy({}, { get: () => true }) : {}) as Record<string, boolean>;

    const hasPermission = !permissionKey || (
        Array.isArray(permissionKey)
            ? permissionKey.some(key => effectivePermissions[key as keyof typeof effectivePermissions])
            : effectivePermissions[permissionKey as keyof typeof effectivePermissions]
    );

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

        // If really NO permissions or at login, final fallback
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
