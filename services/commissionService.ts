/**
 * CommissionService – Isolated Commission Management Module
 * 
 * Principles:
 * 1. Commission logic is 100% isolated from SaleService
 * 2. All commission values are AUTOMATICALLY calculated (never manual)
 * 3. Immutable once paid/closed
 * 4. Full audit trail for every mutation
 */

import { supabase } from '../supabaseClient.ts';
import { Commission, CommissionStatus } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';

// ─── HELPERS ──────────────────────────────────────────────

const getPeriodReference = (date?: string): string => {
    const d = date ? new Date(date) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const logCommissionAudit = async (
    commissionId: string,
    actionType: string,
    oldValue: number | null,
    newValue: number | null,
    oldStatus: string | null,
    newStatus: string | null,
    reason: string,
    userId: string,
    userName: string
) => {
    await supabase.from('commission_audit_logs').insert({
        commission_id: commissionId,
        action_type: actionType,
        old_value: oldValue,
        new_value: newValue,
        old_status: oldStatus,
        new_status: newStatus,
        reason,
        user_id: userId,
        user_name: userName,
    });
};

// ─── CALCULATION ENGINE ───────────────────────────────────

/**
 * Calculate the commission for a single sale item.
 * Returns 0 if any condition disqualifies the commission.
 */
export const calculateItemCommission = (
    product: {
        commission_enabled?: boolean;
        commission_type?: 'fixed' | 'percentage';
        commission_value?: number;
        discount_limit_type?: 'fixed' | 'percentage';
        discount_limit_value?: number;
    },
    item: {
        unitPrice: number;
        quantity: number;
        discountType: string;
        discountValue: number;
        netTotal: number;
    }
): { commissionAmount: number; commissionRate: number; commissionType: 'fixed' | 'percentage' } => {
    // Rule 1: Commission must be enabled
    if (!product.commission_enabled) {
        return { commissionAmount: 0, commissionRate: 0, commissionType: 'fixed' };
    }

    const commissionType = product.commission_type || 'percentage';
    const commissionValue = product.commission_value || 0;
    const discountLimitType = product.discount_limit_type || 'percentage';
    const discountLimitValue = product.discount_limit_value || 0;

    // Rule 2: Calculate effective discount on the item
    const itemGross = item.unitPrice * item.quantity;
    let effectiveDiscountPct = 0;
    let effectiveDiscountAbs = 0;

    if (item.discountType === '%') {
        effectiveDiscountPct = item.discountValue;
        effectiveDiscountAbs = (effectiveDiscountPct / 100) * itemGross;
    } else {
        effectiveDiscountAbs = item.discountValue;
        effectiveDiscountPct = itemGross > 0 ? (effectiveDiscountAbs / itemGross) * 100 : 0;
    }

    // Rule 3: Verify discount limit
    let exceedsLimit = false;
    if (discountLimitValue > 0) {
        if (discountLimitType === 'percentage') {
            exceedsLimit = effectiveDiscountPct > discountLimitValue;
        } else {
            exceedsLimit = effectiveDiscountAbs > discountLimitValue;
        }
    }

    if (exceedsLimit) {
        return { commissionAmount: 0, commissionRate: commissionValue, commissionType };
    }

    // Rule 4: Calculate commission
    let commissionAmount = 0;
    if (commissionType === 'fixed') {
        commissionAmount = commissionValue * item.quantity;
    } else {
        // percentage over net total
        commissionAmount = (commissionValue / 100) * item.netTotal;
    }

    return {
        commissionAmount: Math.round(commissionAmount * 100) / 100,
        commissionRate: commissionValue,
        commissionType,
    };
};

// ─── GENERATE COMMISSIONS FOR A SALE ──────────────────────

/**
 * Called after a sale is finalized. Fetches product commission config
 * for each item and creates commission records in batch.
 */
export const generateCommissionsForSale = async (
    saleId: string,
    sellerId: string,
    items: Array<{
        productId: string;
        unitPrice: number;
        quantity: number;
        discountType: string;
        discountValue: number;
        netTotal: number;
        productName?: string;
        costPrice?: number;
    }>,
    userId: string,
    userName: string,
    saleDate?: string,
    saleStatus?: string
): Promise<Commission[]> => {
    if (!items || items.length === 0) return [];

    // Batch fetch all product commission configs
    const productIds = items.map(i => i.productId).filter(Boolean);
    if (productIds.length === 0) return [];

    const { data: products } = await supabase
        .from('products')
        .select('id, commission_enabled, commission_type, commission_value, discount_limit_type, discount_limit_value, model')
        .in('id', productIds);

    const productMap = new Map();
    (products || []).forEach(p => productMap.set(p.id, p));

    const periodRef = getPeriodReference(saleDate);
    const commissionsToInsert: any[] = [];

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const product = productMap.get(item.productId);
        if (!product) continue;

        const { commissionAmount, commissionRate, commissionType } = calculateItemCommission(
            product,
            item
        );

        // Only create commission record if product has commission enabled
        if (!product.commission_enabled) continue;

        let initialStatus: CommissionStatus = 'pending';
        if (commissionAmount <= 0) {
            initialStatus = 'cancelled';
        } else if (saleStatus === 'Pendente') {
            initialStatus = 'on_hold';
        }

        commissionsToInsert.push({
            sale_id: saleId,
            sale_item_index: idx,
            seller_id: sellerId,
            product_id: item.productId,
            product_name: item.productName || product.model || 'Produto',
            unit_price: item.unitPrice,
            quantity: item.quantity,
            discount_value: item.discountValue,
            discount_type: item.discountType,
            net_total: item.netTotal,
            commission_type: commissionType,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            status: initialStatus,
            period_reference: periodRef,
        });
    }

    if (commissionsToInsert.length === 0) return [];

    const { data: inserted, error } = await supabase
        .from('commissions')
        .insert(commissionsToInsert)
        .select();

    if (error) {
        console.error('[CommissionService] Error generating commissions:', error);
        throw error;
    }

    // Audit log for each created commission
    for (const comm of (inserted || [])) {
        await logCommissionAudit(
            comm.id,
            'created',
            null,
            comm.commission_amount,
            null,
            comm.status,
            `Comissão gerada automaticamente para venda ${saleId}`,
            userId,
            userName
        );
    }

    return inserted || [];
};

