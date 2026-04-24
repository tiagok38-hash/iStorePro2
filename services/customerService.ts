
import { supabase } from '../supabaseClient.ts';
import { Customer, TradeInEntry, AuditActionType, AuditEntityType } from '../types.ts';
import { fetchWithCache, fetchWithRetry, clearCache } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

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
    contact2: c.contact2,
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

// Mapped fields list. Including avatar_url despite size concerns as it is required for functionality.
const CUSTOMER_COLUMNS = 'id, name, email, phone, contact2, cpf, rg, birth_date, createdAt, is_blocked, custom_tag, instagram, cep, street, numero, complemento, bairro, city, state, avatar_url, active, credit_limit, credit_used, allow_credit';

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

            let { data, error } = await query;
            if (error && (error.code === '42703' || error.code === 'PGRST204') && error.message?.includes('contact2')) {
                // Retry sem a nova coluna contact2 caso o banco ainda não tenha sido atualizado
                console.warn("Retrying getCustomers sem a coluna contact2...");
                const fallbackColumns = CUSTOMER_COLUMNS.replace(', contact2', '');
                let fallbackQuery = supabase
                    .from('customers')
                    .select(fallbackColumns)
                    .order('name', { ascending: true })
                    .limit(3000);
                if (onlyActive) fallbackQuery = fallbackQuery.eq('active', true);
                
                const retryResult = await fallbackQuery;
                data = retryResult.data as any;
                error = retryResult.error;
            }

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
        let query = supabase
            .from('customers')
            .select(CUSTOMER_COLUMNS)
            .eq('active', true) // Search only active customers
            .or(`name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`)
            .limit(50);
            
        let { data, error } = await query;
        if (error && (error.code === '42703' || error.code === 'PGRST204') && error.message?.includes('contact2')) {
            console.warn("Retrying searchCustomers sem a coluna contact2...");
            const fallbackColumns = CUSTOMER_COLUMNS.replace(', contact2', '');
            const retryResult = await supabase
                .from('customers')
                .select(fallbackColumns)
                .eq('active', true)
                .or(`name.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%`)
                .limit(50);
            data = retryResult.data as any;
            error = retryResult.error;
        }
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
        const { data: users } = await supabase.from('users').select('id, name');
        const userMap = (users || []).reduce((acc: any, u: any) => ({ ...acc, [u.id]: u.name }), {});

        const derivedHistory: TradeInEntry[] = [];

        sales.forEach((sale: any) => {
            if (sale.payments && Array.isArray(sale.payments)) {
                sale.payments.forEach((p: any) => {
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

    const payload: any = {
        name: data.name.trim(), // Ensure trimmed name
        phone: data.phone
    };

    if (data.email !== undefined) payload.email = data.email;
    if (data.contact2 !== undefined) payload.contact2 = data.contact2;
    if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
    if (data.cpf !== undefined) payload.cpf = data.cpf;
    if (data.rg !== undefined) payload.rg = data.rg;
    if (data.birthDate !== undefined) payload.birth_date = data.birthDate;
    if (data.isBlocked !== undefined) payload.is_blocked = data.isBlocked;
    if (data.customTag !== undefined) payload.custom_tag = data.customTag;
    if (data.instagram !== undefined) payload.instagram = data.instagram;
    if (data.active !== undefined) payload.active = data.active;
    if (data.credit_limit !== undefined) payload.credit_limit = data.credit_limit;
    if (data.allow_credit !== undefined) payload.allow_credit = data.allow_credit;
    if (data.credit_used !== undefined) payload.credit_used = data.credit_used;

    if (data.address) {
        if (data.address.zip !== undefined) payload.cep = data.address.zip;
        if (data.address.street !== undefined) payload.street = data.address.street;
        if (data.address.number !== undefined) payload.numero = data.address.number;
        if (data.address.complement !== undefined) payload.complemento = data.address.complement;
        if (data.address.neighborhood !== undefined) payload.bairro = data.address.neighborhood;
        if (data.address.city !== undefined) payload.city = data.address.city;
        if (data.address.state !== undefined) payload.state = data.address.state;
    }

    if (payload.cpf) {
        const { data: existingCpf } = await supabase
            .from('customers')
            .select('id, name')
            .eq('cpf', payload.cpf)
            .maybeSingle();

        if (existingCpf) {
            throw new Error(`Já existe um cliente cadastrado com este CPF: ${existingCpf.name}`);
        }
    }

    if (payload.rg) {
        try {
            const { data: existingRg, error: rgError } = await supabase
                .from('customers')
                .select('id, name')
                .eq('rg', payload.rg)
                .maybeSingle();

            if (rgError && rgError.code !== 'PGRST100') throw rgError;

            if (existingRg) {
                throw new Error(`Já existe um cliente cadastrado com este RG: ${existingRg.name}`);
            }
        } catch (err: any) {
            if ((err.code !== '42703' && err.code !== 'PGRST204') && !err.message?.includes('rg')) {
                console.warn('Error checking RG duplication:', err);
                if (err.message && err.message.includes('Já existe um cliente')) throw err;
            }
        }
    }

    let result = await supabase.from('customers').insert([payload]).select().single();

    if (result.error && (result.error.code === '42703' || result.error.code === 'PGRST204')) {
        const msg = result.error.message || '';
        let retry = false;

        if (msg.includes('instagram')) { delete payload.instagram; retry = true; }
        if (msg.includes('contact2')) { delete payload.contact2; retry = true; }
        if (msg.includes('rg')) { delete payload.rg; retry = true; }
        if (msg.includes('cpf')) { delete payload.cpf; retry = true; }
        if (msg.includes('birth_date')) { delete payload.birth_date; retry = true; }
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

export const syncCustomerCreditLimit = async (customerId: string) => {
    try {
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('id, current_debt_balance, payments')
            .eq('customer_id', customerId)
            .in('status', ['Finalizada', 'Editada']);

        if (salesError) throw salesError;

        let totalUsed = 0;

        for (const sale of (sales || [])) {
            const payments = Array.isArray(sale.payments) ? sale.payments : (typeof sale.payments === 'string' ? JSON.parse(sale.payments) : []);
            const hasCredit = payments.some((p: any) => p.method === 'Crediário' || p.method === 'Crediario');
            if (!hasCredit) continue;

            let debt = Number(sale.current_debt_balance || 0);

            if (debt <= 0) {
                const { data: installments } = await supabase
                    .from('credit_installments')
                    .select('amount, amount_paid')
                    .eq('sale_id', sale.id)
                    .in('status', ['pending', 'partial', 'overdue']);

                debt = (installments || []).reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.amount_paid)), 0);

                if (debt > 0) {
                    await supabase.from('sales').update({ current_debt_balance: debt }).eq('id', sale.id);
                }
            }

            totalUsed += debt;
        }

        await supabase.from('customers').update({ credit_used: totalUsed }).eq('id', customerId);

        return totalUsed;
    } catch (err) {
        console.error('[syncCustomerCreditLimit] Error:', err);
        return 0;
    }
};

export const updateCustomer = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.contact2 !== undefined) payload.contact2 = data.contact2;

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

    if (data.address) {
        if (data.address.zip !== undefined) payload.cep = data.address.zip;
        if (data.address.street !== undefined) payload.street = data.address.street;
        if (data.address.number !== undefined) payload.numero = data.address.number;
        if (data.address.complement !== undefined) payload.complemento = data.address.complement;
        if (data.address.neighborhood !== undefined) payload.bairro = data.address.neighborhood;
        if (data.address.city !== undefined) payload.city = data.address.city;
        if (data.address.state !== undefined) payload.state = data.address.state;
    }

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
            const { data: existingRg } = await supabase
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
        }
    }

    const updatePromise = supabase.from('customers').update(payload).eq('id', data.id).select().single();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao atualizar cliente no Supabase (30s)')), 30000));

    let result: any;
    try {
        result = await Promise.race([updatePromise, timeoutPromise]);
    } catch (err: any) {
        console.error("mockApi: Exception during update race:", err);
        throw err;
    }

    if (result.error && (result.error.code === '42703' || result.error.code === 'PGRST204')) {
        const msg = result.error.message || '';
        let retry = false;
        
        if (payload.instagram !== undefined && msg.includes('instagram')) {
            console.warn("Instagram column missing, retrying without it...");
            delete payload.instagram;
            retry = true;
        }
        if (payload.contact2 !== undefined && msg.includes('contact2')) {
            console.warn("Contact2 column missing, retrying without it...");
            delete payload.contact2;
            retry = true;
        }
        
        if (retry) {
            result = await supabase.from('customers').update(payload).eq('id', data.id).select().single();
        }
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

    const { count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('customerId', id);

    if (salesCount && salesCount > 0) {
        throw new Error(`Este cliente possui ${salesCount} venda(s) registrada(s) e não pode ser excluído. Você pode desativar o cadastro ao invés de excluir.`);
    }

    const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', id);

    if (productsCount && productsCount > 0) {
        throw new Error(`Este cliente possui ${productsCount} produto(s) recebido(s) via troca/compra e não pode ser excluído.`);
    }

    // Bloquear exclusão se o cliente tiver OS vinculada
    const { count: osCount } = await supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', id);

    if (osCount && osCount > 0) {
        throw new Error(`Este cliente possui ${osCount} Ordem(ns) de Serviço vinculada(s) e não pode ser excluído. Você pode desativar o cadastro ao invés de excluir.`);
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
