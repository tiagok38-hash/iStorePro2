
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient.ts';
import { Product, Customer, Sale, User, Supplier, PurchaseOrder, Brand, Category, ProductModel, Grade, GradeValue, TodaySale, Payment, AuditLog, AuditActionType, AuditEntityType, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, PaymentMethodParameter, CardConfigData, CompanyInfo, PermissionProfile, PermissionSet, ReceiptTermParameter, CashSession, CashMovement, StockHistoryEntry, PurchaseItem, PriceHistoryEntry, TradeInEntry, Service, ServiceOrder, CatalogItem, TransactionCategory, FinancialTransaction, CrmDeal, CrmActivity, CrmColumn, CreditInstallment, CreditSettings, InventoryMovement } from '../types.ts';
import { getNowISO, getTodayDateString, formatDateTimeBR } from '../utils/dateUtils.ts';
import { sendSaleNotification, sendPurchaseNotification } from './telegramService.ts';
import { calculateInstallmentDates, calculateFinancedAmount, generateAmortizationTable } from '../utils/creditUtils.ts';

// --- CACHE SYSTEM ---
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const METADATA_TTL = 30 * 60 * 1000; // 30 minutes

// Cross-tab cache synchronization
const cacheChannel = new BroadcastChannel('app_cache_sync');

const fetchWithCache = async <T>(key: string, fetcher: () => Promise<T>, ttl: number = CACHE_TTL): Promise<T> => {
    const now = Date.now();
    // Use the cached data directly to avoid the overhead of JSON.parse(JSON.stringify())
    // which is extremely slow for large arrays like products and sales.
    if (cache[key] && (now - cache[key].timestamp < ttl)) {
        return cache[key].data;
    }
    const data = await fetcher();
    cache[key] = { data, timestamp: now };
    return data;
};

export const clearCache = (keys: string[]) => {
    const cacheKeys = Object.keys(cache);
    keys.forEach(key => {
        // Clear exact match
        delete cache[key];

        // Clear related keys (e.g. 'sales' clears 'sales_all_all', 'sales_USER_ID_all')
        cacheKeys.forEach(ck => {
            if (ck === key || ck.startsWith(key + '_')) {
                delete cache[ck];
            }
        });
    });
    // Sync with other tabs by sending prefixes
    cacheChannel.postMessage({ type: 'CLEAR_CACHE', keys, prefixes: keys });

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-reloadData'));
    }
};

cacheChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE' && Array.isArray(event.data.prefixes)) {
        const cacheKeys = Object.keys(cache);
        event.data.prefixes.forEach((prefix: string) => {
            cacheKeys.forEach(ck => {
                if (ck === prefix || ck.startsWith(prefix + '_')) {
                    delete cache[ck];
                }
            });
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app-reloadData'));
        }
    }
};

// --- TIMEOUT HELPER ---
// Prevents calls from hanging indefinitely when connection is stale
const DEFAULT_TIMEOUT = 5000; // 5 seconds

const withTimeout = <T>(promise: Promise<T> | any, timeoutMs: number = DEFAULT_TIMEOUT, errorMessage?: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage || `Request timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

const fetchWithRetry = async <T>(fetcher: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
        return await fetcher();
    } catch (error: any) {
        // Don't retry if it's a legitimate user abortion or timeout that shouldn't be retried blindly
        if (error?.name === 'AbortError') {
            throw error;
        }

        if (retries <= 0) throw error;

        const isNetworkError =
            error?.message?.includes('aborted') || // specific supabase aborts might differ
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('NetworkError');

        if (isNetworkError) {

            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(fetcher, retries - 1, delay * 2);
        }
        throw error;
    }
};

// Helper para formatar moeda (mantido local pois é utilitário de UI)
export const formatCurrency = (value: number | null | undefined, fallback: string = 'R$ 0,00'): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return fallback;
    }
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

export const formatPhone = (value: string): string => {
    if (!value) return "";
    let v = value.replace(/\D/g, "");
    v = v.substring(0, 11);
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length <= 10) return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
    return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
};



// --- AUDIT LOGGING HELPER ---
export const addAuditLog = async (
    action: AuditActionType,
    entity: AuditEntityType,
    entityId: string,
    details: string,
    userId: string = 'system',
    userName: string = 'Sistema'
) => {
    try {
        await supabase.from('audit_logs').insert([{
            timestamp: getNowISO(),
            userId,
            userName,
            action,
            entity,
            entityId,
            details
        }]);
        clearCache(['audit_logs']);
    } catch (e) {
        console.error("Failed to add audit log", e);
    }
};

// --- AUTH & USERS ---

export const login = async (email: string, password_param: string): Promise<User> => {
    if (!email || !password_param) throw new Error('E-mail e senha são obrigatórios.');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password_param,
    });

    if (authError) {
        console.error('mockApi: Auth error:', authError);
        throw new Error(authError.message);
    }

    if (!authData.user) throw new Error('Usuário não encontrado.');

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        console.warn('Profile fetch error:', profileError);
    }

    if (profileError || !profile) {
        console.warn('Profile not found for authenticated user, using fallback.');
        const fallbackUser = {
            id: authData.user.id,
            email: authData.user.email || '',
            name: authData.user.user_metadata?.name || 'Usuário',
            permissionProfileId: 'profile-admin',
            phone: '',
            createdAt: authData.user.created_at
        } as User;
        return fallbackUser;
    }

    // Nível Máximo: Política de sessão única por dispositivo
    // Administradores são isentos desta regra (podem logar em múltiplos lugares)
    if (profile.permissionProfileId !== 'profile-admin') {
        const newSessionId = crypto.randomUUID();
        const { error: updateSessionError } = await supabase
            .from('users')
            .update({ lastSessionId: newSessionId })
            .eq('id', profile.id);

        if (!updateSessionError) {
            profile.lastSessionId = newSessionId;
        } else {
            console.error('Erro ao atualizar lastSessionId:', updateSessionError);
        }
    }

    // Log login event (fire-and-forget to not block login)
    addAuditLog(
        AuditActionType.LOGIN,
        AuditEntityType.USER,
        profile.id,
        `Login realizado: ${profile.name} (${profile.email})`,
        profile.id,
        profile.name
    ).catch(err => console.error('Failed to log login event:', err));

    return profile as User;
};

export const logout = async (userId?: string, userName?: string) => {
    // Log logout event before signing out (fire-and-forget)
    if (userId && userName) {
        addAuditLog(
            AuditActionType.LOGOUT,
            AuditEntityType.USER,
            userId,
            `Logout realizado: ${userName}`,
            userId,
            userName
        ).catch(err => console.error('Failed to log logout event:', err));
    }

    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error.message);
    clearCache(Object.keys(cache));
};

export const getProfile = async (userId: string): Promise<User | null> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error) {
            console.error('mockApi: getProfile error:', error);
            return null;
        }
        return data as User;
    });
};

export const getUsers = async (): Promise<User[]> => {
    return fetchWithCache('users', async () => {
        return fetchWithRetry(async () => {
            const res = await supabase.from('users').select('*');
            if (res.error) throw res.error;
            return res.data || [];
        });
    });
};

export const addUser = async (data: any) => {
    // We use a separate client instance to sign up the new user 
    // without logging out the current admin session.
    const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
    });

    // 1. Create entry in Auth
    const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: { name: data.name }
        }
    });

    if (authError) {
        console.error('mockApi: Erro no signUp:', authError);
        if (authError.message.includes('already registered') || authError.status === 422) {
            throw new Error('Este e-mail já está cadastrado no sistema de autenticação (pode pertencer a um usuário antigo/excluído). Por favor, use um e-mail diferente.');
        }
        if (authError.message.includes('Database error')) {
            throw new Error('Erro interno ao salvar usuário (possível falha de Trigger). Tente novamente ou use outro e-mail.');
        }
        throw new Error(`Erro ao criar acesso: ${authError.message}`);
    }
    if (!authData.user) throw new Error('Falha silenciosa ao criar credenciais de acesso.');

    // 2. Wait for the SQL Trigger to create the profile in public.users
    let profile = await getProfile(authData.user.id);
    let retries = 0;
    while (!profile && retries < 10) {
        await new Promise(r => setTimeout(r, 500));
        profile = await getProfile(authData.user.id);
        retries++;
    }

    if (profile) {
        // 3. Update the profile with additional fields from the form
        const { error: updateError } = await supabase
            .from('users')
            .update({
                phone: data.phone || '',
                permissionProfileId: data.permissionProfileId,
                // Do NOT save password here as it is now in Auth
            })
            .eq('id', profile.id);

        if (updateError) console.error("Error updating profile metadata:", updateError);

        // Return the updated profile
        profile = { ...profile, phone: data.phone || '', permissionProfileId: data.permissionProfileId };
    }

    clearCache(['users']);
    return profile;
};

export const updateUser = async (data: any) => {

    // 1. Handle password update if provided
    if (data.password) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && currentUser.id === data.id) {
            const { error: authError } = await supabase.auth.updateUser({
                password: data.password
            });
            if (authError) {
                console.error('mockApi: Auth password update error:', authError);
                throw authError;
            }
        } else {
            console.warn('mockApi: Cannot update password for other users via client SDK.');
            throw new Error('Não é possível alterar a senha de outros usuários por aqui. O usuário deve usar "Esqueci minha senha" ou alterar no próprio perfil.');
        }
    }

    // 2. Prepare data for the public.users table update
    // We remove fields that shouldn't be updated manually or might cause conflicts
    const { id, password, createdAt, ...updateFields } = data;

    const { data: updated, error } = await supabase
        .from('users')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('mockApi: Error updating user profile:', error);
        throw error;
    }

    clearCache(['users']);
    return updated;
};

export const deleteUser = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: user } = await supabase.from('users').select('*').eq('id', id).single();

    // Em vez de deletar fisicamente, inativamos o usuário para preservar histórico
    const { error } = await supabase.from('users').update({ active: false }).eq('id', id);
    if (error) {
        console.error('Erro ao inativar usuário:', error);
        throw error;
    }

    if (user) {
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.USER,
            id,
            `Usuário inativado (soft-delete): ${user.name} (${user.email})`,
            userId,
            userName
        );
    }

    clearCache(['users']);
};

export const registerAdmin = async (name: string, email: string, password_param: string): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: password_param,
        options: {
            data: { name }
        }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Falha ao criar usuário.');

    // Profile will be created by the SQL trigger. We wait a bit or fetch it.
    let profile = await getProfile(authData.user.id);
    let retries = 0;
    while (!profile && retries < 5) {
        await new Promise(r => setTimeout(r, 500));
        profile = await getProfile(authData.user.id);
        retries++;
    }

    return profile || {
        id: authData.user.id,
        name,
        email,
        permissionProfileId: 'profile-admin',
        phone: '',
        createdAt: getNowISO()
    } as User;
};

export const checkAdminExists = async (): Promise<boolean> => {
    const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('permissionProfileId', 'profile-admin');

    if (error) return false;
    return (count || 0) > 0;
};

// --- PERMISSIONS ---

export const getPermissionProfiles = async (): Promise<PermissionProfile[]> => {
    return fetchWithCache('permission_profiles', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('permissions_profiles').select('*');
            if (error) throw error;
            return data || [];
        });
    });
};

export const addPermissionProfile = async (data: any) => {
    const payload = { ...data };
    if (!payload.id) {
        payload.id = crypto.randomUUID();
    }
    const { data: newProfile, error } = await supabase.from('permissions_profiles').insert([payload]).select().single();
    if (error) throw error;
    clearCache(['permission_profiles']);
    return newProfile;
};

export const updatePermissionProfile = async (data: any) => {
    const { data: updated, error } = await supabase.from('permissions_profiles').update(data).eq('id', data.id).select().single();
    if (error) throw error;
    clearCache(['permission_profiles']);
    return updated;
};

export const deletePermissionProfile = async (id: string) => {
    const { error } = await supabase.from('permissions_profiles').delete().eq('id', id);
    if (error) throw error;
    clearCache(['permission_profiles']);
};

// --- CASH SESSIONS ---

export const getCashSessions = async (currentUserId?: string): Promise<CashSession[]> => {
    return fetchWithCache(`cash_sessions_${currentUserId || 'all'}`, async () => {
        return fetchWithRetry(async () => {
            let query = supabase.from('cash_sessions').select('*').order('open_time', { ascending: false }).limit(400);

            // RULE 7: User only sees its own cash sessions.
            if (currentUserId) {
                query = query.eq('user_id', currentUserId);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Map snake_case to camelCase
            const mappedSessions = (data || []).map((s: any) => ({
                ...s,
                userId: s.user_id,
                displayId: s.display_id,
                openingBalance: s.opening_balance,
                cashInRegister: s.cash_in_register,
                openTime: s.open_time,
                closeTime: s.close_time,
                reopenedBy: s.reopened_by,
                reopenedAt: s.reopened_at,
                reopenReason: s.reopen_reason
            }));

            // AUTO-CLOSE STALE SESSIONS
            // Check if any open session belongs to a previous day
            // GOVERNANCE: Do NOT auto-close sessions that were explicitly reopened by admin
            const today = getTodayDateString(); // Assume YYYY-MM-DD local
            const staleSessions = mappedSessions.filter((s: any) => {
                if (s.status === 'aberto' || s.status === 'Aberto') {
                    // Skip auto-close for admin-reopened sessions (they have reopen_reason set)
                    if (s.reopen_reason || s.reopened_at) return false;

                    const sessionDate = s.openTime.split('T')[0];
                    return sessionDate < today;
                }
                return false;
            });

            if (staleSessions.length > 0) {
                // Fire-and-forget update to close them in DB
                (async () => {
                    const staleIds = staleSessions.map((s: any) => s.id);
                    // Update status to 'fechado' locally and in DB
                    for (const session of staleSessions) {
                        const sessionDay = session.openTime.split('T')[0];
                        const autoCloseTime = `${sessionDay}T23:59:59.999Z`;

                        await supabase.from('cash_sessions').update({
                            status: 'fechado',
                            close_time: autoCloseTime
                        }).eq('id', session.id);

                        await addAuditLog(
                            AuditActionType.UPDATE,
                            'CASH_SESSION' as any,
                            session.id,
                            `Fechamento Automático (Virada de Dia): ${sessionDay}`,
                            'system',
                            'Sistema'
                        );
                    }
                    // Clear cache to ensure next fetch gets clean DB state
                    clearCache(['cash_sessions']);
                })().catch(err => console.error('[getCashSessions] Auto-close failed:', err));

                // Return modified data to UI immediately (Optimistic update)
                return mappedSessions.map((s: any) => {
                    const isStale = staleSessions.find((st: any) => st.id === s.id);
                    if (isStale) {
                        const sessionDay = s.openTime.split('T')[0];
                        return { ...s, status: 'fechado', closeTime: `${sessionDay}T23:59:59.999Z` };
                    }
                    return s;
                });
            }

            return mappedSessions;
        });
    });
};

export const addCashSession = async (data: any, odId: string = 'system', userName: string = 'Sistema') => {
    // Generate sequential displayId
    const { count } = await supabase.from('cash_sessions').select('*', { count: 'exact', head: true });
    const nextDisplayId = (count || 0) + 1;

    // RULE: ONE SESSION PER USER PER DAY
    // Check if there is already a session for this user today (open or closed)
    const today = getTodayDateString(); // e.g. "2023-10-27"

    // We need to check against the open_time which is ISO. 
    // We can filter by open_time >= todayT00:00:00 and open_time <= todayT23:59:59
    // But since getTodayDateString returns local date string, we need to be careful with UTC.
    // However, for this mock implementation running locally, we can rely on string comparison of the date part 
    // if we assume getNowISO() follows the same locale or we use a more robust check.

    // Robust check: fetch all sessions for user and check if any falls in "today"
    const { data: existingSessions, error: checkError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('user_id', data.userId)
        .gte('open_time', `${today}T00:00:00`)
        .lte('open_time', `${today}T23:59:59.999`);

    if (checkError) throw checkError;

    if (existingSessions && existingSessions.length > 0) {
        const existing = existingSessions[0];
        const status = existing.status === 'aberto' ? 'ABERTO' : 'FECHADO';
        throw new Error(`O usuário já possui um caixa ${status} para a data de hoje (${formatDateTimeBR(existing.open_time)}). Não é permitido abrir múltiplos caixas no mesmo dia.`);
    }

    // Use snake_case column names (Supabase default)
    const session = {
        user_id: data.userId,
        display_id: nextDisplayId,
        opening_balance: data.openingBalance || 0,
        cash_in_register: data.openingBalance || 0,
        withdrawals: 0,
        deposits: 0,
        movements: [],
        open_time: getNowISO(),
        status: 'aberto'
    };


    const { data: newSession, error } = await supabase.from('cash_sessions').insert([session]).select().single();
    if (error) {
        console.error('Error creating cash session:', error);
        throw error;
    }

    // Fire-and-forget audit log to avoid blocking
    addAuditLog(
        AuditActionType.CASH_OPEN,
        AuditEntityType.USER,
        newSession.id,
        `Caixa #${newSession.display_id || nextDisplayId} aberto com saldo inicial de ${formatCurrency(data.openingBalance || 0)}`,
        data.userId,
        userName
    ).catch(err => console.error('Failed to log cash open event:', err));

    clearCache(['cash_sessions']);

    // Map response back to camelCase for frontend
    return {
        ...newSession,
        userId: newSession.user_id,
        displayId: newSession.display_id,
        openingBalance: newSession.opening_balance,
        cashInRegister: newSession.cash_in_register,
        openTime: newSession.open_time,
        closeTime: newSession.close_time
    };
};

export const updateCashSession = async (data: any, odId: string = 'system', userName: string = 'Sistema') => {
    // RULE 5 & 7: Validate ownership before update
    const callingUserProfile = odId !== 'system' ? await getProfile(odId) : null;
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin';
    const permissions = (callingUserProfile as any)?.permissions || {};

    if (odId !== 'system') {
        const { data: existing } = await supabase.from('cash_sessions').select('user_id, status').eq('id', data.id).single();
        if (existing && !isCallingAdmin && existing.user_id !== odId) {
            throw new Error('Acesso NEGADO: Este caixa pertence a outro usuário.');
        }

        // GOVERNANCE: Reopening a closed cash register requires special permission
        if (existing?.status === 'fechado' && (data.status === 'aberto' || data.status === 'reaberto')) {
            const canReopen = isCallingAdmin || permissions.canReopenCashRegister === true;
            if (!canReopen) {
                throw new Error('Acesso NEGADO: Você não tem permissão para reabrir caixas fechados.');
            }
            if (!data.reopenReason) {
                throw new Error('É obrigatório informar o motivo para reabrir o caixa.');
            }
        }
    }

    // Convert camelCase to snake_case for Supabase
    const updatePayload: any = {
        status: data.status
    };
    if (data.closeTime !== undefined) updatePayload.close_time = data.closeTime;
    if (data.cashInRegister !== undefined) updatePayload.cash_in_register = data.cashInRegister;
    if (data.withdrawals !== undefined) updatePayload.withdrawals = data.withdrawals;
    if (data.deposits !== undefined) updatePayload.deposits = data.deposits;
    if (data.movements !== undefined) updatePayload.movements = data.movements;

    // GOVERNANCE: Track reopen metadata
    const isReopening = data.status === 'aberto' && data.reopenReason;
    if (isReopening) {
        updatePayload.reopened_by = odId !== 'system' ? odId : null;
        updatePayload.reopened_at = new Date().toISOString();
        updatePayload.reopen_reason = data.reopenReason;
    }

    const { data: updated, error } = await supabase.from('cash_sessions').update(updatePayload).eq('id', data.id).select().single();
    if (error) {
        console.error('Error updating cash session:', error);
        throw error;
    }

    const displayId = updated.display_id || updated.displayId;
    const auditAction = data.status === 'fechado' ? AuditActionType.CASH_CLOSE : AuditActionType.CASH_OPEN;
    const actionDescription = data.status === 'fechado'
        ? `Caixa #${displayId} fechado`
        : isReopening
            ? `Caixa #${displayId} reaberto. Motivo: ${data.reopenReason}`
            : `Caixa #${displayId} aberto`;

    // Fire-and-forget legacy audit
    addAuditLog(
        auditAction,
        AuditEntityType.USER,
        updated.id,
        actionDescription,
        data.userId || odId,
        userName
    ).catch(err => console.error('Failed to log cash session update:', err));

    // GOVERNANCE: Insert immutable audit log for reopening
    if (isReopening) {
        supabase.from('cash_register_audit_logs').insert({
            cash_register_id: updated.id,
            action_type: 'cash_register_reopened',
            description: `Admin reabriu caixa #${displayId}. Motivo: ${data.reopenReason}`,
            performed_by: odId !== 'system' ? odId : '00000000-0000-0000-0000-000000000000',
            performed_by_name: userName,
            performed_at: new Date().toISOString(),
            metadata: { reason: data.reopenReason, display_id: displayId }
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('Failed to insert cash_register_audit_log:', auditErr);
        });
    }

    // GOVERNANCE: Insert immutable audit log for closing
    if (data.status === 'fechado') {
        supabase.from('cash_register_audit_logs').insert({
            cash_register_id: updated.id,
            action_type: 'cash_register_closed',
            description: `Caixa #${displayId} fechado por ${userName}`,
            performed_by: odId !== 'system' ? odId : '00000000-0000-0000-0000-000000000000',
            performed_by_name: userName,
            performed_at: new Date().toISOString(),
            metadata: { display_id: displayId }
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('Failed to insert cash_register_audit_log:', auditErr);
        });
    }

    clearCache([`cash_sessions_${odId || 'all'}`, 'cash_sessions_all']);

    // Map back to camelCase
    return {
        ...updated,
        userId: updated.user_id,
        displayId: updated.display_id,
        openingBalance: updated.opening_balance,
        cashInRegister: updated.cash_in_register,
        openTime: updated.open_time,
        closeTime: updated.close_time,
        reopenedBy: updated.reopened_by,
        reopenedAt: updated.reopened_at,
        reopenReason: updated.reopen_reason
    };
};

export const addCashMovement = async (sid: string, mov: any, odId: string = 'system', userName: string = 'Sistema') => {
    const { data: session, error: fetchError } = await supabase.from('cash_sessions').select('*').eq('id', sid).single();
    if (fetchError) throw fetchError;

    // RULE 5: Strict validation of ownership (EXCEPT ADMINS)
    const callingUserProfile = odId !== 'system' ? await getProfile(odId) : null;
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin';

    if (odId !== 'system' && !isCallingAdmin && session.user_id !== odId) {
        throw new Error('Acesso NEGADO: Você não tem permissão para movimentar este caixa.');
    }

    const movements = session.movements || [];
    const newMovement = { ...mov, id: crypto.randomUUID(), timestamp: getNowISO() };
    const updatedMovements = [...movements, newMovement];

    const totalAmount = Number(mov.amount);
    // Use snake_case column names
    const currentCash = session.cash_in_register || session.cashInRegister || 0;
    const currentWithdrawals = session.withdrawals || 0;
    const currentDeposits = session.deposits || 0;

    let updates: any = { movements: updatedMovements };
    if (mov.type === 'sangria') {
        updates.withdrawals = currentWithdrawals + totalAmount;
        updates.cash_in_register = currentCash - totalAmount;
    } else {
        updates.deposits = currentDeposits + totalAmount;
        updates.cash_in_register = currentCash + totalAmount;
    }

    const { data: updated, error } = await supabase
        .from('cash_sessions')
        .update(updates)
        .eq('id', sid)
        .select()
        .single();

    if (error) throw error;

    // Fire-and-forget logging to avoid UI hang
    const auditAction = mov.type === 'sangria' ? AuditActionType.CASH_WITHDRAWAL : AuditActionType.CASH_SUPPLY;
    const actionLabel = mov.type === 'sangria' ? 'Sangria' : 'Suprimento';
    const displayIdMov = updated.display_id || updated.displayId;
    addAuditLog(
        auditAction,
        AuditEntityType.USER,
        sid,
        `${actionLabel} no Caixa #${displayIdMov}: ${formatCurrency(totalAmount)} - Motivo: ${mov.reason}`,
        odId,
        userName
    ).catch(err => console.error('Failed to log cash movement:', err));

    // GOVERNANCE: Insert immutable audit log for cash movement
    supabase.from('cash_register_audit_logs').insert({
        cash_register_id: sid,
        sale_id: mov.saleId || null,
        action_type: mov.type === 'sangria' ? 'withdrawal_created' : 'supply_created',
        description: `${actionLabel} de ${formatCurrency(totalAmount)} no caixa #${displayIdMov}. Motivo: ${mov.reason}${mov.saleId ? ` (vinculada à venda #${mov.saleId})` : ''}`,
        performed_by: odId !== 'system' ? odId : '00000000-0000-0000-0000-000000000000',
        performed_by_name: userName,
        performed_at: new Date().toISOString(),
        metadata: { amount: totalAmount, reason: mov.reason, type: mov.type, sale_id: mov.saleId || null }
    }).then(({ error: auditErr }) => {
        if (auditErr) console.error('Failed to insert cash_register_audit_log (movement):', auditErr);
    });

    clearCache(['cash_sessions']);

    // Map back to camelCase
    return {
        ...updated,
        userId: updated.user_id,
        displayId: updated.display_id,
        openingBalance: updated.opening_balance,
        cashInRegister: updated.cash_in_register,
        openTime: updated.open_time,
        closeTime: updated.close_time
    };
};

// --- PRODUCTS ---

export const getProducts = async (filters: { model?: string, categoryId?: string, brandId?: string, onlyInStock?: boolean, select?: string } = {}): Promise<Product[]> => {
    const cacheKey = `products_${JSON.stringify(filters)}`;
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            let query = supabase.from('products').select(filters.select || '*');

            if (filters.model) query = query.ilike('model', `%${filters.model}%`);
            if (filters.categoryId) query = query.eq('category', filters.categoryId); // Prop is categoryId but col is category
            if (filters.brandId) query = query.eq('brand', filters.brandId); // Prop is brandId but col is brand
            if (filters.onlyInStock) query = query.gt('stock', 0);

            // Robustness: Always limit to a sane amount for general fetch (e.g. 1000 items)
            // If they need more, they should use specific search functions.
            const { data, error } = await query.order('createdAt', { ascending: false }).limit(1000);

            if (error) throw error;
            return (data || []).map((p: any) => ({
                ...p,
                supplierId: p.supplier_id || p.supplierId,
                storageLocation: p.storage_location || p.storageLocation,
                costPrice: p.cost_price || p.costPrice,
                wholesalePrice: p.wholesale_price || p.wholesalePrice,
                batteryHealth: p.battery_health || p.batteryHealth,
                serialNumber: p.serial_number || p.serialNumber,
                additionalCostPrice: p.additional_cost_price || p.additionalCostPrice,
                stockHistory: p.stock_history || p.stockHistory,
                priceHistory: p.price_history || p.priceHistory,
                createdAt: p.created_at || p.createdAt,
                updatedAt: p.updated_at || p.updatedAt,
                minimumStock: p.minimum_stock || p.minimumStock,
                createdBy: p.created_by || p.createdBy,
                createdByName: p.created_by_name || p.createdByName,
            }));
        });
    });
};

