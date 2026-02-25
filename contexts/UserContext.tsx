import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { User, PermissionSet, CashSession } from '../types.ts';
import {
  getPermissionProfiles,
  login as apiLogin,
  registerAdmin as apiRegisterAdmin,
  logout as apiLogout,
  getProfile,
  getCashSessions,
  clearCache
} from '../services/mockApi.ts';
import { supabase } from '../supabaseClient.ts';
import { useToast } from './ToastContext.tsx';

// =====================================================
// CONFIGURAÇÕES DE SESSÃO E TIMEOUTS
// =====================================================
const KEEP_ALIVE_INTERVAL = 30 * 1000;
const BACKGROUND_REFRESH_THRESHOLD = 60 * 1000;

interface UserContextData {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  permissions: PermissionSet | null;
  isOnline: boolean;
  session: any | null;
  openCashSession: CashSession | null;
  login: (email: string, password_param: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password_param: string) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  checkSession: (forceRefreshData?: boolean) => Promise<void>;
}

const UserContext = createContext<UserContextData | undefined>(undefined);

// Permissões padrão (Segurança: Deny by Default para novos recursos)
const defaultPermissions: PermissionSet = {
  canAccessDashboard: true, canAccessEstoque: true, canAccessVendas: true,
  canAccessPOS: true, canAccessClientes: true, canAccessFornecedores: true,
  canAccessRelatorios: true, canAccessEmpresa: true, canAccessOrcamentos: true,
  canCreateProduct: true, canEditProduct: true, canDeleteProduct: true,
  canCompareStock: true, canAccessStockMovement: true, canGenerateLabels: true,
  canBulkUpdatePrices: true, canBulkUpdateLocations: true,
  canEditStock: true,
  canViewPurchases: true, canCreatePurchase: true, canEditPurchase: true,
  canDeletePurchase: true, canLaunchPurchase: true,
  canViewPurchaseKPIs: false,
  canCreateSale: true, canCancelSale: true,
  canViewSalesKPIs: true, canEditSale: true,
  canViewAllSales: true,
  canManageCompanyData: true, canManageUsers: true,
  canManagePermissions: true, canViewAudit: true,
  canEditOwnProfile: true, canManageMarcasECategorias: true,
  canCreateCustomer: true, canEditCustomer: true, canViewCustomerHistory: true,
  canInactivateCustomer: true, canDeleteCustomer: true,
  canCreateSupplier: true, canEditSupplier: true, canViewSupplierHistory: true,
  canDeleteSupplier: true,
  canManagePaymentMethods: true, canManageBackups: true, canManageParameters: true,
  canAccessFinanceiro: true, canCreateTransaction: true, canEditTransaction: true,
  canDeleteTransaction: true, canViewFinancialKPIs: true,
  canAccessServiceOrders: true, canCreateServiceOrder: true, canEditServiceOrder: true,
  canDeleteServiceOrder: true, canManageServiceOrderStatus: true,
  canAccessCrm: true, canCreateCrmDeal: true, canEditCrmDeal: true,
  canDeleteCrmDeal: true, canMoveCrmDeal: true, canViewAllCrmDeals: true,
  canAccessCatalog: true, canCreateCatalogItem: true, canEditCatalogItem: true, canDeleteCatalogItem: true,
  canViewOwnCommission: true,
  canViewAllCommissions: true,
  canCloseCommissionPeriod: true,
  canMarkCommissionPaid: true,
  canEditProductCommissionSettings: true,
  canAccessComissoes: true,
  canViewSaleProfit: true,
  canEditCompletedSale: false,
  canCancelCompletedSale: false,
  canReopenCashRegister: false,
};

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [permissions, setPermissions] = useState<PermissionSet | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('user'));
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<any | null>(null);
  const [openCashSession, setOpenCashSession] = useState<CashSession | null>(null);

  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastActiveRef = useRef<number>(Date.now());

  const reloadCriticalData = useCallback(async (userId: string) => {
    clearCache(['products', 'sales', 'permissions_profiles', 'cash_sessions', 'cash_sessions_' + userId]);
    window.dispatchEvent(new CustomEvent('app-reloadData'));
    try {
      const sessions = await getCashSessions(userId);
      const active = sessions.find(s => s.status === 'aberto');
      if (isMountedRef.current) setOpenCashSession(active || null);
    } catch (e) {
      console.warn('UserContext: Erro ao restaurar caixa:', e);
    }
  }, []);

  const updateUserAndPermissions = useCallback(async (userData: User | null, sessionData: any = null) => {
    if (!isMountedRef.current) return;

    if (userData) {
      // 1. Parallelize fetching of permissions and cash session context
      let currentPermissions = defaultPermissions;
      let activeSession = null;

      try {
        const [profiles, sessions] = await Promise.all([
          getPermissionProfiles(),
          getCashSessions(userData.id)
        ]);
        const profile = profiles.find(p => p.id === userData.permissionProfileId);
        if (profile) currentPermissions = { ...defaultPermissions, ...profile.permissions };
        activeSession = sessions.find(s => s.status === 'aberto') || null;
      } catch (e) {
        console.error("UserContext: Falha no carregamento de dados críticos", e);
      }

      // 2. Batch State Update (Atomic-ish)
      setUser(userData);
      setPermissions(currentPermissions);
      setOpenCashSession(activeSession);
      setIsAuthenticated(true);
      if (sessionData) setSession(sessionData);

      localStorage.setItem('user', JSON.stringify(userData));
      if (userData.lastSessionId) localStorage.setItem('local_session_id', userData.lastSessionId);

    } else {
      setUser(null);
      setPermissions(null);
      setIsAuthenticated(false);
      setSession(null);
      setOpenCashSession(null);
      localStorage.removeItem('user');
      localStorage.removeItem('local_session_id');
    }
  }, []);

  const checkSession = useCallback(async (forceRefreshData = false) => {
    const now = Date.now();
    const lastCheck = parseInt(sessionStorage.getItem('last_auth_check') || '0');
    if (!forceRefreshData && (now - lastCheck < 2000)) return;
    sessionStorage.setItem('last_auth_check', now.toString());

    if (!navigator.onLine) {
      setIsOnline(false);
      setLoading(false);
      return;
    }
    setIsOnline(true);

    const loadingTimeout = setTimeout(() => {
      if (loading && isMountedRef.current) {
        console.warn('UserContext: CheckSession loading timeout hit.');
        setLoading(false);
      }
    }, 8000);

    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        if (error.message.includes('invalid_grant') || error.message.includes('refresh_token_not_found')) {
          await updateUserAndPermissions(null);
        }
        return;
      }

      if (currentSession?.user) {
        setSession(currentSession);
        if (!user || user.id !== currentSession.user.id || forceRefreshData) {
          const profile = await getProfile(currentSession.user.id);
          const userData = profile || {
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            name: currentSession.user.user_metadata?.name || 'Usuário',
            permissionProfileId: 'profile-admin',
            phone: '',
            createdAt: currentSession.user.created_at
          } as User;

          if (profile && profile.permissionProfileId !== 'profile-admin') {
            const localSessionId = localStorage.getItem('local_session_id');
            if (profile.lastSessionId && profile.lastSessionId !== localSessionId) {
              showToast('Sua conta foi conectada em outro dispositivo. Desconectando...', 'warning');
              await updateUserAndPermissions(null);
              return;
            }
          }

          await updateUserAndPermissions(userData, currentSession);
          if (forceRefreshData) await reloadCriticalData(userData.id);
        } else {
          if (session?.access_token !== currentSession.access_token) setSession(currentSession);
          if (user && user.permissionProfileId !== 'profile-admin') {
            const latestProfile = await getProfile(user.id);
            const localSessionId = localStorage.getItem('local_session_id');
            if (latestProfile?.lastSessionId && latestProfile.lastSessionId !== localSessionId) {
              showToast('Login detectado em outro navegador/dispositivo.', 'warning');
              await updateUserAndPermissions(null);
            }
          }
        }
      } else if (user) {
        await updateUserAndPermissions(null);
      }
    } catch (err) {
      console.error('UserContext: Erro crítico no checkSession:', err);
    } finally {
      clearTimeout(loadingTimeout);
      if (isMountedRef.current) setLoading(false);
    }
  }, [user, session, updateUserAndPermissions, reloadCriticalData, loading]);

  useEffect(() => {
    isMountedRef.current = true;
    checkSession(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (newSession) {
            setSession(newSession);
            if (!user || user.id !== newSession.user.id) checkSession(true);
          }
          break;
        case 'SIGNED_OUT':
          await updateUserAndPermissions(null);
          clearCache(['products', 'sales', 'users', 'cash_sessions']);
          break;
        case 'USER_UPDATED':
          checkSession(false);
          break;
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeAway = now - lastActiveRef.current;
        checkSession(timeAway > BACKGROUND_REFRESH_THRESHOLD);
        lastActiveRef.current = now;
      } else {
        lastActiveRef.current = Date.now();
      }
    };

    const handleOnline = () => { setIsOnline(true); checkSession(true); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    keepAliveRef.current = setInterval(async () => {
      if (user && isOnline) {
        const { error } = await supabase.auth.getUser();
        if (error) checkSession(false);
        else checkSession(false);
      }
    }, KEEP_ALIVE_INTERVAL);

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, []);

  const login = async (email: string, password_param: string) => {
    const userData = await apiLogin(email, password_param);
    if (userData) {
      const { data: { session: newSession } } = await supabase.auth.getSession();
      await updateUserAndPermissions(userData, newSession);
      await reloadCriticalData(userData.id);
    }
  };

  const register = async (name: string, email: string, password_param: string) => {
    const userData = await apiRegisterAdmin(name, email, password_param);
    if (userData) {
      const { data: { session: newSession } } = await supabase.auth.getSession();
      await updateUserAndPermissions(userData, newSession);
    }
  };

  const logout = async () => {
    const currentId = user?.id;
    const currentName = user?.name;
    await updateUserAndPermissions(null);
    try {
      if (currentId) await apiLogout(currentId, currentName || '');
    } catch (e) { console.warn("Erro logout API", e); }
    setOpenCashSession(null);
    clearCache(Object.keys({}));
  };

  const refreshPermissions = async () => { if (user) await checkSession(true); };

  const contextValue = React.useMemo(() => ({
    user, isAuthenticated, loading, permissions, isOnline, session, openCashSession,
    login, logout, register, refreshPermissions, checkSession
  }), [user, isAuthenticated, loading, permissions, isOnline, session, openCashSession, checkSession, updateUserAndPermissions, reloadCriticalData]);

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error('useUser must be used within a UserProvider');
  return context;
};
