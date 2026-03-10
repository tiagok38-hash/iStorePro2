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

    // Se as permissões ainda não carregaram ou por algum problema estão null,
    // garantimos segurança máxima com Deny by Default. Apenas usuários admin master teriam fallback total,
    // mas na dúvida, bloqueamos acessos confidenciais.
    const emptyFallback = {} as Record<string, boolean>;
    const effectivePermissions = permissions
        ? { ...emptyFallback, ...permissions } // Se temos permissões vindas do contexto, usamos elas
        : (user?.permissionProfileId === 'profile-admin' 
            // Admin master recebe bypass caso permissões de objeto deem falha extrema
            ? new Proxy({}, { get: () => true }) 
            // Usuário comum é bloqueado com fallback vazio (Deny by default)
            : emptyFallback);

    if (permissions === null) {
        console.warn('ProtectedRoute: Permissions are null. Access denied as Deny-by-Default fallback used for:', user?.email);
    }

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