// Specialized Search for high-volume data
export const searchProducts = async (term: string): Promise<Product[]> => {
    if (!term || term.length < 2) return [];

    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`model.ilike.%${term}%,imei1.ilike.%${term}%,imei2.ilike.%${term}%,"serialNumber".ilike.%${term}%`)
            .limit(50);

        if (error) throw error;
        return (data || []).map((p: any) => ({
            ...p,
            supplierId: p.supplier_id || p.supplierId,
            storageLocation: p.storage_location || p.storageLocation,
            costPrice: p.cost_price || p.costPrice,
            wholesalePrice: p.wholesale_price || p.wholesalePrice,
            batteryHealth: p.battery_health || p.batteryHealth,
            serialNumber: p.serial_number || p.serialNumber,
            additionalCostPrice: p.additional_cost_price || p.additionalCostPrice,
            stockHistory: p.stock_history || p.stockHistory,
            priceHistory: p.price_history || p.priceHistory,
            createdAt: p.created_at || p.createdAt,
            updatedAt: p.updated_at || p.updatedAt,
            minimumStock: p.minimum_stock || p.minimumStock,
            createdBy: p.created_by || p.createdBy,
            createdByName: p.created_by_name || p.createdByName,
        }));
    });
};

// ==========================================
// SERVER-SIDE SEARCH ENGINE (PostgreSQL RPC)
// ==========================================
export interface SearchProductsParams {
    query: string;
    stockFilter?: 'all' | 'in_stock' | 'out_of_stock';
    conditionFilter?: string;
    locationFilter?: string;
    typeFilter?: string;
    sortOrder?: 'relevance' | 'newest' | 'oldest';
    limit?: number;
    offset?: number;
}

export interface SearchProductsResult {
    products: Product[];
    totalCount: number;
}

export const searchProductsRPC = async (params: SearchProductsParams): Promise<SearchProductsResult> => {
    const {
        query,
        stockFilter = 'in_stock',
        conditionFilter = 'Todos',
        locationFilter = 'Todos',
        typeFilter = 'Todos',
        sortOrder = 'relevance',
        limit = 15,
        offset = 0
    } = params;

    return fetchWithRetry(async () => {
        const { data, error } = await supabase.rpc('search_products', {
            p_query: query,
            p_stock_filter: stockFilter,
            p_condition_filter: conditionFilter,
            p_location_filter: locationFilter,
            p_type_filter: typeFilter,
            p_sort_order: query.trim() ? sortOrder : (sortOrder === 'relevance' ? 'newest' : sortOrder),
            p_limit: limit,
            p_offset: offset
        });

        if (error) {
            console.warn('searchProductsRPC failed, will throw:', error);
            throw error;
        }

        const rows = data || [];
        const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

        const products: Product[] = rows.map((p: any) => ({
            ...p,
            supplierId: p.supplier_id || p.supplierId,
            storageLocation: p.storage_location || p.storageLocation,
            costPrice: p.cost_price || p.costPrice,
            wholesalePrice: p.wholesale_price || p.wholesalePrice,
            batteryHealth: p.battery_health || p.batteryHealth,
            serialNumber: p.serial_number || p.serialNumber,
            additionalCostPrice: p.additional_cost_price || p.additionalCostPrice,
            stockHistory: p.stock_history || p.stockHistory,
            priceHistory: p.price_history || p.priceHistory,
            createdAt: p.created_at || p.createdAt,
            updatedAt: p.updated_at || p.updatedAt,
            minimumStock: p.minimum_stock || p.minimumStock,
            createdBy: p.created_by || p.createdBy,
            createdByName: p.created_by_name || p.createdByName,
        }));

        return { products, totalCount };
    });
};

export const getProductsByPurchaseForLabels = async (purchaseId: string): Promise<Product[]> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, model, brand, sku, serialNumber, imei1, imei2, barcodes, price, createdAt, condition, color, storage, warranty, purchaseOrderId')
            .eq('purchaseOrderId', purchaseId)
            .order('createdAt', { ascending: true });

        if (error) {
            console.error('Error fetching products by purchase for labels:', error);
            throw error;
        }

        // Map camelCase
        return (data || []).map((p: any) => ({
            ...p,
            serialNumber: p.serial_number || p.serialNumber,
            purchaseOrderId: p.purchase_order_id || p.purchaseOrderId || p.purchaseId,
            createdAt: p.created_at || p.createdAt,
        }));
    });
};

export const addProduct = async (data: any, userId: string = 'system', userName: string = 'Sistema'): Promise<Product> => {
    const { markup, selectedCustomerId, stockHistory, priceHistory, createdByName, ...rest } = data;
    const now = getNowISO();

    const imei1 = rest.imei1 || null;
    const imei2 = rest.imei2 || null;
    const serialNumber = rest.serialNumber || null;

    // PROFESSIONAL DEVICE LIFECYCLE: Check if IMEI/Serial already exists
    let existingProduct = null;

    if (imei1 || imei2 || serialNumber) {
        const orConditions = [];
        if (imei1) orConditions.push(`imei1.eq.${imei1}`, `imei2.eq.${imei1}`);
        if (imei2) orConditions.push(`imei1.eq.${imei2}`, `imei2.eq.${imei2}`);
        if (serialNumber) orConditions.push(`"serialNumber".eq.${serialNumber}`);

        try {
            const searchQuery = supabase
                .from('products')
                .select('*')
                .or(orConditions.join(','))
                .limit(1)
                .maybeSingle();

            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SEARCH_TIMEOUT')), 5000)
            );

            const result = await Promise.race([searchQuery, timeout]) as any;
            existingProduct = result.data || null;
        } catch (e: any) {
            if (e.message === 'SEARCH_TIMEOUT') {
                console.warn('[addProduct] Search timed out. Proceeding as new product.');
                existingProduct = null;
            } else {
                throw e;
            }
        }
    }

    // If product exists, check its status
    if (existingProduct) {
        if (existingProduct.stock > 0) {
            // ❌ BLOCK: Product is currently in stock (real duplicate)
            throw new Error(`Este produto já está em estoque com IMEI/Serial: ${imei1 || imei2 || serialNumber}`);
        }

        // ✅ REACTIVATE: Product was sold, now being repurchased

        const newStockHistoryEntry = {
            id: crypto.randomUUID(),
            oldStock: 0,
            newStock: data.stock || 1,
            adjustment: data.stock || 1,
            reason: data.origin === 'Troca' ? 'Recompra (Troca)' : 'Reentrada',
            timestamp: now,
            changedBy: userName,
            details: data.origin === 'Troca' ? 'Produto retornou via troca no PDV' : 'Produto reativado no sistema'
        };

        const existingHistory = existingProduct.stockHistory || [];

        const updatePayload = {
            stock: data.stock || 1,
            costPrice: data.costPrice,
            price: data.price,
            wholesalePrice: data.wholesalePrice,
            condition: data.condition,
            storageLocation: data.storageLocation,
            warranty: data.warranty || existingProduct.warranty,
            batteryHealth: data.batteryHealth || existingProduct.batteryHealth,
            origin: data.origin || 'Recompra',
            supplier: data.supplier || data.supplierName,
            updatedAt: now,
            stockHistory: [...existingHistory, newStockHistoryEntry]
        };

        // Simple UPDATE without requiring response
        const { error: updateError } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', existingProduct.id);

        if (updateError) throw updateError;


        // Return the merged product data
        const reactivatedProduct = { ...existingProduct, ...updatePayload };

        // Fire-and-forget audit log (non-blocking)
        addAuditLog(
            AuditActionType.STOCK_LAUNCH,
            AuditEntityType.PRODUCT,
            existingProduct.id,
            `Produto reativado (${data.origin || 'Recompra'}): ${existingProduct.model}. Estoque: 0 → ${data.stock || 1}.`,
            userId,
            userName
        ).catch(e => console.warn('[addProduct] Audit log failed:', e));

        clearCache(['products']);
        return reactivatedProduct as Product;
    }

    // ✅ NEW PRODUCT: IMEI/Serial doesn't exist, create it

    // If this is a trade-in from a customer (selectedCustomerId), find or create linked supplier
    let resolvedSupplierId = data.supplierId;
    let resolvedSupplierName = data.supplier || data.supplierName;

    if (selectedCustomerId && !resolvedSupplierId) {
        // This is a trade-in from a customer - find or create a supplier linked to this customer
        try {
            const { data: customer } = await supabase.from('customers').select('*').eq('id', selectedCustomerId).single();
            if (customer) {
                // Use the findOrCreateSupplierFromCustomer function (defined later in the file)
                // For now, inline the logic to avoid circular dependency issues
                const { data: existingSupplier } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('linked_customer_id', selectedCustomerId)
                    .maybeSingle();

                if (existingSupplier) {
                    resolvedSupplierId = existingSupplier.id;
                    resolvedSupplierName = existingSupplier.name;
                } else {
                    // Create a new supplier linked to this customer
                    const newSupplierData = {
                        name: customer.name,
                        email: customer.email || null,
                        phone: customer.phone || null,
                        linked_customer_id: selectedCustomerId,
                        instagram: customer.instagram || null
                    };
                    const { data: createdSupplier } = await supabase
                        .from('suppliers')
                        .insert([newSupplierData])
                        .select()
                        .single();

                    if (createdSupplier) {
                        resolvedSupplierId = createdSupplier.id;
                        resolvedSupplierName = createdSupplier.name;
                        clearCache(['suppliers']);

                    }
                }
            }
        } catch (e) {
            console.warn('[addProduct] Could not find/create supplier from customer:', e);
            // Fallback to using customer ID directly
            resolvedSupplierId = selectedCustomerId;
        }
    } else if (!resolvedSupplierName && resolvedSupplierId) {
        // Just resolve the supplier name
        try {
            const { data: s } = await supabase.from('suppliers').select('name').eq('id', resolvedSupplierId).maybeSingle();
            if (s) resolvedSupplierName = s.name;
        } catch (e) {
            console.warn('[addProduct] Could not resolve supplier name:', e);
        }
    }

    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const nextSku = `#${(count || 0) + 1}`;

    const productData: any = {
        name: data.name,
        brand: data.brand,
        model: data.model,
        color: data.color,
        storage: data.storage || data.storageCapacity,
        condition: data.condition,
        price: data.price,
        costPrice: data.costPrice,
        wholesalePrice: data.wholesalePrice,
        stock: data.stock,
        sku: data.sku || nextSku,
        category: data.category,
        supplier_id: resolvedSupplierId || null, // Use the resolved supplier ID
        // supplier: is removed because it's not in the DB
        imei1: imei1,
        imei2: imei2,
        serialNumber: serialNumber,
        batteryHealth: data.batteryHealth,
        origin: data.origin,
        storageLocation: data.storageLocation,
        warranty: data.warranty,
        createdAt: now,
        updatedAt: now,
        // Track who created the product
        createdBy: data.createdBy || userId || null,
        createdByName: data.createdByName || userName || null,
        // Trade-in and purchase extras
        photos: data.photos || [],
        accessories: data.accessories || [],
        checklist: data.checklist || null,
        additionalCostPrice: data.additionalCostPrice || 0,
        variations: data.variations || [],
        // Add initial stock history entry for traceability (only if stock > 0)
        // Trade-in products (stock: 0) will have their history added when the sale is finalized
        stockHistory: data.stock === 0 ? [] : [{
            id: crypto.randomUUID(),
            oldStock: 0,
            newStock: data.stock || 1,
            adjustment: data.stock || 1,
            reason: data.origin === 'Troca' ? 'Entrada via Troca' : (data.origin === 'Comprado de Cliente' ? 'Compra de Cliente' : 'Cadastro Inicial'),
            timestamp: now,
            changedBy: data.createdByName || userName || 'Sistema',
            details: (data.origin === 'Troca' || data.origin === 'Comprado de Cliente')
                ? `Produto recebido via ${data.origin === 'Troca' ? 'troca' : 'compra de cliente'}. Fornecedor: ${resolvedSupplierName || 'N/A'}. Custo: R$ ${(data.costPrice || 0).toFixed(2)}`
                : `Produto cadastrado manualmente.`
        }]
    };

    Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

    // INSERT and get the created product with its database-generated ID
    let createdProduct: any = null;

    try {
        const insertQuery = supabase.from('products').insert([productData]).select().single();
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('INSERT_TIMEOUT')), 15000)
        );

        const result = await Promise.race([insertQuery, timeout]) as any;
        if (result.error) throw result.error;

        createdProduct = result.data;
    } catch (e: any) {
        if (e.message === 'INSERT_TIMEOUT') {
            console.warn('[addProduct] Insert timed out, but proceeding anyway (product may have been created)');
            // Fallback: generate a local ID (this is a last resort)
            createdProduct = { ...productData, id: crypto.randomUUID() };
        } else {
            // Real error - throw it
            throw e;
        }
    }

    if (!createdProduct) {
        throw new Error('Falha ao criar produto - sem resposta do banco de dados');
    }

    // Fire-and-forget audit log (non-blocking)
    addAuditLog(
        AuditActionType.STOCK_LAUNCH,
        AuditEntityType.PRODUCT,
        createdProduct.id,
        `Entrada de estoque (${createdProduct.origin || 'Cadastro'}): ${createdProduct.model}. Estoque: ${createdProduct.stock}.`,
        userId,
        userName
    ).catch(e => console.warn('[addProduct] Audit log failed:', e));

    clearCache(['products']);
    return createdProduct as Product;
};

export const updateProduct = async (data: any, userId?: string, userName?: string) => {
    // 1. Fetch current product to compare prices
    const { data: currentProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', data.id).maybeSingle();

    // If product not found (RLS or doesn't exist), still try to update
    if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
    }

    // Use data as fallback if currentProduct is null
    const existingProduct = currentProduct || data;

    const { markup, selectedCustomerId, stockHistory, priceHistory: inputPriceHistory, ...rest } = data;
    const now = getNowISO();

    // Build the update payload
    const updatePayload: any = {
        ...rest,
        updatedAt: now
    };

    // Fix: Remove keys that are likely names (like 'iPad') from UUID columns to prevent crash
    const uuidFields = ['categoryId', 'brandId', 'supplierId'];
    uuidFields.forEach(f => {
        if (updatePayload[f] && typeof updatePayload[f] === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatePayload[f])) {
            delete updatePayload[f];
        }
    });

    // Note: ensure supplierId exists in products table

    // Track price changes for history
    const existingPriceHistory = existingProduct.priceHistory || [];
    let priceHistoryUpdated = false;

    // If sale price changed, add to price history
    if (existingProduct.price !== data.price) {
        // Log price change to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Preço de venda alterado de ${formatCurrency(existingProduct.price)} para ${formatCurrency(data.price)}`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to priceHistory column
        const newPriceEntry = {
            id: crypto.randomUUID(),
            oldPrice: existingProduct.price,
            newPrice: data.price,
            priceType: 'sale',
            changedBy: userName || 'Sistema',
            timestamp: now
        };
        existingPriceHistory.push(newPriceEntry);
        priceHistoryUpdated = true;
    }

    // If wholesale price changed, add to price history
    if (data.wholesalePrice !== undefined && existingProduct.wholesalePrice !== data.wholesalePrice) {
        // Log wholesale price change to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Preço de atacado alterado de ${formatCurrency(existingProduct.wholesalePrice || 0)} para ${formatCurrency(data.wholesalePrice)}`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to priceHistory column
        const newWholesaleEntry = {
            id: crypto.randomUUID(),
            oldPrice: existingProduct.wholesalePrice || 0,
            newPrice: data.wholesalePrice,
            priceType: 'wholesale',
            changedBy: userName || 'Sistema',
            timestamp: now
        };
        existingPriceHistory.push(newWholesaleEntry);
        priceHistoryUpdated = true;
    }

    // If cost price changed, add to price history
    if (data.costPrice !== undefined && existingProduct.costPrice !== data.costPrice) {
        // Log cost price change to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Preço de custo alterado de ${formatCurrency(existingProduct.costPrice || 0)} para ${formatCurrency(data.costPrice)}`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to priceHistory column
        const newCostEntry = {
            id: crypto.randomUUID(),
            oldPrice: existingProduct.costPrice || 0,
            newPrice: data.costPrice,
            priceType: 'cost',
            changedBy: userName || 'Sistema',
            timestamp: now
        };
        existingPriceHistory.push(newCostEntry);
        priceHistoryUpdated = true;
    }

    if (priceHistoryUpdated) {
        updatePayload.priceHistory = existingPriceHistory;
    }

    // --- LOCATION CHANGE TRACKING ---
    const existingStockHistory = existingProduct.stockHistory || [];
    let stockHistoryUpdated = false;

    if (data.storageLocation !== undefined && existingProduct.storageLocation !== data.storageLocation) {
        // Log to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Local de estoque alterado de "${existingProduct.storageLocation || 'N/A'}" para "${data.storageLocation}"`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to stockHistory column
        const newLocationEntry: StockHistoryEntry = {
            id: crypto.randomUUID(),
            oldStock: existingProduct.stock, // Stock volume doesn't change
            newStock: existingProduct.stock,
            adjustment: 0,
            reason: 'Alteração de Local',
            timestamp: now,
            changedBy: userName || 'Sistema',
            previousLocation: existingProduct.storageLocation || 'N/A',
            newLocation: data.storageLocation
        };
        existingStockHistory.push(newLocationEntry);
        stockHistoryUpdated = true;
    }

    if (stockHistoryUpdated) {
        updatePayload.stockHistory = existingStockHistory;
    }
    // --------------------------------

    // Try to update with priceHistory
    let updatedRows, error;
    try {
        const query = supabase.from('products').update(updatePayload).eq('id', data.id).select();

        // Safety timeout to prevent infinite loading spinners
        const res: any = await Promise.race([
            query,
            new Promise((_, reject) => setTimeout(() => reject(new Error('A atualização demorou muito e foi cancelada por segurança. Verifique se as alterações foram salvas.')), 15000))
        ]);

        updatedRows = res.data;
        error = res.error;
    } catch (e: any) {
        if (e.name === 'AbortError' || e.message?.includes('aborted')) {
            // Translating the cryptic AbortError to something the user can understand
            throw new Error('A conexão foi interrompida durante a atualização. Por favor, verifique sua internet e tente novamente.');
        }
        throw e;
    }

    if (error) throw error;

    const updated = (updatedRows && updatedRows.length > 0) ? updatedRows[0] : { ...existingProduct, ...updatePayload };

    if (!updatedRows || updatedRows.length === 0) {
        console.warn('mockApi: Product updated successfully but returned no data (likely RLS). Using local payload.');
    }
    clearCache(['products']);
    return updated;
};

export const deleteProduct = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    // Pegar infos do produto antes de deletar para o log e verificação de estoque
    const { data: product } = await supabase.from('products').select('*').eq('id', id).single();

    // Verificação de Segurança: Impedir exclusão se houver vendas vinculadas (Exceto Canceladas)
    // O produto não pode ser excluído se já foi vendido, a menos que a venda tenha sido cancelada.
    const { count } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'Cancelada')
        .contains('items', [{ productId: id }]);

    if (count && count > 0) {
        throw new Error('Este produto possui vendas registradas e não pode ser excluído. Cancele as vendas associadas antes de excluir.');
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    if (product) {
        await addAuditLog(
            AuditActionType.DELETE,
            AuditEntityType.PRODUCT,
            id,
            `Produto excluído: ${product.model} (${product.brand})`,
            userId,
            userName
        );
    }

    clearCache(['products']);
};

export const updateProductStock = async (id: string, newStock: number, reason: string = 'Ajuste Manual', userId?: string, userName?: string) => {
    const { data: currentProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    const now = getNowISO();
    const adjustment = newStock - currentProduct.stock;

    // Build update payload
    const updatePayload: any = {
        stock: newStock,
        updatedAt: now
    };

    if (adjustment !== 0) {
        await addAuditLog(
            AuditActionType.STOCK_ADJUST,
            AuditEntityType.PRODUCT,
            id,
            `Estoque ajustado manualmente. Anterior: ${currentProduct.stock}, Novo: ${newStock} (Ajuste: ${adjustment > 0 ? '+' : ''}${adjustment})`,
            userId || 'user',
            userName || 'Usuário'
        );

        // Add to stockHistory column
        const existingStockHistory = currentProduct.stockHistory || [];
        const newStockEntry = {
            id: crypto.randomUUID(),
            oldStock: currentProduct.stock,
            newStock: newStock,
            adjustment: adjustment,
            reason: reason,
            timestamp: now,
            changedBy: userName || 'Usuário'
        };
        updatePayload.stockHistory = [...existingStockHistory, newStockEntry];
    }

    const { data, error } = await supabase.from('products').update(updatePayload).eq('id', id).select().single();

    if (error) throw error;
    clearCache(['products']);
    return data;
};

export const updateMultipleProducts = async (updates: { id: string; price?: number; costPrice?: number; wholesalePrice?: number; storageLocation?: string; commission_enabled?: boolean; commission_type?: 'fixed' | 'percentage'; commission_value?: number; discount_limit_type?: 'fixed' | 'percentage'; discount_limit_value?: number }[], userId?: string, userName?: string) => {
    const now = getNowISO();

    for (const u of updates) {
        const { data: currentProduct } = await supabase.from('products').select('*').eq('id', u.id).single();
        if (!currentProduct) continue;

        const payload: any = {};
        const existingPriceHistory = currentProduct.priceHistory || [];
        let priceHistoryUpdated = false;

        // Handle sale price update
        if (u.price !== undefined) {
            payload.price = u.price;
            if (currentProduct.price !== u.price) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Preço de venda alterado de ${formatCurrency(currentProduct.price)} para ${formatCurrency(u.price)}`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // Add to priceHistory column
                const newPriceEntry = {
                    id: crypto.randomUUID(),
                    oldPrice: currentProduct.price,
                    newPrice: u.price,
                    priceType: 'sale',
                    changedBy: userName || 'Atualização em Massa',
                    timestamp: now
                };
                existingPriceHistory.push(newPriceEntry);
                priceHistoryUpdated = true;
            }
        }

        // Handle wholesale price update
        if (u.wholesalePrice !== undefined) {
            payload.wholesalePrice = u.wholesalePrice;
            if (currentProduct.wholesalePrice !== u.wholesalePrice) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Preço de atacado alterado de ${formatCurrency(currentProduct.wholesalePrice || 0)} para ${formatCurrency(u.wholesalePrice)}`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // Add to priceHistory column
                const newWholesaleEntry = {
                    id: crypto.randomUUID(),
                    oldPrice: currentProduct.wholesalePrice || 0,
                    newPrice: u.wholesalePrice,
                    priceType: 'wholesale',
                    changedBy: userName || 'Atualização em Massa',
                    timestamp: now
                };
                existingPriceHistory.push(newWholesaleEntry);
                priceHistoryUpdated = true;
            }
        }

        // Handle cost price update
        if (u.costPrice !== undefined) {
            payload.costPrice = u.costPrice;
            if (currentProduct.costPrice !== u.costPrice) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Preço de custo alterado de ${formatCurrency(currentProduct.costPrice || 0)} para ${formatCurrency(u.costPrice)}`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // Add to priceHistory column
                const newCostEntry = {
                    id: crypto.randomUUID(),
                    oldPrice: currentProduct.costPrice || 0,
                    newPrice: u.costPrice,
                    priceType: 'cost',
                    changedBy: userName || 'Atualização em Massa',
                    timestamp: now
                };
                existingPriceHistory.push(newCostEntry);
                priceHistoryUpdated = true;
            }
        }

        // Handle storage location update
        if (u.storageLocation !== undefined) {
            payload.storageLocation = u.storageLocation;
            if (currentProduct.storageLocation !== u.storageLocation) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Local de estoque alterado de "${currentProduct.storageLocation || 'N/A'}" para "${u.storageLocation}"`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // --- LOCATION CHANGE TRACKING (BULK) ---
                const existingStockHistory = currentProduct.stockHistory || [];
                const newLocationEntry: StockHistoryEntry = {
                    id: crypto.randomUUID(),
                    oldStock: currentProduct.stock, // Stock volume doesn't change
                    newStock: currentProduct.stock,
                    adjustment: 0,
                    reason: 'Alteração de Local',
                    timestamp: now,
                    changedBy: userName || 'Atualização em Massa',
                    previousLocation: currentProduct.storageLocation || 'N/A',
                    newLocation: u.storageLocation
                };
                existingStockHistory.push(newLocationEntry);
                payload.stockHistory = existingStockHistory;
                // ----------------------------------------
            }
        }

        // Handle commission fields update
        if (u.commission_enabled !== undefined) {
            payload.commission_enabled = u.commission_enabled;
        }
        if (u.commission_type !== undefined) {
            payload.commission_type = u.commission_type;
        }
        if (u.commission_value !== undefined) {
            payload.commission_value = u.commission_value;
        }
        if (u.discount_limit_type !== undefined) {
            payload.discount_limit_type = u.discount_limit_type;
        }
        if (u.discount_limit_value !== undefined) {
            payload.discount_limit_value = u.discount_limit_value;
        }

        // Log commission changes
        const commissionChanged = (
            (u.commission_enabled !== undefined && currentProduct.commission_enabled !== u.commission_enabled) ||
            (u.commission_type !== undefined && currentProduct.commission_type !== u.commission_type) ||
            (u.commission_value !== undefined && currentProduct.commission_value !== u.commission_value) ||
            (u.discount_limit_type !== undefined && currentProduct.discount_limit_type !== u.discount_limit_type) ||
            (u.discount_limit_value !== undefined && currentProduct.discount_limit_value !== u.discount_limit_value)
        );

        if (commissionChanged) {
            const parts = [];
            if (u.commission_enabled !== undefined) parts.push(`Comissão: ${u.commission_enabled ? 'Ativada' : 'Desativada'}`);
            if (u.commission_type !== undefined) parts.push(`Tipo: ${u.commission_type === 'fixed' ? 'Fixo' : 'Percentual'}`);
            if (u.commission_value !== undefined) parts.push(`Valor: ${u.commission_value}`);
            if (u.discount_limit_type !== undefined) parts.push(`Limite Desc. Tipo: ${u.discount_limit_type === 'fixed' ? 'Fixo' : 'Percentual'}`);
            if (u.discount_limit_value !== undefined) parts.push(`Limite Desc. Valor: ${u.discount_limit_value}`);

            await addAuditLog(
                AuditActionType.UPDATE,
                AuditEntityType.PRODUCT,
                u.id,
                `Atualização em Massa (Comissão): ${parts.join(', ')}`,
                userId || 'system',
                userName || 'Atualização em Massa'
            );
        }

        if (priceHistoryUpdated) {
            payload.priceHistory = existingPriceHistory;
        }

        if (Object.keys(payload).length > 0) {
            payload.updatedAt = now;
            await supabase.from('products').update(payload).eq('id', u.id);
        }
    }
    clearCache(['products']);
};

