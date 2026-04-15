/**
 * Serviço de Autenticação, Usuários e Permissões.
 * Extraído do mockApi.ts para modularização.
 */
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient.ts';
import { User, PermissionProfile, AuditActionType, AuditEntityType } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache, getAllCacheKeys, fetchWithRetry } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

// --- PERMISSIONS HELPERS ---
export const resolvePermissions = async (userId: string): Promise<any> => {
    const profile = await getProfile(userId);
    if (!profile) return {};
    const allProfiles = await getPermissionProfiles();
    const userProfile = allProfiles.find(p => p.id === profile.permissionProfileId);
    return userProfile?.permissions || {};
};

// --- AUTH & USERS ---

export const login = async (email: string, password_param: string): Promise<User> => {
    if (!email || !password_param) throw new Error('E-mail e senha são obrigatórios.');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password_param,
    });

    if (authError) {
        if (authError.message.includes('Email not confirmed')) {
            throw new Error('Seu e-mail ainda não foi confirmado. Por favor, verifique sua caixa de entrada e clique no link de confirmação.');
        }
        console.error('authService: Auth error:', authError);
        throw new Error(authError.message);
    }

    if (!authData.user) throw new Error('Usuário não encontrado.');

    // Garantir que o email está confirmado se a configuração estiver ativa no Supabase
    if (!authData.user.email_confirmed_at) {
        // Enviar novamente o email de confirmação se necessário ou apenas avisar
        throw new Error('Seu e-mail ainda não foi confirmado. Por favor, verifique sua caixa de entrada.');
    }

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
    clearCache(getAllCacheKeys());
};

export const getProfile = async (userId: string): Promise<User | null> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error) {
            console.error('authService: getProfile error:', error);
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

    const { data: userCompanyId } = await supabase.rpc('get_my_company_id');

    // 1. Create entry in Auth
    const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                name: data.name,
                company_id: userCompanyId,
                permissionProfileId: data.permissionProfileId
            }
        }
    });

    if (authError) {
        console.error('authService: Erro no signUp:', authError);

        // Check for disabled signups in Supabase
        if (authError.message.includes('Signups not allowed') || authError.message.includes('signup_disabled')) {
            throw new Error('A criação de novos usuários está desativada no seu projeto Supabase. Por favor, acesse o painel do Supabase > Authentication > Settings e ative a opção "Allow new users to sign up".');
        }

        if (authError.message.includes('already registered') || (authError.status === 422 && authError.message.includes('email'))) {
            throw new Error('Este e-mail já está cadastrado no sistema de autenticação (pode pertencer a um usuário antigo/excluído). Por favor, use um e-mail diferente ou remova o usuário antigo do Auth do Supabase.');
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
            // Self-update
            const { error: authError } = await supabase.auth.updateUser({
                password: data.password
            });
            if (authError) {
                console.error('authService: Auth password update error:', authError);
                throw authError;
            }
        } else {
            // Update another user's password using the RPC function
            const { error: rpcError } = await supabase.rpc('admin_update_user_password', {
                target_user_id: data.id,
                new_password: data.password
            });
            
            if (rpcError) {
                console.error('authService: RPC admin password update error:', rpcError);
                throw new Error(`Falha ao alterar a senha: ${rpcError.message}. Certifique-se de executar o script SQL de atualização de senha no Supabase.`);
            }
        }
    }

    // 2. Prepare data for the public.users table update
    const { id, password, createdAt, ...updateFields } = data;

    const { data: updated, error } = await supabase
        .from('users')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('authService: Error updating user profile:', error);
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

// --- PASSWORD RECOVERY ---

export const sendPasswordResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
};

export const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
        password: newPassword
    });
    if (error) throw error;
};

export const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
            emailRedirectTo: `${window.location.origin}/login`,
        },
    });
    if (error) throw error;
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
