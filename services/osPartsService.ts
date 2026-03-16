
import { supabase } from '../supabaseClient.ts';
import { FinancialStatus } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache } from './cacheUtils.ts';
import { cleanUUIDs } from '../utils/formatters.ts';

// ============================================================
// ESTOQUE EXCLUSIVO DE ORDEM DE SERVIÇO (OS)
// Completamente separado do estoque ERP principal.
// Peças compradas aqui NÃO aparecem no estoque do ERP.
// ============================================================

export interface OsPart {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    model?: string;
    sku?: string;
    costPrice: number;
    salePrice: number;
    wholesalePrice: number;
    stock: number;
    minimumStock?: number;
    unit?: string;
    storageLocation?: string;
    supplierId?: string;
    supplierName?: string;
    observations?: string;
    condition?: string;
    warranty?: string;
    barcode?: string;
    variations?: any[];
    isActive: boolean;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OsPurchaseOrderItem {
    id: string;
    osPartId?: string;
    partName: string;
    brand?: string;
    category?: string;
    model?: string;
    condition?: string;
    warranty?: string;
    barcode?: string;
    variations?: any[];
    storageLocation?: string;
    wholesalePrice?: number;
    quantity: number;
    unitCost: number;
    finalUnitCost: number;
}

export interface OsPurchaseOrder {
    id: string;
    displayId: number;
    supplierId?: string;
    supplierName?: string;
    purchaseDate: string;
    total: number;
    additionalCost: number;
    stockStatus: 'Lançado' | 'Pendente' | 'Parcialmente Lançado' | 'Cancelada';
    financialStatus: 'Pendente' | 'Pago';
    status?: 'Pendente' | 'Cancelada' | 'Finalizada';
    cancellationReason?: string;
    observations?: string;
    purchaseTerm?: string;
    origin?: string;
    items: OsPurchaseOrderItem[];
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    updatedAt: string;
}

const mapOsPart = (p: any): OsPart => ({
    id: p.id,
    name: cleanUUIDs(p.name),
    brand: p.brand,
    category: p.category,
    model: p.model,
    sku: p.sku,
    costPrice: p.cost_price ?? 0,
    salePrice: p.sale_price ?? 0,
    wholesalePrice: p.wholesale_price ?? 0,
    stock: p.stock ?? 0,
    minimumStock: p.minimum_stock,
    unit: p.unit || 'Un',
    storageLocation: p.storage_location,
    supplierId: p.supplier_id,
    observations: p.observations,
    condition: p.condition,
    warranty: p.warranty,
    barcode: p.barcode,
    variations: p.variations || [],
    isActive: p.is_active !== false,
    createdBy: p.created_by,
    createdByName: p.created_by_name,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
});

const mapOsPurchaseOrder = (p: any): OsPurchaseOrder => ({
    id: p.id,
    displayId: p.display_id,
    supplierId: p.supplier_id,
    supplierName: p.supplier_name,
    purchaseDate: p.purchase_date,
    total: p.total ?? 0,
    additionalCost: p.additional_cost ?? 0,
    stockStatus: p.stock_status,
    financialStatus: p.financial_status,
    status: p.status,
    cancellationReason: p.cancellation_reason,
    observations: p.observations,
    purchaseTerm: p.purchase_term,
    origin: p.origin,
    items: (Array.isArray(p.items) ? p.items : []).map((item: any) => ({
        ...item,
        partName: cleanUUIDs(item.partName),
        brand: item.brand,
        category: item.category,
        model: item.model,
    })),
    createdBy: p.created_by,
    createdByName: p.created_by_name,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
});

// --- GET: Lista todas as peças do estoque de OS ---
export const getOsParts = async (onlyActive = false): Promise<OsPart[]> => {
    return fetchWithCache(`os_parts_${onlyActive}`, async () => {
        let query = supabase.from('os_parts').select('*').order('name');
        if (onlyActive) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapOsPart);
    });
};