const mapSale = (sale: any): Sale => {
    try {
        const separatorCSDID = '\n---CSDID---\n';
        const separatorInternal = '\n---INTERNAL---\n';
        const separatorCancelReason = '\n---CANCEL_REASON---\n';

        let external = sale.observations || '';
        let internal = '';
        let csdid = undefined;
        let cancelReason = '';

        // Extrair motivo de cancelamento primeiro
        if (external.includes(separatorCancelReason)) {
            const parts = external.split(separatorCancelReason);
            external = parts[0];
            cancelReason = parts.slice(1).join(separatorCancelReason);
        }

        if (external.includes(separatorCSDID)) {
            const parts = external.split(separatorCSDID);
            external = parts[0];
            const csdidStr = parts[1];
            csdid = parseInt(csdidStr, 10);
        }

        if (external.includes(separatorInternal)) {
            const parts = external.split(separatorInternal);
            external = parts[0];
            internal = parts.slice(1).join(separatorInternal);
        }

        return {
            ...sale,
            customerId: sale.customer_id,
            salespersonId: sale.salesperson_id,
            cashSessionId: sale.cash_session_id,
            warrantyTerm: sale.warranty_term,
            posTerminal: sale.pos_terminal,
            observations: external,
            internalObservations: internal,
            cashSessionDisplayId: csdid,
            cancellationReason: cancelReason,
            interestRate: Number(sale.interest_rate || 0),
            totalFinanced: Number(sale.total_financed || 0),
            installmentAmount: Number(sale.installment_amount || 0),
            currentDebtBalance: Number(sale.current_debt_balance || 0),
            amortizationTable: Array.isArray(sale.amortization_table) ? sale.amortization_table : (typeof sale.amortization_table === 'string' ? JSON.parse(sale.amortization_table) : []),
            items: Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? JSON.parse(sale.items) : []),
            payments: Array.isArray(sale.payments) ? sale.payments : (typeof sale.payments === 'string' ? JSON.parse(sale.payments) : [])
        };
    } catch (e) {
        console.error("Error mapping sale:", sale.id, e);
        return {
            ...sale,
            items: [],
            payments: [],
            observations: sale.observations || '',
        };
    }
};

export const getSales = async (currentUserId?: string, cashSessionId?: string, startDate?: string, endDate?: string): Promise<Sale[]> => {
    const cacheKey = `sales_${currentUserId || 'all'}_${cashSessionId || 'all'}_${startDate || 'none'}_${endDate || 'none'}`;
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            let query = supabase.from('sales').select('*');

            // RULE 4: Strict filtering by User and Cash Session
            if (currentUserId) {
                // Fetch ONLY the necessary session IDs (limit to recent ones for salesperson check)
                const { data: userSessions } = await supabase
                    .from('cash_sessions')
                    .select('id')
                    .eq('user_id', currentUserId)
                    .order('open_time', { ascending: false })
                    .limit(200);

                const sessionIds = (userSessions || []).map((s: any) => s.id);

                if (sessionIds.length > 0) {
                    query = query.or(`salesperson_id.eq.${currentUserId},cash_session_id.in.(${sessionIds.join(',')})`);
                } else {
                    query = query.eq('salesperson_id', currentUserId);
                }
            }
            if (cashSessionId) {
                query = query.eq('cash_session_id', cashSessionId);
            }
            if (startDate) {
                // If it's a simple YYYY-MM-DD, treat as start of day
                const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
                query = query.gte('date', start);
            }
            if (endDate) {
                // Timezone Robustness: Brazil is UTC-3, so 21:00 Jan 28 (Local) is 00:00 Jan 29 (UTC).
                // When the user filters for Jan 28, we MUST include early morning Jan 29 in UTC.
                // We add a 24-hour buffer to endDate to ensure all timezone overlaps are covered.
                if (!endDate.includes('T')) {
                    const endObj = new Date(`${endDate}T23:59:59.999Z`);
                    endObj.setDate(endObj.getDate() + 1); // Buffer 24h
                    query = query.lte('date', endObj.toISOString());
                } else {
                    query = query.lte('date', endDate);
                }
            }
            query = query.neq('status', 'Rascunho');

            // ROBUSTNESS: Always limit to last 1000 sales to prevent memory overflows.
            // For historical data beyond this, specialized reports should be used.
            query = query.order('date', { ascending: false }).limit(1000);

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching sales:', error);
                throw error;
            }
            return data;
        }).then(data => {

            return (data || []).map(mapSale);
        });
    });
};

export const getProductSalesHistory = async (productId: string): Promise<Sale[]> => {
    // Optimization: Reuse the cached 'sales' list instead of a specific DB query
    const allSales = await getSales();
    return allSales.filter((s: Sale) => s.items.some((i: any) => i.productId === productId));
};

export const getTodaysSales = async (): Promise<TodaySale[]> => {
    return [];
};

// --- SALES ---

const adjustProductStock = async (
    productId: string,
    adjustment: number, // positive to add, negative to deduct
    relatedId: string,
    reasonBase: string,
    customerName: string,
    paymentMethods: string,
    userName: string,
    userId: string
) => {
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
    if (!product) {
        console.warn(`[adjustProductStock] Product ${productId} not found.`);
        return;
    }

    const currentStock = Number(product.stock || 0);
    const newStock = Math.max(0, currentStock + adjustment);
    const isReturning = adjustment > 0;

    const stockHistoryEntry = {
        id: crypto.randomUUID(),
        oldStock: currentStock,
        newStock: newStock,
        adjustment: adjustment,
        reason: isReturning ? `${reasonBase} (Devolução)` : reasonBase,
        relatedId: relatedId,
        timestamp: getNowISO(),
        changedBy: userName,
        details: `Cliente: ${customerName} | Pagamento: ${paymentMethods}`
    };

    const { error } = await supabase.from('products').update({
        stock: newStock,
        stockHistory: [...(product.stockHistory || []), stockHistoryEntry]
    }).eq('id', productId);

    if (error) {
        console.error(`[adjustProductStock] Error updating stock for ${productId}:`, error);
        throw error;
    }

    await addAuditLog(
        isReturning ? AuditActionType.STOCK_ADJUST : AuditActionType.SALE_CREATE,
        AuditEntityType.PRODUCT,
        productId,
        `${reasonBase} #${relatedId} - Qtd: ${Math.abs(adjustment)} | Estoque: ${currentStock} → ${newStock}`,
        userId,
        userName
    );
};

export const getNextSaleId = async (userId: string = 'system'): Promise<string> => {
    // 1. Encontrar o último ID numérico
    const { data: recentIds } = await supabase
        .from('sales')
        .select('id')
        .order('createdAt', { ascending: false })
        .limit(10);

    const matchNext = (ids: any[]) => {
        if (!ids || ids.length === 0) return 1;
        const numbers = ids
            .map(s => {
                const match = s.id.match(/^ID-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    };

    let nextNum = matchNext(recentIds || []);

    // 2. Tentar reservar o ID criando um registro rascunho
    for (let attempts = 0; attempts < 10; attempts++) {
        const candidateId = `ID-${nextNum + attempts}`;
        const { error } = await supabase.from('sales').insert([{
            id: candidateId,
            status: 'Rascunho',
            salesperson_id: userId,
            createdAt: getNowISO(),
            date: getNowISO()
        }]);

        if (!error) return candidateId;
        if (error.code !== '23505') throw error;
    }

    return `ID-${nextNum + 10}`;
};

export const cancelSaleReservation = async (id: string) => {
    if (!id || !id.startsWith('ID-')) return;
    // Deleta o rascunho para liberar o ID se for o último, ou marcar como cancelado
    // Para manter a simplicidade e atender o pedido, vamos apenas remover se for status Rascunho
    await supabase.from('sales').delete().eq('id', id).eq('status', 'Rascunho');
};

export const addSale = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const now = new Date();

    // Get all IDs to find the max and ensure uniqueness efficiently
    // Improved ID generation: Fetch only the most recent IDs to avoid timeouts and RLS truncation issues
    const { data: recentIds, error: fetchError } = await supabase
        .from('sales')
        .select('id')
        .order('createdAt', { ascending: false })
        .limit(50);

    if (fetchError) {
        console.warn('mockApi: Error fetching recent IDs, falling back to sequential check. error:', fetchError);
    }

    let nextNum = 1;
    if (recentIds && recentIds.length > 0) {
        const numbers = recentIds
            .map((s: { id: string }) => {
                const match = s.id.match(/^ID-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n) && n < 1000000000);

        if (numbers.length > 0) {
            nextNum = Math.max(...numbers) + 1;
        }
    } else {
        // If we found no IDs via created_at (maybe old records don't have it?), try a fallback or start from count
        const { count } = await supabase.from('sales').select('*', { count: 'exact', head: true });
        nextNum = (count || 0) + 1;
    }

    // Merge observations for DB storage
    let dbObservations = data.observations || '';
    if (data.internalObservations) {
        dbObservations = `${dbObservations}\n---INTERNAL---\n${data.internalObservations}`;
    }
    if (data.cashSessionDisplayId) {
        dbObservations = `${dbObservations}\n---CSDID---\n${data.cashSessionDisplayId}`;
    }

    const saleData: any = {
        id: `ID-${nextNum}`,
        date: now.toISOString(),
        customer_id: data.customerId,
        salesperson_id: data.salespersonId,
        items: data.items,
        subtotal: data.subtotal,

        total: data.total,
        payments: data.payments,
        pos_terminal: data.posTerminal || 'Caixa 1',
        status: data.status || 'Finalizada',
        origin: data.origin || 'PDV',
        warranty_term: data.warrantyTerm || null,
        observations: dbObservations,
        cash_session_id: data.cashSessionId || null,
        lead_origin: data.leadOrigin || null,
    };

    let success = false;
    let attempts = 0;
    const maxAttempts = 50;
    let currentSaleId = data.id || `ID-${nextNum}`;
    let finalSale: any = null;

    while (attempts < maxAttempts && !success) {
        attempts++;
        const currentId = attempts === 1 ? currentSaleId : `ID-${nextNum + attempts - 1}`;

        let res;
        if (currentId.startsWith('ID-')) {
            // Tenta upsert para aproveitar ID reservado ou criar novo
            res = await supabase.from('sales').upsert([{ ...saleData, id: currentId }], { onConflict: 'id' }).select();
        } else {
            res = await supabase.from('sales').insert([{ ...saleData, id: currentId }]).select();
        }

        const { data: insertedRows, error } = res;

        if (error) {
            if (error.code === '23505') {
                console.warn(`[addSale] Duplicate ID ${currentId}, retrying...`);
                continue;
            }
            console.error("Error adding sale:", JSON.stringify(error, null, 2));
            throw error;
        }

        finalSale = (insertedRows && insertedRows.length > 0) ? insertedRows[0] : { ...saleData, id: currentId };
        success = true;
    }

    if (!success) {
        throw new Error('Não foi possível gerar um ID único para a venda após várias tentativas.');
    }

    const newSale = finalSale;

    // Map back to camelCase for frontend
    const mappedSale = {
        ...newSale,
        date: newSale.date,
        customerId: newSale.customer_id,
        salespersonId: newSale.salesperson_id,
        posTerminal: newSale.pos_terminal,
        warrantyTerm: newSale.warranty_term,
        cashSessionId: newSale.cash_session_id,
        leadOrigin: newSale.lead_origin
    };

    // Update stock and history for sold items
    // ONLY deduct stock if sale is NOT Pendente
    let customerName = 'Cliente';

    if (data.status !== 'Pendente' && data.items && Array.isArray(data.items)) {
        // Fetch customer name for history (and all products at once for speed)
        const [customerRes, productsRes] = await Promise.all([
            supabase.from('customers').select('*').eq('id', data.customerId).single(),
            supabase.from('products').select('*').in('id', data.items.map(i => i.productId))
        ]);

        customerName = customerRes.data?.name || 'Cliente';
        const paymentMethods = data.payments?.map((p: Payment) => p.method).join(', ') || 'N/A';
        const allProducts = productsRes.data || [];

        // Parallelize initial audit logs
        const auditLogs = [
            addAuditLog(
                AuditActionType.SALE_CREATE,
                AuditEntityType.SALE,
                newSale.id,
                `Venda criada. Cliente: ${customerName} | Total: ${formatCurrency(newSale.total)} | Pagamento: ${paymentMethods}`,
                userId,
                userName
            )
        ];

        for (const item of data.items) {
            const product = allProducts.find(p => p.id === item.productId);
            if (product) {
                const quantityToDeduct = Number(item.quantity);
                await adjustProductStock(
                    item.productId,
                    -quantityToDeduct,
                    newSale.id,
                    'Venda',
                    customerName,
                    paymentMethods,
                    userName,
                    userId
                );
            }
        }
        // Wait for all audit logs to complete (they were started in background)
        await Promise.allSettled(auditLogs).catch(err => console.warn('mockApi: Audit logs partial failure', err));
    }

    // COMMISSION GENERATION: Generate commissions for finalized or pending sales
    if (['Finalizada', 'Pendente'].includes(saleData.status) && data.items && Array.isArray(data.items)) {
        try {
            const { generateCommissionsForSale } = await import('./commissionService.ts');
            const commissionItems = data.items.map((item: any) => ({
                productId: item.productId,
                unitPrice: item.unitPrice || 0,
                quantity: item.quantity || 1,
                discountType: item.discountType || 'R$',
                discountValue: item.discountValue || 0,
                netTotal: item.netTotal || ((item.unitPrice || 0) * (item.quantity || 1)),
                productName: item.productName || item.model || 'Produto',
                costPrice: item.costPrice || 0,
            }));
            await generateCommissionsForSale(
                newSale.id,
                data.salespersonId || userId,
                commissionItems,
                userId,
                userName,
                newSale.date,
                saleData.status
            );
        } catch (commErr) {
            console.warn('[addSale] Commission generation failed (non-blocking):', commErr);
        }
    }

    // TRADE-IN STOCK MANAGEMENT: Add trade-in products to stock only when sale is Finalizada
    const saleStatus = saleData.status;
    if ((saleStatus === 'Finalizada' || saleStatus === 'Editada') && data.payments && Array.isArray(data.payments)) {
        // Ensure customerName is available if the first block skipped or failed
        if (customerName === 'Cliente' && data.customerId) {
            const { data: c } = await supabase.from('customers').select('name').eq('id', data.customerId).maybeSingle();
            if (c) customerName = c.name;
        }

        const tradeInPayments = data.payments.filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );

        for (const tradeInPayment of tradeInPayments) {
            const productId = tradeInPayment.tradeInDetails.productId;

            // Retry logic to ensure stock update persists
            let attempts = 0;
            const maxAttempts = 3;
            let success = false;

            while (attempts < maxAttempts && !success) {
                attempts++;
                // Small delay to ensure DB propagation of the newly created product
                if (attempts === 1) await new Promise(r => setTimeout(r, 500));

                const { data: tradeInProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

                if (fetchError || !tradeInProduct) {
                    console.warn(`[addSale] Attempt ${attempts}: Trade-in product not found or error:`, fetchError);
                    await new Promise(r => setTimeout(r, 1000)); // Wait before retry
                    continue;
                }

                if (tradeInProduct.stock === 0) {
                    const stockHistory = tradeInProduct.stockHistory || [];

                    const newStockEntry = {
                        id: crypto.randomUUID(),
                        oldStock: 0,
                        newStock: 1,
                        adjustment: 1,
                        reason: 'Entrou em uma troca',
                        relatedId: newSale.id,
                        timestamp: now.toISOString(),
                        changedBy: userName,
                        details: `Produto recebido em troca de ${customerName} - Venda #${newSale.id}`
                    };

                    const { error: updateError } = await supabase.from('products').update({
                        stock: 1,
                        stockHistory: [...stockHistory, newStockEntry],
                        observations: `Troca pela venda #${newSale.id}`
                    }).eq('id', productId);

                    if (updateError) {
                        console.error(`[addSale] Attempt ${attempts}: Error updating stock:`, updateError);
                        await new Promise(r => setTimeout(r, 1000));
                    } else {

                        await addAuditLog(
                            AuditActionType.STOCK_ADJUST,
                            AuditEntityType.PRODUCT,
                            productId,
                            `Produto de troca entrou no estoque (venda finalizada): ${tradeInProduct.model}. Estoque: 0 → 1`,
                            userId,
                            userName
                        );
                        success = true;
                    }
                } else {
                    // Already has stock (maybe fixed by another process or race condition)
                    success = true;
                }
            }

            if (!success) {
                console.error('[addSale] FAILED to update trade-in stock after multiple attempts:', productId);
            }
        }
    }

    // TELEGRAM NOTIFICATION: Send notification for finalized sales
    if (saleData.status === 'Finalizada') {
        try {
            // Calculate profit from items and build product descriptions
            let totalProfit = 0;
            const productDescriptions: string[] = [];

            if (data.items && Array.isArray(data.items)) {
                // Fetch full product details for all items
                const productIds = data.items.map((item: any) => item.productId).filter(Boolean);
                const { data: productDetails } = await supabase
                    .from('products')
                    .select('id, model, category, brand')
                    .in('id', productIds);

                // Fetch category and brand names
                const categoryIds = (productDetails || []).map(p => p.category).filter(Boolean);
                const brandIds = (productDetails || []).map(p => p.brand).filter(Boolean);

                const [categoriesResult, brandsResult] = await Promise.all([
                    categoryIds.length > 0 ? supabase.from('categories').select('id, name').in('id', categoryIds) : { data: [] },
                    brandIds.length > 0 ? supabase.from('brands').select('id, name').in('id', brandIds) : { data: [] }
                ]);

                const categoryMap = new Map();
                (categoriesResult.data || []).forEach((c: any) => categoryMap.set(c.id, c.name));

                const brandMap = new Map();
                (brandsResult.data || []).forEach((b: any) => brandMap.set(b.id, b.name));

                const productMap = new Map();
                (productDetails || []).forEach((p: any) => productMap.set(p.id, p));

                for (const item of data.items) {
                    const itemNetRevenue = item.netTotal ?? ((item.unitPrice || 0) * (item.quantity || 1));
                    const itemProfit = itemNetRevenue - ((item.costPrice || 0) * (item.quantity || 1));
                    totalProfit += itemProfit;

                    // Build product description: Category Name + Brand Name + Model
                    const product = productMap.get(item.productId);
                    if (product) {
                        const parts = [];
                        const categoryName = categoryMap.get(product.category);
                        const brandName = brandMap.get(product.brand);

                        if (categoryName) parts.push(categoryName);
                        if (brandName) parts.push(brandName);
                        if (product.model) parts.push(product.model);

                        if (parts.length > 0) {
                            productDescriptions.push(parts.join(' '));
                        } else {
                            productDescriptions.push(item.productName || item.model || 'Produto');
                        }
                    } else if (item.productName || item.model) {
                        productDescriptions.push(item.productName || item.model);
                    }
                }
            }


            // Get product description (first item or combined)
            let productDescription = productDescriptions.length > 0
                ? productDescriptions.join(' + ')
                : 'Produto';

            // Calculate daily profit (all finalized sales today)
            let dailyProfit = totalProfit;
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data: todaySales } = await supabase
                    .from('sales')
                    .select('items')
                    .gte('date', today)
                    .neq('id', newSale.id)
                    .in('status', ['Finalizada', 'Editada']);

                if (todaySales && todaySales.length > 0) {
                    dailyProfit = 0;
                    for (const sale of todaySales) {
                        const items = sale.items || [];
                        for (const item of items) {
                            const itemNetRevenue = item.netTotal ?? ((item.unitPrice || 0) * (item.quantity || 1));
                            dailyProfit += itemNetRevenue - ((item.costPrice || 0) * (item.quantity || 1));
                        }

                    }
                    // Add current sale profit (manually added since we excluded it or in case of delay)
                    dailyProfit += totalProfit;
                }
            } catch (dailyError) {
                console.warn('[addSale] Could not calculate daily profit:', dailyError);
            }

            await sendSaleNotification({
                productDescription,
                profit: totalProfit,
                dailyProfit
            });
        } catch (telegramError) {
            // Don't fail the sale if Telegram notification fails
            console.warn('[addSale] Telegram notification failed:', telegramError);
        }
    }

    // CASH SESSION UPDATE: Update cash_in_register based on cash payments/change
    // NOTE: deposits/withdrawals are NOT updated here — those are for MANUAL suprimentos/sangrias only
    if (saleData.status === 'Finalizada') {
        try {
            const totalPaid = (data.payments || []).reduce((sum: number, p: any) => sum + p.value, 0);
            const change = Math.max(0, totalPaid - newSale.total);

            // Calculate cash payments
            const cashIncome = (data.payments || []).filter((p: any) => p.method === 'Dinheiro').reduce((sum: number, p: any) => sum + p.value, 0);

            // Net cash impact on the register (cash received minus change given)
            const netCashImpact = cashIncome - change;

            if (netCashImpact !== 0 && newSale.cash_session_id) {
                const { data: session } = await supabase.from('cash_sessions').select('*').eq('id', newSale.cash_session_id).single();
                if (session) {
                    const currentCash = session.cash_in_register || session.cashInRegister || 0;

                    await supabase.from('cash_sessions').update({
                        cash_in_register: currentCash + netCashImpact
                    }).eq('id', newSale.cash_session_id);
                }
            }
        } catch (err) {
            console.error('Failed to update cash session balance:', err);
        }
    }

    // Generate Credit Installments if (Crediário)
    if (saleData.status === 'Finalizada') {
        const creditPayment = data.payments?.find((p: any) => (p.method === 'Crediário' || p.method === 'Crediario' || p.method === 'Promissória') && p.creditDetails);

        if (creditPayment) {
        } else {
            const hasCrediarioMethod = data.payments?.some((p: any) => p.method === 'Crediário' || p.method === 'Crediario' || p.method === 'Promissória');
        }

        if (creditPayment && creditPayment.creditDetails) {
            try {
                const { creditDetails } = creditPayment;
                const interestRate = Number(creditDetails.interestRate || 0);
                const totalInstallments = Number(creditDetails.totalInstallments || 1);
                const productValue = Number(creditDetails.totalAmount || 0);

                // Regra 2: Cálculo do valor total financiado (Juros Simples)
                const { totalFinanced, installmentAmount } = calculateFinancedAmount(productValue, interestRate, totalInstallments);

                // Gerar Tabela de Amortização (para persistir no sale)
                const amortizationTable = generateAmortizationTable(totalFinanced, installmentAmount, totalInstallments, interestRate);

                const installmentsPayload: CreditInstallment[] = amortizationTable.map((entry: any) => ({
                    id: crypto.randomUUID(),
                    saleId: newSale.id,
                    customerId: newSale.customer_id,
                    installmentNumber: entry.number,
                    totalInstallments: totalInstallments,
                    dueDate: creditDetails.installmentsPreview[entry.number - 1]?.date || getNowISO(),
                    amount: entry.installmentAmount,
                    status: 'pending',
                    amountPaid: 0,
                    interestApplied: entry.interest,
                    amortizationValue: entry.amortization,
                    remainingBalance: entry.remainingBalance,
                    penaltyApplied: 0
                }));

                await addCreditInstallments(installmentsPayload);

                // Update sale with amortization info and initial debt balance
                await supabase.from('sales').update({
                    interest_rate: interestRate,
                    total_financed: totalFinanced,
                    installment_amount: installmentAmount,
                    current_debt_balance: totalFinanced,
                    amortization_table: amortizationTable
                }).eq('id', newSale.id);

                if (newSale.customer_id) {
                    const totalUsed = await syncCustomerCreditLimit(newSale.customer_id);

                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.CUSTOMER,
                        newSale.customer_id,
                        `Aprovação de Crediário: Financiado ${formatCurrency(totalFinanced)} | Novo Saldo Devedor: ${formatCurrency(totalUsed)}`,
                        userId,
                        userName
                    );
                }

            } catch (err: any) {
                console.error('Failed to create credit installments or update limit:', err);
                throw new Error(`Erro no Crediário: ${err.message || 'Falha desconhecida'}`);
            }
        } else if (data.payments?.some((p: any) => p.method === 'Crediário' || p.method === 'Crediario')) {
            throw new Error('Falha: Pagamento Crediário selecionado, mas os detalhes das parcelas estão ausentes.');
        }
    }


    clearCache(['sales', 'products', 'cash_sessions', 'customers']);
    return mappedSale;
};

