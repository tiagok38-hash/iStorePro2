
import { supabase } from '../supabaseClient.ts';
import { PurchaseOrder, AuditActionType, AuditEntityType } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { sendPurchaseNotification } from './telegramService.ts';

// Helper to map database row to TypeScript PurchaseOrder interface
const mapPurchaseOrder = (row: any): PurchaseOrder => {
    let external = row.observations || '';
    let cancelReason = '';

    const separatorCancelReason = '\n---CANCEL_REASON---\n';
    if (external.includes(separatorCancelReason)) {
        const parts = external.split(separatorCancelReason);
        external = parts[0];
        cancelReason = parts.slice(1).join(separatorCancelReason);
    }

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
        observations: external,
        cancellationReason: cancelReason
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
    let purchaseDateISO = now;
    if (data.purchaseDate) {
        if (!data.purchaseDate.includes('Z') && !data.purchaseDate.includes('+') && !data.purchaseDate.includes('-', 10)) {
            purchaseDateISO = new Date(data.purchaseDate).toISOString();
        } else {
            purchaseDateISO = data.purchaseDate;
        }
    }

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

    // TELEGRAM NOTIFICATION
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
    const { id, purchaseTerm, createdAt, displayId, locatorId, ...rest } = data;

    let purchaseDateISO = rest.purchaseDate;
    if (purchaseDateISO) {
        if (!purchaseDateISO.includes('Z') && !purchaseDateISO.includes('+') && !purchaseDateISO.includes('T')) {
            purchaseDateISO = new Date(purchaseDateISO).toISOString();
        } else if (purchaseDateISO.includes('T') && !purchaseDateISO.includes('Z') && !purchaseDateISO.includes('+') && !purchaseDateISO.slice(10).includes('-')) {
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

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const { data: updated, error } = await supabase.from('purchase_orders').update(payload).eq('id', id).select().single();
    if (error) {
        console.error("Error updating purchase order:", error);
        throw error;
    }
    clearCache(['purchase_orders']);
    return {
        ...updated,
        displayId: updated.displayId || updated.display_id || displayId,
        locatorId: updated.locatorId || updated.locator_id || locatorId,
    };
};

export const deletePurchaseOrder = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: po } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
    if (!po) throw new Error("Compra não encontrada.");

    if (po.stockStatus === 'Lançado' || po.stockStatus === 'Parcialmente Lançado') {
        throw new Error("Esta compra já foi lançada no estoque e não pode ser excluída, apenas cancelada.");
    }

    const { error: deleteProdError } = await supabase.from('products').delete().eq('purchaseOrderId', id);
    if (deleteProdError) {
        throw new Error("Não é possível excluir a compra pois existem vínculos ativos no banco de dados.");
    }

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

    if (isLaunched) {
        try {
            await supabase.from('products').delete().eq('purchaseOrderId', id);
        } catch (e: any) {
            const { data: products } = await supabase.from('products').select('id').eq('purchaseOrderId', id);
            if (products && products.length > 0) {
                for (const prod of products) {
                    try {
                        await supabase.from('products').delete().eq('id', prod.id);
                    } catch (err) {
                        await supabase.from('products').update({ stock: 0 }).eq('id', prod.id);
                    }
                }
            }
        }
    }

    const { error } = await supabase.from('purchase_orders').update({
        status: 'Cancelada',
        stockStatus: 'Cancelada',
        observations: po.observations ? `${po.observations}\n---CANCEL_REASON---\n${reason}` : `\n---CANCEL_REASON---\n${reason}`
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
    const { error: updateError } = await supabase.from('purchase_orders').update({ stockStatus: 'Pendente' }).eq('id', id);
    if (updateError) throw updateError;

    try {
        const { error: deleteError } = await supabase.from('products').delete().eq('purchaseOrderId', id);
        if (deleteError) throw deleteError;
    } catch (error: any) {
        await supabase.from('purchase_orders').update({ stockStatus: 'Lançado' }).eq('id', id);

        if (error.code === '23503') { // Foreign key violation
            throw new Error('Não é possível reverter esta compra pois alguns produtos já foram vendidos.');
        }
        throw error;
    }

    clearCache(['purchase_orders', 'products']);
};

export const launchPurchaseToStock = async (purchaseOrderId: string, products: any[], launchedBy?: string, launchedById?: string) => {
    const now = getNowISO();

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

    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    let currentSkuCount = count || 0;

    const productsToInsert: any[] = [];
    const productsToReactivate: any[] = [];
    const blockedProducts: string[] = [];

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
            const { data: found } = await supabase
                .from('products')
                .select('*')
                .eq('model', p.model)
                .eq('condition', p.condition)
                .eq('costPrice', p.costPrice)
                .eq('price', p.price)
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
                        // ✅ Atualiza campos de auditoria de criação na reentrada
                        createdAt: now,
                        createdBy: p.createdBy || launchedById || null,
                        createdByName: p.createdByName || launchedBy || createdBy,
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
                // ✅ Usa o ID do usuário para createdBy, e o nome para createdByName
                createdBy: p.createdBy || launchedById || null,
                createdByName: p.createdByName || launchedBy || createdBy,
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