// --- GET: Lista compras do estoque de OS ---
export const getOsPurchaseOrders = async (): Promise<OsPurchaseOrder[]> => {
    return fetchWithCache('os_purchase_orders', async () => {
        const { data, error } = await supabase
            .from('os_purchase_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) throw error;
        return (data || []).map(mapOsPurchaseOrder);
    });
};

// --- ADD: Adiciona uma peça ao estoque de OS ---
export const addOsPart = async (
    data: Partial<OsPart>,
    userId: string = 'system',
    userName: string = 'Sistema'
): Promise<OsPart> => {
    const now = getNowISO();
    const { count } = await supabase.from('os_parts').select('*', { count: 'exact', head: true });
    const nextSku = `OS-${(count || 0) + 1}`;

    const payload: any = {
        name: data.name,
        brand: data.brand || null,
        category: data.category || null,
        model: data.model || null,
        sku: data.sku || nextSku,
        cost_price: data.costPrice ?? 0,
        sale_price: data.salePrice ?? 0,
        wholesale_price: data.wholesalePrice ?? 0,
        stock: data.stock ?? 0,
        minimum_stock: data.minimumStock ?? 0,
        unit: data.unit || 'Un',
        storage_location: data.storageLocation || null,
        supplier_id: data.supplierId || null,
        observations: data.observations || null,
        condition: data.condition || 'Novo',
        warranty: data.warranty || null,
        barcode: data.barcode || null,
        variations: data.variations || [],
        is_active: true,
        created_by: userId !== 'system' ? userId : null,
        created_by_name: userName,
        created_at: now,
        updated_at: now,
    };

    const { data: created, error } = await supabase.from('os_parts').insert([payload]).select().single();
    if (error) throw error;

    clearCache(['os_parts_false', 'os_parts_true']);
    return mapOsPart(created);
};

// --- UPDATE: Atualiza uma peça do estoque de OS ---
export const updateOsPart = async (
    id: string,
    data: Partial<OsPart>,
    userId: string = 'system',
    userName: string = 'Sistema'
): Promise<OsPart> => {
    const payload: any = { updated_at: getNowISO() };
    if (data.name !== undefined) payload.name = data.name;
    if (data.brand !== undefined) payload.brand = data.brand;
    if (data.category !== undefined) payload.category = data.category;
    if (data.model !== undefined) payload.model = data.model;
    if (data.costPrice !== undefined) payload.cost_price = data.costPrice;
    if (data.salePrice !== undefined) payload.sale_price = data.salePrice;
    if (data.wholesalePrice !== undefined) payload.wholesale_price = data.wholesalePrice;
    if (data.stock !== undefined) payload.stock = data.stock;
    if (data.minimumStock !== undefined) payload.minimum_stock = data.minimumStock;
    if (data.unit !== undefined) payload.unit = data.unit;
    if (data.storageLocation !== undefined) payload.storage_location = data.storageLocation;
    if (data.supplierId !== undefined) payload.supplier_id = data.supplierId || null;
    if (data.observations !== undefined) payload.observations = data.observations;
    if (data.condition !== undefined) payload.condition = data.condition;
    if (data.warranty !== undefined) payload.warranty = data.warranty;
    if (data.barcode !== undefined) payload.barcode = data.barcode;
    if (data.variations !== undefined) payload.variations = data.variations;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: updated, error } = await supabase
        .from('os_parts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    clearCache(['os_parts_false', 'os_parts_true']);
    return mapOsPart(updated);
};

// --- DELETE: Remove uma peça (soft delete) do estoque de OS ---
export const deleteOsPart = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('os_parts')
        .update({ is_active: false, updated_at: getNowISO() })
        .eq('id', id);
    if (error) throw error;
    clearCache(['os_parts_false', 'os_parts_true']);
};

// --- ADD: Registra uma ordem de compra de peças de OS ---
export const addOsPurchaseOrder = async (
    data: Partial<OsPurchaseOrder>,
    userId: string = 'system',
    userName: string = 'Sistema'
): Promise<OsPurchaseOrder> => {
    const now = getNowISO();
    const total = (data.items || []).reduce((acc, item) => acc + item.finalUnitCost * item.quantity, 0) + (data.additionalCost || 0);

    const payload: any = {
        supplier_id: data.supplierId || null,
        supplier_name: data.supplierName || null,
        purchase_date: data.purchaseDate || now.split('T')[0],
        total,
        additional_cost: data.additionalCost || 0,
        stock_status: 'Pendente',
        financial_status: 'Pendente',
        status: 'Pendente',
        observations: data.observations || null,
        purchase_term: data.purchaseTerm || null,
        origin: data.origin || 'Nacional',
        items: (data.items || []).map(item => ({
            id: item.id || crypto.randomUUID(),
            osPartId: item.osPartId || null,
            partName: item.partName,
            brand: item.brand || null,
            category: item.category || null,
            model: item.model || null,
            condition: item.condition || 'Novo',
            warranty: item.warranty || null,
            barcode: item.barcode || null,
            variations: item.variations || [],
            storageLocation: item.storageLocation || null,
            wholesalePrice: item.wholesalePrice || item.finalUnitCost,
            quantity: item.quantity,
            unitCost: item.unitCost,
            finalUnitCost: item.finalUnitCost,
        })),
        created_by: userId !== 'system' ? userId : null,
        created_by_name: userName,
        created_at: now,
        updated_at: now,
    };

    const { data: created, error } = await supabase
        .from('os_purchase_orders')
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    clearCache(['os_purchase_orders']);
    return mapOsPurchaseOrder(created);
};