export const updateSale = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // STEP 0: Fetch the original sale to compare for stock and trade-in changes
    const { data: originalSale } = await supabase.from('sales').select('*').eq('id', data.id).maybeSingle();
    const oldStatus = originalSale?.status || '';
    const originalItems = originalSale?.items || [];

    // Check if a trade-in product was removed from this sale
    if (data.payments && originalSale?.payments) {
        // Find trade-in payments in original that are NOT in the new payments
        const originalTradeIns = (originalSale.payments || []).filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );
        const newTradeInProductIds = (data.payments || [])
            .filter((p: any) => p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId)
            .map((p: any) => p.tradeInDetails.productId);

        for (const originalTradeIn of originalTradeIns) {
            const productId = originalTradeIn.tradeInDetails?.productId;
            if (productId && !newTradeInProductIds.includes(productId)) {
                // Fetch the product to check its history
                const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

                if (product) {
                    const stockHistory = product.stockHistory || [];
                    const isFresh = stockHistory.length <= 1 && product.stock > 0;

                    if (isFresh) {
                        await supabase.from('products').delete().eq('id', productId);
                        await addAuditLog(
                            AuditActionType.DELETE,
                            AuditEntityType.PRODUCT,
                            productId,
                            `Produto de troca removido (venda alterada): ${product.model}`,
                            userId,
                            userName
                        );
                    } else {
                        if (product.stock > 0) {
                            const newStockEntry = {
                                id: crypto.randomUUID(),
                                oldStock: product.stock,
                                newStock: 0,
                                adjustment: -product.stock,
                                reason: 'Remoção de Troca',
                                relatedId: data.id,
                                timestamp: getNowISO(),
                                changedBy: userName,
                                details: 'Produto de troca removido da venda original'
                            };

                            await supabase.from('products').update({
                                stock: 0,
                                stockHistory: [...stockHistory, newStockEntry]
                            }).eq('id', productId);

                            await addAuditLog(
                                AuditActionType.STOCK_ADJUST,
                                AuditEntityType.PRODUCT,
                                productId,
                                `Estoque zerado (troca removida da venda): ${product.model}. Estoque: ${product.stock} → 0`,
                                userId,
                                userName
                            );
                        }
                    }
                }
            }
        }
    }

    // Merge observations for DB storage
    let dbObservations = data.observations || '';
    if (data.internalObservations && !dbObservations.includes('---INTERNAL---')) {
        dbObservations = `${dbObservations}\n---INTERNAL---\n${data.internalObservations}`;
    } else if (data.internalObservations && dbObservations.includes('---INTERNAL---')) {
        // Replace existing internal part if needed, or keep as is if it's already there
        const parts = dbObservations.split('\n---INTERNAL---\n');
        dbObservations = `${parts[0]}\n---INTERNAL---\n${data.internalObservations}`;
    }

    if (data.cashSessionDisplayId && !dbObservations.includes('---CSDID---')) {
        dbObservations = `${dbObservations}\n---CSDID---\n${data.cashSessionDisplayId}`;
    }

    const updatePayload: any = {};
    if (dbObservations !== undefined) updatePayload.observations = dbObservations;

    // RULE: If updating a sale and status moves to Finalizada, it should be 'Editada' 
    // to show both badges, unless it's already Editada.
    let finalStatus = data.status;
    if (finalStatus === 'Finalizada' && oldStatus && oldStatus !== 'Finalizada') {
        finalStatus = 'Editada';
    }

    // Explicitly map known fields to snake_case
    if (data.customerId) updatePayload.customer_id = data.customerId;
    if (data.salespersonId) updatePayload.salesperson_id = data.salespersonId;
    if (finalStatus) updatePayload.status = finalStatus;
    if (data.posTerminal) updatePayload.pos_terminal = data.posTerminal;
    if (data.warrantyTerm) updatePayload.warranty_term = data.warrantyTerm;
    if (data.cashSessionId) updatePayload.cash_session_id = data.cashSessionId;
    if (data.leadOrigin) updatePayload.lead_origin = data.leadOrigin;
    if (data.items) updatePayload.items = data.items;
    if (data.subtotal !== undefined) updatePayload.subtotal = data.subtotal;

    if (data.total !== undefined) updatePayload.total = data.total;
    if (data.payments) updatePayload.payments = data.payments;


    // RULE 5 & 6: Strict validation of ownership (EXCEPT ADMINS)
    const callingUserProfile = userId !== 'system' ? await getProfile(userId) : null;
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin';
    const userPermissions = (callingUserProfile as any)?.permissions || {};

    if (userId !== 'system') {
        const { data: existing } = await supabase.from('sales').select('salesperson_id, cash_session_id, status').eq('id', data.id).single();
        if (existing) {
            // GOVERNANCE: Editing completed sales requires admin permission
            if ((existing.status === 'Finalizada' || existing.status === 'Editada') && finalStatus !== 'Cancelada') {
                const canEdit = isCallingAdmin || userPermissions.canEditCompletedSale === true;
                if (!canEdit) {
                    throw new Error('Acesso NEGADO: Apenas administradores podem editar vendas finalizadas.');
                }
                if (!data.editReason) {
                    throw new Error('É obrigatório informar o motivo da edição.');
                }
            }

            // GOVERNANCE: Canceling completed sales requires admin permission
            if (finalStatus === 'Cancelada' && (existing.status === 'Finalizada' || existing.status === 'Editada')) {
                const canCancel = isCallingAdmin || userPermissions.canCancelCompletedSale === true;
                if (!canCancel) {
                    throw new Error('Acesso NEGADO: Apenas administradores podem cancelar vendas finalizadas.');
                }
                if (!data.cancelReason) {
                    throw new Error('É obrigatório informar o motivo do cancelamento.');
                }
            }

            // RULE: IMMUTABLE SALES - Block updates if session is closed (UNLESS admin)
            if (existing.cash_session_id) {
                const { data: session } = await supabase.from('cash_sessions').select('status').eq('id', existing.cash_session_id).single();
                if (session && (session.status === 'fechado' || session.status === 'closed')) {
                    if (!isCallingAdmin) {
                        throw new Error('Acesso NEGADO: Vendas de caixas fechados não podem ser editadas. Realize o cancelamento e lance uma nova venda.');
                    }
                }
            }

            if (!isCallingAdmin && existing.salesperson_id !== userId) {
                throw new Error('Acesso NEGADO: Esta venda pertence a outro vendedor.');
            }
        }
    }

    // GOVERNANCE: Track original_total on first edit
    if (data.total !== undefined && originalSale && originalSale.original_total === null && Number(data.total) !== Number(originalSale.total)) {
        updatePayload.original_total = originalSale.total;
    }

    // GOVERNANCE: Track edit metadata
    if (data.editReason && finalStatus !== 'Cancelada') {
        updatePayload.edited_by = userId !== 'system' ? userId : null;
        updatePayload.edited_at = new Date().toISOString();
        updatePayload.edit_reason = data.editReason;
    }

    // GOVERNANCE: Track cancel metadata
    if (finalStatus === 'Cancelada' && data.cancelReason) {
        updatePayload.canceled_by = userId !== 'system' ? userId : null;
        updatePayload.canceled_at = new Date().toISOString();
        updatePayload.cancel_reason = data.cancelReason;
    }

    const { data: updatedRows, error } = await supabase.from('sales').update(updatePayload).eq('id', data.id).select();
    if (error) {
        console.error('mockApi: Error updating sale:', error);
        throw error;
    }

    // Handle RLS: if no rows returned but no error, use local data
    const updated = (updatedRows && updatedRows.length > 0) ? updatedRows[0] : { id: data.id, ...updatePayload };

    if (!updatedRows || updatedRows.length === 0) {
        console.warn('mockApi: Sale updated successfully but returned no data (likely RLS). Using local payload.');
    }

    const saleDisplayId = updated.display_id || data.id;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SALE,
        data.id,
        `Venda atualizada. Status: ${finalStatus || updated.status}${data.editReason ? ` | Motivo: ${data.editReason}` : ''}${data.cancelReason ? ` | Motivo cancelamento: ${data.cancelReason}` : ''}`,
        userId,
        userName
    );

    // GOVERNANCE: Insert immutable audit log on edit
    if (data.editReason && finalStatus !== 'Cancelada' && updated.cash_session_id) {
        const oldTotal = originalSale?.total || 0;
        const newTotal = data.total || updated.total || 0;
        supabase.from('cash_register_audit_logs').insert({
            cash_register_id: updated.cash_session_id,
            sale_id: data.id,
            action_type: 'sale_edited',
            description: `Admin editou venda #${saleDisplayId} (${formatCurrency(Number(oldTotal))} → ${formatCurrency(Number(newTotal))}). Motivo: ${data.editReason}`,
            performed_by: userId !== 'system' ? userId : '00000000-0000-0000-0000-000000000000',
            performed_by_name: userName,
            performed_at: new Date().toISOString(),
            metadata: { old_total: oldTotal, new_total: newTotal, reason: data.editReason }
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('Failed to insert cash_register_audit_log (edit):', auditErr);
        });
    }

    // GOVERNANCE: Insert immutable audit log on cancel
    if (finalStatus === 'Cancelada' && data.cancelReason && updated.cash_session_id) {
        supabase.from('cash_register_audit_logs').insert({
            cash_register_id: updated.cash_session_id,
            sale_id: data.id,
            action_type: 'sale_canceled',
            description: `Admin cancelou venda #${saleDisplayId} (motivo: ${data.cancelReason})`,
            performed_by: userId !== 'system' ? userId : '00000000-0000-0000-0000-000000000000',
            performed_by_name: userName,
            performed_at: new Date().toISOString(),
            metadata: { total: updated.total, reason: data.cancelReason }
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('Failed to insert cash_register_audit_log (cancel):', auditErr);
        });
    }

    // If sale was not Finalizada/Editada and now it is, we need to deduct stock
    const newStatus = updated.status;

    if ((oldStatus === 'Pendente' || !oldStatus) && (newStatus === 'Finalizada' || newStatus === 'Editada')) {
        const paymentMethods = data.payments?.map((p: any) => p.method).join(', ') || 'N/A';
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', updated.customer_id).single();
        const customerName = customerData?.name || 'Cliente';

        for (const item of updated.items || []) {
            await adjustProductStock(
                item.productId,
                -Number(item.quantity),
                updated.id,
                'Venda (Finalizada na Edição)',
                customerName,
                paymentMethods,
                userName,
                userId
            );
        }

        // Auto-generate installments when finalizing a pending sale with Credit
        const creditPayments = updated.payments?.filter((p: any) => p.method === 'Crediário' || p.method === 'Promissória') || [];
        if (creditPayments.length > 0 && updated.customer_id && (newStatus === 'Finalizada' || newStatus === 'Editada') && (oldStatus !== 'Finalizada' && oldStatus !== 'Editada')) {
            try {
                let totalAdded = 0;
                for (const credPayment of creditPayments) {
                    const cDetails = credPayment.creditDetails || {};
                    let cPreviews = cDetails.installmentsPreview || [];

                    if (!cPreviews.length) {
                        const amt = Number(cDetails.financedAmount) || Number(credPayment.value) || 0;
                        const cnt = Number(cDetails.totalInstallments) || 1;
                        const val = amt / cnt;
                        const dt = new Date();
                        dt.setDate(dt.getDate() + 30);

                        for (let k = 0; k < cnt; k++) {
                            const d = new Date(dt);
                            d.setMonth(d.getMonth() + k);
                            cPreviews.push({ number: k + 1, date: d.toISOString().split('T')[0], amount: val });
                        }
                    }

                    const iPayload = cPreviews.map((p: any) => ({
                        id: crypto.randomUUID(),
                        saleId: updated.id,
                        customerId: updated.customer_id,
                        installmentNumber: p.number,
                        totalInstallments: cPreviews.length,
                        dueDate: p.date,
                        amount: p.amount,
                        status: 'pending',
                        amountPaid: 0,
                        interestApplied: 0,
                        penaltyApplied: 0
                    }));

                    await addCreditInstallments(iPayload);
                    totalAdded += iPayload.reduce((s: number, i: any) => s + i.amount, 0);
                }

                if (totalAdded > 0) {
                    const { data: cust } = await supabase.from('customers').select('credit_used').eq('id', updated.customer_id).single();
                    if (cust) {
                        await supabase.from('customers').update({ credit_used: (cust.credit_used || 0) + totalAdded }).eq('id', updated.customer_id);
                        await addAuditLog(AuditActionType.UPDATE, AuditEntityType.CUSTOMER, updated.customer_id, `Crédito atualizado via finalização de venda #${updated.display_id}`, userId, userName);
                    }
                }
            } catch (e) { console.error('[updateSale] Error creating installments:', e); }
        }

        // FIX: Reconcile payments if they changed between Finalizada/Editada states
        if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && (newStatus === 'Finalizada' || newStatus === 'Editada')) {
            const oldCreditPayments = originalSale?.payments?.filter((p: any) => p.method === 'Crediário' || p.method === 'Promissória') || [];
            const newCreditPayments = updated.payments?.filter((p: any) => p.method === 'Crediário' || p.method === 'Promissória') || [];

            const oldCreditJSON = JSON.stringify(oldCreditPayments);
            const newCreditJSON = JSON.stringify(newCreditPayments);

            if (oldCreditJSON !== newCreditJSON) {
                try {
                    const oldCreditTotal = oldCreditPayments.reduce((s: number, p: any) => s + (p.value || 0), 0);
                    if (oldCreditTotal > 0 && originalSale?.customer_id) {
                        await supabase.from('credit_installments').delete().eq('sale_id', updated.id);
                        const { data: custOld } = await supabase.from('customers').select('credit_used').eq('id', originalSale.customer_id).single();
                        if (custOld) {
                            const newUsed = Math.max(0, (custOld.credit_used || 0) - oldCreditTotal);
                            await supabase.from('customers').update({ credit_used: newUsed }).eq('id', originalSale.customer_id);
                        }
                    }

                    if (newCreditPayments.length > 0 && updated.customer_id) {
                        let totalAdded = 0;
                        for (const credPayment of newCreditPayments) {
                            const cDetails = credPayment.creditDetails || {};
                            let cPreviews = cDetails.installmentsPreview || [];

                            if (!cPreviews.length) {
                                const amt = Number(cDetails.financedAmount) || Number(credPayment.value) || 0;
                                const cnt = Number(cDetails.totalInstallments) || 1;
                                const val = amt / cnt;
                                const dt = new Date(updated.date || new Date().toISOString());
                                dt.setDate(dt.getDate() + 30);

                                for (let k = 0; k < cnt; k++) {
                                    const d = new Date(dt);
                                    d.setMonth(d.getMonth() + k);
                                    cPreviews.push({ number: k + 1, date: d.toISOString().split('T')[0], amount: val });
                                }
                            }

                            const iPayload = cPreviews.map((p: any) => ({
                                id: crypto.randomUUID(),
                                saleId: updated.id,
                                customerId: updated.customer_id,
                                installmentNumber: p.number,
                                totalInstallments: cPreviews.length,
                                dueDate: p.date,
                                amount: p.amount,
                                status: 'pending',
                                amountPaid: 0,
                                interestApplied: 0,
                                penaltyApplied: 0
                            }));

                            await addCreditInstallments(iPayload);
                            totalAdded += iPayload.reduce((s: number, i: any) => s + i.amount, 0);
                        }

                        if (totalAdded > 0) {
                            const { data: custNew } = await supabase.from('customers').select('credit_used').eq('id', updated.customer_id).single();
                            if (custNew) {
                                await supabase.from('customers').update({ credit_used: (custNew.credit_used || 0) + totalAdded }).eq('id', updated.customer_id);
                                await addAuditLog(AuditActionType.UPDATE, AuditEntityType.CUSTOMER, updated.customer_id, `Crédito re-aplicado em edição de venda #${updated.display_id}`, userId, userName);
                            }
                        }
                    }
                } catch (err) {
                    console.error('[updateSale] Error reconciling credit installments during edit:', err);
                }
            }
        }

        // TELEGRAM NOTIFICATION: Send notification when pending sale is finalized
        try {
            let totalProfit = 0;
            const productDescriptions: string[] = [];

            // Fetch full product details for all items
            const productIds = (updated.items || []).map((item: any) => item.productId).filter(Boolean);
            const { data: productDetails } = await supabase
                .from('products')
                .select('id, model, category, brand')
                .in('id', productIds);

            // Fetch category and brand names
            const categoryIds = (productDetails || []).map(p => p.category).filter(Boolean);
            const brandIds = (productDetails || []).map(p => p.brand).filter(Boolean);

            const [categoriesResult, brandsResult] = await Promise.all([
                categoryIds.length > 0 ? supabase.from('categories').select('id, name').in('id', categoryIds) : { data: [] },
                brandIds.length > 0 ? supabase.from('brands').select('id, name').in('id', brandIds) : { data: [] }
            ]);

            const categoryMap = new Map();
            (categoriesResult.data || []).forEach((c: any) => categoryMap.set(c.id, c.name));

            const brandMap = new Map();
            (brandsResult.data || []).forEach((b: any) => brandMap.set(b.id, b.name));

            const productMap = new Map();
            (productDetails || []).forEach((p: any) => productMap.set(p.id, p));

            for (const item of updated.items || []) {
                const itemNetRevenue = item.netTotal ?? ((item.unitPrice || 0) * (item.quantity || 1));
                const itemProfit = itemNetRevenue - ((item.costPrice || 0) * (item.quantity || 1));
                totalProfit += itemProfit;

                // Build product description: Category Name + Brand Name + Model
                const product = productMap.get(item.productId);
                if (product) {
                    const parts = [];
                    const categoryName = categoryMap.get(product.category);
                    const brandName = brandMap.get(product.brand);

                    if (categoryName) parts.push(categoryName);
                    if (brandName) parts.push(brandName);
                    if (product.model) parts.push(product.model);

                    if (parts.length > 0) {
                        productDescriptions.push(parts.join(' '));
                    } else {
                        productDescriptions.push(item.productName || item.model || 'Produto');
                    }
                } else if (item.productName || item.model) {
                    productDescriptions.push(item.productName || item.model);
                }
            }

            const productDescription = productDescriptions.length > 0
                ? productDescriptions.join(' + ')
                : 'Produto';

            // Calculate daily profit
            let dailyProfit = totalProfit;
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data: todaySales } = await supabase
                    .from('sales')
                    .select('items')
                    .gte('date', today)
                    .in('status', ['Finalizada', 'Editada']);

                if (todaySales && todaySales.length > 0) {
                    dailyProfit = 0;
                    for (const sale of todaySales) {
                        const items = sale.items || [];
                        for (const item of items) {
                            const itemNetRevenue = item.netTotal ?? ((item.unitPrice || 0) * (item.quantity || 1));
                            dailyProfit += itemNetRevenue - ((item.costPrice || 0) * (item.quantity || 1));
                        }
                    }
                }
            } catch (dailyError) {
                console.warn('[updateSale] Could not calculate daily profit:', dailyError);
            }

            await sendSaleNotification({
                productDescription,
                profit: totalProfit,
                dailyProfit
            });
        } catch (telegramError) {
            console.warn('[updateSale] Telegram notification failed:', telegramError);
        }
    }

    // FIX: If sale is Cancelada or changed to Pendente (from Finalizada), we need to revert Credit Limit
    if (originalSale && (oldStatus === 'Finalizada' || oldStatus === 'Editada') && (newStatus === 'Cancelada' || newStatus === 'Pendente')) {
        const oldCreditPayments = originalSale.payments?.filter((p: any) => p.method === 'Crediário' || p.method === 'Promissória') || [];

        if (oldCreditPayments.length > 0 && originalSale.customer_id) {

            // 1. Delete installments for this sale
            const { error: deleteError } = await supabase
                .from('credit_installments')
                .delete()
                .eq('sale_id', data.id);

            if (deleteError) {
                console.error('[updateSale] Error deleting credit installments:', deleteError);
            }

            // 2. Restore customer credit limit
            const creditUsedToRevert = oldCreditPayments.reduce((s: number, p: any) => s + (p.value || 0), 0);

            if (creditUsedToRevert > 0) {
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('credit_used, name')
                    .eq('id', originalSale.customer_id)
                    .single();

                if (customerData) {
                    const currentUsed = customerData.credit_used || 0;
                    const newCreditUsed = Math.max(0, currentUsed - creditUsedToRevert);

                    await supabase
                        .from('customers')
                        .update({ credit_used: newCreditUsed })
                        .eq('id', originalSale.customer_id);

                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.CUSTOMER,
                        originalSale.customer_id,
                        `Limite restaurado (Venda ${newStatus}): +${formatCurrency(creditUsedToRevert)}`,
                        userId,
                        userName
                    );
                }
            }
        }
    }

    // FIX: If sale was Finalizada/Editada and now is Pendente (Estorno), we need to RETURN stock
    if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && newStatus === 'Pendente') {
        const paymentMethods = data.payments?.map((p: any) => p.method).join(', ') || 'N/A';
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', updated.customer_id).maybeSingle();
        const customerName = customerData?.name || 'Cliente';

        for (const item of originalItems) { // Use original items to be safe, or updated if you trust the cart state matches
            // We use updated.items primarily, but since we are reverting, we assume the items in the sale are what we are returning.
            // If the user edited items AND changed to pending, updated.items reflects the NEW state.
            // Ideally, we return what was previously taken (originalItems).
            // However, if the user changed items, `updateSale` might have already processed the diffs? 
            // Wait, `updateSale` handles diffs below in "If sale was already finalized and is being edited".
            // BUT that block checks `if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && newStatus === 'Editada')`.
            // So if newStatus is 'Pendente', that diff block is SKIPPED.
            // Therefore, we should return the ORIGINAL items to stock, because those were the ones deducted.
            // BUT, wait. If the user changed the cart (e.g. removed an item) AND set to Pendente, 
            // we want the final state of the Pending sale to reflect the new cart.
            // Code-wise, `updated` already has the NEW items saved to DB.
            // The stock adjustment should be: Return EVERYTHING that was previously deducted.

            await adjustProductStock(
                item.productId,
                Number(item.quantity),
                updated.id,
                'Venda alterada para Pendente (Estorno)',
                customerName,
                paymentMethods,
                userName,
                userId
            );
        }
    }

    // If sale was already finalized and is being edited, handle stock differences
    if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && newStatus === 'Editada') {
        const currentItems = data.items || [];
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', updated.customer_id).maybeSingle();
        const customerName = customerData?.name || 'Cliente';
        const paymentMethods = data.payments?.map((p: any) => p.method).join(', ') || 'N/A';

        // 1. Check original items vs current items (removals and reductions)
        for (const oldItem of originalItems) {
            const newItem = currentItems.find((i: any) => i.productId === oldItem.productId);
            if (!newItem) {
                // Item completely removed - Return full quantity
                await adjustProductStock(oldItem.productId, Number(oldItem.quantity), updated.id, 'Item Removido da Venda', customerName, paymentMethods, userName, userId);
            } else if (Number(newItem.quantity) < Number(oldItem.quantity)) {
                // Quantity reduced - Return difference
                const diff = Number(oldItem.quantity) - Number(newItem.quantity);
                await adjustProductStock(oldItem.productId, diff, updated.id, 'Qtd Reduzida na Venda', customerName, paymentMethods, userName, userId);
            } else if (Number(newItem.quantity) > Number(oldItem.quantity)) {
                // Quantity increased - Deduct difference
                const diff = Number(newItem.quantity) - Number(oldItem.quantity);
                await adjustProductStock(oldItem.productId, -diff, updated.id, 'Qtd Aumentada na Venda', customerName, paymentMethods, userName, userId);
            }
        }

        // 2. Check for new items added during edit
        for (const newItem of currentItems) {
            const wasOld = originalItems.find((i: any) => i.productId === newItem.productId);
            if (!wasOld) {
                // Completely new item - Deduct full quantity
                await adjustProductStock(newItem.productId, -Number(newItem.quantity), updated.id, 'Item Adicionado na Edição', customerName, paymentMethods, userName, userId);
            }
        }
    }

    // TRADE-IN STOCK MANAGEMENT: Handle trade-in product stock based on sale status
    // Trade-in products should only be in stock when sale is Finalizada
    if (data.payments) {
        const tradeInPayments = (data.payments || []).filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );

        for (const tradeInPayment of tradeInPayments) {
            const productId = tradeInPayment.tradeInDetails.productId;
            const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

            if (product) {
                const wasFinalized = oldStatus === 'Finalizada' || oldStatus === 'Editada';
                const isNowFinalized = newStatus === 'Finalizada' || newStatus === 'Editada';
                const isNowPendingOrCancelled = newStatus === 'Pendente' || newStatus === 'Cancelada';

                // Case 1: Sale was Finalized and now is Pending/Cancelled -> Remove trade-in from stock
                if (wasFinalized && isNowPendingOrCancelled) {
                    const stockHistory = product.stockHistory || [];

                    // Check if product was EVER sold in another sale
                    const wasSoldInAnotherSale = stockHistory.some((entry: any) =>
                        entry.reason === 'Venda' && entry.relatedId && entry.relatedId !== data.id
                    );

                    if (wasSoldInAnotherSale || newStatus === 'Pendente') {
                        // Product was sold to another customer OR sale is just pending - keep it but zero the stock
                        if (product.stock > 0) {
                            const newStockEntry = {
                                id: crypto.randomUUID(),
                                oldStock: product.stock,
                                newStock: 0,
                                adjustment: -product.stock,
                                reason: `Venda ${newStatus}`,
                                relatedId: data.id,
                                timestamp: getNowISO(),
                                changedBy: userName,
                                details: `Produto de troca removido do estoque (venda ${newStatus.toLowerCase()})`
                            };

                            await supabase.from('products').update({
                                stock: 0,
                                stockHistory: [...stockHistory, newStockEntry]
                            }).eq('id', productId);

                            await addAuditLog(
                                AuditActionType.STOCK_ADJUST,
                                AuditEntityType.PRODUCT,
                                productId,
                                `Estoque zerado (venda ${newStatus.toLowerCase()}): ${product.model}. Estoque: ${product.stock} → 0`,
                                userId,
                                userName
                            );
                        }
                    } else {
                        // Product was NEVER sold elsewhere AND sale is being CANCELLED - DELETE it completely
                        await supabase.from('products').delete().eq('id', productId);

                        await addAuditLog(
                            AuditActionType.DELETE,
                            AuditEntityType.PRODUCT,
                            productId,
                            `Produto de troca excluído (venda cancelada): ${product.model}`,
                            userId,
                            userName
                        );
                    }
                }

                // Case 2: Sale was Pending and now is Finalized -> Add trade-in to stock
                else if (!wasFinalized && isNowFinalized && product.stock === 0) {
                    const stockHistory = product.stockHistory || [];

                    const newStockEntry = {
                        id: crypto.randomUUID(),
                        oldStock: 0,
                        newStock: 1,
                        adjustment: 1,
                        reason: 'Entrou em uma troca',
                        relatedId: data.id,
                        timestamp: getNowISO(),
                        changedBy: userName,
                        details: `Produto recebido em troca - Venda #${data.id}`
                    };

                    await supabase.from('products').update({
                        stock: 1,
                        stockHistory: [...stockHistory, newStockEntry],
                        observations: `Troca pela venda #${data.id}`
                    }).eq('id', productId);

                    await addAuditLog(
                        AuditActionType.STOCK_ADJUST,
                        AuditEntityType.PRODUCT,
                        productId,
                        `Produto de troca entrou no estoque (venda finalizada): ${product.model}. Estoque: 0 → 1`,
                        userId,
                        userName
                    );
                }
            }
        }
    }

    // COMMISSION CANCELLATION/RECALCULATION: Update commissions on sale edit
    try {
        const { recalculateCommissionsForSale, cancelCommissionsForSale } = await import('./commissionService.ts');

        if (newStatus === 'Cancelada') {
            await cancelCommissionsForSale(updated.id, userId, userName, 'Venda cancelada durante edição');
        } else if (['Finalizada', 'Editada', 'Pendente'].includes(newStatus)) {
            const currentItems = data.items || updated.items || [];
            if (currentItems && Array.isArray(currentItems) && currentItems.length > 0) {
                const commissionItems = currentItems.map((item: any) => ({
                    productId: item.productId,
                    unitPrice: item.unitPrice || 0,
                    quantity: item.quantity || 1,
                    discountType: item.discountType || 'R$',
                    discountValue: item.discountValue || 0,
                    netTotal: item.netTotal || ((item.unitPrice || 0) * (item.quantity || 1)),
                    productName: item.productName || item.model || 'Produto',
                    costPrice: item.costPrice || 0,
                }));
                await recalculateCommissionsForSale(
                    updated.id,
                    updated.salesperson_id || userId,
                    commissionItems,
                    userId,
                    userName,
                    updated.date,
                    newStatus
                );
            }
        }
    } catch (commErr) {
        console.warn('[updateSale] Commission recalculation failed (non-blocking):', commErr);
    }

    clearCache(['sales', 'products', 'cash_sessions']);

    return {
        ...updated,
        customerId: updated.customer_id,
        salespersonId: updated.salesperson_id,
        posTerminal: updated.pos_terminal,
        warrantyTerm: updated.warranty_term,
        cashSessionId: updated.cash_session_id,
        leadOrigin: updated.lead_origin,
        date: updated.date
    };
};

