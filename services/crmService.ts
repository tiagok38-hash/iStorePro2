
import { supabase } from '../supabaseClient.ts';
import { CrmDeal, CrmActivity, CrmColumn } from '../types.ts';

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
