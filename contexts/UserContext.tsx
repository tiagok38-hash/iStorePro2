import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { User, PermissionSet } from '../types.ts';
import { getPermissionProfiles, login as apiLogin, registerAdmin as apiRegisterAdmin, logout as apiLogout, getProfile } from '../services/mockApi.ts';
import { supabase } from '../supabaseClient.ts';

// =====================================================
// KEEP ALIVE INTERVAL (3 minutos) 
// =====================================================
const KEEP_ALIVE_INTERVAL = 180000; // 3 minutos

interface UserContextData {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  permissions: PermissionSet | null;
  isOnline: boolean;
  session: any | null;
  login: (email: string, password_param: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password_param: string) => Promise<void>;
  refreshPermissions: () => void;
  checkSession: () => Promise<void>;
}

const UserContext = createContext<UserContextData | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [permissions, setPermissions] = useState<PermissionSet | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('user') !== null;
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<any | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const refreshPermissions = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const updateUserAndPermissions = useCallback(async (userData: User | null) => {
    console.log('UserContext: Updating user state:', userData?.email || 'Guest');
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
      try {
        const profiles = await getPermissionProfiles();
        const profile = profiles.find(p => p.id === userData.permissionProfileId);
        if (profile) {
          setPermissions(profile.permissions);
        } else {
          console.warn('UserContext: Profile ID not found:', userData.permissionProfileId);
          setPermissions(null);
        }
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (e) {
        console.error("UserContext: Failed to fetch permissions", e);
        setPermissions(null);
      }
    } else {
      setUser(null);
      setPermissions(null);
      setIsAuthenticated(false);
      setSession(null);
      localStorage.removeItem('user');
    }
  }, []);

  // =====================================================
  // WORKFLOW: CheckSession (conforme especificação)
  // =====================================================
  const checkSession = useCallback(async () => {
    // Avoid redundant checks if we just checked
    const lastCheck = sessionStorage.getItem('last_auth_check');
    const now = Date.now();
    if (lastCheck && now - parseInt(lastCheck) < 5000) return; // Cooldown 5s
    sessionStorage.setItem('last_auth_check', now.toString());

    console.log('UserContext: checkSession - Starting check...');

    if (!navigator.onLine) {
      console.log('UserContext: checkSession - Offline, relying on cache');
      setIsOnline(false);
      return;
    }

    setIsOnline(true);

    try {
      const { data: { session: supabaseSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('UserContext: checkSession - error getting session:', error);
        return; // Ignore transient errors
      }

      if (supabaseSession?.user) {
        console.log('UserContext: checkSession - Session valid');
        if (isMountedRef.current) setSession(supabaseSession);

        try {
          const profile = await getProfile(supabaseSession.user.id);
          if (!isMountedRef.current) return;

          const userData = profile || {
            id: supabaseSession.user.id,
            email: supabaseSession.user.email || '',
            name: supabaseSession.user.user_metadata?.name || 'Usuário',
            permissionProfileId: 'profile-admin',
            phone: '',
            createdAt: supabaseSession.user.created_at
          } as User;

          await updateUserAndPermissions(userData);
          // Only trigger refetch if something actually changed or after a long time
          // window.dispatchEvent(new Event('app-focus-refetch'));

        } catch (profileError) {
          console.error('UserContext: checkSession - Profile error:', profileError);
        }
      } else {
        // IMPORTANT: If we have a user in RAM, but Supabase says no session, 
        // DO NOT log out immediately. This could be a transient issue.
        // We only clear if supabase explicitly reports a SIGNED_OUT event via onAuthStateChange.
        console.log('UserContext: checkSession - Supabase reports no session, but keeping local cache.');
      }
    } catch (error) {
      console.error('UserContext: checkSession - Critical error:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [updateUserAndPermissions]);

  // =====================================================
  // KEEP ALIVE TIMER (3 minutos) - Mantém sessão ativa
  // =====================================================
  useEffect(() => {
    if (!session || !isAuthenticated) {
      // Clear keep-alive when no session
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      return;
    }

    // Start keep-alive timer
    keepAliveRef.current = setInterval(async () => {
      if (!isOnline) return;

      console.log('UserContext: KeepAlive - Pinging server...');
      try {
        // Simple query to keep connection alive
        const { error } = await supabase.rpc('now');
        if (error) throw error;
        console.log('UserContext: KeepAlive - Ping successful');
      } catch (error) {
        console.warn('UserContext: KeepAlive - Ping failed, checking session:', error);
        // Check session if ping fails
        await checkSession();
      }
    }, KEEP_ALIVE_INTERVAL);

    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    };
  }, [session, isAuthenticated, isOnline, checkSession]);

  useEffect(() => {
    isMountedRef.current = true;
    let authSubscription: any = null;

    const syncAuth = async (sessionData: any) => {
      console.log('UserContext: Syncing auth state, session:', sessionData ? 'Present' : 'None');

      if (sessionData?.user) {
        try {
          const profile = await getProfile(sessionData.user.id);
          if (!isMountedRef.current) return;

          const userData = profile || {
            id: sessionData.user.id,
            email: sessionData.user.email || '',
            name: sessionData.user.user_metadata?.name || 'Usuário',
            permissionProfileId: 'profile-admin',
            phone: '',
            createdAt: sessionData.user.created_at
          } as User;

          setSession(sessionData);
          await updateUserAndPermissions(userData);
        } catch (err) {
          console.error("UserContext: Profile sync failed", err);
        }
      } else if (isMountedRef.current) {
        await updateUserAndPermissions(null);
      }

      if (isMountedRef.current) {
        console.log('UserContext: Sync complete, setting loading to false');
        setLoading(false);
      }
    };

    const init = async (retryCount = 0) => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await syncAuth(initialSession);
      } catch (err: any) {
        console.error("UserContext: Session check failed", err);

        // If AbortError, try to fallback to cache immediately without retrying indefinitely or blocking
        const isAbort = err?.message?.includes('aborted') || err?.name === 'AbortError';

        if (isAbort) {
          console.warn("UserContext: AbortError detected. Skipping retries and falling back to local cache significantly.");
        } else if (retryCount < 3) { // Reduced max retries
          const delay = Math.min(500 * Math.pow(2, retryCount), 2000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return init(retryCount + 1);
        }

        // If we have a cached user, use it
        const cachedUser = localStorage.getItem('user');
        if (cachedUser && isMountedRef.current) {
          console.log('UserContext: Using cached user due to session check failure');
          const userData = JSON.parse(cachedUser);
          setUser(userData);
          setIsAuthenticated(true);
          try {
            const profiles = await getPermissionProfiles();
            const profile = profiles.find(p => p.id === userData.permissionProfileId);
            if (profile) setPermissions(profile.permissions);
          } catch (e) {
            console.warn('UserContext: Failed to load permissions from cache path, using null');
          }
        } else if (isMountedRef.current && !isAbort) { // Only force logout if it wasn't an abort (which might be transient)
          // No cached user and session failed - check if we need to require login
          console.log('UserContext: No session and no cache - user needs to login');
          setUser(null);
          setIsAuthenticated(false);
        }

        if (isMountedRef.current) setLoading(false);
      }


      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('UserContext: Auth event:', event);

        // Critical fix: Only treat explicit SIGNED_OUT or INITIAL_SESSION (if null) as logout.
        // Ignore other events with null session (like timeouts) to preserve local cache state if available.
        if (event === 'SIGNED_OUT') {
          if (isMountedRef.current) await updateUserAndPermissions(null);
        } else if (newSession?.user) {
          if (isMountedRef.current) await syncAuth(newSession);
        } else if (event === 'INITIAL_SESSION' && !newSession) {
          // Only clear if initial session check explicitly returns nothing
          if (isMountedRef.current) await updateUserAndPermissions(null);
        }
      });
      authSubscription = subscription;
    };



    // --- App Lifecycle & Network Events (EVENTOS DE APLICAÇÃO) ---
    // Event: On App Resume / On Page Focus / On Visibility Change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastCheck = sessionStorage.getItem('last_visible_check');
        const now = Date.now();
        // Only re-check session if user has been away for more than 1 minute
        if (!lastCheck || now - parseInt(lastCheck) > 60000) {
          console.log('UserContext: Visibility changed to visible - CheckSession');
          checkSession();
          sessionStorage.setItem('last_visible_check', now.toString());
        }
      }
    };

    const handleOnline = () => {
      console.log('UserContext: App is back online - CheckSession');
      setIsOnline(true);
      checkSession();
    };

    const handleOffline = () => {
      console.log('UserContext: App is offline');
      setIsOnline(false);
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    init();

    const timeout = setTimeout(() => {
      setLoading(currentLoading => {
        if (isMountedRef.current && currentLoading) {
          console.warn("UserContext: Safety timeout reached, forcing loading to false");
          return false;
        }
        return currentLoading;
      });
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeout);
      if (authSubscription) authSubscription.unsubscribe();
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateUserAndPermissions, checkSession]);

  const login = async (email: string, password_param: string) => {
    console.log('UserContext: Manual login started');
    const userData = await apiLogin(email, password_param);
    if (userData) {
      await updateUserAndPermissions(userData);
    }
  };

  const register = async (name: string, email: string, password_param: string) => {
    const userData = await apiRegisterAdmin(name, email, password_param);
    if (userData) {
      await updateUserAndPermissions(userData);
    }
  };

  const logout = async () => {
    console.log('UserContext: Logging out');
    // Optimistic logout: Clear state first, then tell API
    // This prevents hanging if network is down
    await updateUserAndPermissions(null);
    try {
      if (user) await apiLogout(user.id, user.name);
    } catch (e) {
      console.warn("UserContext: API Logout failed (ignoring)", e);
    }
  };

  const contextValue = React.useMemo(() => ({
    user,
    isAuthenticated,
    loading,
    permissions,
    isOnline,
    session,
    login,
    logout,
    register,
    refreshPermissions,
    checkSession
  }), [user, isAuthenticated, loading, permissions, isOnline, session, login, logout, register, refreshPermissions, checkSession]);

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