export const cancelSale = async (id: string, reason: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: sale, error: fetchError } = await supabase.from('sales').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    // RULE 5 & 6: Strict validation of ownership (EXCEPT ADMINS)
    const callingUserProfile = userId !== 'system' ? await getProfile(userId) : null;
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin';

    // Allow if salesperson OR if the sale belongs to a cash session owned by the user
    let isOwnerBySession = false;
    if (sale.cash_session_id) {
        const { data: session } = await supabase.from('cash_sessions').select('user_id').eq('id', sale.cash_session_id).single();
        if (session && session.user_id === userId) {
            isOwnerBySession = true;
        }
    }

    // RULE: IMMUTABLE SALES - Restrict cancellation if session is closed
    if (sale.cash_session_id) {
        const { data: session } = await supabase.from('cash_sessions').select('status').eq('id', sale.cash_session_id).single();
        if (session && (session.status === 'fechado' || session.status === 'closed')) {
            if (!isCallingAdmin) {
                throw new Error('Acesso NEGADO: Apenas administradores podem cancelar vendas de caixas fechados.');
            }
        }
    }

    if (userId !== 'system' && !isCallingAdmin && sale.salesperson_id !== userId && !isOwnerBySession) {
        throw new Error('Acesso NEGADO: Você não pode cancelar uma venda de outro vendedor, a menos que seja o dono do caixa.');
    }

    // Salvar o motivo de cancelamento usando um separador específico, preservando as observações originais
    // Formato: observações_originais\n---CANCEL_REASON---\nmotivo
    const separator = '\n---CANCEL_REASON---\n';
    const updatedObservations = sale.observations
        ? `${sale.observations}${separator}${reason}`
        : `${separator}${reason}`;

    const { data: updatedSale, error: updateError } = await supabase.from('sales').update({
        status: 'Cancelada',
        observations: updatedObservations
    }).eq('id', id).select().single();
    if (updateError) throw updateError;

    // REVERT ORCAMENTO STATUS IF APPLICABLE
    try {
        const { data: orcamento } = await supabase
            .from('orcamentos')
            .select('id')
            .eq('venda_id', id)
            .maybeSingle();

        if (orcamento) {
            await supabase
                .from('orcamentos')
                .update({
                    status: 'finalizado',
                    venda_id: null,
                    convertido_em: null,
                    updated_at: getNowISO()
                })
                .eq('id', orcamento.id);

            clearCache(['orcamentos']);
        }
    } catch (err) {
        console.warn('cancelSale: Error reverting orcamento status:', err);
    }

    // Add main sale cancel audit log
    await addAuditLog(
        AuditActionType.SALE_CANCEL,
        AuditEntityType.SALE,
        id,
        `Venda Cancelada. Motivo: ${reason}`,
        userId,
        userName
    );

    if (sale.items && Array.isArray(sale.items)) {
        const now = getNowISO();
        for (const item of sale.items) {
            const { data: product } = await supabase.from('products').select('*').eq('id', item.productId).single();
            if (product) {
                const currentStock = Number(product.stock);
                const newStock = currentStock + item.quantity;

                await addAuditLog(
                    AuditActionType.SALE_CANCEL,
                    AuditEntityType.PRODUCT,
                    item.productId,
                    `Venda #${sale.id} Cancelada. Motivo: ${reason}. Estoque retornado: +${item.quantity}`,
                    userId,
                    userName
                );

                // Add to stockHistory column
                const existingStockHistory = product.stockHistory || [];
                const newStockEntry = {
                    id: crypto.randomUUID(),
                    oldStock: currentStock,
                    newStock: newStock,
                    adjustment: item.quantity,
                    reason: 'Cancelamento de Venda',
                    relatedId: sale.id,
                    timestamp: now,
                    changedBy: userName,
                    details: `Motivo: ${reason}`
                };

                await supabase.from('products').update({
                    stock: newStock,
                    stockHistory: [...existingStockHistory, newStockEntry]
                }).eq('id', item.productId);
            }
        }
    }

    // COMMISSION CANCELLATION: Cancel pending commissions for this sale
    try {
        const { cancelCommissionsForSale } = await import('./commissionService.ts');
        await cancelCommissionsForSale(id, userId, userName, `Venda cancelada: ${reason}`);
    } catch (commErr) {
        console.warn('[cancelSale] Commission cancellation failed (non-blocking):', commErr);
    }

    // TRADE-IN STOCK MANAGEMENT: Remove trade-in products from stock when sale is cancelled
    const tradeInAlreadySoldProducts: { model: string; sku: string }[] = [];

    if (sale.payments && Array.isArray(sale.payments)) {
        const tradeInPayments = sale.payments.filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );

        for (const tradeInPayment of tradeInPayments) {
            const productId = tradeInPayment.tradeInDetails.productId;
            const { data: tradeInProduct } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

            if (tradeInProduct) {
                const stockHistory = tradeInProduct.stockHistory || [];

                // Check if product was EVER sold in another sale (has a 'Venda' entry with a different sale ID)
                const wasSoldInAnotherSale = stockHistory.some((entry: any) =>
                    entry.reason === 'Venda' && entry.relatedId && entry.relatedId !== sale.id
                );

                if (wasSoldInAnotherSale) {
                    // Product was already sold - cannot be removed, just track it for notification
                    tradeInAlreadySoldProducts.push({
                        model: tradeInProduct.model,
                        sku: tradeInProduct.sku
                    });

                    await addAuditLog(
                        AuditActionType.STOCK_ADJUST,
                        AuditEntityType.PRODUCT,
                        productId,
                        `Produto de troca não removido (já vendido em outra venda): ${tradeInProduct.model}`,
                        userId,
                        userName
                    );
                } else {
                    // Product was NEVER sold to another customer - DELETE it completely
                    await supabase.from('products').delete().eq('id', productId);

                    await addAuditLog(
                        AuditActionType.DELETE,
                        AuditEntityType.PRODUCT,
                        productId,
                        `Produto de troca excluído (venda cancelada): ${tradeInProduct.model}. Motivo: ${reason}`,
                        userId,
                        userName
                    );
                }
            }
        }
    }

    // CREDIT REVERT: If sale had "Crediário", revert the customer's credit_used and delete installments
    if (sale.payments && Array.isArray(sale.payments)) {
        const creditPayment = sale.payments.find((p: any) =>
            p.method === 'Crediário' || p.method === 'Crediario'
        );

        if (creditPayment && sale.customer_id) {
            try {
                // 1. Delete installments
                const { error: delError } = await supabase.from('credit_installments').delete().eq('sale_id', sale.id);
                if (delError) console.error('Error deleting installments:', delError);

                // 2. Fetch current customer credit_used
                const { data: customer } = await supabase
                    .from('customers')
                    .select('credit_used, name')
                    .eq('id', sale.customer_id)
                    .single();

                if (customer) {
                    // Important: Use financedAmount if available, otherwise fallback to payment value
                    // The creditDetails might be in creditPayment.creditDetails
                    const financedAmount = creditPayment.creditDetails?.financedAmount || creditPayment.value;
                    const currentUsed = Number(customer.credit_used || 0);
                    const newUsed = Math.max(0, currentUsed - Number(financedAmount));

                    const { error: updError } = await supabase
                        .from('customers')
                        .update({ credit_used: newUsed })
                        .eq('id', sale.customer_id);

                    if (updError) {
                        console.error('Error updating customer credit_used:', updError);
                    } else {
                        await addAuditLog(
                            AuditActionType.UPDATE,
                            AuditEntityType.CUSTOMER,
                            sale.customer_id,
                            `Estorno de crédito (venda cancelada): -${formatCurrency(financedAmount)}. Novo total: ${formatCurrency(newUsed)}`,
                            userId,
                            userName
                        );
                    }
                }
            } catch (err) {
                console.error('Error reverting credit on cancellation:', err);
            }
        }
    }

    clearCache(['sales', 'products', 'customers']);

    // Return with info about trade-in products that were already sold
    return {
        ...updatedSale,
        customerId: updatedSale.customer_id,
        salespersonId: updatedSale.salesperson_id,
        cashSessionId: updatedSale.cash_session_id,
        warrantyTerm: updatedSale.warranty_term,
        tradeInAlreadySold: tradeInAlreadySoldProducts.length > 0 ? tradeInAlreadySoldProducts : undefined
    };
};

export const getCustomerSales = async (customerId: string): Promise<Sale[]> => {
    // Optimization: Reuse the cached 'sales' list instead of a specific DB query
    const allSales = await getSales();
    return allSales.filter(s => s.customerId === customerId);
};

// --- CUSTOMERS ---
// --- MAPPING HELPERS ---
const mapCustomer = (c: any) => ({
    ...c,
    avatarUrl: c.avatar_url,
    birthDate: c.birth_date,
    createdAt: c.createdAt || c.created_at,
    isBlocked: c.is_blocked,
    customTag: c.custom_tag,
    instagram: c.instagram,
    active: c.active ?? true,
    address: {
        zip: c.cep || '',
        street: c.street || '',
        number: c.numero || '',
        complement: c.complemento || '',
        neighborhood: c.bairro || '',
        city: c.city || '',
        state: c.state || ''
    }
});

const mapSupplier = (s: any) => ({
    ...s,
    contactPerson: s.contact_person,
    avatarUrl: s.avatar_url,
    linkedCustomerId: s.linked_customer_id,
    instagram: s.instagram,
    address: s.address
});

// Mapped fields list. Including avatar_url despite size concerns as it is required for functionality.
const CUSTOMER_COLUMNS = 'id, name, email, phone, cpf, rg, birth_date, createdAt, is_blocked, custom_tag, instagram, cep, street, numero, complemento, bairro, city, state, avatar_url, active, credit_limit, credit_used, allow_credit';

// Helper to ensure date format is YYYY-MM-DD
const ensureISODate = (dateStr: string | undefined | null): string | null => {
    if (!dateStr) return null;
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
    // Convert DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
};

export const getCustomers = async (onlyActive: boolean = true): Promise<Customer[]> => {
    const cacheKey = onlyActive ? 'customers_active' : 'customers_all';
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            // Exclude avatar_url to prevent large payloads from crashing the app
            let query = supabase
                .from('customers')
                .select(CUSTOMER_COLUMNS)
                .order('name', { ascending: true })
                .limit(3000); // Robustness limit

            if (onlyActive) {
                query = query.eq('active', true);
            }

            const { data, error } = await query;
            if (error) {
                console.error('mockApi: Error fetching customers:', error);
                throw error;
            }
            return data;
        }).then(data => {
            return (data || []).map(mapCustomer);
        });
    });
};

export const searchCustomers = async (term: string): Promise<Customer[]> => {
    if (!term || term.length < 2) return [];
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('customers')
            .select(CUSTOMER_COLUMNS)
            .eq('active', true) // Search only active customers
            .or(`name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`)
            .limit(50);
        if (error) throw error;
        return (data || []).map(mapCustomer);
    });
};

// Fetch single customer directly from DB without cache (for fresh data like tradeInHistory)
export const getCustomerById = async (id: string): Promise<Customer | null> => {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) {
        console.error('Error fetching customer by ID:', error);
        return null;
    }
    return data ? populateTradeInHistory(mapCustomer(data)) : null;
};

// Helper function to populate tradeInHistory from sales interactions
const populateTradeInHistory = async (customer: Customer): Promise<Customer> => {
    // 1. Fetch sales for this customer
    const { data: sales } = await supabase.from('sales').select('*').eq('customer_id', customer.id);

    if (sales && sales.length > 0) {
        // 2. We need user names for 'salespersonName'
        // Using a simple cache or fetching all users might be heavy, but for a single customer view it's acceptable.
        // Optimization: Fetch only needed users? Or cache users globally? 
        // For now, fetch all users as it's a small table usually.
        const { data: users } = await supabase.from('users').select('id, name');
        const userMap = (users || []).reduce((acc: any, u: any) => ({ ...acc, [u.id]: u.name }), {});

        const derivedHistory: TradeInEntry[] = [];

        sales.forEach((sale: any) => {
            if (sale.payments && Array.isArray(sale.payments)) {
                sale.payments.forEach((p: any) => {
                    // Check for trade-in method or presence of tradeInDetails
                    if ((p.method === 'Aparelho na Troca' || p.tradeInDetails) && p.tradeInDetails) {
                        derivedHistory.push({
                            id: `trade-${sale.id}-${p.tradeInDetails.productId || Math.random().toString(36).substr(2, 5)}`,
                            productId: p.tradeInDetails.productId,
                            date: sale.date,
                            value: p.value,
                            model: p.tradeInDetails.model,
                            serialNumber: p.tradeInDetails.serialNumber,
                            imei1: p.tradeInDetails.imei1,
                            imei2: p.tradeInDetails.imei2,
                            batteryHealth: p.tradeInDetails.batteryHealth,
                            saleId: sale.id,
                            salespersonName: userMap[sale.salespersonId] || 'Vendedor'
                        });
                    }
                });
            }
        });

        // Sort by date descending
        derivedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { ...customer, tradeInHistory: derivedHistory };
    }

    return customer;
};

export const addCustomer = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // STRICT VALIDATION: Name is mandatory
    if (!data.name || data.name.trim() === '') {
        throw new Error('O nome do cliente é obrigatório.');
    }

    // Only include fields that exist in the actual customers table schema
    const payload: any = {
        name: data.name.trim(), // Ensure trimmed name
        phone: data.phone
    };

    // Optional fields - only add if they have values
    if (data.email) payload.email = data.email;
    if (data.avatarUrl) payload.avatar_url = data.avatarUrl;
    if (data.cpf) payload.cpf = data.cpf;
    if (data.rg) payload.rg = data.rg;
    if (data.birthDate) payload.birth_date = data.birthDate;
    if (data.isBlocked) payload.is_blocked = data.isBlocked;
    if (data.customTag) payload.custom_tag = data.customTag;
    if (data.instagram) payload.instagram = data.instagram;
    if (data.active !== undefined) payload.active = data.active;
    if (data.credit_limit !== undefined) payload.credit_limit = data.credit_limit;
    if (data.allow_credit !== undefined) payload.allow_credit = data.allow_credit;
    if (data.credit_used !== undefined) payload.credit_used = data.credit_used;


    // Address fields
    if (data.address) {
        if (data.address.zip) payload.cep = data.address.zip;
        if (data.address.street) payload.street = data.address.street;
        if (data.address.number) payload.numero = data.address.number;
        if (data.address.complement) payload.complemento = data.address.complement;
        if (data.address.neighborhood) payload.bairro = data.address.neighborhood;
        if (data.address.city) payload.city = data.address.city;
        if (data.address.state) payload.state = data.address.state;
    }


    // --- Validation: Check for duplicates ---
    if (payload.cpf) {
        const { data: existingCpf, error: cpfError } = await supabase
            .from('customers')
            .select('id, name')
            .eq('cpf', payload.cpf)
            .maybeSingle();

        if (existingCpf) {
            throw new Error(`Já existe um cliente cadastrado com este CPF: ${existingCpf.name}`);
        }
    }

    if (payload.rg) {
        // Try-catch block to handle case where 'rg' column might not exist yet
        try {
            const { data: existingRg, error: rgError } = await supabase
                .from('customers')
                .select('id, name')
                .eq('rg', payload.rg)
                .maybeSingle();

            if (rgError && rgError.code !== 'PGRST100') throw rgError; // Ignore simple errors, but throw specifics

            if (existingRg) {
                throw new Error(`Já existe um cliente cadastrado com este RG: ${existingRg.name}`);
            }
        } catch (err: any) {
            // If column doesn't exist (Postgres error 42703), we can't check duplication but we also can't save it.
            // Let the insert fail naturally if column is missing, or ignore check error.
            if (err.code !== '42703' && !err.message?.includes('rg')) {
                console.warn('Error checking RG duplication:', err);
                // If it's a duplication error thrown by us, rethrow
                if (err.message && err.message.includes('Já existe um cliente')) throw err;
            }
        }
    }
    // ----------------------------------------
    // ----------------------------------------
    let result = await supabase.from('customers').insert([payload]).select().single();

    // Retry logic for missing columns (Schema drift protection)
    if (result.error && result.error.code === '42703') {
        const msg = result.error.message || '';
        let retry = false;

        // Check for specific columns known to validly be missing in some schemas
        if (msg.includes('instagram')) {
            console.warn("Column 'instagram' missing, retrying...");
            delete payload.instagram;
            retry = true;
        }
        if (msg.includes('rg')) {
            console.warn("Column 'rg' missing, retrying...");
            delete payload.rg;
            retry = true;
        }
        if (msg.includes('cpf')) {
            console.warn("Column 'cpf' missing, retrying...");
            delete payload.cpf;
            retry = true;
        }
        if (msg.includes('birth_date')) {
            console.warn("Column 'birth_date' missing, retrying...");
            delete payload.birth_date;
            retry = true;
        }
        // Address fields
        if (msg.includes('cep')) { delete payload.cep; retry = true; }
        if (msg.includes('street')) { delete payload.street; retry = true; }
        if (msg.includes('numero')) { delete payload.numero; retry = true; }
        if (msg.includes('complemento')) { delete payload.complemento; retry = true; }
        if (msg.includes('bairro')) { delete payload.bairro; retry = true; }
        if (msg.includes('city')) { delete payload.city; retry = true; }
        if (msg.includes('state')) { delete payload.state; retry = true; }

        if (retry) {
            result = await supabase.from('customers').insert([payload]).select().single();
        }
    }

    const { data: newCustomer, error } = result;
    if (error) {
        console.error("Error adding customer:", JSON.stringify(error, null, 2));
        throw error;
    }

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.CUSTOMER,
        newCustomer.id,
        `Cliente cadastrado: ${newCustomer.name}`,
        userId,
        userName
    );

    clearCache(['customers']);
    return mapCustomer(newCustomer);
};


/**
 * Regra 3 & 6: Sincroniza o limite_utilizado do cliente com base nos saldos devedores atuais.
 * Se uma venda antiga não tiver saldo_devedor_atual, calcula a partir das parcelas pendentes.
 */
export const syncCustomerCreditLimit = async (customerId: string) => {
    try {
        // 1. Buscar todas as vendas ativas do cliente que possuem pagamento em crediário
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('id, current_debt_balance, payments')
            .eq('customer_id', customerId)
            .in('status', ['Finalizada', 'Editada']);

        if (salesError) throw salesError;

        let totalUsed = 0;

        for (const sale of (sales || [])) {
            // Check if mapped or raw payments have credit
            const payments = Array.isArray(sale.payments) ? sale.payments : (typeof sale.payments === 'string' ? JSON.parse(sale.payments) : []);
            const hasCredit = payments.some((p: any) => p.method === 'Crediário' || p.method === 'Crediario' || p.method === 'Promissória');
            if (!hasCredit) continue;

            let debt = Number(sale.current_debt_balance || 0);

            // Fallback para vendas antigas: se saldo é 0/null, buscar parcelas pendentes
            if (debt <= 0) {
                const { data: installments } = await supabase
                    .from('credit_installments')
                    .select('amount, amount_paid')
                    .eq('sale_id', sale.id)
                    .in('status', ['pending', 'partial', 'overdue']);

                debt = (installments || []).reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.amount_paid)), 0);

                // Opcional: Atualizar a venda com este saldo para futuras consultas
                if (debt > 0) {
                    await supabase.from('sales').update({ current_debt_balance: debt }).eq('id', sale.id);
                }
            }

            totalUsed += debt;
        }

        // 2. Atualizar o cliente
        await supabase.from('customers').update({ credit_used: totalUsed }).eq('id', customerId);

        return totalUsed;
    } catch (err) {
        console.error('[syncCustomerCreditLimit] Error:', err);
        return 0;
    }
};

export const updateCustomer = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // Only include fields that exist in the actual customers table schema
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.phone !== undefined) payload.phone = data.phone;

    // Optional fields - only add if they have values
    if (data.email !== undefined) payload.email = data.email || null;
    if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl || null;
    if (data.cpf !== undefined) payload.cpf = data.cpf || null;
    if (data.rg !== undefined) payload.rg = data.rg || null;
    if (data.birthDate !== undefined) payload.birth_date = ensureISODate(data.birthDate) || null;
    if (data.isBlocked !== undefined) payload.is_blocked = data.isBlocked || false;
    if (data.customTag !== undefined) payload.custom_tag = data.customTag || null;
    if (data.instagram !== undefined) payload.instagram = data.instagram || null;
    if (data.active !== undefined) payload.active = data.active;
    if (data.credit_limit !== undefined) payload.credit_limit = data.credit_limit;
    if (data.allow_credit !== undefined) payload.allow_credit = data.allow_credit;
    if (data.credit_used !== undefined) payload.credit_used = data.credit_used;


    // Address fields
    if (data.address) {
        if (data.address.zip !== undefined) payload.cep = data.address.zip;
        if (data.address.street !== undefined) payload.street = data.address.street;
        if (data.address.number !== undefined) payload.numero = data.address.number;
        if (data.address.complement !== undefined) payload.complemento = data.address.complement;
        if (data.address.neighborhood !== undefined) payload.bairro = data.address.neighborhood;
        if (data.address.city !== undefined) payload.city = data.address.city;
        if (data.address.state !== undefined) payload.state = data.address.state;
    }


    // --- Validation: Check for duplicates (excluding self) ---
    if (payload.cpf) {
        const { data: existingCpf } = await supabase
            .from('customers')
            .select('id, name')
            .eq('cpf', payload.cpf)
            .neq('id', data.id)
            .maybeSingle();

        if (existingCpf) {
            throw new Error(`Outro cliente já possui este CPF: ${existingCpf.name}`);
        }
    }

    if (payload.rg) {
        try {
            const { data: existingRg, error: rgError } = await supabase
                .from('customers')
                .select('id, name')
                .eq('rg', payload.rg)
                .neq('id', data.id)
                .maybeSingle();

            if (existingRg) {
                throw new Error(`Outro cliente já possui este RG: ${existingRg.name}`);
            }
        } catch (err: any) {
            if (err.message && err.message.includes('Outro cliente')) throw err;
            // Ignore other errors (like column missing) during check, let update handle it
        }
    }
    // ---------------------------------------------------------

    // Timeout de segurança para evitar hang infinito
    const updatePromise = supabase.from('customers').update(payload).eq('id', data.id).select().single();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar cliente no Supabase (30s)')), 30000));

    let result: any;
    try {
        result = await Promise.race([updatePromise, timeoutPromise]);
    } catch (err: any) {
        console.error("mockApi: Exception during update race:", err);
        throw err;
    }

    if (result.error && payload.instagram && (result.error.code === '42703' || result.error.message?.includes('instagram'))) {
        console.warn("Instagram column missing, retrying without it...");
        delete payload.instagram;
        result = await supabase.from('customers').update(payload).eq('id', data.id).select().single();
    }

    const { data: updated, error } = result;
    if (error) {
        console.error("Error updating customer:", JSON.stringify(error, null, 2));
        throw error;
    }

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.CUSTOMER,
        updated.id,
        `Cliente atualizado: ${updated.name}`,
        userId,
        userName
    );

    clearCache(['customers']);
    return mapCustomer(updated);
};

export const deleteCustomer = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();

    if (!customer) {
        throw new Error('Cliente não encontrado.');
    }

    // Check if customer has any sales
    const { count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('customerId', id);

    if (salesCount && salesCount > 0) {
        throw new Error(`Este cliente possui ${salesCount} venda(s) registrada(s) e não pode ser excluído. Você pode desativar o cadastro ao invés de excluir.`);
    }

    // Check if customer has any trade-in history (products where they are the supplier)
    const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', id);

    if (productsCount && productsCount > 0) {
        throw new Error(`Este cliente possui ${productsCount} produto(s) recebido(s) via troca/compra e não pode ser excluído.`);
    }

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;

    await addAuditLog(
        AuditActionType.DELETE,
        AuditEntityType.CUSTOMER,
        id,
        `Cliente excluído: ${customer.name}`,
        userId,
        userName
    );

    clearCache(['customers']);
};

// --- SUPPLIERS ---

export const getSuppliers = async (): Promise<Supplier[]> => {
    return fetchWithCache('suppliers', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name', { ascending: true })
                .limit(3000); // Robustness limit

            if (error) throw error;
            return (data || []).map(mapSupplier);
        });
    });
};

export const searchSuppliers = async (term: string): Promise<Supplier[]> => {
    if (!term || term.length < 2) return [];
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
            .limit(50);
        if (error) throw error;
        return (data || []).map(mapSupplier);
    });
};

export const addSupplier = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // Only include fields that exist in the table
    const payload: any = {
        name: data.name,
        phone: data.phone
    };

    // Optional fields - only add if they have values
    if (data.contactPerson) payload.contact_person = data.contactPerson;
    if (data.email) payload.email = data.email;
    if (data.cnpj) payload.cnpj = data.cnpj;
    if (data.cpf) payload.cpf = data.cpf;
    if (data.rg) payload.rg = data.rg;
    if (data.birthDate) payload.birth_date = ensureISODate(data.birthDate);
    if (data.avatarUrl) payload.avatar_url = data.avatarUrl;
    if (data.linkedCustomerId) payload.linked_customer_id = data.linkedCustomerId;
    if (data.instagram) payload.instagram = data.instagram;
    if (data.address) payload.address = data.address;

    let result = await supabase.from('suppliers').insert([payload]).select().single();

    if (result.error && payload.instagram && (result.error.code === '42703' || result.error.message?.includes('instagram'))) {
        console.warn("Instagram column missing, retrying without it...");
        delete payload.instagram;
        result = await supabase.from('suppliers').insert([payload]).select().single();
    }

    const { data: newSupplier, error } = result;
    if (error) {
        console.error("Error adding supplier:", JSON.stringify(error, null, 2));
        throw error;
    }

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.SUPPLIER,
        newSupplier.id,
        `Fornecedor cadastrado: ${newSupplier.name}`,
        userId,
        userName
    );

    clearCache(['suppliers']);
    return mapSupplier(newSupplier);
};

