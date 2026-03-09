import { supabase } from '../supabaseClient.ts';
import { Branch, BranchInventory, InventoryMovement, Product } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { clearCache } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';
import { AuditActionType, AuditEntityType } from '../types.ts';

// --- BRANCHES ---

export const getBranches = async (): Promise<Branch[]> => {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

    if (error) throw error;
    return (data || []) as Branch[];
};

export const createBranch = async (branchData: Omit<Branch, 'id' | 'created_at' | 'updated_at'>): Promise<Branch> => {
    const { data, error } = await supabase
        .from('branches')
        .insert(branchData)
        .select()
        .single();
    if (error) throw error;
    clearCache(['branches']);
    return data as Branch;
};

// --- BRANCH INVENTORY ---

export const getBranchInventory = async (branchId: string): Promise<any[]> => {
    // Return view mapping for products at branch
    const { data, error } = await supabase
        .from('branch_inventory')
        .select(`
            *,
            product:products (id, model, sku, price, costPrice, serialNumber, imei1, imei2, brand, category)
        `)
        .eq('branch_id', branchId);

    if (error) throw error;
    return data || [];
};

export const transferStockToBranch = async (
    movement: {
        product_id: string;
        product_name: string;
        imei?: string;
        serial_number?: string;
        branch_id: string;
        quantity: number;
        reason?: string;
    },
    userId: string,
    userName: string
): Promise<InventoryMovement> => {

    // 1. Fetch current product to check main stock
    const { data: product, error: fetchErr } = await supabase
        .from('products')
        .select('id, stock, stockHistory')
        .eq('id', movement.product_id)
        .single();

    if (fetchErr || !product) throw new Error('Produto não encontrado na base principal.');
    if (product.stock < movement.quantity) {
        throw new Error(`Estoque principal insuficiente. Disponível: ${product.stock}`);
    }

    const { data: branch } = await supabase.from('branches').select('name').eq('id', movement.branch_id).single();
    const branchName = branch ? branch.name : 'Filial';

    // 2. Reduce main stock
    const now = getNowISO();
    const newMainStock = product.stock - movement.quantity;
    const existingStockHistory = product.stockHistory || [];

    // Create local entry
    const { error: updateMainErr } = await supabase
        .from('products')
        .update({
            stock: newMainStock,
            updatedAt: now,
            stockHistory: [...existingStockHistory, {
                id: crypto.randomUUID(),
                oldStock: product.stock,
                newStock: newMainStock,
                adjustment: -movement.quantity,
                reason: `Transferência para ${branchName}`,
                timestamp: now,
                changedBy: userName,
            }],
        })
        .eq('id', movement.product_id);

    if (updateMainErr) throw updateMainErr;

    // 3. Increment branch stock
    // Upsert branch inventory
    const { data: existingBranchStock } = await supabase
        .from('branch_inventory')
        .select('id, stock')
        .eq('branch_id', movement.branch_id)
        .eq('product_id', movement.product_id)
        .maybeSingle();

    if (existingBranchStock) {
        const { error: updateBranchErr } = await supabase
            .from('branch_inventory')
            .update({ stock: existingBranchStock.stock + movement.quantity })
            .eq('id', existingBranchStock.id);
        if (updateBranchErr) throw updateBranchErr;
    } else {
        const { error: insertBranchErr } = await supabase
            .from('branch_inventory')
            .insert({
                branch_id: movement.branch_id,
                product_id: movement.product_id,
                stock: movement.quantity
            });
        if (insertBranchErr) throw insertBranchErr;
    }

    // 4. Log movement (saída do estoque principal -> transferência)
    const { data: movementData, error: movErr } = await supabase
        .from('inventory_movements')
        .insert({
            product_id: movement.product_id,
            product_name: movement.product_name,
            imei: movement.imei || null,
            serial_number: movement.serial_number || null,
            movement_type: 'saida', // It's a Saida from main
            quantity: movement.quantity,
            reason: 'Transferência para Filial',
            custom_reason: movement.reason,
            user_id: userId,
            user_name: userName,
            transfer_to_branch_id: movement.branch_id
        })
        .select('*')
        .single();

    if (movErr) throw movErr;

    // 5. Audit
    await addAuditLog(AuditActionType.STOCK_ADJUST, AuditEntityType.PRODUCT, movement.product_id, `Transferência de ${movement.quantity} unidade(s) para a filial ${branchName}`, userId, userName);

    clearCache(['products', 'inventory_movements', `branch_inventory_${movement.branch_id}`]);

    return movementData as InventoryMovement;
};

export const transferStockFromBranchToMain = async (
    movement: {
        product_id: string;
        product_name: string;
        imei?: string;
        serial_number?: string;
        branch_id: string;
        quantity: number;
        reason?: string;
    },
    userId: string,
    userName: string
): Promise<InventoryMovement> => {

    // 1. Check branch stock
    const { data: branchStock, error: fetchBranchErr } = await supabase
        .from('branch_inventory')
        .select('id, stock')
        .eq('branch_id', movement.branch_id)
        .eq('product_id', movement.product_id)
        .single();

    if (fetchBranchErr || !branchStock || branchStock.stock < movement.quantity) {
        throw new Error('Estoque insuficiente na filial para transferência.');
    }

    const { data: branch } = await supabase.from('branches').select('name').eq('id', movement.branch_id).single();
    const branchName = branch ? branch.name : 'Filial';

    // 2. Reduce branch stock
    const { error: updateBranchErr } = await supabase
        .from('branch_inventory')
        .update({ stock: branchStock.stock - movement.quantity })
        .eq('id', branchStock.id);
    if (updateBranchErr) throw updateBranchErr;

    // 3. Increment main stock
    const { data: product, error: fetchMainErr } = await supabase
        .from('products')
        .select('id, stock, stockHistory')
        .eq('id', movement.product_id)
        .single();

    if (fetchMainErr || !product) throw new Error('Produto não existe no cadastro principal.');

    const now = getNowISO();
    const newMainStock = product.stock + movement.quantity;
    const existingStockHistory = product.stockHistory || [];

    const { error: updateMainErr } = await supabase
        .from('products')
        .update({
            stock: newMainStock,
            updatedAt: now,
            stockHistory: [...existingStockHistory, {
                id: crypto.randomUUID(),
                oldStock: product.stock,
                newStock: newMainStock,
                adjustment: movement.quantity,
                reason: `Retorno da filial ${branchName}`,
                timestamp: now,
                changedBy: userName,
            }],
        })
        .eq('id', movement.product_id);

    if (updateMainErr) throw updateMainErr;

    // 4. Log movement (entrada no estoque principal)
    const { data: movementData, error: movErr } = await supabase
        .from('inventory_movements')
        .insert({
            product_id: movement.product_id,
            product_name: movement.product_name,
            imei: movement.imei || null,
            serial_number: movement.serial_number || null,
            movement_type: 'entrada', // It's an Entrada into main
            quantity: movement.quantity,
            reason: 'Recebimento de Filial',
            custom_reason: movement.reason,
            user_id: userId,
            user_name: userName,
            transfer_from_branch_id: movement.branch_id
        })
        .select('*')
        .single();

    if (movErr) throw movErr;

    // 5. Audit
    await addAuditLog(AuditActionType.STOCK_ADJUST, AuditEntityType.PRODUCT, movement.product_id, `Retorno de ${movement.quantity} unidade(s) vinda da filial ${branchName}`, userId, userName);

    clearCache(['products', 'inventory_movements', `branch_inventory_${movement.branch_id}`]);

    return movementData as InventoryMovement;
};
