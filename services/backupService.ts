/**
 * Serviço de Backup & Restore.
 * Extraído do mockApi.ts para modularização.
 */
import { supabase } from '../supabaseClient.ts';
import { AuditActionType, AuditEntityType } from '../types.ts';
import { clearCache, getAllCacheKeys } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

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
    clearCache(getAllCacheKeys()); // Use current cache keys
    // Since cache is local to the module, we can just clear it if we export a way
};
