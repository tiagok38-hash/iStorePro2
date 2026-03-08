
import { supabase } from '../supabaseClient.ts';
import { TransactionCategory, FinancialTransaction, Customer, Sale, AuditActionType, AuditEntityType } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, METADATA_TTL, fetchWithRetry } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';
import { mapSale } from './mockApi.ts';

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
