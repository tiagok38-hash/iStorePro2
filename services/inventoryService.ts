
import { supabase } from '../supabaseClient.ts';
import { InventoryMovement, AuditActionType, AuditEntityType } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache, CACHE_TTL, fetchWithRetry } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

// --- INVENTORY MOVEMENTS ---

export const getInventoryMovements = async (startDate?: string, endDate?: string): Promise<InventoryMovement[]> => {
    const cacheKey = `inventory_movements_${startDate || 'all'}_${endDate || 'all'}`;
    return fetchWithCache(cacheKey, async () => {
        let query = supabase
            .from('inventory_movements')
            .select('*')
            .order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as InventoryMovement[];
    }, CACHE_TTL);
};

export const createInventoryMovement = async (
    movement: {
        product_id: string;
        product_name: string;
        imei?: string;
        serial_number?: string;
        movement_type: 'entrada' | 'saida';
        quantity: number;
        reason: string;
        custom_reason?: string;
    },
    userId: string,
    userName: string
): Promise<InventoryMovement> => {
    // 1. Fetch current product to validate stock
    const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('id, stock, model, stockHistory')
        .eq('id', movement.product_id)
        .single();

    if (fetchErr || !product) throw new Error('Produto não encontrado.');

    // 2. Validate stock for outgoing movements
    if (movement.movement_type === 'saida' && product.stock < movement.quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock}, Solicitado: ${movement.quantity}`);
    }

    // 3. Calculate new stock
    const newStock = movement.movement_type === 'saida'
        ? product.stock - movement.quantity
        : product.stock + movement.quantity;

    const now = getNowISO();
    const displayReason = movement.reason === 'Outro' && movement.custom_reason
        ? `Outro: ${movement.custom_reason}`
        : movement.reason;

    // 4. Insert movement record
    const { data: movementData, error: insertErr } = await supabase
        .from('inventory_movements')
        .insert({
            product_id: movement.product_id,
            product_name: movement.product_name,
            imei: movement.imei || null,
            serial_number: movement.serial_number || null,
            movement_type: movement.movement_type,
            quantity: movement.quantity,
            reason: displayReason,
            custom_reason: movement.custom_reason || null,
            user_id: userId,
            user_name: userName,
        })
        .select()
        .single();

    if (insertErr) throw insertErr;

    // 5. Update product stock + stockHistory
    const existingStockHistory = product.stockHistory || [];
    const newStockEntry = {
        id: crypto.randomUUID(),
        oldStock: product.stock,
        newStock: newStock,
        adjustment: movement.movement_type === 'saida' ? -movement.quantity : movement.quantity,
        reason: `Movimentação: ${displayReason}`,
        timestamp: now,
        changedBy: userName,
    };

    const { error: updateErr } = await supabase
        .from('products')
        .update({
            stock: newStock,
            updatedAt: now,
            stockHistory: [...existingStockHistory, newStockEntry],
        })
        .eq('id', movement.product_id);

    if (updateErr) throw updateErr;

    // 6. Audit log
    await addAuditLog(
        AuditActionType.STOCK_ADJUST,
        AuditEntityType.PRODUCT,
        movement.product_id,
        `Movimentação de estoque (${movement.movement_type === 'saida' ? 'Saída' : 'Entrada'}). Qtd: ${movement.quantity}. Motivo: ${displayReason}. Estoque: ${product.stock} → ${newStock}`,
        userId,
        userName
    );

    // 7. Clear caches
    clearCache(['products', 'inventory_movements']);

    return movementData as InventoryMovement;
};

export const getProductMovements = async (productId: string): Promise<InventoryMovement[]> => {
    const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as InventoryMovement[];
};
