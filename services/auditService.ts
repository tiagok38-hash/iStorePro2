/**
 * Serviço de Auditoria — Logs de auditoria do sistema.
 * Extraído do mockApi.ts para modularização.
 */
import { supabase } from '../supabaseClient.ts';
import { AuditActionType, AuditEntityType, AuditLog } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache, fetchWithRetry } from './cacheUtils.ts';

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

// --- AUDIT QUERIES ---
export const getAuditLogs = async (): Promise<AuditLog[]> => {
    return fetchWithCache('audit_logs', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500);
            if (error) throw error;
            return data || [];
        });
    });
};

export const getBulkUpdateLogs = async (): Promise<AuditLog[]> => {
    return fetchWithCache('bulk_update_logs', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('audit_logs')
                .select('*')
                .in('action', ['BULK_UPDATE_PRICE', 'BULK_UPDATE_LOCATION'])
                .order('timestamp', { ascending: false })
                .limit(200);
            if (error) throw error;
            return data || [];
        });
    });
};

// GOVERNANCE: Immutable audit logs for cash register operations
export const getCashRegisterAuditLogs = async (cashRegisterId?: string) => {
    let query = supabase
        .from('cash_register_audit_logs')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(200);

    if (cashRegisterId) {
        query = query.eq('cash_register_id', cashRegisterId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching cash register audit logs:', error);
        return [];
    }
    return data || [];
};