// --- LAUNCH: Lança o estoque de uma compra de OS (adiciona ao estoque de peças) ---
export const launchOsPurchaseOrder = async (
    purchaseId: string,
    userId: string = 'system',
    userName: string = 'Sistema'
): Promise<void> => {
    // 1. Busca a ordem de compra
    const { data: purchase, error: fetchError } = await supabase
        .from('os_purchase_orders')
        .select('*')
        .eq('id', purchaseId)
        .single();

    if (fetchError) throw fetchError;
    if (!purchase) throw new Error('Ordem de compra de OS não encontrada.');
    if (purchase.stock_status === 'Lançado') throw new Error('Esta compra já foi lançada no estoque.');

    const items: OsPurchaseOrderItem[] = Array.isArray(purchase.items) ? purchase.items : [];

    // 2. Para cada item, atualiza o estoque da peça correspondente
    for (const item of items) {
        if (!item.osPartId) {
            // Cria a peça automaticamente se não existir
            const { data: newPart, error: createError } = await supabase
                .from('os_parts')
                .insert([{
                    name: item.partName,
                    brand: item.brand || null,
                    category: item.category || null,
                    model: item.model || null,
                    condition: item.condition || 'Novo',
                    warranty: item.warranty || null,
                    barcode: item.barcode || null,
                    variations: item.variations || [],
                    storage_location: item.storageLocation || null,
                    cost_price: item.finalUnitCost,
                    sale_price: item.finalUnitCost,
                    wholesale_price: item.wholesalePrice || item.finalUnitCost,
                    stock: item.quantity,
                    unit: 'Un',
                    is_active: true,
                    supplier_id: purchase.supplier_id || null,
                    created_by_name: userName,
                    created_at: getNowISO(),
                    updated_at: getNowISO(),
                }])
                .select()
                .single();

            if (createError) throw createError;

            // Registra histórico
            await supabase.from('os_parts_stock_history').insert([{
                os_part_id: newPart.id,
                old_stock: 0,
                new_stock: item.quantity,
                adjustment: item.quantity,
                reason: 'Lançamento de Compra (OS)',
                related_id: purchaseId,
                changed_by: userId,
                changed_by_name: userName,
                details: `Compra OS #${purchase.display_id} - ${item.partName}`,
            }]);
        } else {
            // Atualiza estoque da peça existente
            const { data: part, error: partError } = await supabase
                .from('os_parts')
                .select('stock')
                .eq('id', item.osPartId)
                .single();

            if (partError) throw partError;

            const oldStock = part.stock || 0;
            const newStock = oldStock + item.quantity;

            const { error: updateError } = await supabase
                .from('os_parts')
                .update({ stock: newStock, updated_at: getNowISO() })
                .eq('id', item.osPartId);

            if (updateError) throw updateError;

            // Registra histórico
            await supabase.from('os_parts_stock_history').insert([{
                os_part_id: item.osPartId,
                old_stock: oldStock,
                new_stock: newStock,
                adjustment: item.quantity,
                reason: 'Lançamento de Compra (OS)',
                related_id: purchaseId,
                changed_by: userId,
                changed_by_name: userName,
                details: `Compra OS #${purchase.display_id} - ${item.partName}`,
            }]);
        }
    }

    // 3. Atualiza status da ordem de compra
    const { error: updateError } = await supabase
        .from('os_purchase_orders')
        .update({
            stock_status: 'Lançado',
            status: 'Finalizada',
            updated_at: getNowISO(),
        })
        .eq('id', purchaseId);

    if (updateError) throw updateError;

    clearCache(['os_parts_false', 'os_parts_true', 'os_purchase_orders']);
};

