
import { supabase } from '../supabaseClient.ts';
import { CashSession, AuditActionType, AuditEntityType } from '../types.ts';
import { getTodayDateString, getNowISO, formatDateTimeBR } from '../utils/dateUtils.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { fetchWithCache, fetchWithRetry, clearCache } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';
import { getProfile } from './authService.ts';
import { resolvePermissions } from './authService.ts';

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
            const today = getTodayDateString(); // YYYY-MM-DD in America/Sao_Paulo
            const staleSessions = mappedSessions.filter((s: any) => {
                const status = (s.status || '').toLowerCase();
                if (status === 'aberto') {
                    // Skip auto-close for admin-reopened sessions
                    if (s.reopenReason || s.reopenedAt) return false;

                    // Convert open_time (UTC ISO) to Brazil Date string
                    const sessionDate = new Date(s.openTime).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
                    return sessionDate < today;
                }
                return false;
            });

            if (staleSessions.length > 0) {
                // Fire-and-forget update to close them in DB
                (async () => {
                    // Update status to 'fechado' locally and in DB
                    for (const session of staleSessions) {
                        const sessionDay = new Date(session.openTime).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
                        // Final do dia em Brasília (23:59:59-03:00)
                        const autoCloseTime = `${sessionDay}T23:59:59.999-03:00`;

                        await supabase.from('cash_sessions').update({
                            status: 'fechado',
                            close_time: new Date(autoCloseTime).toISOString()
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
                        const sessionDay = new Date(s.openTime).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
                        return { ...s, status: 'fechado', closeTime: new Date(`${sessionDay}T23:59:59.999-03:00`).toISOString() };
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
    const today = getTodayDateString();

    // Define o intervalo de "hoje" no fuso de Brasília para busca no DB (UTC)
    const startOfDay = new Date(`${today}T00:00:00-03:00`).toISOString();
    const endOfDay = new Date(`${today}T23:59:59.999-03:00`).toISOString();

    const { data: existingSessions, error: checkError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('user_id', data.userId)
        .gte('open_time', startOfDay)
        .lte('open_time', endOfDay);

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
    const permissions = odId !== 'system' ? await resolvePermissions(odId) : {};
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin' || permissions?.canManageCompanyData === true;

    if (odId !== 'system') {
        const { data: existing } = await supabase.from('cash_sessions').select('user_id, status, open_time').eq('id', data.id).single();
        if (existing && !isCallingAdmin && existing.user_id !== odId) {
            throw new Error('Acesso NEGADO: Este caixa pertence a outro usuário.');
        }

        // GOVERNANCE: Reopening a closed cash register requires special permission
        if (existing?.status === 'fechado' && (data.status === 'aberto' || data.status === 'reaberto')) {
            const isOwnSessionToday = existing.user_id === odId &&
                new Date(existing.open_time).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === getTodayDateString();

            const canReopen = isCallingAdmin || permissions.canReopenCashRegister === true || isOwnSessionToday;
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
    const permissions = odId !== 'system' ? await resolvePermissions(odId) : {};
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin' || permissions?.canManageCompanyData === true;

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