export const updateSupplier = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // Only include fields that exist in the actual suppliers table
    const payload: any = {
        name: data.name,
        phone: data.phone
    };

    // Optional fields - only add if they have values
    if (data.contactPerson !== undefined) payload.contact_person = data.contactPerson;
    if (data.email !== undefined) payload.email = data.email;
    if (data.cnpj !== undefined) payload.cnpj = data.cnpj;
    if (data.cpf !== undefined) payload.cpf = data.cpf;
    if (data.rg !== undefined) payload.rg = data.rg;
    if (data.birthDate !== undefined) payload.birth_date = ensureISODate(data.birthDate);
    if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
    if (data.linkedCustomerId !== undefined) payload.linked_customer_id = data.linkedCustomerId;
    if (data.instagram !== undefined) payload.instagram = data.instagram || null;
    if (data.address !== undefined) payload.address = data.address;


    // Timeout de segurança (30s) para uploads de imagem ou conexões lentas
    const updatePromise = supabase.from('suppliers').update(payload).eq('id', data.id).select().single();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar fornecedor no Supabase (30s)')), 30000));

    let result: any;
    try {
        result = await Promise.race([updatePromise, timeoutPromise]);
    } catch (err) {
        throw err;
    }

    if (result.error && payload.instagram && (result.error.code === '42703' || result.error.message?.includes('instagram'))) {
        console.warn("Instagram column missing, retrying without it...");
        delete payload.instagram;
        result = await supabase.from('suppliers').update(payload).eq('id', data.id).select().single();
    }

    const { data: updated, error } = result;
    if (error) {
        console.error("Error updating supplier:", JSON.stringify(error, null, 2));
        throw error;
    }

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SUPPLIER,
        updated.id,
        `Fornecedor atualizado: ${updated.name}`,
        userId,
        userName
    );

    clearCache(['suppliers']);
    return mapSupplier(updated);
};

export const deleteSupplier = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', id).single();

    if (!supplier) {
        throw new Error('Fornecedor não encontrado.');
    }

    // Check if supplier has any products linked
    const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', id);

    if (productsCount && productsCount > 0) {
        throw new Error(`Este fornecedor possui ${productsCount} produto(s) vinculado(s) e não pode ser excluído.`);
    }

    // Check if supplier has any purchase orders
    const { count: ordersCount } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('supplierId', id);

    if (ordersCount && ordersCount > 0) {
        throw new Error(`Este fornecedor possui ${ordersCount} pedido(s) de compra vinculado(s) e não pode ser excluído.`);
    }

    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;

    await addAuditLog(
        AuditActionType.DELETE,
        AuditEntityType.SUPPLIER,
        id,
        `Fornecedor excluído: ${supplier.name}`,
        userId,
        userName
    );

    clearCache(['suppliers']);
};

export const findOrCreateSupplierFromCustomer = async (c: Customer, retryCount = 0): Promise<Supplier> => {
    // Create a fallback supplier that we can use if DB operations fail or timeout
    const fallbackSupplier: Supplier = {
        id: `temp-supplier-${c.id}`,
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        linkedCustomerId: c.id,
        contactPerson: c.name,
        cnpj: '',
        address: ''
    };

    // Timeout wrapper for the entire operation
    const timeoutPromise = new Promise<Supplier>((_, reject) =>
        setTimeout(() => reject(new Error('SUPPLIER_TIMEOUT')), 8000)
    );

    const mainOperation = async (): Promise<Supplier> => {
        try {
            const { data: existing, error } = await supabase.from('suppliers').select('*').eq('linked_customer_id', c.id).maybeSingle();

            if (error && error.code !== 'PGRST116') {
                console.error("Error checking existing supplier:", error);
                // If AbortError and first try, retry once after a short delay
                if ((error.message?.includes('aborted') || (error as any).name === 'AbortError') && retryCount < 2) {
                    console.warn('AbortError on check, retrying after delay...');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    return findOrCreateSupplierFromCustomer(c, retryCount + 1);
                }
                throw error;
            }
            if (existing) return mapSupplier(existing);

            // Use only basic columns that exist in the suppliers table
            const ns: any = {
                name: c.name,
                email: c.email || null,
                phone: c.phone || null,
                linked_customer_id: c.id,
                instagram: c.instagram || null
            };

            const { data: insertedRows, error: insertError } = await supabase.from('suppliers').insert([ns]).select();

            if (insertError) {
                console.error("Error creating supplier from customer:", JSON.stringify(insertError, null, 2));
                // If AbortError and first try, retry once after a short delay
                if ((insertError.message?.includes('aborted') || (insertError as any).name === 'AbortError') && retryCount < 2) {
                    console.warn('AbortError on insert, retrying after delay...');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    return findOrCreateSupplierFromCustomer(c, retryCount + 1);
                }
                throw insertError;
            }

            // Handle RLS: if no rows returned but no error, use local data
            const newSupplier = (insertedRows && insertedRows.length > 0) ? insertedRows[0] : { ...ns, id: crypto.randomUUID() };

            clearCache(['suppliers']);
            return mapSupplier(newSupplier);
        } catch (err: any) {
            // If insert fails, try with even more minimal fields

            // If AbortError and we haven't retried yet, retry the whole function
            if ((err.message?.includes('aborted') || err.name === 'AbortError') && retryCount < 2) {
                await new Promise(resolve => setTimeout(resolve, 300));
                return findOrCreateSupplierFromCustomer(c, retryCount + 1);
            }

            const minimalNs = {
                name: c.name,
                linked_customer_id: c.id
            };
            const { data: minInsertedRows, error: minError } = await supabase.from('suppliers').insert([minimalNs]).select();
            if (minError) throw minError;

            const newSupplier = (minInsertedRows && minInsertedRows.length > 0) ? minInsertedRows[0] : { ...minimalNs, id: crypto.randomUUID() };
            clearCache(['suppliers']);
            return mapSupplier(newSupplier);
        }
    };

    // Race between main operation and timeout
    try {
        return await Promise.race([mainOperation(), timeoutPromise]);
    } catch (err: any) {
        if (err.message === 'SUPPLIER_TIMEOUT') {
            console.warn('findOrCreateSupplierFromCustomer: Timeout reached, using fallback supplier');
            return fallbackSupplier;
        }
        // For any other error, also return fallback to not block the user
        console.error('findOrCreateSupplierFromCustomer: Error, using fallback supplier', err);
        return fallbackSupplier;
    }
};


// --- GENERIC PARAMETERS (Brands, Categories, etc) ---

const getTable = async (table: string, cacheKey: string) => {
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            const res = await supabase.from(table).select('*');
            if (res.error) throw res.error;
            return res.data || [];
        });
    }, METADATA_TTL);
};

const addItem = async (table: string, data: any, cacheKey: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: newItem, error } = await supabase.from(table).insert([data]).select().single();
    if (error) {
        console.error(`Error adding item to ${table}:`, error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.CREATE,
        getTableEntityType(table),
        newItem.id,
        `Item adicionado em ${table}. Dados: ${JSON.stringify(data)}`,
        userId,
        userName
    );

    clearCache([cacheKey]);
    return newItem;
};

const updateItem = async (table: string, data: any, cacheKey: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: updated, error } = await supabase.from(table).update(data).eq('id', data.id).select().single();
    if (error) {
        console.error(`Error updating item in ${table}:`, error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.UPDATE,
        getTableEntityType(table),
        data.id,
        `Item atualizado em ${table}. Alterações: ${JSON.stringify(data)}`,
        userId,
        userName
    );

    clearCache([cacheKey]);
    return updated;
};

const deleteItem = async (table: string, id: string, cacheKey: string, userId: string = 'system', userName: string = 'Sistema') => {
    // Pegar infos antes de deletar
    const { data: item } = await supabase.from(table).select('*').eq('id', id).single();

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;

    if (item) {
        await addAuditLog(
            AuditActionType.DELETE,
            getTableEntityType(table),
            id,
            `Item excluído de ${table}: ${item.name || item.id}`,
            userId,
            userName
        );
    }

    clearCache([cacheKey]);
};

const getTableEntityType = (table: string): AuditEntityType => {
    switch (table) {
        case 'products': return AuditEntityType.PRODUCT;
        case 'customers': return AuditEntityType.CUSTOMER;
        case 'suppliers': return AuditEntityType.SUPPLIER;
        case 'sales': return AuditEntityType.SALE;
        case 'purchase_orders': return AuditEntityType.PURCHASE_ORDER;
        case 'users': return AuditEntityType.USER;
        case 'payment_methods': return AuditEntityType.PAYMENT_METHOD;
        case 'brands': return AuditEntityType.BRAND;
        case 'categories': return AuditEntityType.CATEGORY;
        case 'product_models': return AuditEntityType.PRODUCT_MODEL;
        case 'grades': return AuditEntityType.GRADE;
        case 'grade_values': return AuditEntityType.GRADE_VALUE;
        case 'warranties': return AuditEntityType.WARRANTY;
        case 'storage_locations': return AuditEntityType.STORAGE_LOCATION;
        case 'product_conditions': return AuditEntityType.CONDITION;
        case 'receipt_terms': return AuditEntityType.RECEIPT_TERM;
        case 'permission_profiles': return AuditEntityType.PERMISSION_PROFILE;
        case 'cash_sessions': return AuditEntityType.CASH_SESSION;
        default: return AuditEntityType.PRODUCT;
    }
}

export const getBrands = () => getTable('brands', 'brands');
export const addBrand = (data: any, userId?: string, userName?: string) => addItem('brands', data, 'brands', userId, userName);
export const updateBrand = (data: any, userId?: string, userName?: string) => updateItem('brands', data, 'brands', userId, userName);
export const deleteBrand = (id: string, userId?: string, userName?: string) => deleteItem('brands', id, 'brands', userId, userName);

export const getCategories = async () => {
    return fetchWithCache('categories', async () => {
        const { data, error } = await supabase.from('categories').select('*');
        if (error) throw error;
        return (data || []).map((c: any) => ({
            ...c,
            brandId: c.brand_id
        }));
    });
};
export const addCategory = async (data: any, userId?: string, userName?: string) => {
    const payloads = [
        { name: data.name, brand_id: data.brandId },
        { name: data.name }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            return await addItem('categories', payload, 'categories', userId, userName);
        } catch (error: any) {
            console.error('addCategory: Error:', error.message);
            lastError = error;
            if (!error.message?.includes('column') && !error.message?.includes('schema')) {
                throw error;
            }
        }
    }
    throw lastError;
};
export const updateCategory = async (data: any, userId?: string, userName?: string) => {
    const payloads = [
        { id: data.id, name: data.name, brand_id: data.brandId },
        { id: data.id, name: data.name }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            return await updateItem('categories', payload, 'categories', userId, userName);
        } catch (error: any) {
            lastError = error;
            if (!error.message?.includes('column') && !error.message?.includes('schema')) {
                throw error;
            }
        }
    }
    throw lastError;
};
export const deleteCategory = (id: string, userId?: string, userName?: string) => deleteItem('categories', id, 'categories', userId, userName);

export const getProductModels = async () => {
    return fetchWithCache('product_models', async () => {
        const { data, error } = await supabase.from('product_models').select('*');
        if (error) throw error;
        return (data || []).map((m: any) => ({
            ...m,
            categoryId: m.category_id,
            imageUrl: m.image_url || m.imageUrl || m.photo_url || m.photoUrl
        }));
    });
};
export const addProductModel = async (data: any, userId?: string, userName?: string) => {
    // Try progressively simpler payloads until one works
    const payloads = [
        { name: data.name, category_id: data.categoryId, image_url: data.imageUrl },
        { name: data.name, category_id: data.categoryId, imageUrl: data.imageUrl },
        { name: data.name, category_id: data.categoryId, photo_url: data.imageUrl },
        { name: data.name, category_id: data.categoryId },
        { name: data.name }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            return await addItem('product_models', payload, 'product_models', userId, userName);
        } catch (error: any) {
            console.error('addProductModel: Error:', error.message);
            lastError = error;
            // Continue to next simpler payload if column doesn't exist
            if (!error.message?.includes('column') && !error.message?.includes('schema')) {
                throw error; // If error is not about missing column, rethrow
            }
        }
    }
    throw lastError;
};
export const updateProductModel = async (data: any, userId?: string, userName?: string) => {
    const payloads = [
        { id: data.id, name: data.name, category_id: data.categoryId, image_url: data.imageUrl },
        { id: data.id, name: data.name, category_id: data.categoryId, imageUrl: data.imageUrl },
        { id: data.id, name: data.name, category_id: data.categoryId, photo_url: data.imageUrl },
        { id: data.id, name: data.name, category_id: data.categoryId },
        { id: data.id, name: data.name }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            return await updateItem('product_models', payload, 'product_models', userId, userName);
        } catch (error: any) {
            lastError = error;
            if (!error.message?.includes('column') && !error.message?.includes('schema')) {
                throw error;
            }
        }
    }
    throw lastError;
};
export const deleteProductModel = (id: string, userId?: string, userName?: string) => deleteItem('product_models', id, 'product_models', userId, userName);

export const getGrades = () => getTable('grades', 'grades');
export const addGrade = (data: any, userId?: string, userName?: string) => addItem('grades', data, 'grades', userId, userName);
export const updateGrade = (data: any, userId?: string, userName?: string) => updateItem('grades', data, 'grades', userId, userName);
export const deleteGrade = (id: string, userId?: string, userName?: string) => deleteItem('grades', id, 'grades', userId, userName);

export const getGradeValues = async () => {
    return fetchWithCache('grade_values', async () => {
        const { data, error } = await supabase.from('grade_values').select('*');
        if (error) throw error;
        return (data || []).map((v: any) => ({
            ...v,
            gradeId: v.grade_id
        }));
    });
};
export const addGradeValue = async (data: any, userId?: string, userName?: string) => {
    const payloads = [
        { name: data.name, grade_id: data.gradeId },
        { name: data.name }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            return await addItem('grade_values', payload, 'grade_values', userId, userName);
        } catch (error: any) {
            console.error('addGradeValue: Error:', error.message);
            lastError = error;
            if (!error.message?.includes('column') && !error.message?.includes('schema')) {
                throw error;
            }
        }
    }
    throw lastError;
};
export const updateGradeValue = async (data: any, userId?: string, userName?: string) => {
    const payloads = [
        { id: data.id, name: data.name, grade_id: data.gradeId },
        { id: data.id, name: data.name }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            return await updateItem('grade_values', payload, 'grade_values', userId, userName);
        } catch (error: any) {
            lastError = error;
            if (!error.message?.includes('column') && !error.message?.includes('schema')) {
                throw error;
            }
        }
    }
    throw lastError;
};
export const deleteGradeValue = (id: string, userId?: string, userName?: string) => deleteItem('grade_values', id, 'grade_values', userId, userName);

export const getReceiptTerms = async () => {
    return fetchWithCache('receipt_terms', async () => {
        const { data, error } = await supabase.from('receipt_terms').select('*');
        if (error) throw error;
        return (data || []).map((term: any) => ({
            ...term,
            // DB has camelCase columns, but we ensure consistency
            warrantyTerm: term.warrantyTerm || term.warranty_term,
            warrantyExclusions: term.warrantyExclusions || term.warranty_exclusions,
            imageRights: term.imageRights || term.image_rights || term.imageRights
        }));
    });
};

export const addReceiptTerm = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // DB has camelCase columns for this table. We try camelCase first.
    const payloads = [
        {
            name: data.name || '',
            warrantyTerm: data.warrantyTerm || null,
            warrantyExclusions: data.warrantyExclusions || null,
            imageRights: data.imageRights || null,
        },
        {
            name: data.name || '',
            warranty_term: data.warrantyTerm || null,
            warranty_exclusions: data.warrantyExclusions || null,
            image_rights: data.imageRights || null,
        }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            const { data: newItem, error } = await supabase.from('receipt_terms').insert([payload]).select().single();

            if (error) {
                lastError = error;
                if (error.code === '42703' || error.message?.includes('column')) continue;
                throw error;
            }

            if (newItem) {
                addAuditLog(
                    AuditActionType.CREATE,
                    AuditEntityType.PRODUCT,
                    newItem.id,
                    `Termo de recebimento adicionado: ${newItem.name}`,
                    userId,
                    userName
                ).catch(e => console.warn('Audit log failed:', e));
            }

            clearCache(['receipt_terms']);
            return newItem;
        } catch (error: any) {
            console.error('addReceiptTerm Error:', error.message);
            lastError = error;
            if (error.message?.includes('column') || error.message?.includes('schema')) continue;
            throw error;
        }
    }
    throw lastError || new Error('Falha ao adicionar termo.');
};

export const updateReceiptTerm = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const { id, ...rest } = data;

    const payloads = [
        {
            name: rest.name || '',
            warrantyTerm: rest.warrantyTerm || null,
            warrantyExclusions: rest.warrantyExclusions || null,
            imageRights: rest.imageRights || null,
        },
        {
            name: rest.name || '',
            warranty_term: rest.warrantyTerm || null,
            warranty_exclusions: rest.warrantyExclusions || null,
            image_rights: rest.imageRights || null,
        }
    ];

    let lastError: any = null;
    for (const payload of payloads) {
        try {
            const { data: updated, error } = await supabase.from('receipt_terms').update(payload).eq('id', id).select().single();

            if (error) {
                lastError = error;
                if (error.code === '42703' || error.message?.includes('column')) continue;
                throw error;
            }

            addAuditLog(
                AuditActionType.UPDATE,
                AuditEntityType.PRODUCT,
                id,
                `Termo de recebimento atualizado: ${rest.name || 'Sem nome'}`,
                userId,
                userName
            ).catch(e => console.warn('Audit log failed:', e));

            clearCache(['receipt_terms']);
            return updated;
        } catch (error: any) {
            console.error('updateReceiptTerm Error:', error.message);
            lastError = error;
            if (error.message?.includes('column') || error.message?.includes('schema')) continue;
            throw error;
        }
    }
    throw lastError || new Error('Falha ao atualizar termo.');
};

export const deleteReceiptTerm = (id: string, userId: string = 'system', userName: string = 'Sistema') => deleteItem('receipt_terms', id, 'receipt_terms', userId, userName);

const serializePaymentMethod = (data: any) => {
    const { type, active, allowInternalNotes, config, variations, ...rest } = data;
    const safeConfig = config || {};
    return {
        ...rest,
        config: {
            ...safeConfig,
            _meta_type: type || 'cash',
            _meta_active: active !== undefined ? active : true,
            _meta_allow_internal_notes: allowInternalNotes !== undefined ? allowInternalNotes : false,
            _meta_variations: variations || []
        }
    };
};

const deserializePaymentMethod = (data: any) => {
    if (!data) return data;
    return {
        ...data,
        type: data.config?._meta_type || 'cash',
        active: data.config?._meta_active !== undefined ? data.config._meta_active : true,
        allowInternalNotes: data.config?._meta_allow_internal_notes !== undefined ? data.config._meta_allow_internal_notes : false,
        variations: data.config?._meta_variations || []
    };
};

export const getPaymentMethods = async () => {
    return fetchWithCache('payment_methods', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('payment_methods').select('*');
            if (error) throw error;
            return data;
        }).then(data => {
            if (!data || data.length === 0) {
                return [
                    { id: '1', name: 'Dinheiro', type: 'cash', active: true },
                    { id: '2', name: 'Pix', type: 'cash', active: true },
                    { id: '3', name: 'Cartão Débito', type: 'card', active: true },
                    { id: '4', name: 'Cartão Crédito', type: 'card', active: true },
                    { id: '5', name: 'Crediário', type: 'cash', active: true }
                ];
            }
            return data.map(deserializePaymentMethod);
        });
    });
};

export const addPaymentMethod = (data: any, userId?: string, userName?: string) => {
    const paymentMethod = serializePaymentMethod(data);
    if (!paymentMethod.id) {
        paymentMethod.id = crypto.randomUUID();
    }
    return addItem('payment_methods', paymentMethod, 'payment_methods', userId, userName);
};
export const updatePaymentMethod = (data: any, userId?: string, userName?: string) => updateItem('payment_methods', serializePaymentMethod(data), 'payment_methods', userId, userName);
export const deletePaymentMethod = (id: string, userId?: string, userName?: string) => deleteItem('payment_methods', id, 'payment_methods', userId, userName);

export const getProductConditions = () => getTable('product_conditions', 'product_conditions');
export const addProductCondition = (data: any, userId?: string, userName?: string) => addItem('product_conditions', data, 'product_conditions', userId, userName);
export const updateProductCondition = (data: any, userId?: string, userName?: string) => updateItem('product_conditions', data, 'product_conditions', userId, userName);
export const deleteProductCondition = (id: string, userId?: string, userName?: string) => deleteItem('product_conditions', id, 'product_conditions', userId, userName);

export const getStorageLocations = () => getTable('storage_locations', 'storage_locations');
export const addStorageLocation = (data: any, userId?: string, userName?: string) => addItem('storage_locations', data, 'storage_locations', userId, userName);
export const updateStorageLocation = (data: any, userId?: string, userName?: string) => updateItem('storage_locations', data, 'storage_locations', userId, userName);
export const deleteStorageLocation = (id: string, userId?: string, userName?: string) => deleteItem('storage_locations', id, 'storage_locations', userId, userName);

export const getWarranties = async () => {
    return fetchWithCache('warranties', async () => {
        const { data, error } = await supabase.from('warranties').select('*');
        if (error) throw error;
        return (data || []).map((w: any) => ({
            ...w,
            warrantyTerm: w.warrantyTerm || w.warranty_term
        }));
    });
};
export const addWarranty = (data: any, userId?: string, userName?: string) =>
    addItem('warranties', { name: data.name, warranty_term: data.warrantyTerm }, 'warranties', userId, userName);
export const updateWarranty = (data: any, userId?: string, userName?: string) =>
    updateItem('warranties', { id: data.id, name: data.name, warranty_term: data.warrantyTerm }, 'warranties', userId, userName);
export const deleteWarranty = (id: string, userId?: string, userName?: string) => deleteItem('warranties', id, 'warranties', userId, userName);

// --- COMPANY INFO ---

export const getCompanyInfo = async (): Promise<CompanyInfo | null> => {
    return fetchWithCache('company_info', async () => {
        return fetchWithRetry(async () => {
            const res = await supabase.from('company_info').select('*').single();
            if (res.error) return { name: 'iStorePro' } as CompanyInfo;
            const row = res.data;
            // Map snake_case database columns to camelCase frontend fields
            // Use localStorage fallback for logo if column doesn't exist
            const logoFromDb = row.logo_url || row.logoUrl;
            const logoFromStorage = typeof window !== 'undefined' ? localStorage.getItem('company_logo_fallback') : null;
            return {
                id: row.id,
                name: row.name,
                razaoSocial: row.razao_social,
                logoUrl: logoFromDb || logoFromStorage || '',
                cnpj: row.cnpj,
                inscricaoEstadual: row.inscricao_estadual,
                address: row.address,
                numero: row.numero,
                complemento: row.complemento,
                bairro: row.bairro,
                city: row.city,
                state: row.state,
                cep: row.cep,
                email: row.email,
                whatsapp: row.whatsapp,
                instagram: row.instagram,
            } as CompanyInfo;
        }, 2, 500);
    });
};

export const updateCompanyInfo = async (data: CompanyInfo, userId: string = 'system', userName: string = 'Sistema') => {
    // Map camelCase frontend fields to snake_case database columns
    const payload: Record<string, any> = {
        name: data.name,
        razao_social: data.razaoSocial,
        logo_url: data.logoUrl ?? null, // Allow null/empty to remove logo
        cnpj: data.cnpj,
        inscricao_estadual: data.inscricaoEstadual,
        address: data.address,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        city: data.city,
        state: data.state,
        cep: data.cep,
        email: data.email,
        whatsapp: data.whatsapp,
        instagram: data.instagram,
    };

    // Include id if present in data
    if (data.id) {
        payload.id = data.id;
    } else {
        // Try to find existing record to update
        const { data: existing } = await supabase.from('company_info').select('id').limit(1).maybeSingle();
        if (existing) {
            payload.id = existing.id;
        } else {
            // If no record, generate new valid UUID
            payload.id = crypto.randomUUID();
        }
    }

    // Try to save with logo_url first
    let result = await supabase.from('company_info').upsert(payload).select().single();

    // If logo_url column doesn't exist, retry without it
    if (result.error && result.error.message.includes('logo_url')) {
        console.warn('logo_url column not found, saving without logo');
        const { logo_url, ...payloadWithoutLogo } = payload;
        // Store logo in localStorage as fallback
        if (data.logoUrl) {
            localStorage.setItem('company_logo_fallback', data.logoUrl);
        } else {
            localStorage.removeItem('company_logo_fallback');
        }
        result = await supabase.from('company_info').upsert(payloadWithoutLogo).select().single();
    } else if (!result.error) {
        // Logo was saved to DB successfully, clear localStorage fallback
        localStorage.removeItem('company_logo_fallback');
    }

    if (result.error) throw result.error;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.USER, // Or a dynamic SYSTEM entity
        result.data.id, // Use the ID from the updated record
        `Dados da empresa atualizados por ${userName}`,
        userId,
        userName
    );

    clearCache(['company_info']);
    window.dispatchEvent(new CustomEvent('companyInfoUpdated'));
    return result.data;
};

// --- PURCHASE ORDERS ---

// Helper to map database row to TypeScript PurchaseOrder interface
const mapPurchaseOrder = (row: any): PurchaseOrder => {
    return {
        id: row.id,
        displayId: row.displayId || row.display_id,
        locatorId: row.locatorId || row.locator_id || '',
        purchaseDate: row.purchaseDate || row.purchase_date || row.createdAt || row.created_at || getNowISO(),
        origin: row.origin || 'Compra Nacional',
        purchaseTerm: row.purchaseTerm || row.purchase_term,
        supplierId: row.supplierId || row.supplier_id || '',
        supplierName: row.supplierName || row.supplier_name || '',
        items: (row.items || []).map((item: any) => ({
            ...item,
            id: item.id || crypto.randomUUID(),
        })),
        total: Number(row.total) || 0,
        additionalCost: Number(row.additionalCost || row.additional_cost) || 0,
        stockStatus: row.stockStatus || row.stock_status || 'Pendente',
        financialStatus: row.financialStatus || row.financial_status || 'Pendente',
        status: row.status,
        createdAt: row.createdAt || row.created_at || getNowISO(),
        createdBy: row.createdBy || row.created_by || 'Sistema',
        isCustomerPurchase: row.isCustomerPurchase || row.is_customer_purchase || false,
        observations: row.observations,
    };
};

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    return fetchWithCache('purchase_orders', async () => {
        const { data, error } = await supabase.from('purchase_orders').select('*').order('createdAt', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapPurchaseOrder);
    });
};