// --- UPDATE: Atualiza uma ordem de compra de OS ---
export const updateOsPurchaseOrder = async (
    id: string,
    data: Partial<OsPurchaseOrder>,
    userId?: string,
    userName?: string
): Promise<OsPurchaseOrder> => {
    const now = getNowISO();
    const total = (data.items || []).reduce((acc, item) => acc + item.finalUnitCost * item.quantity, 0) + (data.additionalCost || 0);

    const payload: any = {
        supplier_id: data.supplierId || null,
        supplier_name: data.supplierName || null,
        purchase_date: data.purchaseDate || now.split('T')[0],
        total,
        additional_cost: data.additionalCost || 0,
        observations: data.observations || null,
        purchase_term: data.purchaseTerm || null,
        origin: data.origin || 'Nacional',
        items: (data.items || []).map(item => ({
            id: item.id || crypto.randomUUID(),
            osPartId: item.osPartId || null,
            partName: item.partName,
            brand: item.brand || null,
            category: item.category || null,
            model: item.model || null,
            condition: item.condition || 'Novo',
            warranty: item.warranty || null,
            barcode: item.barcode || null,
            variations: item.variations || [],
            storageLocation: item.storageLocation || null,
            wholesalePrice: item.wholesalePrice || item.finalUnitCost,
            quantity: item.quantity,
            unitCost: item.unitCost,
            finalUnitCost: item.finalUnitCost,
        })),
        updated_at: now,
    };

    const { data: updated, error } = await supabase
        .from('os_purchase_orders')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    clearCache(['os_purchase_orders']);
    return mapOsPurchaseOrder(updated);
};

// --- CANCEL: Cancela uma ordem de compra de OS ---
export const cancelOsPurchaseOrder = async (
    id: string,
    reason: string,
    userId: string = 'system',
    userName: string = 'Sistema'
): Promise<void> => {
    // 1. Busca a ordem de compra
    const { data: purchase, error: fetchError } = await supabase
        .from('os_purchase_orders')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;
    if (!purchase) throw new Error('Ordem de compra de OS não encontrada.');

    // 2. Se já foi lançada, reverte o estoque
    if (purchase.stock_status === 'Lançado') {
        const items = purchase.items || [];
        for (const item of items) {
            if (item.osPartId) {
                const { data: part } = await supabase.from('os_parts').select('stock').eq('id', item.osPartId).single();
                if (part) {
                    const newStock = Math.max(0, part.stock - item.quantity);
                    await supabase.from('os_parts').update({ stock: newStock }).eq('id', item.osPartId);

                    await supabase.from('os_parts_stock_history').insert([{
                        os_part_id: item.osPartId,
                        old_stock: part.stock,
                        new_stock: newStock,
                        adjustment: -item.quantity,
                        reason: 'Cancelamento de Compra (OS)',
                        related_id: id,
                        changed_by: userId,
                        changed_by_name: userName,
                        details: `Cancelamento: ${reason}`,
                    }]);
                }
            }
        }
    }

    // 3. Atualiza o status
    const { error: updateError } = await supabase
        .from('os_purchase_orders')
        .update({
            status: 'Cancelada',
            stock_status: 'Cancelada',
            cancellation_reason: reason,
            updated_at: getNowISO(),
        })
        .eq('id', id);

    if (updateError) throw updateError;
    clearCache(['os_parts_false', 'os_parts_true', 'os_purchase_orders']);
};

// --- UPDATE FINANCIAL STATUS ---
export const updateOsPurchaseFinancialStatus = async (
    id: string,
    status: FinancialStatus,
    userId?: string,
    userName?: string
): Promise<void> => {
    const { error } = await supabase
        .from('os_purchase_orders')
        .update({
            financial_status: status,
            updated_at: getNowISO(),
        })
        .eq('id', id);

    if (error) throw error;
    clearCache(['os_purchase_orders']);
};

export const getOsPartsStockStats = async (): Promise<{
    totalParts: number;
    totalCost: number;
    totalSaleValue: number;
    lowStockCount: number;
}> => {
    const parts = await getOsParts(true); // apenas ativas

    const totalParts = parts.reduce((acc, p) => acc + (p.stock || 0), 0);
    const totalCost = parts.reduce((acc, p) => acc + (p.costPrice || 0) * (p.stock || 0), 0);
    const totalSaleValue = parts.reduce((acc, p) => acc + (p.salePrice || 0) * (p.stock || 0), 0);
    const lowStockCount = parts.filter(p => p.stock > 0 && p.minimumStock !== undefined && p.stock <= (p.minimumStock || 0)).length;

    return { totalParts, totalCost, totalSaleValue, lowStockCount };
};
