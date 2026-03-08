
import { supabase } from '../supabaseClient.ts';
import { Supplier, Customer, AuditActionType, AuditEntityType } from '../types.ts';
import { fetchWithCache, fetchWithRetry, clearCache } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

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

export const mapSupplier = (s: any): Supplier => ({
    ...s,
    contactPerson: s.contact_person,
    avatarUrl: s.avatar_url,
    linkedCustomerId: s.linked_customer_id,
    instagram: s.instagram,
    address: s.address
});

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