export const addPurchaseOrder = async (data: any) => {
    const items = (data.items || []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unitCost || 0),
        additionalUnitCost: Number(item.additionalUnitCost || 0),
        finalUnitCost: Number(item.finalUnitCost || 0),
    }));

    let observations = data.observations || '';
    if (data.purchaseTerm) {
        observations = observations ? `${observations} | Termo: ${data.purchaseTerm}` : `Termo: ${data.purchaseTerm}`;
    }

    // Generate displayId and locatorId
    const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true });
    const displayId = (count || 0) + 1;
    const locatorId = `L${Date.now()}`;
    const now = getNowISO();

    // Convert purchaseDate from datetime-local format to proper ISO with timezone
    // The input comes as YYYY-MM-DDTHH:mm (local time), we need to handle it correctly
    let purchaseDateISO = now;
    if (data.purchaseDate) {
        // If purchaseDate doesn't have timezone info, assume it's in Brazil timezone (GMT-3)
        if (!data.purchaseDate.includes('Z') && !data.purchaseDate.includes('+') && !data.purchaseDate.includes('-', 10)) {
            // Append Brazil timezone offset
            purchaseDateISO = new Date(data.purchaseDate).toISOString();
        } else {
            purchaseDateISO = data.purchaseDate;
        }
    }

    // Include all fields needed for the purchase_orders table
    const poData: any = {
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        items,
        observations,
        status: data.status || 'Pendente',
        total: data.total || 0,
        additionalCost: data.additionalCost || 0,
        purchaseDate: purchaseDateISO,
        origin: data.origin || 'Compra Nacional',
        displayId,
        locatorId,
        stockStatus: data.stockStatus || 'Pendente',
        financialStatus: data.financialStatus || 'Pendente',
        createdAt: now,
        createdBy: data.createdBy || 'Sistema',
        isCustomerPurchase: data.isCustomerPurchase || false,
    };

    const { data: newPO, error } = await supabase.from('purchase_orders').insert([poData]).select().single();
    if (error) {
        console.error("Error adding purchase order:", JSON.stringify(error, null, 2));
        throw error;
    }

    // TELEGRAM NOTIFICATION: Notify about new purchase order
    if (poData.stockStatus === 'Lançado no Estoque' || poData.status === 'Finalizada') {
        const userName = poData.createdBy || 'Usuário';
        const supplierName = poData.supplierName || 'Fornecedor Desconhecido';
        const total = poData.total || 0;

        await sendPurchaseNotification({
            userName,
            supplierName,
            total
        });
    }

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.PURCHASE_ORDER,
        newPO.id,
        "Nova compra criada",
        poData.createdBy,
        poData.createdBy
    );

    clearCache(['purchase_orders']);
    return mapPurchaseOrder(newPO);
};

export const updatePurchaseOrder = async (data: any) => {
    const { id, purchaseTerm, createdAt, displayId, locatorId, ...rest } = data; // Remove fields that shouldn't change or cause issues

    // Date handling similar to addPurchaseOrder
    let purchaseDateISO = rest.purchaseDate;
    if (purchaseDateISO) {
        if (!purchaseDateISO.includes('Z') && !purchaseDateISO.includes('+') && !purchaseDateISO.includes('T')) {
            // Handle if just date? Or if datetime-local format without timezone
            purchaseDateISO = new Date(purchaseDateISO).toISOString();
        } else if (purchaseDateISO.includes('T') && !purchaseDateISO.includes('Z') && !purchaseDateISO.includes('+') && !purchaseDateISO.slice(10).includes('-')) {
            // datetime-local format (YYYY-MM-DDTHH:mm)
            purchaseDateISO = new Date(purchaseDateISO).toISOString();
        }
    }

    const payload: any = {
        supplierId: rest.supplierId,
        supplierName: rest.supplierName,
        items: rest.items,
        observations: rest.observations,
        status: rest.status,
        total: rest.total,
        additionalCost: rest.additionalCost,
        purchaseDate: purchaseDateISO,
        origin: rest.origin,
        stockStatus: rest.stockStatus,
        financialStatus: rest.financialStatus,
        isCustomerPurchase: rest.isCustomerPurchase,
    };

    // Remove undefined
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const { data: updated, error } = await supabase.from('purchase_orders').update(payload).eq('id', id).select().single();
    if (error) {
        console.error("Error updating purchase order:", error);
        throw error;
    }
    clearCache(['purchase_orders']);
    // Return mapped object
    return {
        ...updated,
        displayId: updated.displayId || updated.display_id || displayId, // ensure we return consistent data
        locatorId: updated.locatorId || updated.locator_id || locatorId,
    };
    // Actually simpler to just return updated and let caller refetch if needed, 
    // but the app expects the updated record.
};

export const deletePurchaseOrder = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    // Pegar infos da compra antes de deletar
    const { data: po } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
    if (!po) throw new Error("Compra não encontrada.");

    // Guard: Launched purchases cannot be deleted, only canceled.
    if (po.stockStatus === 'Lançado' || po.stockStatus === 'Parcialmente Lançado') {
        throw new Error("Esta compra já foi lançada no estoque e não pode ser excluída, apenas cancelada.");
    }

    // 1. Delete associated products if any (redundant if unlaunched, but safe)
    const { error: deleteProdError } = await supabase.from('products').delete().eq('purchaseOrderId', id);
    if (deleteProdError) {
        // If it fails (likely due to FK/Sold items, which shouldn't happen for unlaunched, but just in case)
        throw new Error("Não é possível excluir a compra pois existem vínculos ativos no banco de dados.");
    }

    // 2. Delete the Purchase Order
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
    if (error) throw error;

    await addAuditLog(
        AuditActionType.DELETE,
        AuditEntityType.PURCHASE_ORDER,
        id,
        `Compra não lançada excluída: #${po.displayId} - Fornecedor: ${po.supplierName} | Total: ${formatCurrency(po.total)}`,
        userId,
        userName
    );

    clearCache(['purchase_orders', 'products']);
};

export const cancelPurchaseOrder = async (id: string, reason: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: po } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
    if (!po) throw new Error("Compra não encontrada.");

    const isLaunched = po.stockStatus === 'Lançado' || po.stockStatus === 'Parcialmente Lançado';

    // 1. If launched, remove products from stock
    if (isLaunched) {
        try {
            // Attempt to delete all products associated with this PO
            // This will fail for products that were already sold due to FK constraints
            await supabase.from('products').delete().eq('purchaseOrderId', id);
        } catch (e: any) {
            // Catch error if some products are sold
            // In that case, we should at least zero out the stock of the NOT sold ones
            const { data: products } = await supabase.from('products').select('id').eq('purchaseOrderId', id);
            if (products && products.length > 0) {
                for (const prod of products) {
                    try {
                        // Try deleting each individually
                        await supabase.from('products').delete().eq('id', prod.id);
                    } catch (err) {
                        // If delete fails, it's sold. Zero out the stock record.
                        await supabase.from('products').update({ stock: 0 }).eq('id', prod.id);
                    }
                }
            }
        }
    }

    // 2. Update PO status to 'Cancelada'
    const { error } = await supabase.from('purchase_orders').update({
        status: 'Cancelada',
        stockStatus: 'Cancelada',
        cancellationReason: reason
    }).eq('id', id);

    if (error) throw error;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.PURCHASE_ORDER,
        id,
        `Compra cancelada: #${po.displayId} | Motivo: ${reason}`,
        userId,
        userName
    );

    clearCache(['purchase_orders', 'products']);
};

export const updatePurchaseFinancialStatus = async (id: string) => {
    const { data: po } = await supabase.from('purchase_orders').select('financialStatus').eq('id', id).single();
    if (po) {
        const newStatus = po.financialStatus === 'Pendente' ? 'Pago' : 'Pendente';
        const { data: updated } = await supabase.from('purchase_orders').update({ financialStatus: newStatus }).eq('id', id).select().single();
        clearCache(['purchase_orders']);
        return updated;
    }
};

export const revertPurchaseLaunch = async (id: string) => {
    // Optimistic update
    const { error: updateError } = await supabase.from('purchase_orders').update({ stockStatus: 'Pendente' }).eq('id', id);
    if (updateError) throw updateError;

    try {
        const { error: deleteError } = await supabase.from('products').delete().eq('purchaseOrderId', id);
        if (deleteError) throw deleteError;
    } catch (error: any) {
        // Rollback status update if delete fails (e.g. FK constraint)
        await supabase.from('purchase_orders').update({ stockStatus: 'Lançado' }).eq('id', id);

        if (error.code === '23503') { // Foreign key violation (Postgres)
            throw new Error('Não é possível reverter esta compra pois alguns produtos já foram vendidos.');
        }
        throw error;
    }

    clearCache(['purchase_orders', 'products']);
};

export const launchPurchaseToStock = async (purchaseOrderId: string, products: any[], launchedBy?: string) => {
    const now = getNowISO();

    // STEP 1: Get purchase order info (with timeout)
    let purchaseOrder: any = null;
    try {
        const poQuery = supabase.from('purchase_orders').select('displayId, createdBy, supplierId, supplierName, total').eq('id', purchaseOrderId).single();
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_PO')), 5000));
        const result = await Promise.race([poQuery, timeout]) as any;
        purchaseOrder = result.data;
        if (result.error) throw result.error;
    } catch (e: any) {
        if (e.message === 'TIMEOUT_PO') {
            throw new Error('O banco de dados não está respondendo. Verifique sua conexão com a internet.');
        }
        throw e;
    }

    const displayId = purchaseOrder?.displayId || '???';
    const createdBy = purchaseOrder?.createdBy || 'Sistema';
    const supplierName = purchaseOrder?.supplierName || 'N/A';
    const total = purchaseOrder?.total || 0;

    // STEP 2: Get current SKU count
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    let currentSkuCount = count || 0;

    const productsToInsert: any[] = [];
    const productsToReactivate: any[] = [];
    const blockedProducts: string[] = [];

    // STEP 3: Process each product
    for (const p of products) {
        const imei1 = p.imei1 || null;
        const imei2 = p.imei2 || null;
        const serialNumber = p.serialNumber || null;
        let existingProduct = null;

        if (imei1 || imei2 || serialNumber) {
            const orConditions = [];
            if (imei1) orConditions.push(`imei1.eq.${imei1}`, `imei2.eq.${imei1}`);
            if (imei2) orConditions.push(`imei1.eq.${imei2}`, `imei2.eq.${imei2}`);
            if (serialNumber) orConditions.push(`"serialNumber".eq.${serialNumber}`);

            if (orConditions.length > 0) {
                const { data: found } = await supabase
                    .from('products')
                    .select('*')
                    .or(orConditions.join(','))
                    .limit(1)
                    .maybeSingle();
                existingProduct = found;
            }
        } else {
            // GENERIC PRODUCT MERGING: Search for existing generic product with same attributes
            // Using model, condition, and prices as key identifiers for bulk products
            const { data: found } = await supabase
                .from('products')
                .select('*')
                .eq('model', p.model)
                .eq('condition', p.condition)
                .eq('costPrice', p.costPrice) // Match by cost price
                .eq('price', p.price)         // Match by sale price
                .is('imei1', null)
                .is('imei2', null)
                .is('serialNumber', null)
                .limit(20);

            existingProduct = found?.find(f => {
                const fVars = (f.variations || []).map((v: any) => `${v.gradeId}:${v.valueId}`).sort().join('|');
                const pVars = (p.variations || []).map((v: any) => `${v.gradeId}:${v.valueId}`).sort().join('|');
                return fVars === pVars;
            }) || null;
        }

        if (existingProduct) {
            // For generic products, we ALWAYS increment the existing stock, even if it's already > 0
            const isUnique = !!(imei1 || imei2 || serialNumber);

            if (isUnique && existingProduct.stock > 0) {
                blockedProducts.push(imei1 || imei2 || serialNumber || 'unknown');
            } else {
                const currentStock = Number(existingProduct.stock || 0);
                const quantityToAdd = Number(p.stock || 1);
                const newStock = currentStock + quantityToAdd;

                const newStockHistoryEntry = {
                    id: crypto.randomUUID(),
                    oldStock: currentStock,
                    newStock: newStock,
                    adjustment: quantityToAdd,
                    reason: isUnique ? 'Recompra' : 'Entrada de Lote',
                    relatedId: purchaseOrderId,
                    timestamp: now,
                    changedBy: createdBy,
                    details: `${isUnique ? 'Recompra' : 'Entrada de mercadoria'} via Compra #${displayId}${supplierName !== 'N/A' ? ` - ${supplierName}` : ''}`
                };
                const existingHistory = existingProduct.stockHistory || [];
                productsToReactivate.push({
                    id: existingProduct.id,
                    updates: {
                        stock: newStock,
                        costPrice: p.costPrice,
                        price: p.price,
                        wholesalePrice: p.wholesalePrice,
                        condition: p.condition,
                        storageLocation: p.storageLocation,
                        warranty: p.warranty,
                        batteryHealth: p.batteryHealth,
                        supplierId: p.supplierId,
                        origin: p.origin,
                        purchaseOrderId: purchaseOrderId,
                        purchaseItemId: p.purchaseItemId,
                        updatedAt: now,
                        stockHistory: [...existingHistory, newStockHistoryEntry]
                    }
                });
            }
        } else {
            currentSkuCount++;
            const { stockHistory, priceHistory, purchaseItemId, ...productDataWithoutHistory } = p;
            const initialStockHistory = [{
                id: crypto.randomUUID(),
                oldStock: 0,
                newStock: p.stock || 1,
                adjustment: p.stock || 1,
                reason: 'Lançamento de Compra',
                relatedId: purchaseOrderId,
                timestamp: now,
                changedBy: createdBy,
                details: `Compra #${displayId}${supplierName !== 'N/A' ? ` - ${supplierName}` : ''}`
            }];

            productsToInsert.push({
                ...productDataWithoutHistory,
                imei1: imei1 || null,
                imei2: imei2 || null,
                serialNumber: serialNumber || null,
                purchaseOrderId,
                purchaseItemId,
                createdAt: now,
                updatedAt: now,
                sku: p.sku || `#${currentSkuCount}`,
                stockHistory: initialStockHistory,
                priceHistory: []
            });
        }
    }

    if (blockedProducts.length === products.length && products.length > 0) {
        throw new Error(`Todos os produtos já estão em estoque: ${blockedProducts.join(', ')}`);
    }

    if (productsToReactivate.length > 0) {
        for (const { id, updates } of productsToReactivate) {
            await supabase.from('products').update(updates).eq('id', id);
        }
    }

    if (productsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('products').insert(productsToInsert);
        if (insertError) throw insertError;
    }

    await supabase.from('purchase_orders').update({ stockStatus: 'Lançado' }).eq('id', purchaseOrderId);

    // TELEGRAM NOTIFICATION
    await sendPurchaseNotification({
        userName: launchedBy || createdBy,
        supplierName,
        total
    });
    clearCache(['products', 'purchase_orders']);
};

// --- AUDIT ---

export const getAuditLogs = async (): Promise<AuditLog[]> => {
    return fetchWithCache('audit_logs', async () => {
        const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
    });
};

// GOVERNANCE: Immutable audit logs for cash register operations
export const getCashRegisterAuditLogs = async (cashRegisterId?: string) => {
    let query = supabase
        .from('cash_register_audit_logs')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(500);

    if (cashRegisterId) {
        query = query.eq('cash_register_id', cashRegisterId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching cash register audit logs:', error);
        throw error;
    }
    return data || [];
};

// --- BACKUP & RESTORE ---

const BACKUP_TABLES = [
    'permissions_profiles',
    'users',
    'brands',
    'categories',
    'product_models',
    'grades',
    'grade_values',
    'suppliers',
    'customers',
    'purchase_orders',
    'products',
    'sales',
    'cash_sessions',
    'product_conditions',
    'storage_locations',
    'warranties',
    'payment_methods',
    'receipt_terms',
    'company_info',
    'audit_logs'
];

export const getFullBackup = async () => {
    const backupData: Record<string, any[]> = {};

    for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            console.error(`Error backing up table ${table}:`, error);
            throw error;
        }
        backupData[table] = data || [];
    }

    return backupData;
};

export const restoreFullBackup = async (backupData: Record<string, any[]>, userId: string, userName: string) => {
    // 1. Validate - check if all keys exist
    for (const table of BACKUP_TABLES) {
        if (!Array.isArray(backupData[table])) {
            throw new Error(`O arquivo de backup é inválido ou está corrompido (tabela ${table} ausente).`);
        }
    }

    // 2. Clear all tables in order (to handle constraints)
    // Deleting in reverse order of dependencies is usually safer
    const tablesToDelete = [...BACKUP_TABLES].reverse();

    for (const table of tablesToDelete) {
        // Use 'id' for most tables, 'name' for others like company_info
        const filterField = table === 'company_info' ? 'name' : 'id';
        const { error } = await supabase.from(table).delete().neq(filterField, '00000000-0000-0000-0000-000000000000');
        if (error) {
            console.error(`Error clearing table ${table}:`, error);
        }
    }

    // 3. Restore data
    for (const table of BACKUP_TABLES) {
        if (backupData[table].length > 0) {
            const { error } = await supabase.from(table).insert(backupData[table]);
            if (error) {
                console.error(`Error restoring table ${table}:`, error);
                throw new Error(`Erro ao restaurar a tabela ${table}: ${error.message}`);
            }
        }
    }

    // 4. Audit the restore
    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.USER,
        userId,
        'Sistema restaurado a partir de backup completo.',
        userId,
        userName
    );

    // 5. Clear all caches
    clearCache(Object.keys(cache)); // Use current cache keys
    // Since cache is local to the module, we can just clear it if we export a way
};

// --- SERVICES ---

export const getServices = async (): Promise<Service[]> => {
    return fetchWithCache('services', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('services').select('*').order('name');
            if (error) throw error;
            return (data || []).map((s: any) => ({
                ...s,
                createdAt: s.created_at || s.createdAt,
                updatedAt: s.updated_at || s.updatedAt,
            }));
        });
    });
};

export const addService = async (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newService = {
        ...data,
        id: crypto.randomUUID(),
        created_at: getNowISO(),
        updated_at: getNowISO()
    };

    const { data: service, error } = await supabase.from('services').insert([newService]).select().single();

    if (error) {
        console.error('Error adding service:', error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.SERVICE,
        service.id,
        `Serviço criado: ${service.name}`
    );

    clearCache(['services']);
    return {
        ...service,
        createdAt: service.created_at,
        updatedAt: service.updated_at
    };
};

export const updateService = async (id: string, data: Partial<Service>) => {
    const updatePayload: any = { ...data, updated_at: getNowISO() };
    delete updatePayload.id;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;

    const { data: updated, error } = await supabase
        .from('services')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating service:', error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SERVICE,
        id,
        `Serviço atualizado: ${updated.name}`
    );

    clearCache(['services']);
    return {
        ...updated,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
    };
};

export const deleteService = async (id: string) => {
    const { data: service } = await supabase.from('services').select('*').eq('id', id).single();

    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) {
        console.error('Error deleting service:', error);
        throw error;
    }

    if (service) {
        await addAuditLog(
            AuditActionType.DELETE,
            AuditEntityType.SERVICE,
            id,
            `Serviço excluído: ${service.name}`
        );
    }

    clearCache(['services']);
};


// --- SERVICE ORDERS ---

export const getServiceOrders = async (): Promise<ServiceOrder[]> => {
    return fetchWithCache('service_orders', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('service_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map((so: any) => ({
                ...so,
                customerId: so.customer_id,
                customerName: so.customer_name,
                deviceModel: so.device_model,
                serialNumber: so.serial_number,
                patternLock: so.pattern_lock,
                defectDescription: so.defect_description,
                technicalReport: so.technical_report,
                createdAt: so.created_at,
                updatedAt: so.updated_at,
                responsibleId: so.responsible_id,
                responsibleName: so.responsible_name,
                entryDate: so.entry_date,
                exitDate: so.exit_date,
            }));
        });
    });
};

export const getServiceOrder = async (id: string): Promise<ServiceOrder | null> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('service_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;

        return {
            ...data,
            customerId: data.customer_id,
            customerName: data.customer_name,
            deviceModel: data.device_model,
            serialNumber: data.serial_number,
            patternLock: data.pattern_lock,
            defectDescription: data.defect_description,
            technicalReport: data.technical_report,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            responsibleId: data.responsible_id,
            responsibleName: data.responsible_name,
            entryDate: data.entry_date,
            exitDate: data.exit_date,
        };
    });
};

export const addServiceOrder = async (data: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'displayId'>) => {
    // Generate Display ID
    const { count } = await supabase.from('service_orders').select('*', { count: 'exact', head: true });
    const nextDisplayId = (count || 0) + 1;

    const newOrder: any = {
        ...data,
        display_id: nextDisplayId,
        customer_id: data.customerId,
        customer_name: data.customerName,
        device_model: data.deviceModel,
        serial_number: data.serialNumber,
        pattern_lock: data.patternLock,
        defect_description: data.defectDescription,
        technical_report: data.technicalReport,
        responsible_id: data.responsibleId,
        responsible_name: data.responsibleName,
        entry_date: data.entryDate,
        exit_date: data.exitDate,
    };

    // Remove camelCase keys that were added by ...data
    const camelCaseKeys = [
        'customerId', 'customerName', 'deviceModel', 'serialNumber',
        'patternLock', 'defectDescription', 'technicalReport',
        'responsibleId', 'responsibleName', 'entryDate', 'exitDate'
    ];
    camelCaseKeys.forEach(key => delete newOrder[key]);

    // Clean undefined keys
    const payload = Object.fromEntries(
        Object.entries(newOrder).filter(([_, v]) => v !== undefined)
    );

    const { data: created, error } = await supabase.from('service_orders').insert([payload]).select().single();

    if (error) throw error;

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.SERVICE_ORDER,
        created.id,
        `OS #${created.display_id} criada para ${created.customer_name}`
    );

    clearCache(['service_orders']);
    return {
        ...created,
        customerId: created.customer_id,
        customerName: created.customer_name,
        deviceModel: created.device_model,
        serialNumber: created.serial_number,
        patternLock: created.pattern_lock,
        defectDescription: created.defect_description,
        technicalReport: created.technical_report,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
        responsibleId: created.responsible_id,
        responsibleName: created.responsible_name,
        entryDate: created.entry_date,
        exitDate: created.exit_date,
    };
};

export const updateServiceOrder = async (id: string, data: Partial<ServiceOrder>) => {
    const updatePayload: any = { ...data, updated_at: getNowISO() };

    // Map to snake_case
    if (data.customerId) updatePayload.customer_id = data.customerId;
    if (data.customerName) updatePayload.customer_name = data.customerName;
    if (data.deviceModel) updatePayload.device_model = data.deviceModel;
    if (data.serialNumber) updatePayload.serial_number = data.serialNumber;
    if (data.patternLock) updatePayload.pattern_lock = data.patternLock;
    if (data.defectDescription) updatePayload.defect_description = data.defectDescription;
    if (data.technicalReport) updatePayload.technical_report = data.technicalReport;
    if (data.responsibleId) updatePayload.responsible_id = data.responsibleId;
    if (data.responsibleName) updatePayload.responsible_name = data.responsibleName;
    if (data.entryDate) updatePayload.entry_date = data.entryDate;
    if (data.exitDate) updatePayload.exit_date = data.exitDate;

    // Remove camelCase keys
    delete updatePayload.customerId;
    delete updatePayload.customerName;
    delete updatePayload.deviceModel;
    delete updatePayload.serialNumber;
    delete updatePayload.patternLock;
    delete updatePayload.defectDescription;
    delete updatePayload.technicalReport;
    delete updatePayload.responsibleId;
    delete updatePayload.responsibleName;
    delete updatePayload.entryDate;
    delete updatePayload.exitDate;
    delete updatePayload.id;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;
    delete updatePayload.displayId;

    const { data: updated, error } = await supabase
        .from('service_orders')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SERVICE_ORDER,
        id,
        `OS #${updated.display_id} atualizada`
    );

    clearCache(['service_orders']);
    return {
        ...updated,
        customerId: updated.customer_id,
        customerName: updated.customer_name,
        deviceModel: updated.device_model,
        serialNumber: updated.serial_number,
        patternLock: updated.pattern_lock,
        defectDescription: updated.defect_description,
        technicalReport: updated.technical_report,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        responsibleId: updated.responsible_id,
        responsibleName: updated.responsible_name,
        entryDate: updated.entry_date,
        exitDate: updated.exit_date,
    };
};


// ===== CATALOG MODULE =====

const mapCatalogItem = (item: any): CatalogItem => ({
    id: item.id,
    productId: item.product_id,
    displayOrder: item.display_order || 0,
    costPrice: item.cost_price || 0,
    salePrice: item.sale_price || 0,
    cardPrice: item.card_price || 0,
    installments: item.installments || 1,
    section: item.section || 'Destaques',
    isActive: item.is_active ?? true,
    imageUrl: item.image_url,
    imageUrls: (item.image_urls && item.image_urls.length > 0) ? item.image_urls : (item.image_url ? [item.image_url] : []),
    condition: item.condition || 'Novo',
    batteryHealth: item.battery_health,
    productName: item.product_name || '',
    productBrand: item.product_brand || '',
    productCategory: item.product_category || '',
    description: item.description || '',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
});

export const getCatalogItems = async (): Promise<CatalogItem[]> => {
    return fetchWithCache('catalog_items', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;
            return (data || []).map(mapCatalogItem);
        });
    });
};

export const getActiveCatalogItems = async (): Promise<CatalogItem[]> => {
    return fetchWithCache('catalog_items_active', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (error) throw error;
            return (data || []).map(mapCatalogItem);
        });
    });
};

export const addCatalogItem = async (item: Partial<CatalogItem>): Promise<CatalogItem> => {
    return fetchWithRetry(async () => {
        const payload: any = {
            product_id: item.productId,
            display_order: item.displayOrder || 0,
            cost_price: item.costPrice || 0,
            sale_price: item.salePrice || 0,
            card_price: item.cardPrice || 0,
            installments: item.installments || 1,
            section: item.section || 'Destaques',
            is_active: item.isActive ?? true,
            image_url: item.imageUrl || (item.imageUrls && item.imageUrls[0]) || null,
            image_urls: item.imageUrls || [],
            condition: item.condition || 'Novo',
            battery_health: item.batteryHealth,
            product_name: item.productName || '',
            product_brand: item.productBrand || '',
            product_category: item.productCategory || '',
            description: item.description || '',
        };

        const { data, error } = await supabase
            .from('catalog_items')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
        return mapCatalogItem(data);
    });
};

