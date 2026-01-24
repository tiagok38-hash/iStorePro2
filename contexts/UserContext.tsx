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

// =====================================================
// CONFIGURAÇÕES DE SESSÃO E TIMEOUTS
// =====================================================
const KEEP_ALIVE_INTERVAL = 2 * 60 * 1000; // 2 minutos - Verifica token proativamente
const BACKGROUND_REFRESH_THRESHOLD = 60 * 1000; // 1 minuto em background força reload de dados críticos

interface UserContextData {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  permissions: PermissionSet | null;
  isOnline: boolean;
  session: any | null;
  openCashSession: CashSession | null; // Nível 9: Contexto de Caixa
  login: (email: string, password_param: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password_param: string) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  checkSession: (forceRefreshData?: boolean) => Promise<void>;
}

const UserContext = createContext<UserContextData | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Estado Persistente (LocalStorage como backup, mas Supabase é a verdade)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [permissions, setPermissions] = useState<PermissionSet | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('user'));
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<any | null>(null);
  const [openCashSession, setOpenCashSession] = useState<CashSession | null>(null);

  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastActiveRef = useRef<number>(Date.now());

  // =====================================================
  // GERENCIAMENTO DE DADOS CRÍTICOS (Nível 6)
  // =====================================================
  const reloadCriticalData = useCallback(async (userId: string) => {
    console.log('UserContext: 🔄 Recarregando dados críticos (Estoque, Vendas, Permissões, Caixa)...');

    // 1. Limpar cache local (mockApi) para forçar fetch fresco do Supabase
    clearCache(['products', 'sales', 'permissions_profiles', 'cash_sessions', 'cash_sessions_' + userId]);

    // 2. Disparar evento para componentes atualizarem
    window.dispatchEvent(new CustomEvent('app-reloadData'));

    // 3. Restaurar contexto do caixa (Nível 9)
    try {
      const sessions = await getCashSessions(userId);
      const active = sessions.find(s => s.status === 'aberto');
      if (isMountedRef.current) {
        setOpenCashSession(active || null);
        console.log('UserContext: Caixa restaurado:', active ? `ID ${active.displayId}` : 'Nenhum aberto');
      }
    } catch (e) {
      console.warn('UserContext: Erro ao restaurar caixa:', e);
    }
  }, []);

  // =====================================================
  // ATUALIZAÇÃO DE ESTADO DO USUÁRIO
  // =====================================================
  const updateUserAndPermissions = useCallback(async (userData: User | null, sessionData: any = null) => {
    if (!isMountedRef.current) return;

    if (userData) {
      console.log('UserContext: ✅ Atualizando usuário autenticado:', userData.email);
      setUser(userData);
      setIsAuthenticated(true);
      if (sessionData) setSession(sessionData);

      // Persistência local segura
      localStorage.setItem('user', JSON.stringify(userData));

      // Carregar Permissões
      try {
        const profiles = await getPermissionProfiles();
        const profile = profiles.find(p => p.id === userData.permissionProfileId);
        if (profile) {
          setPermissions(profile.permissions);
        } else {
          console.warn('UserContext: Perfil de permissão não encontrado, usando fallback seguro.');
          // Fallback seguro em vez de erro
          setPermissions({
            canAccessDashboard: true, canAccessVendas: true, canAccessEstoque: true,
            canAccessClientes: true, canAccessFornecedores: true, canAccessRelatorios: true,
            canAccessEmpresa: true, canAccessPOS: true, canManageProducts: true,
            canEditProductPrices: true, canCancelSales: true, canApplyDiscounts: true,
            canEditOwnProfile: true, canManageMarcasECategorias: true
          });
        }
      } catch (e) {
        console.error("UserContext: Falha ao carregar permissões", e);
      }

      // Restaurar Caixa Aberto se necessário
      if (!openCashSession) {
        try {
          const sessions = await getCashSessions(userData.id);
          const active = sessions.find(s => s.status === 'aberto');
          setOpenCashSession(active || null);
        } catch (e) { console.error('Erro silent caixa', e) }
      }

    } else {
      console.log('UserContext: 🛑 Limpando sessão de usuário');
      setUser(null);
      setPermissions(null);
      setIsAuthenticated(false);
      setSession(null);
      setOpenCashSession(null);
      localStorage.removeItem('user');
    }
  }, [openCashSession]);

  // =====================================================
  // VERIFICAÇÃO DE SESSÃO (Core Logic)
  // =====================================================
  const checkSession = useCallback(async (forceRefreshData = false) => {
    // Evita check redundante muito rápido (debounce 2s)
    const now = Date.now();
    const lastCheck = parseInt(sessionStorage.getItem('last_auth_check') || '0');
    if (!forceRefreshData && (now - lastCheck < 2000)) return;

    sessionStorage.setItem('last_auth_check', now.toString());
    console.log('UserContext: 🔍 Verificando sessão Supabase...');

    if (!navigator.onLine) {
      console.log('UserContext: Offline - Mantendo estado local');
      setIsOnline(false);
      setLoading(false);
      return;
    }
    setIsOnline(true);

    try {
      // 1. Tenta obter sessão atual (usa refresh token se necessário automaticamente)
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('UserContext: Erro na sessão:', error.message);
        // Se erro crítico (ex: refresh token revogado), logout
        if (error.message.includes('invalid_grant') || error.message.includes('refresh_token_not_found')) {
          await updateUserAndPermissions(null);
        }
        return;
      }

      if (currentSession?.user) {
        // Sessão válida!
        setSession(currentSession);

        // Verifica se usuário mudou ou se precisamos recarregar perfil
        if (!user || user.id !== currentSession.user.id || forceRefreshData) {
          console.log('UserContext: Sessão recuperada, carregando perfil...');
          const profile = await getProfile(currentSession.user.id);

          const userData = profile || {
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            name: currentSession.user.user_metadata?.name || 'Usuário',
            permissionProfileId: 'profile-admin', // Fallback temporário
            phone: '',
            createdAt: currentSession.user.created_at
          } as User;

          await updateUserAndPermissions(userData, currentSession);

          // SE for um 'hard refresh' ou retorno de background, recarrega dados
          if (forceRefreshData) {
            await reloadCriticalData(userData.id);
          }
        } else {
          console.log('UserContext: Sessão quente mantida.');
          // Apenas atualiza token se mudou
          if (session?.access_token !== currentSession.access_token) {
            setSession(currentSession);
          }
        }
      } else {
        // Nenhuma sessão ativa no Supabase
        console.log('UserContext: Nenhuma sessão ativa encontrada.');
        // Se tínhamos usuário logado localmente, agora é hora de fazer o logout real
        if (user) {
          await updateUserAndPermissions(null);
        }
      }
    } catch (err) {
      console.error('UserContext: Erro crítico no checkSession:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [user, session, updateUserAndPermissions, reloadCriticalData]);

  // =====================================================
  // ESCUTA DE EVENTOS DE AUTENTICAÇÃO E JANELA
  // =====================================================
  useEffect(() => {
    isMountedRef.current = true;

    // 1. Inicialização
    checkSession(true); // Force load on mount

    // 2. Supabase Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`UserContext: 🔔 Auth Event: ${event}`);

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (newSession) {
            // Atualiza sessão sem necessariamente recarregar tudo se o user for o mesmo
            setSession(newSession);
            if (!user) { // Se não tinha user, carrega completo
              checkSession(true);
            } else if (user.id !== newSession.user.id) { // Mudou user
              checkSession(true);
            }
          }
          break;
        case 'SIGNED_OUT':
          await updateUserAndPermissions(null);
          clearCache(['products', 'sales', 'users', 'cash_sessions']); // Limpa dados sensíveis
          break;
        case 'USER_UPDATED':
          checkSession(false);
          break;
      }
    });

    // 3. Visibilidade e Foco (Restaurar Sessão e Dados)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeAway = now - lastActiveRef.current;
        console.log(`UserContext: App em foco. Tempo ausente: ${Math.round(timeAway / 1000)}s`);

        // Se ficou fora por mais que o threshold, força refresh de dados
        const shouldRefreshData = timeAway > BACKGROUND_REFRESH_THRESHOLD;

        checkSession(shouldRefreshData);
        lastActiveRef.current = now;
      } else {
        lastActiveRef.current = Date.now();
      }
    };

    // 4. Online/Offline Listeners
    const handleOnline = () => {
      setIsOnline(true);
      console.log('UserContext: Online detectado. Ressincronizando...');
      checkSession(true); // Voltando online sempre é bom checar
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange); // Extra guarantee
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 5. Keep Alive Interval (Refresca token preventivamente)
    keepAliveRef.current = setInterval(async () => {
      if (user && isOnline) {
        // Apenas chama getUser para validar/refresh token silenciosamente
        const { error } = await supabase.auth.getUser();
        if (error) {
          console.warn('UserContext: KeepAlive falhou, tentando recuperar sessão...');
          checkSession(false);
        }
      }
    }, KEEP_ALIVE_INTERVAL);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, []); // Empty dependecy array intended for singleton-like behavior

  // =====================================================
  // AÇÕES PÚBLICAS
  // =====================================================
  const login = async (email: string, password_param: string) => {
    // await apiLogout(); // Garante limpeza anterior
    console.log('UserContext: Login manual...');
    const userData = await apiLogin(email, password_param);
    if (userData) {
      // Force session refresh to get the pure Supabase session object
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
    console.log('UserContext: Logout solicitado.');
    await updateUserAndPermissions(null);
    try {
      if (user) await apiLogout(user.id, user.name);
    } catch (e) { console.warn("Erro no logout API", e); }
    // Limpeza final
    setOpenCashSession(null);
    clearCache(Object.keys({})); // Clear all
  };

  const refreshPermissions = async () => {
    if (user) await checkSession(false);
  };

  const contextValue = React.useMemo(() => ({
    user,
    isAuthenticated,
    loading,
    permissions,
    isOnline,
    session,
    openCashSession,
    login,
    logout,
    register,
    refreshPermissions,
    checkSession
  }), [user, isAuthenticated, loading, permissions, isOnline, session, openCashSession]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
