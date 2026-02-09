import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext.tsx';
import { SpinnerIcon, BoltIcon } from './icons.tsx';

// =====================================================
// COMPONENT: GlobalLoadingOverlay
// Visible when loading == true (evita tela branca)
// Para usar em todas as páginas protegidas
// =====================================================
export const GlobalLoadingOverlay: React.FC<{ show?: boolean }> = ({ show }) => {
    const { loading, isOnline } = useUser();
    const isVisible = show !== undefined ? show : loading;

    // Auto-reload removed to prevent infinite loops on slow connections
    /*
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isVisible) {
            timer = setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
        return () => clearTimeout(timer);
    }, [isVisible]);
    */

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 animate-fade-in">
                {/* Spinner Premium */}
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-accent/20 rounded-full"></div>
                    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-accent rounded-full animate-spin"></div>
                    <div className="absolute inset-2 w-12 h-12 border-4 border-transparent border-b-accent/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>

                <div className="text-center">
                    <p className="text-primary font-semibold text-lg">Carregando...</p>
                    <p className="text-muted text-sm mt-1">
                        {isOnline ? 'Sincronizando dados com o servidor' : 'Modo offline - usando dados locais'}
                    </p>
                </div>

                {/* Offline indicator */}
                {!isOnline && (
                    <div className="mt-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center gap-2">
                        <BoltIcon className="w-4 h-4" />
                        Sem conexão com a internet
                    </div>
                )}
            </div>
        </div>
    );
};

// =====================================================
// COMPONENT: OnlineStatusIndicator
// Shows connection status in the corner
// =====================================================
export const OnlineStatusIndicator: React.FC = () => {
    const { isOnline } = useUser();
    const [showBanner, setShowBanner] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        if (!isOnline) {
            setShowBanner(true);
            setWasOffline(true);
        } else if (wasOffline) {
            // Show "back online" message briefly
            setShowBanner(true);
            const timer = setTimeout(() => {
                setShowBanner(false);
                setWasOffline(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, wasOffline]);

    if (!showBanner) return null;

    return (
        <div className={`fixed bottom-4 left-4 z-50 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg transition-all duration-300 animate-fade-in ${isOnline
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
            {isOnline
                ? '✓ Conexão restaurada'
                : 'Sem conexão - usando dados locais'
            }
        </div>
    );
};

// =====================================================
// COMPONENT: PageLoadingWrapper
// Para envolver o conteúdo de páginas protegidas
// Visibility Rule: Visible when loading == false
// =====================================================
interface PageLoadingWrapperProps {
    loading: boolean;
    children: React.ReactNode;
    loadingText?: string;
}

export const PageLoadingWrapper: React.FC<PageLoadingWrapperProps> = ({
    loading,
    children,
    loadingText = 'Carregando dados...'
}) => {
    // Auto-reload removed to prevent infinite loops on slow connections
    /*
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (loading) {
            timer = setTimeout(() => {
                window.location.reload();
            }, 3000);
        }
        return () => clearTimeout(timer);
    }, [loading]);
    */

    if (loading) {
        return (
            <div className="w-full h-64 flex flex-col items-center justify-center gap-4">
                <SpinnerIcon className="w-10 h-10" />
                <p className="text-muted text-sm">{loadingText}</p>
            </div>
        );
    }

    return <>{children}</>;
};

// =====================================================
// COMPONENT: SkeletonLoader
// Loading placeholder para cards e listas
// =====================================================
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse rounded-[32px] bg-surface border border-gray-100 shadow-xl p-6 ${className || ''}`}>
        <div className="flex justify-between items-center mb-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
);

export const SuspenseFallback: React.FC<{ fullScreen?: boolean }> = ({ fullScreen }) => {
    // Auto-reload removed to prevent infinite loops on slow connections
    /*
    useEffect(() => {
        const timer = setTimeout(() => {
            window.location.reload();
        }, 3000);
        return () => clearTimeout(timer);
    }, []);
    */

    return (
        <div className={fullScreen ? "w-screen h-screen flex items-center justify-center bg-background" : "w-full h-full flex items-center justify-center"}>
            <SpinnerIcon className={fullScreen ? "w-12 h-12" : "w-10 h-10"} />
        </div>
    );
};

// =====================================================
// HOOK: useSessionRefresh
// Para usar em páginas que precisam recarregar dados
// quando a sessão for validada
// =====================================================
export const useSessionRefresh = (onRefresh: () => void) => {
    const { checkSession } = useUser();

    useEffect(() => {
        const handleRefetch = () => {
            onRefresh();
        };

        window.addEventListener('app-focus-refetch', handleRefetch);

        return () => {
            window.removeEventListener('app-focus-refetch', handleRefetch);
        };
    }, [onRefresh]);

    return { checkSession };
};

export default GlobalLoadingOverlay;