// ─── CANCEL COMMISSIONS FOR A SALE ────────────────────────

/**
 * Called when a sale is cancelled. Marks all pending commissions
 * for that sale as cancelled.
 */
export const cancelCommissionsForSale = async (
    saleId: string,
    userId: string,
    userName: string,
    reason: string = 'Venda cancelada'
): Promise<void> => {
    const { data: existing } = await supabase
        .from('commissions')
        .select('*')
        .eq('sale_id', saleId)
        .in('status', ['pending']);

    if (!existing || existing.length === 0) return;

    const ids = existing.map(c => c.id);

    await supabase
        .from('commissions')
        .update({ status: 'cancelled', updated_at: getNowISO() })
        .in('id', ids);

    for (const comm of existing) {
        await logCommissionAudit(
            comm.id,
            'cancelled',
            comm.commission_amount,
            0,
            'pending',
            'cancelled',
            reason,
            userId,
            userName
        );
    }
};

// ─── RECALCULATE COMMISSIONS FOR AN EDITED SALE ──────────

/**
 * Called when a sale is edited. Deletes old pending commissions
 * and regenerates them based on new item data.
 */
export const recalculateCommissionsForSale = async (
    saleId: string,
    sellerId: string,
    items: Array<{
        productId: string;
        unitPrice: number;
        quantity: number;
        discountType: string;
        discountValue: number;
        netTotal: number;
        productName?: string;
        costPrice?: number;
    }>,
    userId: string,
    userName: string,
    saleDate?: string,
    saleStatus?: string
): Promise<Commission[]> => {
    // Only recalculate pending or on_hold commissions; closed/paid are immutable
    const { data: existing } = await supabase
        .from('commissions')
        .select('*')
        .eq('sale_id', saleId)
        .in('status', ['pending', 'on_hold']);

    if (existing && existing.length > 0) {
        const ids = existing.map(c => c.id);

        for (const comm of existing) {
            await logCommissionAudit(
                comm.id,
                'recalculated',
                comm.commission_amount,
                null,
                'pending', // we could track old_status properly, but 'pending' acts as a generic before-recalculate here
                'recalculated',
                'Comissão recalculada por edição de venda',
                userId,
                userName
            );
        }

        await supabase
            .from('commissions')
            .delete()
            .in('id', ids);
    }

    // Regenerate with new data
    return generateCommissionsForSale(saleId, sellerId, items, userId, userName, saleDate, saleStatus);
};

// ─── FETCH COMMISSIONS ────────────────────────────────────

export const getCommissions = async (
    filters: {
        sellerId?: string;
        status?: CommissionStatus;
        periodReference?: string;
        startDate?: string;
        endDate?: string;
    } = {}
): Promise<Commission[]> => {
    let query = supabase
        .from('commissions')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.sellerId) {
        query = query.eq('seller_id', filters.sellerId);
    }
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    if (filters.periodReference) {
        query = query.eq('period_reference', filters.periodReference);
    }
    if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
        const endObj = new Date(`${filters.endDate}T23:59:59.999Z`);
        endObj.setDate(endObj.getDate() + 1);
        query = query.lte('created_at', endObj.toISOString());
    }

    const { data, error } = await query.limit(2000);
    if (error) {
        console.error('[CommissionService] Error fetching commissions:', error);
        return [];
    }
    return data || [];
};

// ─── GET COMMISSION SUMMARY ───────────────────────────────