export const updateCatalogItem = async (id: string, updates: Partial<CatalogItem>): Promise<CatalogItem> => {
    return fetchWithRetry(async () => {
        const payload: any = {};
        if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
        if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
        if (updates.salePrice !== undefined) payload.sale_price = updates.salePrice;
        if (updates.cardPrice !== undefined) payload.card_price = updates.cardPrice;
        if (updates.installments !== undefined) payload.installments = updates.installments;
        if (updates.section !== undefined) payload.section = updates.section;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.imageUrls !== undefined) { payload.image_urls = updates.imageUrls; payload.image_url = updates.imageUrls[0] || null; }
        if (updates.condition !== undefined) payload.condition = updates.condition;
        if (updates.batteryHealth !== undefined) payload.battery_health = updates.batteryHealth;
        if (updates.productName !== undefined) payload.product_name = updates.productName;
        if (updates.productBrand !== undefined) payload.product_brand = updates.productBrand;
        if (updates.productCategory !== undefined) payload.product_category = updates.productCategory;
        if (updates.description !== undefined) payload.description = updates.description;
        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('catalog_items')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
        return mapCatalogItem(data);
    });
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
    return fetchWithRetry(async () => {
        const { error } = await supabase
            .from('catalog_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
    });
};

// ======= Catalog Sections =======
export const getCatalogSections = async (): Promise<{ id: string; name: string; emoji: string; displayOrder: number; sortOrder?: string }[]> => {
    // Try to fetch from Supabase
    try {
        const { data, error } = await supabase
            .from('catalog_sections')
            .select('*')
            .order('display_order', { ascending: true });

        if (!error && data) {
            return data.map(d => ({
                id: d.id,
                name: d.name,
                emoji: d.emoji,
                displayOrder: d.display_order,
                sortOrder: d.sort_order || 'newest'
            }));
        }
    } catch (e) {
        console.error('Error fetching sections from Supabase:', e);
    }

    // Fallback to local storage
    const stored = localStorage.getItem('catalog_sections');
    if (stored) return JSON.parse(stored);

    return [
        { id: '1', name: 'Destaques', emoji: '⭐', displayOrder: 0, sortOrder: 'newest' },
        { id: '2', name: 'iPhones Seminovos', emoji: '📱', displayOrder: 1, sortOrder: 'newest' },
        { id: '3', name: 'iPhones Lacrados', emoji: '📦', displayOrder: 2, sortOrder: 'newest' },
        { id: '4', name: 'Acessórios Apple', emoji: '🎧', displayOrder: 3, sortOrder: 'newest' },
        { id: '5', name: 'Promoções', emoji: '🔥', displayOrder: 4, sortOrder: 'newest' },
        { id: '6', name: 'Outros', emoji: '📋', displayOrder: 5, sortOrder: 'newest' },
    ];
};

export const addCatalogSection = async (section: { name: string; emoji: string; displayOrder: number; sortOrder?: string }) => {
    try {
        const { data, error } = await supabase
            .from('catalog_sections')
            .insert([{
                name: section.name,
                emoji: section.emoji,
                display_order: section.displayOrder,
                sort_order: section.sortOrder || 'newest'
            }])
            .select()
            .single();

        if (!error && data) {
            return {
                id: data.id,
                name: data.name,
                emoji: data.emoji,
                displayOrder: data.display_order,
                sortOrder: data.sort_order
            };
        }
    } catch (e) {
        console.error('Error adding section to Supabase:', e);
    }

    // Fallback
    const sections = await getCatalogSections();
    const newSection = { ...section, id: crypto.randomUUID(), sortOrder: section.sortOrder || 'newest' };
    const updated = [...sections, newSection];
    localStorage.setItem('catalog_sections', JSON.stringify(updated));
    return newSection;
};

export const updateCatalogSection = async (id: string, updates: Partial<{ name: string; emoji: string; displayOrder: number; sortOrder: string }>) => {
    try {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
        if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
        if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

        const { error } = await supabase
            .from('catalog_sections')
            .update(dbUpdates)
            .eq('id', id);

        if (error) throw error;
    } catch (e) {
        console.error('Error updating section in Supabase:', e);
    }

    // Fallback
    const sections = await getCatalogSections();
    const updated = sections.map(s => s.id === id ? { ...s, ...updates } : s);
    localStorage.setItem('catalog_sections', JSON.stringify(updated));
};

export const deleteCatalogSection = async (id: string) => {
    return fetchWithRetry(async () => {
        const { error } = await supabase.from('catalog_sections').delete().eq('id', id);
        if (error) throw error;
        clearCache(['catalog_sections']);
    });
};

// ============================================================
// --- FINANCIAL MODULE ---
// ============================================================

export const getTransactionCategories = async (): Promise<TransactionCategory[]> => {
    return fetchWithCache('transaction_categories', async () => {
        const { data, error } = await supabase
            .from('transaction_categories')
            .select('*')
            .order('group_name')
            .order('name');
        if (error) throw error;
        return (data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            group_name: c.group_name,
            icon: c.icon,
            color: c.color,
            is_default: c.is_default,
            company_id: c.company_id,
        }));
    }, METADATA_TTL);
};

export const getFinancialTransactions = async (filters: {
    type?: 'income' | 'expense';
    status?: 'pending' | 'paid' | 'overdue';
    startDate?: string;
    endDate?: string;
    search?: string;
    categoryId?: string;
} = {}): Promise<FinancialTransaction[]> => {
    return fetchWithRetry(async () => {
        let query = supabase
            .from('financial_transactions')
            .select('*, category:transaction_categories(*)')
            .order('due_date', { ascending: false });

        if (filters.type) query = query.eq('type', filters.type);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
        if (filters.startDate) query = query.gte('due_date', filters.startDate);
        if (filters.endDate) query = query.lte('due_date', filters.endDate);
        if (filters.search) query = query.or(`description.ilike.%${filters.search}%,entity_name.ilike.%${filters.search}%`);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((t: any) => ({
            id: t.id,
            type: t.type,
            description: t.description,
            amount: Number(t.amount),
            category_id: t.category_id,
            category: t.category ? {
                id: t.category.id,
                name: t.category.name,
                type: t.category.type,
                group_name: t.category.group_name,
                icon: t.category.icon,
                color: t.category.color,
            } : undefined,
            due_date: t.due_date,
            payment_date: t.payment_date,
            status: t.status,
            payment_method: t.payment_method,
            entity_name: t.entity_name,
            entity_type: t.entity_type,
            is_recurring: t.is_recurring || false,
            recurrence_interval: t.recurrence_interval,
            attachment_url: t.attachment_url,
            notes: t.notes,
            company_id: t.company_id,
            created_by: t.created_by,
            created_at: t.created_at,
            updated_at: t.updated_at,
        }));
    });
};

export const getCustomer = async (id: string): Promise<Customer | null> => {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

export const getSale = async (id: string): Promise<Sale | null> => {
    try {
        const { data, error } = await supabase.from('sales').select('*').eq('id', id).maybeSingle();
        if (error) {
            console.error(`getSale error for id ${id}:`, error);
            return null;
        }
        return data ? mapSale(data) : null;
    } catch (e) {
        console.error(`getSale exception for id ${id}:`, e);
        return null;
    }
};



export const addFinancialTransaction = async (data: Partial<FinancialTransaction>, userId?: string, userName?: string): Promise<FinancialTransaction> => {
    const now = getNowISO();
    const record = {
        type: data.type,
        description: data.description,
        amount: data.amount,
        category_id: data.category_id,
        due_date: data.due_date,
        payment_date: data.payment_date || null,
        status: data.status || 'pending',
        payment_method: data.payment_method || null,
        entity_name: data.entity_name || null,
        entity_type: data.entity_type || null,
        is_recurring: data.is_recurring || false,
        recurrence_interval: data.recurrence_interval || null,
        notes: data.notes || null,
        created_by: userId || null,
        created_at: now,
        updated_at: now,
    };

    const { data: inserted, error } = await supabase
        .from('financial_transactions')
        .insert(record)
        .select('*, category:transaction_categories(*)')
        .single();

    if (error) throw error;

    await addAuditLog(
        'create' as AuditActionType,
        'financial_transaction' as AuditEntityType,
        inserted.id,
        `Transação "${data.description}" (${data.type === 'income' ? 'Receita' : 'Despesa'}) de R$ ${Number(data.amount).toFixed(2)} criada`,
        userId || 'system',
        userName || 'Sistema'
    );

    return {
        ...inserted,
        amount: Number(inserted.amount),
        is_recurring: inserted.is_recurring || false,
    };
};

export const updateFinancialTransaction = async (data: Partial<FinancialTransaction> & { id: string }, userId?: string, userName?: string): Promise<FinancialTransaction> => {
    const now = getNowISO();
    const { id, category, ...rest } = data;

    const record: any = { ...rest, updated_at: now };
    delete record.created_at;
    delete record.created_by;

    const { data: updated, error } = await supabase
        .from('financial_transactions')
        .update(record)
        .eq('id', id)
        .select('*, category:transaction_categories(*)')
        .single();

    if (error) throw error;

    await addAuditLog(
        'update' as AuditActionType,
        'financial_transaction' as AuditEntityType,
        id,
        `Transação "${updated.description}" atualizada`,
        userId || 'system',
        userName || 'Sistema'
    );

    return {
        ...updated,
        amount: Number(updated.amount),
        is_recurring: updated.is_recurring || false,
    };
};

export const deleteFinancialTransaction = async (id: string, userId?: string, userName?: string): Promise<void> => {
    // Get data before deleting for audit
    const { data: existing } = await supabase
        .from('financial_transactions')
        .select('description, type, amount')
        .eq('id', id)
        .single();

    const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', id);

    if (error) throw error;

    if (existing) {
        await addAuditLog(
            'delete' as AuditActionType,
            'financial_transaction' as AuditEntityType,
            id,
            `Transação "${existing.description}" (${existing.type === 'income' ? 'Receita' : 'Despesa'}) de R$ ${Number(existing.amount).toFixed(2)} excluída`,
            userId || 'system',
            userName || 'Sistema'
        );
    }
};

// ============================================================
// CRM MODULE — Pipeline de Vendas Kanban
// ============================================================

export const getCrmDeals = async (filters?: {
    status_column?: CrmColumn;
    priority?: string;
    assigned_to?: string;
    search?: string;
}): Promise<CrmDeal[]> => {
    let query = supabase
        .from('crm_deals')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (filters?.status_column) query = query.eq('status_column', filters.status_column);
    if (filters?.priority) query = query.eq('priority', filters.priority);
    if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
    if (filters?.search) {
        query = query.or(`client_name.ilike.%${filters.search}%,product_interest.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(d => ({
        id: d.id,
        client_id: d.client_id,
        client_name: d.client_name,
        client_phone: d.client_phone,
        status_column: d.status_column as CrmColumn,
        value: Number(d.value || 0),
        product_interest: d.product_interest,
        priority: d.priority,
        origin: d.origin,
        assigned_to: d.assigned_to,
        assigned_to_name: d.assigned_to_name,
        follow_up_date: d.follow_up_date,
        notes: d.notes,
        sort_order: d.sort_order || 0,
        company_id: d.company_id,
        created_by: d.created_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
    }));
};

export const addCrmDeal = async (data: Partial<CrmDeal>, userId?: string, userName?: string): Promise<CrmDeal> => {
    const insert: any = {
        client_id: data.client_id || null,
        client_name: data.client_name || '',
        client_phone: data.client_phone || null,
        status_column: data.status_column || 'new_leads',
        value: data.value || 0,
        product_interest: data.product_interest || null,
        priority: data.priority || 'warm',
        origin: data.origin || null,
        assigned_to: data.assigned_to || userId || null,
        assigned_to_name: data.assigned_to_name || userName || null,
        follow_up_date: data.follow_up_date || null,
        notes: data.notes || null,
        sort_order: data.sort_order || 0,
        created_by: userId || null,
    };

    const { data: result, error } = await supabase
        .from('crm_deals')
        .insert(insert)
        .select()
        .single();

    if (error) throw error;
    return result as CrmDeal;
};

export const updateCrmDeal = async (id: string, updates: Partial<CrmDeal>, userId?: string, userName?: string): Promise<void> => {
    const dbUpdates: any = { updated_at: new Date().toISOString() };

    if (updates.client_id !== undefined) dbUpdates.client_id = updates.client_id;
    if (updates.client_name !== undefined) dbUpdates.client_name = updates.client_name;
    if (updates.client_phone !== undefined) dbUpdates.client_phone = updates.client_phone;
    if (updates.status_column !== undefined) dbUpdates.status_column = updates.status_column;
    if (updates.value !== undefined) dbUpdates.value = updates.value;
    if (updates.product_interest !== undefined) dbUpdates.product_interest = updates.product_interest;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.origin !== undefined) dbUpdates.origin = updates.origin;
    if (updates.assigned_to !== undefined) dbUpdates.assigned_to = updates.assigned_to;
    if (updates.assigned_to_name !== undefined) dbUpdates.assigned_to_name = updates.assigned_to_name;
    if (updates.follow_up_date !== undefined) dbUpdates.follow_up_date = updates.follow_up_date;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.sort_order !== undefined) dbUpdates.sort_order = updates.sort_order;

    const { error } = await supabase
        .from('crm_deals')
        .update(dbUpdates)
        .eq('id', id);

    if (error) throw error;
};

export const deleteCrmDeal = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getCrmActivities = async (dealId: string): Promise<CrmActivity[]> => {
    const { data, error } = await supabase
        .from('crm_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as CrmActivity[];
};

export const addCrmActivity = async (data: Partial<CrmActivity>): Promise<CrmActivity> => {
    const { data: result, error } = await supabase
        .from('crm_activities')
        .insert({
            deal_id: data.deal_id,
            type: data.type || 'note',
            content: data.content,
            created_by: data.created_by || null,
            created_by_name: data.created_by_name || null,
        })
        .select()
        .single();

    if (error) throw error;
    return result as CrmActivity;
};
// ============================================================
// CREDIT MANAGEMENT
// ============================================================

export const getCreditSettings = async (): Promise<CreditSettings> => {
    try {
        const { data, error } = await supabase
            .from('credit_settings')
            .select('*')
            .single();

        if (error || !data) {
            // Return default if not found
            return { id: 'default', defaultInterestRate: 0, lateFeePercentage: 0 };
        }
        return {
            id: data.id,
            defaultInterestRate: Number(data.default_interest_rate),
            lateFeePercentage: Number(data.late_fee_percentage)
        };
    } catch (error) {
        console.error('Error getting credit settings:', error);
        return { id: 'default', defaultInterestRate: 0, lateFeePercentage: 0 };
    }
};

export const updateCreditSettings = async (settings: Partial<CreditSettings>): Promise<CreditSettings> => {
    // Check if exists
    const current = await getCreditSettings();

    const payload = {
        default_interest_rate: settings.defaultInterestRate,
        late_fee_percentage: settings.lateFeePercentage
    };

    if (current.id === 'default' || !current.id) {
        const { data, error } = await supabase
            .from('credit_settings')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id,
            defaultInterestRate: Number(data.default_interest_rate),
            lateFeePercentage: Number(data.late_fee_percentage)
        };
    } else {
        const { data, error } = await supabase
            .from('credit_settings')
            .update(payload)
            .eq('id', current.id)
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id,
            defaultInterestRate: Number(data.default_interest_rate),
            lateFeePercentage: Number(data.late_fee_percentage)
        };
    }
};

export const addCreditInstallments = async (installments: Partial<CreditInstallment>[]): Promise<CreditInstallment[]> => {
    const payload = installments.map(i => ({
        id: i.id, // Include ID if provided
        sale_id: i.saleId,
        customer_id: i.customerId,
        installment_number: i.installmentNumber,
        total_installments: i.totalInstallments,
        due_date: i.dueDate,
        amount: i.amount,
        status: i.status,
        amount_paid: i.amountPaid,
        interest_applied: i.interestApplied,
        penalty_applied: i.penaltyApplied
    }));

    const { data, error } = await supabase
        .from('credit_installments')
        .insert(payload)
        .select();

    if (error) {
        console.error('Error adding credit installments:', error);
        throw error;
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        saleId: d.sale_id,
        customerId: d.customer_id,
        installmentNumber: d.installment_number,
        totalInstallments: d.total_installments,
        dueDate: d.due_date,
        amount: Number(d.amount),
        status: d.status,
        amountPaid: Number(d.amount_paid),
        interestApplied: Number(d.interest_applied),
        penaltyApplied: Number(d.penalty_applied),
        paidAt: d.paid_at,
        paymentMethod: d.payment_method,
        observation: d.observation
    }));
};

export const getCreditInstallments = async (): Promise<CreditInstallment[]> => {
    const { data, error } = await supabase
        .from('credit_installments')
        .select(`
            *,
            customer:customers(name, phone),
            sale:sales(id)
        `)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error getting credit installments:', error);
        return [];
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        saleId: d.sale_id,
        saleDisplayId: d.sale?.id || d.sale_id, // Usar o ID da venda como DisplayId já que display_id não existe
        customerId: d.customer_id,
        customerName: d.customer?.name || 'Cliente',
        customerPhone: d.customer?.phone || '',
        installmentNumber: d.installment_number,
        totalInstallments: d.total_installments,
        dueDate: d.due_date,
        amount: Number(d.amount),
        status: d.status,
        amountPaid: Number(d.amount_paid),
        interestApplied: Number(d.interest_applied),
        penaltyApplied: Number(d.penalty_applied),
        amortizationValue: Number(d.amortization_value || 0),
        interestValue: Number(d.interest_value || 0),
        remainingBalance: Number(d.remaining_balance || 0),
        paidAt: d.paid_at,
        paymentMethod: d.payment_method,
        observation: d.observation
    }));
};

export const payInstallment = async (
    id: string,
    amountPaid: number,
    method: string,
    penalty: number,
    observation?: string,
    userId?: string,
    userName?: string
): Promise<CreditInstallment> => {
    const now = new Date().toISOString();

    // First get current installment to check total and get customer name
    const { data: current, error: fetchError } = await supabase
        .from('credit_installments')
        .select('*, customer:customers(name, id)')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    const totalDue = Number(current.amount) + penalty;
    const newAmountPaid = Number(current.amount_paid) + amountPaid;

    // Determine status
    // Floating point comparison safety margin
    let newStatus = 'pending';
    if (newAmountPaid >= totalDue - 0.01) {
        newStatus = 'paid';
    } else if (newAmountPaid > 0) {
        newStatus = 'partial';
    }

    const { data, error } = await supabase
        .from('credit_installments')
        .update({
            amount_paid: newAmountPaid,
            penalty_applied: penalty, // This overwrites, assumes penalty is passed as total accumulate or just for this payment?
            // Implementation detail: for simplicity let's assume penalty is set once or accumulated. 
            // If partial payment, logic might be complex. 
            // ideally we simply update penalty_applied to what the user confirmed.
            status: newStatus,
            paid_at: now,
            payment_method: method,
            observation: observation
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // --- NEW: Amortization Logic (Regra 4) ---
    // valor_juros = saldo_devedor_atual × taxa_juros_percentual_parcela
    // valor_amortizacao = valor_parcela − valor_juros
    // saldo_devedor_atual = saldo_devedor_atual − valor_amortizacao

    try {
        if (current.sale_id) {
            const { data: sale } = await supabase
                .from('sales')
                .select('*')
                .eq('id', current.sale_id)
                .single();

            if (sale) {
                const interestRate = Number(sale.interest_rate || 0);
                const installmentsCount = Number(current.total_installments || 1);
                const ratePerInstallment = (interestRate / 100) / installmentsCount;

                let currentDebt = Number(sale.current_debt_balance || 0);

                // Recuperar saldo se for venda antiga
                if (currentDebt <= 0) {
                    const { data: installments } = await supabase
                        .from('credit_installments')
                        .select('amount, amount_paid')
                        .eq('sale_id', sale.id)
                        .in('status', ['pending', 'partial', 'overdue']);
                    currentDebt = (installments || []).reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.amount_paid)), 0);
                }

                const calculatedInterest = currentDebt * ratePerInstallment;

                // Amortização é o valor pago MENOS os juros calculados sobre o saldo
                const amortizationPart = Math.max(0, amountPaid - calculatedInterest);
                const newDebtBalance = Math.max(0, currentDebt - amortizationPart);

                await supabase.from('sales').update({
                    current_debt_balance: newDebtBalance
                }).eq('id', sale.id);

                // Update installment with amort/interest details of THIS payment
                await supabase.from('credit_installments').update({
                    interest_value: calculatedInterest,
                    amortization_value: amortizationPart,
                    remaining_balance: newDebtBalance
                }).eq('id', id);


                // Regra 6: Atualizar total credit_used do cliente baseado em TODOS os saldos devedores atuais
                if (current.customer_id) {
                    const newTotalUsed = await syncCustomerCreditLimit(current.customer_id);

                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.CUSTOMER,
                        current.customer_id,
                        `Pagamento efetuado: Amortizado ${formatCurrency(amortizationPart)} | Juros: ${formatCurrency(calculatedInterest)} | Novo total devedor: ${formatCurrency(newTotalUsed)}`,
                        userId,
                        userName
                    );
                }
            }
        }
    } catch (restorationError) {
        console.error('payInstallment: Amortization logic error:', restorationError);
    }
    // --- END Restore Credit ---

    // Create a FinancialTransaction for this payment ("Receita")
    // This is important for the cash register flow.
    try {
        // Find a suitable category for sales/credit
        const { data: categories } = await supabase
            .from('transaction_categories')
            .select('id, name')
            .eq('type', 'income')
            .limit(1);

        const categoryId = categories && categories.length > 0 ? categories[0].id : null;

        if (categoryId) {
            const customerName = current.customer?.name || 'Cliente Desconhecido';
            const description = `Recebimento Parc. ${current.installment_number}/${current.total_installments} - ${customerName}`;

            await addFinancialTransaction({
                type: 'income',
                description: description,
                amount: amountPaid,
                category_id: categoryId,
                due_date: now.split('T')[0],
                payment_date: now.split('T')[0],
                status: 'paid',
                payment_method: method,
                entity_name: customerName,
                is_recurring: false,
                notes: `Ref. Venda #${current.sale_id || '?'}. Obs: ${observation || ''}`
            }, userId, userName);
        } else {
            console.warn('payInstallment: No income category found, skipping financial transaction creation.');
        }
    } catch (ftError) {
        console.error('payInstallment: Error creating financial transaction:', ftError);
        // Do not fail the installment payment just because FT creation failed, but log it.
    }

    clearCache(['credit_installments', 'customers', 'financial_transactions']);

    return {
        id: data.id,
        saleId: data.sale_id,
        saleDisplayId: data.sale_id,
        customerId: data.customer_id,
        customerName: current.customer?.name || 'Cliente',
        customerPhone: current.customer?.phone || '',
        installmentNumber: data.installment_number,
        totalInstallments: data.total_installments,
        dueDate: data.due_date,
        amount: Number(data.amount),
        status: data.status,
        amountPaid: Number(data.amount_paid),
        interestApplied: Number(data.interest_applied),
        penaltyApplied: Number(data.penalty_applied),
        paidAt: data.paid_at,
        paymentMethod: data.payment_method,
        observation: data.observation
    };
};

// --- INVENTORY MOVEMENTS ---

export const getInventoryMovements = async (startDate?: string, endDate?: string): Promise<InventoryMovement[]> => {
    const cacheKey = `inventory_movements_${startDate || 'all'}_${endDate || 'all'}`;
    return fetchWithCache(cacheKey, async () => {
        let query = supabase
            .from('inventory_movements')
            .select('*')
            .order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as InventoryMovement[];
    }, CACHE_TTL);
};

export const createInventoryMovement = async (
    movement: {
        product_id: string;
        product_name: string;
        imei?: string;
        serial_number?: string;
        movement_type: 'entrada' | 'saida';
        quantity: number;
        reason: string;
        custom_reason?: string;
    },
    userId: string,
    userName: string
): Promise<InventoryMovement> => {
    // 1. Fetch current product to validate stock
    const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('id, stock, model, stockHistory')
        .eq('id', movement.product_id)
        .single();

    if (fetchErr || !product) throw new Error('Produto não encontrado.');

    // 2. Validate stock for outgoing movements
    if (movement.movement_type === 'saida' && product.stock < movement.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock}, Solicitado: ${movement.quantity}`);
    }

    // 3. Calculate new stock
    const newStock = movement.movement_type === 'saida'
        ? product.stock - movement.quantity
        : product.stock + movement.quantity;

    const now = getNowISO();
    const displayReason = movement.reason === 'Outro' && movement.custom_reason
        ? `Outro: ${movement.custom_reason}`
        : movement.reason;

    // 4. Insert movement record
    const { data: movementData, error: insertErr } = await supabase
        .from('inventory_movements')
        .insert({
            product_id: movement.product_id,
            product_name: movement.product_name,
            imei: movement.imei || null,
            serial_number: movement.serial_number || null,
            movement_type: movement.movement_type,
            quantity: movement.quantity,
            reason: displayReason,
            custom_reason: movement.custom_reason || null,
            user_id: userId,
            user_name: userName,
        })
        .select()
        .single();

    if (insertErr) throw insertErr;

    // 5. Update product stock + stockHistory
    const existingStockHistory = product.stockHistory || [];
    const newStockEntry = {
        id: crypto.randomUUID(),
        oldStock: product.stock,
        newStock: newStock,
        adjustment: movement.movement_type === 'saida' ? -movement.quantity : movement.quantity,
        reason: `Movimentação: ${displayReason}`,
        timestamp: now,
        changedBy: userName,
    };

    const { error: updateErr } = await supabase
        .from('products')
        .update({
            stock: newStock,
            updatedAt: now,
            stockHistory: [...existingStockHistory, newStockEntry],
        })
        .eq('id', movement.product_id);

    if (updateErr) throw updateErr;

    // 6. Audit log
    await addAuditLog(
        AuditActionType.STOCK_ADJUST,
        AuditEntityType.PRODUCT,
        movement.product_id,
        `Movimentação de estoque (${movement.movement_type === 'saida' ? 'Saída' : 'Entrada'}). Qtd: ${movement.quantity}. Motivo: ${displayReason}. Estoque: ${product.stock} → ${newStock}`,
        userId,
        userName
    );

    // 7. Clear caches
    clearCache(['products', 'inventory_movements']);

    return movementData as InventoryMovement;
};

export const getProductMovements = async (productId: string): Promise<InventoryMovement[]> => {
    const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as InventoryMovement[];
};