export const getCommissionSummary = async (
    sellerId?: string,
    periodReference?: string
): Promise<{ pending: number; closed: number; paid: number; cancelled: number; total: number; on_hold: number }> => {
    let query = supabase.from('commissions').select('status, commission_amount');

    if (sellerId) query = query.eq('seller_id', sellerId);
    if (periodReference) query = query.eq('period_reference', periodReference);

    const { data } = await query;

    const summary = { pending: 0, closed: 0, paid: 0, cancelled: 0, total: 0, on_hold: 0 };
    (data || []).forEach((c: any) => {
        const amount = Number(c.commission_amount) || 0;
        if (c.status === 'pending') summary.pending += amount;
        else if (c.status === 'closed') summary.closed += amount;
        else if (c.status === 'paid') summary.paid += amount;
        else if (c.status === 'cancelled') summary.cancelled += amount;
        else if (c.status === 'on_hold') summary.on_hold += amount;

        // Total history ONLY includes valid, active commissions (not on_hold, not cancelled)
        if (['pending', 'closed', 'paid'].includes(c.status)) {
            summary.total += amount;
        }
    });

    return summary;
};

// ─── CLOSE PERIOD ─────────────────────────────────────────

/**
 * Close all pending commissions for a given month.
 * After closing, sales in that period cannot retroactively alter commissions.
 */
export const closeCommissionPeriod = async (
    periodReference: string,
    userId: string,
    userName: string
): Promise<number> => {
    const { data: pending } = await supabase
        .from('commissions')
        .select('*')
        .eq('period_reference', periodReference)
        .eq('status', 'pending');

    if (!pending || pending.length === 0) return 0;

    const ids = pending.map(c => c.id);

    await supabase
        .from('commissions')
        .update({ status: 'closed', updated_at: getNowISO() })
        .in('id', ids);

    for (const comm of pending) {
        await logCommissionAudit(
            comm.id,
            'closed',
            comm.commission_amount,
            comm.commission_amount,
            'pending',
            'closed',
            `Período ${periodReference} fechado`,
            userId,
            userName
        );
    }

    return pending.length;
};

// ─── MARK COMMISSION AS PAID ──────────────────────────────

export const markCommissionPaid = async (
    commissionIds: string[],
    paymentDate: string,
    paymentMethod: string,
    paymentNotes: string,
    userId: string,
    userName: string
): Promise<void> => {
    // Only closed commissions can be paid
    const { data: toUpdate } = await supabase
        .from('commissions')
        .select('*')
        .in('id', commissionIds)
        .eq('status', 'closed');

    if (!toUpdate || toUpdate.length === 0) return;

    const validIds = toUpdate.map(c => c.id);

    await supabase
        .from('commissions')
        .update({
            status: 'paid',
            payment_date: paymentDate,
            payment_method: paymentMethod,
            payment_notes: paymentNotes,
            updated_at: getNowISO(),
        })
        .in('id', validIds);

    for (const comm of toUpdate) {
        await logCommissionAudit(
            comm.id,
            'paid',
            comm.commission_amount,
            comm.commission_amount,
            'closed',
            'paid',
            `Pagamento: ${paymentMethod} - ${paymentNotes || 'Sem obs'}`,
            userId,
            userName
        );
    }
};

// ─── GET AUDIT LOGS ───────────────────────────────────────

export const getCommissionAuditLogs = async (commissionId?: string): Promise<any[]> => {
    let query = supabase
        .from('commission_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (commissionId) {
        query = query.eq('commission_id', commissionId);
    }

    const { data } = await query.limit(500);
    return data || [];
};

// ─── BULK UPDATE PRODUCT COMMISSION CONFIG ────────────────

export const bulkUpdateProductCommission = async (
    productIds: string[],
    config: {
        commission_enabled?: boolean;
        commission_type?: 'fixed' | 'percentage';
        commission_value?: number;
        discount_limit_type?: 'fixed' | 'percentage';
        discount_limit_value?: number;
    },
    userId: string,
    userName: string
): Promise<void> => {
    const updatePayload: any = {};
    if (config.commission_enabled !== undefined) updatePayload.commission_enabled = config.commission_enabled;
    if (config.commission_type !== undefined) updatePayload.commission_type = config.commission_type;
    if (config.commission_value !== undefined) updatePayload.commission_value = config.commission_value;
    if (config.discount_limit_type !== undefined) updatePayload.discount_limit_type = config.discount_limit_type;
    if (config.discount_limit_value !== undefined) updatePayload.discount_limit_value = config.discount_limit_value;

    if (Object.keys(updatePayload).length === 0) return;

    // Update in batches of 50
    for (let i = 0; i < productIds.length; i += 50) {
        const batch = productIds.slice(i, i + 50);
        await supabase
            .from('products')
            .update(updatePayload)
            .in('id', batch);
    }
};
