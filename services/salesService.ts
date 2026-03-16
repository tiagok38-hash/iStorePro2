
import { getProducts, updateProductStock } from './productService.ts';
import { syncCustomerCreditLimit } from './customerService.ts';
import { addCreditInstallments } from './creditService.ts';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient.ts';
import { Product, Customer, Sale, User, Supplier, PurchaseOrder, Brand, Category, ProductModel, Grade, GradeValue, TodaySale, Payment, AuditLog, AuditActionType, AuditEntityType, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, PaymentMethodParameter, CardConfigData, CompanyInfo, PermissionProfile, PermissionSet, ReceiptTermParameter, CashSession, CashMovement, StockHistoryEntry, PurchaseItem, PriceHistoryEntry, TradeInEntry, Service, ServiceOrder, CatalogItem, TransactionCategory, FinancialTransaction, CrmDeal, CrmActivity, CrmColumn, CreditInstallment, CreditSettings, InventoryMovement, FinancialStatus, CustomerDevice, ElectronicType } from '../types.ts';
import { getNowISO, getTodayDateString, formatDateTimeBR } from '../utils/dateUtils.ts';
import { sendSaleNotification, sendPurchaseNotification } from './telegramService.ts';
import { calculateInstallmentDates, calculateFinancedAmount, generateAmortizationTable } from '../utils/creditUtils.ts';
import { sortProductsCommercial } from '../utils/productSorting.ts';

export const mapSale = (sale: any): Sale => {
    try {
        const separatorCSDID = '\n---CSDID---\n';
        const separatorInternal = '\n---INTERNAL---\n';
        const separatorCancelReason = '\n---CANCEL_REASON---\n';

        let external = sale.observations || '';
        let internal = '';
        let csdid = undefined;
        let cancelReason = '';

        // Extrair motivo de cancelamento primeiro
        if (external.includes(separatorCancelReason)) {
            const parts = external.split(separatorCancelReason);
            external = parts[0];
            cancelReason = parts.slice(1).join(separatorCancelReason);
        }

        if (external.includes(separatorCSDID)) {
            const parts = external.split(separatorCSDID);
            external = parts[0];
            const csdidStr = parts[1];
            csdid = parseInt(csdidStr, 10);
        }

        if (external.includes(separatorInternal)) {
            const parts = external.split(separatorInternal);
            external = parts[0];
            internal = parts.slice(1).join(separatorInternal);
        }

        return {
            ...sale,
            customerId: sale.customer_id,
            salespersonId: sale.salesperson_id,
            cashSessionId: sale.cash_session_id,
            warrantyTerm: sale.warranty_term,
            posTerminal: sale.pos_terminal,
            observations: external,
            internalObservations: internal,
            cashSessionDisplayId: csdid,
            cancellationReason: cancelReason,
            interestRate: Number(sale.interest_rate || 0),
            totalFinanced: Number(sale.total_financed || 0),
            installmentAmount: Number(sale.installment_amount || 0),
            currentDebtBalance: Number(sale.current_debt_balance || 0),
            amortizationTable: Array.isArray(sale.amortization_table) ? sale.amortization_table : (typeof sale.amortization_table === 'string' ? JSON.parse(sale.amortization_table) : []),
            items: Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? JSON.parse(sale.items) : []),
            payments: Array.isArray(sale.payments) ? sale.payments : (typeof sale.payments === 'string' ? JSON.parse(sale.payments) : [])
        };
    } catch (e) {
        console.error("Error mapping sale:", sale.id, e);
        return {
            ...sale,
            items: [],
            payments: [],
            observations: sale.observations || '',
        };
    }
};

export const getSales = async (currentUserId?: string, cashSessionId?: string, startDate?: string, endDate?: string): Promise<Sale[]> => {
    const cacheKey = `sales_${currentUserId || 'all'}_${cashSessionId || 'all'}_${startDate || 'none'}_${endDate || 'none'}`;
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            let query = supabase.from('sales').select('*');

            // RULE 4: Strict filtering by User and Cash Session
            if (currentUserId) {
                // Fetch ONLY the necessary session IDs (limit to recent ones for salesperson check)
                const { data: userSessions } = await supabase
                    .from('cash_sessions')
                    .select('id')
                    .eq('user_id', currentUserId)
                    .order('open_time', { ascending: false })
                    .limit(200);

                const sessionIds = (userSessions || []).map((s: any) => s.id);

                if (sessionIds.length > 0) {
                    query = query.or(`salesperson_id.eq.${currentUserId},cash_session_id.in.(${sessionIds.join(',')})`);
                } else {
                    query = query.eq('salesperson_id', currentUserId);
                }
            }
            if (cashSessionId) {
                query = query.eq('cash_session_id', cashSessionId);
            }
            if (startDate) {
                // If it's a simple YYYY-MM-DD, treat as start of day
                const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
                query = query.gte('date', start);
            }
            if (endDate) {
                // Timezone Robustness: Brazil is UTC-3, so 21:00 Jan 28 (Local) is 00:00 Jan 29 (UTC).
                // When the user filters for Jan 28, we MUST include early morning Jan 29 in UTC.
                // We add a 24-hour buffer to endDate to ensure all timezone overlaps are covered.
                if (!endDate.includes('T')) {
                    const endObj = new Date(`${endDate}T23:59:59.999Z`);
                    endObj.setDate(endObj.getDate() + 1); // Buffer 24h
                    query = query.lte('date', endObj.toISOString());
                } else {
                    query = query.lte('date', endDate);
                }
            }
            query = query.neq('status', 'Rascunho');

            // ROBUSTNESS: Always limit to last 1000 sales to prevent memory overflows.
            // For historical data beyond this, specialized reports should be used.
            query = query.order('date', { ascending: false }).limit(1000);

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching sales:', error);
                throw error;
            }
            return data;
        }).then(data => {

            return (data || []).map(mapSale);
        });
    });
};

export const getProductSalesHistory = async (productId: string): Promise<Sale[]> => {
    // Optimization: Reuse the cached 'sales' list instead of a specific DB query
    const allSales = await getSales();
    return allSales.filter((s: Sale) => s.items.some((i: any) => i.productId === productId));
};

export const getTodaysSales = async (): Promise<TodaySale[]> => {
    return [];
};


// --- Shared infrastructure (imported from dedicated modules) ---
import { fetchWithCache, clearCache, getAllCacheKeys, fetchWithRetry, withTimeout, CACHE_TTL, METADATA_TTL } from './cacheUtils.ts';
export { clearCache } from './cacheUtils.ts';

// --- Formatters (imported from dedicated utility and re-exported) ---
import { formatCurrency, formatPhone } from '../utils/formatters.ts';
export { formatCurrency, formatPhone };

// --- Auth, Users, Permissions (imported from dedicated service and re-exported) ---
import { resolvePermissions, login, logout, getProfile, getUsers, addUser, updateUser, deleteUser, registerAdmin, checkAdminExists, getPermissionProfiles, addPermissionProfile, updatePermissionProfile, deletePermissionProfile } from './authService.ts';
export { login, logout, getProfile, getUsers, addUser, updateUser, deleteUser, registerAdmin, checkAdminExists, getPermissionProfiles, addPermissionProfile, updatePermissionProfile, deletePermissionProfile };

// --- Audit (imported from dedicated service and re-exported) ---
import { addAuditLog, getAuditLogs, getBulkUpdateLogs, getCashRegisterAuditLogs } from './auditService.ts';
export { addAuditLog, getAuditLogs, getBulkUpdateLogs, getCashRegisterAuditLogs };

// --- SALES ---

const adjustProductStock = async (
    productId: string,
    adjustment: number, // positive to add, negative to deduct
    relatedId: string,
    reasonBase: string,
    customerName: string,
    paymentMethods: string,
    userName: string,
    userId: string
) => {
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
    if (!product) {
        console.warn(`[adjustProductStock] Product ${productId} not found.`);
        return;
    }

    const currentStock = Number(product.stock || 0);
    const newStock = Math.max(0, currentStock + adjustment);
    const isReturning = adjustment > 0;

    const stockHistoryEntry = {
        id: crypto.randomUUID(),
        oldStock: currentStock,
        newStock: newStock,
        adjustment: adjustment,
        reason: isReturning ? `${reasonBase} (Devolução)` : reasonBase,
        relatedId: relatedId,
        timestamp: getNowISO(),
        changedBy: userName,
        details: `Cliente: ${customerName} | Pagamento: ${paymentMethods}`
    };

    const { error } = await supabase.from('products').update({
        stock: newStock,
        stockHistory: [...(product.stockHistory || []), stockHistoryEntry]
    }).eq('id', productId);

    if (error) {
        console.error(`[adjustProductStock] Error updating stock for ${productId}:`, error);
        throw error;
    }

    await addAuditLog(
        isReturning ? AuditActionType.STOCK_ADJUST : AuditActionType.SALE_CREATE,
        AuditEntityType.PRODUCT,
        productId,
        `${reasonBase} #${relatedId} - Qtd: ${Math.abs(adjustment)} | Estoque: ${currentStock} → ${newStock}`,
        userId,
        userName
    );
};

export const getNextSaleId = async (userId: string = 'system'): Promise<string> => {
    // 1. Encontrar o último ID numérico
    const { data: recentIds } = await supabase
        .from('sales')
        .select('id')
        .order('createdAt', { ascending: false })
        .limit(10);

    const matchNext = (ids: any[]) => {
        if (!ids || ids.length === 0) return 1;
        const numbers = ids
            .map(s => {
                const match = s.id.match(/^ID-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => !isNaN(n));
        return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    };

    let nextNum = matchNext(recentIds || []);

    // 2. Tentar reservar o ID criando um registro rascunho
    for (let attempts = 0; attempts < 10; attempts++) {
        const candidateId = `ID-${nextNum + attempts}`;
        const { error } = await supabase.from('sales').insert([{
            id: candidateId,
            status: 'Rascunho',
            salesperson_id: userId,
            createdAt: getNowISO(),
            date: getNowISO()
        }]);

        if (!error) return candidateId;
        if (error.code !== '23505') throw error;
    }

    return `ID-${nextNum + 10}`;
};

export const cancelSaleReservation = async (id: string) => {
    if (!id || !id.startsWith('ID-')) return;
    // Deleta o rascunho para liberar o ID se for o último, ou marcar como cancelado
    // Para manter a simplicidade e atender o pedido, vamos apenas remover se for status Rascunho
    await supabase.from('sales').delete().eq('id', id).eq('status', 'Rascunho');
};

export const addSale = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const now = new Date();

    // Get all IDs to find the max and ensure uniqueness efficiently
    // Improved ID generation: Fetch only the most recent IDs to avoid timeouts and RLS truncation issues
    const { data: recentIds, error: fetchError } = await supabase
        .from('sales')
        .select('id')
        .order('createdAt', { ascending: false })
        .limit(50);

    if (fetchError) {
        console.warn('mockApi: Error fetching recent IDs, falling back to sequential check. error:', fetchError);
    }

    let nextNum = 1;
    if (recentIds && recentIds.length > 0) {
        const numbers = recentIds
            .map((s: { id: string }) => {
                const match = s.id.match(/^ID-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n) && n < 1000000000);

        if (numbers.length > 0) {
            nextNum = Math.max(...numbers) + 1;
        }
    } else {
        // If we found no IDs via created_at (maybe old records don't have it?), try a fallback or start from count
        const { count } = await supabase.from('sales').select('*', { count: 'exact', head: true });
        nextNum = (count || 0) + 1;
    }

    // Merge observations for DB storage
    let dbObservations = data.observations || '';
    if (data.internalObservations) {
        dbObservations = `${dbObservations}\n---INTERNAL---\n${data.internalObservations}`;
    }
    if (data.cashSessionDisplayId) {
        dbObservations = `${dbObservations}\n---CSDID---\n${data.cashSessionDisplayId}`;
    }

    const saleData: any = {
        id: `ID-${nextNum}`,
        date: now.toISOString(),
        customer_id: data.customerId,
        salesperson_id: data.salespersonId,
        items: data.items,
        subtotal: data.subtotal,

        total: data.total,
        payments: data.payments,
        pos_terminal: data.posTerminal || 'Caixa 1',
        status: data.status || 'Finalizada',
        origin: data.origin || 'PDV',
        warranty_term: data.warrantyTerm || null,
        observations: dbObservations,
        cash_session_id: data.cashSessionId || null,
        lead_origin: data.leadOrigin || null,
        company_id: data.company_id || null,
    };

    let success = false;
    let attempts = 0;
    const maxAttempts = 50;
    let currentSaleId = data.id || `ID-${nextNum}`;
    let finalSale: any = null;

    while (attempts < maxAttempts && !success) {
        attempts++;
        const currentId = attempts === 1 ? currentSaleId : `ID-${nextNum + attempts - 1}`;

        let res;
        if (currentId.startsWith('ID-')) {
            // Tenta upsert para aproveitar ID reservado ou criar novo
            res = await supabase.from('sales').upsert([{ ...saleData, id: currentId }], { onConflict: 'id' }).select();
        } else {
            res = await supabase.from('sales').insert([{ ...saleData, id: currentId }]).select();
        }

        const { data: insertedRows, error } = res;

        if (error) {
            if (error.code === '23505') {
                console.warn(`[addSale] Duplicate ID ${currentId}, retrying...`);
                continue;
            }
            console.error("Error adding sale:", JSON.stringify(error, null, 2));
            throw error;
        }

        finalSale = (insertedRows && insertedRows.length > 0) ? insertedRows[0] : { ...saleData, id: currentId };
        success = true;
    }

    if (!success) {
        throw new Error('Não foi possível gerar um ID único para a venda após várias tentativas.');
    }

    const newSale = finalSale;

    // Map back to camelCase for frontend
    const mappedSale = {
        ...newSale,
        date: newSale.date,
        customerId: newSale.customer_id,
        salespersonId: newSale.salesperson_id,
        posTerminal: newSale.pos_terminal,
        warrantyTerm: newSale.warranty_term,
        cashSessionId: newSale.cash_session_id,
        leadOrigin: newSale.lead_origin
    };

    // Update stock and history for sold items
    // ONLY deduct stock if sale is NOT Pendente
    let customerName = 'Cliente';

    if (data.status !== 'Pendente' && data.items && Array.isArray(data.items)) {
        // Fetch customer name for history (and all products at once for speed)
        const [customerRes, productsRes] = await Promise.all([
            supabase.from('customers').select('*').eq('id', data.customerId).single(),
            supabase.from('products').select('*').in('id', data.items.map(i => i.productId))
        ]);

        customerName = customerRes.data?.name || 'Cliente';
        const paymentMethods = data.payments?.map((p: Payment) => p.method).join(', ') || 'N/A';
        const allProducts = productsRes.data || [];

        // Parallelize initial audit logs
        const auditLogs = [
            addAuditLog(
                AuditActionType.SALE_CREATE,
                AuditEntityType.SALE,
                newSale.id,
                `Venda criada. Cliente: ${customerName} | Total: ${formatCurrency(newSale.total)} | Pagamento: ${paymentMethods}`,
                userId,
                userName
            )
        ];

        for (const item of data.items) {
            const product = allProducts.find(p => p.id === item.productId);
            if (product) {
                const quantityToDeduct = Number(item.quantity);
                await adjustProductStock(
                    item.productId,
                    -quantityToDeduct,
                    newSale.id,
                    'Venda',
                    customerName,
                    paymentMethods,
                    userName,
                    userId
                );
            }
        }
        // Wait for all audit logs to complete (they were started in background)
        await Promise.allSettled(auditLogs).catch(err => console.warn('mockApi: Audit logs partial failure', err));
    }

    // COMMISSION GENERATION: Generate commissions for finalized or pending sales
    if (['Finalizada', 'Pendente'].includes(saleData.status) && data.items && Array.isArray(data.items)) {
        try {
            const { generateCommissionsForSale } = await import('./commissionService.ts');
            const commissionItems = data.items.map((item: any) => ({
                productId: item.productId,
                unitPrice: item.unitPrice || 0,
                quantity: item.quantity || 1,
                discountType: item.discountType || 'R$',
                discountValue: item.discountValue || 0,
                netTotal: item.netTotal || ((item.unitPrice || 0) * (item.quantity || 1)),
                productName: item.productName || item.model || 'Produto',
                costPrice: item.costPrice || 0,
            }));
            await generateCommissionsForSale(
                newSale.id,
                data.salespersonId || userId,
                commissionItems,
                userId,
                userName,
                newSale.date,
                saleData.status
            );
        } catch (commErr) {
            console.warn('[addSale] Commission generation failed (non-blocking):', commErr);
        }
    }

    // TRADE-IN STOCK MANAGEMENT: Add trade-in products to stock only when sale is Finalizada
    const saleStatus = saleData.status;
    if ((saleStatus === 'Finalizada' || saleStatus === 'Editada') && data.payments && Array.isArray(data.payments)) {
        // Ensure customerName is available if the first block skipped or failed
        if (customerName === 'Cliente' && data.customerId) {
            const { data: c } = await supabase.from('customers').select('name').eq('id', data.customerId).maybeSingle();
            if (c) customerName = c.name;
        }

        const tradeInPayments = data.payments.filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );

        for (const tradeInPayment of tradeInPayments) {
            const productId = tradeInPayment.tradeInDetails.productId;

            if (!productId || productId.startsWith('temp-trade-')) {
                console.error('[addSale] Skipped trade-in stock update due to invalid ID:', productId);
                continue;
            }

            // Retry logic to ensure stock update persists
            let attempts = 0;
            const maxAttempts = 3;
            let success = false;

            while (attempts < maxAttempts && !success) {
                attempts++;
                // Small delay to ensure DB propagation of the newly created product
                if (attempts === 1) await new Promise(r => setTimeout(r, 500));

                const { data: tradeInProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

                if (fetchError || !tradeInProduct) {
                    console.warn(`[addSale] Attempt ${attempts}: Trade-in product not found or error:`, fetchError);
                    await new Promise(r => setTimeout(r, 1000)); // Wait before retry
                    continue;
                }

                if (tradeInProduct.stock === 0) {
                    const stockHistory = tradeInProduct.stockHistory || [];

                    const newStockEntry = {
                        id: crypto.randomUUID(),
                        oldStock: 0,
                        newStock: 1,
                        adjustment: 1,
                        reason: 'Entrou em uma troca',
                        relatedId: newSale.id,
                        timestamp: now.toISOString(),
                        changedBy: userName,
                        details: `Produto recebido em troca de ${customerName} - Venda #${newSale.id}`
                    };

                    const { error: updateError } = await supabase.from('products').update({
                        stock: 1,
                        stockHistory: [...stockHistory, newStockEntry],
                        observations: `Troca pela venda #${newSale.id}`
                    }).eq('id', productId);

                    if (updateError) {
                        console.error(`[addSale] Attempt ${attempts}: Error updating stock:`, updateError);
                        await new Promise(r => setTimeout(r, 1000));
                    } else {

                        await addAuditLog(
                            AuditActionType.STOCK_ADJUST,
                            AuditEntityType.PRODUCT,
                            productId,
                            `Produto de troca entrou no estoque (venda finalizada): ${tradeInProduct.model}. Estoque: 0 → 1`,
                            userId,
                            userName
                        );
                        success = true;
                    }
                } else {
                    // Already has stock (maybe fixed by another process or race condition)
                    success = true;
                }
            }

            if (!success) {
                console.error('[addSale] FAILED to update trade-in stock after multiple attempts:', productId);
            }
        }
    }

    // TELEGRAM NOTIFICATION: Send notification for finalized sales
    if (saleData.status === 'Finalizada') {
        try {
            // Calculate profit from items and build product descriptions
            let totalProfit = 0;
            const productDescriptions: string[] = [];

            if (data.items && Array.isArray(data.items)) {
                // Fetch full product details for all items
                const productIds = data.items.map((item: any) => item.productId).filter(Boolean);
                const { data: productDetails } = await supabase
                    .from('products')
                    .select('id, model, category, brand')
                    .in('id', productIds);

                // Fetch category and brand names
                const categoryIds = (productDetails || []).map(p => p.category).filter(Boolean);
                const brandIds = (productDetails || []).map(p => p.brand).filter(Boolean);

                const [categoriesResult, brandsResult] = await Promise.all([
                    categoryIds.length > 0 ? supabase.from('categories').select('id, name').in('id', categoryIds) : { data: [] },
                    brandIds.length > 0 ? supabase.from('brands').select('id, name').in('id', brandIds) : { data: [] }
                ]);

                const categoryMap = new Map();
                (categoriesResult.data || []).forEach((c: any) => categoryMap.set(c.id, c.name));

                const brandMap = new Map();
                (brandsResult.data || []).forEach((b: any) => brandMap.set(b.id, b.name));

                const productMap = new Map();
                (productDetails || []).forEach((p: any) => productMap.set(p.id, p));

                for (const item of data.items) {
                    const itemNetRevenue = item.netTotal ?? ((item.unitPrice || 0) * (item.quantity || 1));
                    const itemProfit = itemNetRevenue - ((item.costPrice || 0) * (item.quantity || 1));
                    totalProfit += itemProfit;

                    // Build product description: Category Name + Brand Name + Model
                    const product = productMap.get(item.productId);
                    if (product) {
                        const parts = [];
                        const categoryName = categoryMap.get(product.category);
                        const brandName = brandMap.get(product.brand);

                        if (categoryName) parts.push(categoryName);
                        if (brandName) parts.push(brandName);
                        if (product.model) parts.push(product.model);

                        if (parts.length > 0) {
                            productDescriptions.push(parts.join(' '));
                        } else {
                            productDescriptions.push(item.productName || item.model || 'Produto');
                        }
                    } else if (item.productName || item.model) {
                        productDescriptions.push(item.productName || item.model);
                    }
                }
            }


            // Get product description (first item or combined)
            let productDescription = productDescriptions.length > 0
                ? productDescriptions.join(' + ')
                : 'Produto';

            // Calculate daily profit (all finalized sales today in BRT)
            let dailyProfit = totalProfit;
            try {
                // Determine 'today' in Brasilia time (BRT) to match the dashboard's logic
                const brtDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                const year = brtDate.getFullYear();
                const month = String(brtDate.getMonth() + 1).padStart(2, '0');
                const day = String(brtDate.getDate()).padStart(2, '0');

                const startOfDay = `${year}-${month}-${day}T00:00:00-03:00`;
                const endOfDay = `${year}-${month}-${day}T23:59:59-03:00`;

                const { data: todaySales } = await supabase
                    .from('sales')
                    .select('items, total')
                    .eq('company_id', newSale.company_id)
                    .gte('date', startOfDay)
                    .lte('date', endOfDay)
                    .neq('id', newSale.id)
                    .in('status', ['Finalizada', 'Editada']);

                if (todaySales) {
                    dailyProfit = 0;
                    for (const sale of todaySales) {
                        const items = sale.items || [];
                        let saleCost = 0;
                        for (const item of items) {
                            saleCost += ((item.costPrice || 0) + (item.additionalCostPrice || 0)) * (item.quantity || 1);
                        }
                        dailyProfit += (sale.total || 0) - saleCost;
                    }
                    dailyProfit += totalProfit;
                }
            } catch (dailyError) {
                console.warn('[addSale] Could not calculate daily profit:', dailyError);
            }

            await sendSaleNotification({
                productDescription,
                profit: totalProfit,
                dailyProfit
            });
        } catch (telegramError) {
            // Don't fail the sale if Telegram notification fails
            console.warn('[addSale] Telegram notification failed:', telegramError);
        }
    }

    // CASH SESSION UPDATE: Update cash_in_register based on cash payments/change
    // NOTE: deposits/withdrawals are NOT updated here — those are for MANUAL suprimentos/sangrias only
    if (saleData.status === 'Finalizada') {
        try {
            const totalPaid = (data.payments || []).reduce((sum: number, p: any) => sum + p.value, 0);
            const change = Math.max(0, totalPaid - newSale.total);

            // Calculate cash payments
            const cashIncome = (data.payments || []).filter((p: any) => p.method === 'Dinheiro').reduce((sum: number, p: any) => sum + p.value, 0);

            // Net cash impact on the register (cash received minus change given)
            const netCashImpact = cashIncome - change;

            if (netCashImpact !== 0 && newSale.cash_session_id) {
                const { data: session } = await supabase.from('cash_sessions').select('*').eq('id', newSale.cash_session_id).single();
                if (session) {
                    const currentCash = session.cash_in_register || session.cashInRegister || 0;

                    await supabase.from('cash_sessions').update({
                        cash_in_register: currentCash + netCashImpact
                    }).eq('id', newSale.cash_session_id);
                }
            }
        } catch (err) {
            console.error('Failed to update cash session balance:', err);
        }
    }

    // Generate Credit Installments if (Crediário)
    if (saleData.status === 'Finalizada') {
        const creditPayment = data.payments?.find((p: any) =>
            (['Crediário', 'Crediario'].includes(p.method)) && p.creditDetails
        );

        if (creditPayment && creditPayment.creditDetails) {
            try {
                const { creditDetails } = creditPayment;
                const interestRate = Number(creditDetails.interestRate || 0);
                const totalInstallments = Number(creditDetails.totalInstallments || 1);
                // Use financedAmount if available, otherwise fallback to totalAmount (legacy/fallback)
                const productValue = Number(creditDetails.financedAmount ?? creditDetails.totalAmount ?? 0);

                // Regra 2: Cálculo do valor total financiado (Juros Simples)
                const { totalFinanced, installmentAmount } = calculateFinancedAmount(productValue, interestRate, totalInstallments);

                // Gerar Tabela de Amortização (para persistir no sale)
                const amortizationTable = generateAmortizationTable(totalFinanced, installmentAmount, totalInstallments, interestRate);

                const installmentsPayload: CreditInstallment[] = amortizationTable.map((entry: any) => ({
                    id: crypto.randomUUID(),
                    saleId: newSale.id,
                    customerId: newSale.customer_id,
                    installmentNumber: entry.number,
                    totalInstallments: totalInstallments,
                    dueDate: creditDetails.installmentsPreview[entry.number - 1]?.date || getNowISO(),
                    amount: entry.installmentAmount,
                    status: 'pending',
                    amountPaid: 0,
                    interestApplied: entry.interest,
                    amortizationValue: entry.amortization,
                    remainingBalance: entry.remainingBalance,
                    penaltyApplied: 0
                }));

                await addCreditInstallments(installmentsPayload);

                // Update sale with amortization info and initial debt balance
                await supabase.from('sales').update({
                    interest_rate: interestRate,
                    total_financed: totalFinanced,
                    installment_amount: installmentAmount,
                    current_debt_balance: totalFinanced,
                    amortization_table: amortizationTable
                }).eq('id', newSale.id);

                if (newSale.customer_id) {
                    const totalUsed = await syncCustomerCreditLimit(newSale.customer_id);

                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.CUSTOMER,
                        newSale.customer_id,
                        `Aprovação de Crediário: Financiado ${formatCurrency(totalFinanced)} | Novo Saldo Devedor: ${formatCurrency(totalUsed)}`,
                        userId,
                        userName
                    );
                }

            } catch (err: any) {
                console.error('Failed to create credit installments or update limit:', err);
                throw new Error(`Erro no Crediário: ${err.message || 'Falha desconhecida'}`);
            }
        } else if (data.payments?.some((p: any) => p.method === 'Crediário' || p.method === 'Crediario')) {
            throw new Error('Falha: Pagamento Crediário selecionado, mas os detalhes das parcelas estão ausentes.');
        }
    }


    clearCache(['sales', 'products', 'cash_sessions', 'customers']);
    return mappedSale;
};

export const updateSale = async (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    // STEP 0: Fetch the original sale to compare for stock and trade-in changes
    const { data: originalSale } = await supabase.from('sales').select('*').eq('id', data.id).maybeSingle();
    const oldStatus = originalSale?.status || '';
    const originalItems = originalSale?.items || [];

    // Check if a trade-in product was removed from this sale
    if (data.payments && originalSale?.payments) {
        // Find trade-in payments in original that are NOT in the new payments
        const originalTradeIns = (originalSale.payments || []).filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );
        const newTradeInProductIds = (data.payments || [])
            .filter((p: any) => p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId)
            .map((p: any) => p.tradeInDetails.productId);

        for (const originalTradeIn of originalTradeIns) {
            const productId = originalTradeIn.tradeInDetails?.productId;
            if (productId && !newTradeInProductIds.includes(productId)) {
                // Fetch the product to check its history
                const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

                if (product) {
                    const stockHistory = product.stockHistory || [];
                    const isFresh = stockHistory.length <= 1 && product.stock > 0;

                    if (isFresh) {
                        await supabase.from('products').delete().eq('id', productId);
                        await addAuditLog(
                            AuditActionType.DELETE,
                            AuditEntityType.PRODUCT,
                            productId,
                            `Produto de troca removido (venda alterada): ${product.model}`,
                            userId,
                            userName
                        );
                    } else {
                        if (product.stock > 0) {
                            const newStockEntry = {
                                id: crypto.randomUUID(),
                                oldStock: product.stock,
                                newStock: 0,
                                adjustment: -product.stock,
                                reason: 'Remoção de Troca',
                                relatedId: data.id,
                                timestamp: getNowISO(),
                                changedBy: userName,
                                details: 'Produto de troca removido da venda original'
                            };

                            await supabase.from('products').update({
                                stock: 0,
                                stockHistory: [...stockHistory, newStockEntry]
                            }).eq('id', productId);

                            await addAuditLog(
                                AuditActionType.STOCK_ADJUST,
                                AuditEntityType.PRODUCT,
                                productId,
                                `Estoque zerado (troca removida da venda): ${product.model}. Estoque: ${product.stock} → 0`,
                                userId,
                                userName
                            );
                        }
                    }
                }
            }
        }
    }

    // Merge observations for DB storage
    let dbObservations = data.observations || '';
    if (data.internalObservations && !dbObservations.includes('---INTERNAL---')) {
        dbObservations = `${dbObservations}\n---INTERNAL---\n${data.internalObservations}`;
    } else if (data.internalObservations && dbObservations.includes('---INTERNAL---')) {
        // Replace existing internal part if needed, or keep as is if it's already there
        const parts = dbObservations.split('\n---INTERNAL---\n');
        dbObservations = `${parts[0]}\n---INTERNAL---\n${data.internalObservations}`;
    }

    if (data.cashSessionDisplayId && !dbObservations.includes('---CSDID---')) {
        dbObservations = `${dbObservations}\n---CSDID---\n${data.cashSessionDisplayId}`;
    }

    const updatePayload: any = {};
    if (dbObservations !== undefined) updatePayload.observations = dbObservations;

    // RULE: If updating a sale and status moves to Finalizada, it should be 'Editada' 
    // to show both badges, unless it's already Editada.
    let finalStatus = data.status;
    if (finalStatus === 'Finalizada' && oldStatus && oldStatus !== 'Finalizada') {
        finalStatus = 'Editada';
    }

    // Explicitly map known fields to snake_case
    if (data.customerId) updatePayload.customer_id = data.customerId;
    if (data.salespersonId) updatePayload.salesperson_id = data.salespersonId;
    if (finalStatus) updatePayload.status = finalStatus;
    if (data.posTerminal) updatePayload.pos_terminal = data.posTerminal;
    if (data.warrantyTerm) updatePayload.warranty_term = data.warrantyTerm;
    if (data.cashSessionId) updatePayload.cash_session_id = data.cashSessionId;
    if (data.leadOrigin) updatePayload.lead_origin = data.leadOrigin;
    if (data.items) updatePayload.items = data.items;
    if (data.subtotal !== undefined) updatePayload.subtotal = data.subtotal;

    if (data.total !== undefined) updatePayload.total = data.total;
    if (data.payments) updatePayload.payments = data.payments;
    if (data.company_id) updatePayload.company_id = data.company_id;


    // RULE 5 & 6: Strict validation of ownership (EXCEPT ADMINS)
    const callingUserProfile = userId !== 'system' ? await getProfile(userId) : null;
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin';
    const userPermissions = userId !== 'system' ? await resolvePermissions(userId) : {};

    if (userId !== 'system') {
        const { data: existing } = await supabase.from('sales').select('salesperson_id, cash_session_id, status').eq('id', data.id).single();
        if (existing) {
            // GOVERNANCE: Editing completed sales requires admin permission
            if ((existing.status === 'Finalizada' || existing.status === 'Editada') && finalStatus !== 'Cancelada') {
                const canEdit = isCallingAdmin || userPermissions.canEditCompletedSale === true;
                if (!canEdit) {
                    throw new Error('Acesso NEGADO: Apenas administradores podem editar vendas finalizadas.');
                }
                if (!data.editReason) {
                    throw new Error('É obrigatório informar o motivo da edição.');
                }
            }

            // GOVERNANCE: Canceling completed sales requires admin permission
            if (finalStatus === 'Cancelada' && (existing.status === 'Finalizada' || existing.status === 'Editada')) {
                const canCancel = isCallingAdmin || userPermissions.canCancelCompletedSale === true;
                if (!canCancel) {
                    throw new Error('Acesso NEGADO: Apenas administradores podem cancelar vendas finalizadas.');
                }
                if (!data.cancelReason) {
                    throw new Error('É obrigatório informar o motivo do cancelamento.');
                }
            }

            // RULE: IMMUTABLE SALES - Block updates if session is closed (UNLESS admin)
            if (existing.cash_session_id) {
                const { data: session } = await supabase.from('cash_sessions').select('status').eq('id', existing.cash_session_id).single();
                if (session && (session.status === 'fechado' || session.status === 'closed')) {
                    if (!isCallingAdmin) {
                        throw new Error('Acesso NEGADO: Vendas de caixas fechados não podem ser editadas. Realize o cancelamento e lance uma nova venda.');
                    }
                }
            }

            if (!isCallingAdmin && existing.salesperson_id !== userId) {
                throw new Error('Acesso NEGADO: Esta venda pertence a outro vendedor.');
            }
        }
    }

    // GOVERNANCE: Track original_total on first edit
    if (data.total !== undefined && originalSale && originalSale.original_total === null && Number(data.total) !== Number(originalSale.total)) {
        updatePayload.original_total = originalSale.total;
    }

    // GOVERNANCE: Track edit metadata
    if (data.editReason && finalStatus !== 'Cancelada') {
        updatePayload.edited_by = userId !== 'system' ? userId : null;
        updatePayload.edited_at = new Date().toISOString();
        updatePayload.edit_reason = data.editReason;
    }

    // GOVERNANCE: Track cancel metadata
    if (finalStatus === 'Cancelada' && data.cancelReason) {
        updatePayload.canceled_by = userId !== 'system' ? userId : null;
        updatePayload.canceled_at = new Date().toISOString();
        updatePayload.cancel_reason = data.cancelReason;
    }

    const { data: updatedRows, error } = await supabase.from('sales').update(updatePayload).eq('id', data.id).select();
    if (error) {
        console.error('mockApi: Error updating sale:', error);
        throw error;
    }

    // Handle RLS: if no rows returned but no error, use local data
    const updated = (updatedRows && updatedRows.length > 0) ? updatedRows[0] : { id: data.id, ...updatePayload };

    if (!updatedRows || updatedRows.length === 0) {
        console.warn('mockApi: Sale updated successfully but returned no data (likely RLS). Using local payload.');
    }

    const saleDisplayId = updated.display_id || data.id;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SALE,
        data.id,
        `Venda atualizada. Status: ${finalStatus || updated.status}${data.editReason ? ` | Motivo: ${data.editReason}` : ''}${data.cancelReason ? ` | Motivo cancelamento: ${data.cancelReason}` : ''}`,
        userId,
        userName
    );

    // GOVERNANCE: Insert immutable audit log on edit
    if (data.editReason && finalStatus !== 'Cancelada' && updated.cash_session_id) {
        const oldTotal = originalSale?.total || 0;
        const newTotal = data.total || updated.total || 0;
        supabase.from('cash_register_audit_logs').insert({
            cash_register_id: updated.cash_session_id,
            sale_id: data.id,
            action_type: 'sale_edited',
            description: `Admin editou venda #${saleDisplayId} (${formatCurrency(Number(oldTotal))} → ${formatCurrency(Number(newTotal))}). Motivo: ${data.editReason}`,
            performed_by: userId !== 'system' ? userId : '00000000-0000-0000-0000-000000000000',
            performed_by_name: userName,
            performed_at: new Date().toISOString(),
            metadata: { old_total: oldTotal, new_total: newTotal, reason: data.editReason }
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('Failed to insert cash_register_audit_log (edit):', auditErr);
        });
    }

    // GOVERNANCE: Insert immutable audit log on cancel
    if (finalStatus === 'Cancelada' && data.cancelReason && updated.cash_session_id) {
        supabase.from('cash_register_audit_logs').insert({
            cash_register_id: updated.cash_session_id,
            sale_id: data.id,
            action_type: 'sale_canceled',
            description: `Admin cancelou venda #${saleDisplayId} (motivo: ${data.cancelReason})`,
            performed_by: userId !== 'system' ? userId : '00000000-0000-0000-0000-000000000000',
            performed_by_name: userName,
            performed_at: new Date().toISOString(),
            metadata: { total: updated.total, reason: data.cancelReason }
        }).then(({ error: auditErr }) => {
            if (auditErr) console.error('Failed to insert cash_register_audit_log (cancel):', auditErr);
        });
    }

    // If sale was not Finalizada/Editada and now it is, we need to deduct stock
    const newStatus = updated.status;

    if ((oldStatus === 'Pendente' || !oldStatus) && (newStatus === 'Finalizada' || newStatus === 'Editada')) {
        const paymentMethods = data.payments?.map((p: any) => p.method).join(', ') || 'N/A';
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', updated.customer_id).single();
        const customerName = customerData?.name || 'Cliente';

        for (const item of updated.items || []) {
            await adjustProductStock(
                item.productId,
                -Number(item.quantity),
                updated.id,
                'Venda (Finalizada na Edição)',
                customerName,
                paymentMethods,
                userName,
                userId
            );
        }

        // Auto-generate installments when finalizing a pending sale with Credit
        const creditPayments = updated.payments?.filter((p: any) => p.method === 'Crediário') || [];
        if (creditPayments.length > 0 && updated.customer_id && (newStatus === 'Finalizada' || newStatus === 'Editada') && (oldStatus !== 'Finalizada' && oldStatus !== 'Editada')) {
            try {
                let totalAdded = 0;
                for (const credPayment of creditPayments) {
                    const cDetails = credPayment.creditDetails || {};
                    let cPreviews = cDetails.installmentsPreview || [];

                    if (!cPreviews.length) {
                        const amt = Number(cDetails.financedAmount) || Number(credPayment.value) || 0;
                        const cnt = Number(cDetails.totalInstallments) || 1;
                        const val = amt / cnt;
                        const dt = new Date();
                        dt.setDate(dt.getDate() + 30);

                        for (let k = 0; k < cnt; k++) {
                            const d = new Date(dt);
                            d.setMonth(d.getMonth() + k);
                            cPreviews.push({ number: k + 1, date: d.toISOString().split('T')[0], amount: val });
                        }
                    }

                    const iPayload = cPreviews.map((p: any) => ({
                        id: crypto.randomUUID(),
                        saleId: updated.id,
                        customerId: updated.customer_id,
                        installmentNumber: p.number,
                        totalInstallments: cPreviews.length,
                        dueDate: p.date,
                        amount: p.amount,
                        status: 'pending',
                        amountPaid: 0,
                        interestApplied: Number(cDetails.interestRate || 0) > 0 ? (p.amount * (Number(cDetails.interestRate) / 100)) / cPreviews.length : 0, // Estimativa se não provido
                        penaltyApplied: 0
                    }));

                    await addCreditInstallments(iPayload);
                    totalAdded += iPayload.reduce((s: number, i: any) => s + i.amount, 0);
                }

                if (totalAdded > 0) {
                    const { data: cust } = await supabase.from('customers').select('credit_used').eq('id', updated.customer_id).single();
                    if (cust) {
                        await supabase.from('customers').update({ credit_used: (cust.credit_used || 0) + totalAdded }).eq('id', updated.customer_id);
                        await addAuditLog(AuditActionType.UPDATE, AuditEntityType.CUSTOMER, updated.customer_id, `Crédito atualizado via finalização de venda #${updated.display_id}`, userId, userName);
                    }
                }
            } catch (e) { console.error('[updateSale] Error creating installments:', e); }
        }

        // Reconcile payments if they changed between Finalizada/Editada states
        if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && (newStatus === 'Finalizada' || newStatus === 'Editada')) {
            const oldCreditPayments = originalSale?.payments?.filter((p: any) => p.method === 'Crediário') || [];
            const newCreditPayments = updated.payments?.filter((p: any) => p.method === 'Crediário') || [];

            const oldCreditJSON = JSON.stringify(oldCreditPayments);
            const newCreditJSON = JSON.stringify(newCreditPayments);

            if (oldCreditJSON !== newCreditJSON) {
                try {
                    const oldCreditTotal = oldCreditPayments.reduce((s: number, p: any) => s + (p.value || 0), 0);
                    if (oldCreditTotal > 0 && originalSale?.customer_id) {
                        await supabase.from('credit_installments').delete().eq('sale_id', updated.id);
                        const { data: custOld } = await supabase.from('customers').select('credit_used').eq('id', originalSale.customer_id).single();
                        if (custOld) {
                            const newUsed = Math.max(0, (custOld.credit_used || 0) - oldCreditTotal);
                            await supabase.from('customers').update({ credit_used: newUsed }).eq('id', originalSale.customer_id);
                        }
                    }

                    if (newCreditPayments.length > 0 && updated.customer_id) {
                        let totalAdded = 0;
                        for (const credPayment of newCreditPayments) {
                            const cDetails = credPayment.creditDetails || {};
                            let cPreviews = cDetails.installmentsPreview || [];

                            if (!cPreviews.length) {
                                const amt = Number(cDetails.financedAmount) || Number(credPayment.value) || 0;
                                const cnt = Number(cDetails.totalInstallments) || 1;
                                const val = amt / cnt;
                                const dt = new Date(updated.date || new Date().toISOString());
                                dt.setDate(dt.getDate() + 30);

                                for (let k = 0; k < cnt; k++) {
                                    const d = new Date(dt);
                                    d.setMonth(d.getMonth() + k);
                                    cPreviews.push({ number: k + 1, date: d.toISOString().split('T')[0], amount: val });
                                }
                            }

                            const iPayload = cPreviews.map((p: any) => ({
                                id: crypto.randomUUID(),
                                saleId: updated.id,
                                customerId: updated.customer_id,
                                installmentNumber: p.number,
                                totalInstallments: cPreviews.length,
                                dueDate: p.date,
                                amount: p.amount,
                                status: 'pending',
                                amountPaid: 0,
                                interestApplied: Number(cDetails.interestRate || 0) > 0 ? (p.amount * (Number(cDetails.interestRate) / 100)) / cPreviews.length : 0,
                                penaltyApplied: 0
                            }));

                            await addCreditInstallments(iPayload);
                            totalAdded += iPayload.reduce((s: number, i: any) => s + i.amount, 0);
                        }

                        if (totalAdded > 0) {
                            const { data: custNew } = await supabase.from('customers').select('credit_used').eq('id', updated.customer_id).single();
                            if (custNew) {
                                await supabase.from('customers').update({ credit_used: (custNew.credit_used || 0) + totalAdded }).eq('id', updated.customer_id);
                                await addAuditLog(AuditActionType.UPDATE, AuditEntityType.CUSTOMER, updated.customer_id, `Crédito re-aplicado em edição de venda #${updated.display_id}`, userId, userName);
                            }
                        }
                    }
                } catch (err) {
                    console.error('[updateSale] Error reconciling credit installments during edit:', err);
                }
            }
        }

        // TELEGRAM NOTIFICATION: Send notification when pending sale is finalized
        try {
            let totalProfit = 0;
            const productDescriptions: string[] = [];

            // Fetch full product details for all items
            const productIds = (updated.items || []).map((item: any) => item.productId).filter(Boolean);
            const { data: productDetails } = await supabase
                .from('products')
                .select('id, model, category, brand')
                .in('id', productIds);

            // Fetch category and brand names
            const categoryIds = (productDetails || []).map(p => p.category).filter(Boolean);
            const brandIds = (productDetails || []).map(p => p.brand).filter(Boolean);

            const [categoriesResult, brandsResult] = await Promise.all([
                categoryIds.length > 0 ? supabase.from('categories').select('id, name').in('id', categoryIds) : { data: [] },
                brandIds.length > 0 ? supabase.from('brands').select('id, name').in('id', brandIds) : { data: [] }
            ]);

            const categoryMap = new Map();
            (categoriesResult.data || []).forEach((c: any) => categoryMap.set(c.id, c.name));

            const brandMap = new Map();
            (brandsResult.data || []).forEach((b: any) => brandMap.set(b.id, b.name));

            const productMap = new Map();
            (productDetails || []).forEach((p: any) => productMap.set(p.id, p));

            for (const item of updated.items || []) {
                const itemNetRevenue = item.netTotal ?? ((item.unitPrice || 0) * (item.quantity || 1));
                const itemProfit = itemNetRevenue - ((item.costPrice || 0) * (item.quantity || 1));
                totalProfit += itemProfit;

                // Build product description: Category Name + Brand Name + Model
                const product = productMap.get(item.productId);
                if (product) {
                    const parts = [];
                    const categoryName = categoryMap.get(product.category);
                    const brandName = brandMap.get(product.brand);

                    if (categoryName) parts.push(categoryName);
                    if (brandName) parts.push(brandName);
                    if (product.model) parts.push(product.model);

                    if (parts.length > 0) {
                        productDescriptions.push(parts.join(' '));
                    } else {
                        productDescriptions.push(item.productName || item.model || 'Produto');
                    }
                } else if (item.productName || item.model) {
                    productDescriptions.push(item.productName || item.model);
                }
            }

            const productDescription = productDescriptions.length > 0
                ? productDescriptions.join(' + ')
                : 'Produto';

            // Calculate daily profit
            let dailyProfit = totalProfit;
            try {
                const brtDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                const year = brtDate.getFullYear();
                const month = String(brtDate.getMonth() + 1).padStart(2, '0');
                const day = String(brtDate.getDate()).padStart(2, '0');

                const startOfDay = `${year}-${month}-${day}T00:00:00-03:00`;
                const endOfDay = `${year}-${month}-${day}T23:59:59-03:00`;

                const { data: todaySales } = await supabase
                    .from('sales')
                    .select('items, total')
                    .eq('company_id', updated.company_id)
                    .gte('date', startOfDay)
                    .lte('date', endOfDay)
                    .in('status', ['Finalizada', 'Editada']);

                if (todaySales) {
                    dailyProfit = 0;
                    for (const sale of todaySales) {
                        const items = sale.items || [];
                        let saleCost = 0;
                        for (const item of items) {
                            saleCost += ((item.costPrice || 0) + (item.additionalCostPrice || 0)) * (item.quantity || 1);
                        }
                        dailyProfit += (sale.total || 0) - saleCost;
                    }
                }
            } catch (dailyError) {
                console.warn('[updateSale] Could not calculate daily profit:', dailyError);
            }

            await sendSaleNotification({
                productDescription,
                profit: totalProfit,
                dailyProfit
            });
        } catch (telegramError) {
            console.warn('[updateSale] Telegram notification failed:', telegramError);
        }
    }

    // If sale is Cancelada or changed to Pendente (from Finalizada), we need to revert Credit Limit
    if (originalSale && (oldStatus === 'Finalizada' || oldStatus === 'Editada') && (newStatus === 'Cancelada' || newStatus === 'Pendente')) {
        const oldCreditPayments = originalSale.payments?.filter((p: any) => p.method === 'Crediário') || [];

        if (oldCreditPayments.length > 0 && originalSale.customer_id) {

            // 1. Delete installments for this sale
            const { error: deleteError } = await supabase
                .from('credit_installments')
                .delete()
                .eq('sale_id', data.id);

            if (deleteError) {
                console.error('[updateSale] Error deleting credit installments:', deleteError);
            }

            // 2. Restore customer credit limit
            const creditUsedToRevert = oldCreditPayments.reduce((s: number, p: any) => s + (p.value || 0), 0);

            if (creditUsedToRevert > 0) {
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('credit_used, name')
                    .eq('id', originalSale.customer_id)
                    .single();

                if (customerData) {
                    const currentUsed = customerData.credit_used || 0;
                    const newCreditUsed = Math.max(0, currentUsed - creditUsedToRevert);

                    await supabase
                        .from('customers')
                        .update({ credit_used: newCreditUsed })
                        .eq('id', originalSale.customer_id);

                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.CUSTOMER,
                        originalSale.customer_id,
                        `Limite restaurado (Venda ${newStatus}): +${formatCurrency(creditUsedToRevert)}`,
                        userId,
                        userName
                    );
                }
            }
        }
    }

    // If sale was Finalizada/Editada and now is Pendente (Estorno), we need to RETURN stock
    if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && newStatus === 'Pendente') {
        const paymentMethods = data.payments?.map((p: any) => p.method).join(', ') || 'N/A';
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', updated.customer_id).maybeSingle();
        const customerName = customerData?.name || 'Cliente';

        for (const item of originalItems) { // Use original items to be safe, or updated if you trust the cart state matches
            // We use updated.items primarily, but since we are reverting, we assume the items in the sale are what we are returning.
            // If the user edited items AND changed to pending, updated.items reflects the NEW state.
            // Ideally, we return what was previously taken (originalItems).
            // However, if the user changed items, `updateSale` might have already processed the diffs? 
            // Wait, `updateSale` handles diffs below in "If sale was already finalized and is being edited".
            // BUT that block checks `if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && newStatus === 'Editada')`.
            // So if newStatus is 'Pendente', that diff block is SKIPPED.
            // Therefore, we should return the ORIGINAL items to stock, because those were the ones deducted.
            // BUT, wait. If the user changed the cart (e.g. removed an item) AND set to Pendente, 
            // we want the final state of the Pending sale to reflect the new cart.
            // Code-wise, `updated` already has the NEW items saved to DB.
            // The stock adjustment should be: Return EVERYTHING that was previously deducted.

            await adjustProductStock(
                item.productId,
                Number(item.quantity),
                updated.id,
                'Venda alterada para Pendente (Estorno)',
                customerName,
                paymentMethods,
                userName,
                userId
            );
        }
    }

    // If sale was already finalized and is being edited, handle stock differences
    if ((oldStatus === 'Finalizada' || oldStatus === 'Editada') && newStatus === 'Editada') {
        const currentItems = data.items || [];
        const { data: customerData } = await supabase.from('customers').select('name').eq('id', updated.customer_id).maybeSingle();
        const customerName = customerData?.name || 'Cliente';
        const paymentMethods = data.payments?.map((p: any) => p.method).join(', ') || 'N/A';

        // 1. Check original items vs current items (removals and reductions)
        for (const oldItem of originalItems) {
            const newItem = currentItems.find((i: any) => i.productId === oldItem.productId);
            if (!newItem) {
                // Item completely removed - Return full quantity
                await adjustProductStock(oldItem.productId, Number(oldItem.quantity), updated.id, 'Item Removido da Venda', customerName, paymentMethods, userName, userId);
            } else if (Number(newItem.quantity) < Number(oldItem.quantity)) {
                // Quantity reduced - Return difference
                const diff = Number(oldItem.quantity) - Number(newItem.quantity);
                await adjustProductStock(oldItem.productId, diff, updated.id, 'Qtd Reduzida na Venda', customerName, paymentMethods, userName, userId);
            } else if (Number(newItem.quantity) > Number(oldItem.quantity)) {
                // Quantity increased - Deduct difference
                const diff = Number(newItem.quantity) - Number(oldItem.quantity);
                await adjustProductStock(oldItem.productId, -diff, updated.id, 'Qtd Aumentada na Venda', customerName, paymentMethods, userName, userId);
            }
        }

        // 2. Check for new items added during edit
        for (const newItem of currentItems) {
            const wasOld = originalItems.find((i: any) => i.productId === newItem.productId);
            if (!wasOld) {
                // Completely new item - Deduct full quantity
                await adjustProductStock(newItem.productId, -Number(newItem.quantity), updated.id, 'Item Adicionado na Edição', customerName, paymentMethods, userName, userId);
            }
        }
    }

    // TRADE-IN STOCK MANAGEMENT: Handle trade-in product stock based on sale status
    // Trade-in products should only be in stock when sale is Finalizada
    if (data.payments) {
        const tradeInPayments = (data.payments || []).filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );

        for (const tradeInPayment of tradeInPayments) {
            const productId = tradeInPayment.tradeInDetails.productId;
            const { data: product } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

            if (product) {
                const wasFinalized = oldStatus === 'Finalizada' || oldStatus === 'Editada';
                const isNowFinalized = newStatus === 'Finalizada' || newStatus === 'Editada';
                const isNowPendingOrCancelled = newStatus === 'Pendente' || newStatus === 'Cancelada';

                // Case 1: Sale was Finalized and now is Pending/Cancelled -> Remove trade-in from stock
                if (wasFinalized && isNowPendingOrCancelled) {
                    const stockHistory = product.stockHistory || [];

                    // Use CURRENT STOCK as the source of truth:
                    // stock > 0 means the product is still in inventory (not sold to anyone else)
                    // stock === 0 means it was already sold to another customer
                    if (product.stock > 0) {
                        const newStockEntry = {
                            id: crypto.randomUUID(),
                            oldStock: product.stock,
                            newStock: 0,
                            adjustment: -product.stock,
                            reason: `Venda ${newStatus}`,
                            relatedId: data.id,
                            timestamp: getNowISO(),
                            changedBy: userName,
                            details: `Produto de troca removido do estoque (venda ${newStatus.toLowerCase()})`
                        };

                        await supabase.from('products').update({
                            stock: 0,
                            stockHistory: [...stockHistory, newStockEntry]
                        }).eq('id', productId);

                        await addAuditLog(
                            AuditActionType.STOCK_ADJUST,
                            AuditEntityType.PRODUCT,
                            productId,
                            `Estoque zerado (venda ${newStatus.toLowerCase()}): ${product.model}. Estoque: ${product.stock} → 0`,
                            userId,
                            userName
                        );
                    }
                    // If stock is already 0, the product was sold to another customer - nothing to do
                }

                // Case 2: Sale was Pending and now is Finalized -> Add trade-in to stock
                else if (!wasFinalized && isNowFinalized && product.stock === 0) {
                    const stockHistory = product.stockHistory || [];

                    const newStockEntry = {
                        id: crypto.randomUUID(),
                        oldStock: 0,
                        newStock: 1,
                        adjustment: 1,
                        reason: 'Entrou em uma troca',
                        relatedId: data.id,
                        timestamp: getNowISO(),
                        changedBy: userName,
                        details: `Produto recebido em troca - Venda #${data.id}`
                    };

                    await supabase.from('products').update({
                        stock: 1,
                        stockHistory: [...stockHistory, newStockEntry],
                        observations: `Troca pela venda #${data.id}`
                    }).eq('id', productId);

                    await addAuditLog(
                        AuditActionType.STOCK_ADJUST,
                        AuditEntityType.PRODUCT,
                        productId,
                        `Produto de troca entrou no estoque (venda finalizada): ${product.model}. Estoque: 0 → 1`,
                        userId,
                        userName
                    );
                }
            }
        }
    }

    // COMMISSION CANCELLATION/RECALCULATION: Update commissions on sale edit
    try {
        const { recalculateCommissionsForSale, cancelCommissionsForSale } = await import('./commissionService.ts');

        if (newStatus === 'Cancelada') {
            await cancelCommissionsForSale(updated.id, userId, userName, 'Venda cancelada durante edição');
        } else if (['Finalizada', 'Editada', 'Pendente'].includes(newStatus)) {
            const currentItems = data.items || updated.items || [];
            if (currentItems && Array.isArray(currentItems) && currentItems.length > 0) {
                const commissionItems = currentItems.map((item: any) => ({
                    productId: item.productId,
                    unitPrice: item.unitPrice || 0,
                    quantity: item.quantity || 1,
                    discountType: item.discountType || 'R$',
                    discountValue: item.discountValue || 0,
                    netTotal: item.netTotal || ((item.unitPrice || 0) * (item.quantity || 1)),
                    productName: item.productName || item.model || 'Produto',
                    costPrice: item.costPrice || 0,
                }));
                await recalculateCommissionsForSale(
                    updated.id,
                    updated.salesperson_id || userId,
                    commissionItems,
                    userId,
                    userName,
                    updated.date,
                    newStatus
                );
            }
        }
    } catch (commErr) {
        console.warn('[updateSale] Commission recalculation failed (non-blocking):', commErr);
    }

    clearCache(['sales', 'products', 'cash_sessions']);

    return {
        ...updated,
        customerId: updated.customer_id,
        salespersonId: updated.salesperson_id,
        posTerminal: updated.pos_terminal,
        warrantyTerm: updated.warranty_term,
        cashSessionId: updated.cash_session_id,
        leadOrigin: updated.lead_origin,
        date: updated.date
    };
};

export const cancelSale = async (id: string, reason: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: sale, error: fetchError } = await supabase.from('sales').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    // RULE 5 & 6: Strict validation of ownership (EXCEPT ADMINS)
    const callingUserProfile = userId !== 'system' ? await getProfile(userId) : null;
    const isCallingAdmin = callingUserProfile?.permissionProfileId === 'profile-admin';

    // Allow if salesperson OR if the sale belongs to a cash session owned by the user
    let isOwnerBySession = false;
    if (sale.cash_session_id) {
        const { data: session } = await supabase.from('cash_sessions').select('user_id').eq('id', sale.cash_session_id).single();
        if (session && session.user_id === userId) {
            isOwnerBySession = true;
        }
    }

    // RULE: IMMUTABLE SALES - Restrict cancellation if session is closed
    if (sale.cash_session_id) {
        const { data: session } = await supabase.from('cash_sessions').select('status').eq('id', sale.cash_session_id).single();
        if (session && (session.status === 'fechado' || session.status === 'closed')) {
            if (!isCallingAdmin) {
                throw new Error('Acesso NEGADO: Apenas administradores podem cancelar vendas de caixas fechados.');
            }
        }
    }

    if (userId !== 'system' && !isCallingAdmin && sale.salesperson_id !== userId && !isOwnerBySession) {
        throw new Error('Acesso NEGADO: Você não pode cancelar uma venda de outro vendedor, a menos que seja o dono do caixa.');
    }

    // Salvar o motivo de cancelamento usando um separador específico, preservando as observações originais
    // Formato: observações_originais\n---CANCEL_REASON---\nmotivo
    const separator = '\n---CANCEL_REASON---\n';
    const updatedObservations = sale.observations
        ? `${sale.observations}${separator}${reason}`
        : `${separator}${reason}`;

    const { data: updatedSale, error: updateError } = await supabase.from('sales').update({
        status: 'Cancelada',
        observations: updatedObservations
    }).eq('id', id).select().single();
    if (updateError) throw updateError;

    // REVERT ORCAMENTO STATUS IF APPLICABLE
    try {
        const { data: orcamento } = await supabase
            .from('orcamentos')
            .select('id')
            .eq('venda_id', id)
            .maybeSingle();

        if (orcamento) {
            await supabase
                .from('orcamentos')
                .update({
                    status: 'finalizado',
                    venda_id: null,
                    convertido_em: null,
                    updated_at: getNowISO()
                })
                .eq('id', orcamento.id);

            clearCache(['orcamentos']);
        }
    } catch (err) {
        console.warn('cancelSale: Error reverting orcamento status:', err);
    }

    // Add main sale cancel audit log
    await addAuditLog(
        AuditActionType.SALE_CANCEL,
        AuditEntityType.SALE,
        id,
        `Venda Cancelada. Motivo: ${reason}`,
        userId,
        userName
    );

    if (sale.items && Array.isArray(sale.items)) {
        const now = getNowISO();
        for (const item of sale.items) {
            const { data: product } = await supabase.from('products').select('*').eq('id', item.productId).single();
            if (product) {
                const currentStock = Number(product.stock);
                const newStock = currentStock + item.quantity;

                await addAuditLog(
                    AuditActionType.SALE_CANCEL,
                    AuditEntityType.PRODUCT,
                    item.productId,
                    `Venda #${sale.id} Cancelada. Motivo: ${reason}. Estoque retornado: +${item.quantity}`,
                    userId,
                    userName
                );

                // Add to stockHistory column
                const existingStockHistory = product.stockHistory || [];
                const newStockEntry = {
                    id: crypto.randomUUID(),
                    oldStock: currentStock,
                    newStock: newStock,
                    adjustment: item.quantity,
                    reason: 'Cancelamento de Venda',
                    relatedId: sale.id,
                    timestamp: now,
                    changedBy: userName,
                    details: `Motivo: ${reason}`
                };

                await supabase.from('products').update({
                    stock: newStock,
                    stockHistory: [...existingStockHistory, newStockEntry]
                }).eq('id', item.productId);
            }
        }
    }

    // COMMISSION CANCELLATION: Cancel pending commissions for this sale
    try {
        const { cancelCommissionsForSale } = await import('./commissionService.ts');
        await cancelCommissionsForSale(id, userId, userName, `Venda cancelada: ${reason}`);
    } catch (commErr) {
        console.warn('[cancelSale] Commission cancellation failed (non-blocking):', commErr);
    }

    // TRADE-IN STOCK MANAGEMENT: Remove trade-in products from stock when sale is cancelled
    const tradeInAlreadySoldProducts: { model: string; sku: string }[] = [];

    if (sale.payments && Array.isArray(sale.payments)) {
        const tradeInPayments = sale.payments.filter((p: any) =>
            p.method === 'Aparelho na Troca' && p.tradeInDetails?.productId
        );

        for (const tradeInPayment of tradeInPayments) {
            const productId = tradeInPayment.tradeInDetails.productId;
            const { data: tradeInProduct } = await supabase.from('products').select('*').eq('id', productId).maybeSingle();

            if (tradeInProduct) {
                const stockHistory = tradeInProduct.stockHistory || [];

                // Use CURRENT STOCK as the source of truth:
                // stock > 0 means the product is still in inventory (not sold to anyone else)
                // stock === 0 means it was already sold to another customer
                if (tradeInProduct.stock > 0) {
                    // Product is still in stock - zero it out
                    await supabase.from('products').update({
                        stock: 0,
                        stockHistory: [
                            ...stockHistory,
                            {
                                id: crypto.randomUUID(),
                                oldStock: tradeInProduct.stock,
                                newStock: 0,
                                adjustment: -tradeInProduct.stock,
                                reason: 'Cancelamento de Venda (trade-in)',
                                relatedId: sale.id,
                                timestamp: getNowISO(),
                                changedBy: userName,
                                details: `Motivo: ${reason}`
                            }
                        ]
                    }).eq('id', productId);

                    await addAuditLog(
                        AuditActionType.STOCK_ADJUST,
                        AuditEntityType.PRODUCT,
                        productId,
                        `Produto de troca removido (venda cancelada): ${tradeInProduct.model}. Estoque: ${tradeInProduct.stock} → 0. Motivo: ${reason}`,
                        userId,
                        userName
                    );
                } else {
                    // Product stock is already 0 - it was sold to another customer
                    tradeInAlreadySoldProducts.push({
                        model: tradeInProduct.model,
                        sku: tradeInProduct.sku
                    });

                    await addAuditLog(
                        AuditActionType.STOCK_ADJUST,
                        AuditEntityType.PRODUCT,
                        productId,
                        `Produto de troca não removido (estoque já em 0, possivelmente vendido): ${tradeInProduct.model}`,
                        userId,
                        userName
                    );
                }
            }
        }
    }

    // CREDIT REVERT: If sale had "Crediário", revert the customer's credit_used and delete installments
    if (sale.payments && Array.isArray(sale.payments)) {
        const creditPayment = sale.payments.find((p: any) =>
            p.method === 'Crediário' || p.method === 'Crediario'
        );

        if (creditPayment && sale.customer_id) {
            try {
                // 1. Delete installments
                const { error: delError } = await supabase.from('credit_installments').delete().eq('sale_id', sale.id);
                if (delError) console.error('Error deleting installments:', delError);

                // 2. Fetch current customer credit_used
                const { data: customer } = await supabase
                    .from('customers')
                    .select('credit_used, name')
                    .eq('id', sale.customer_id)
                    .single();

                if (customer) {
                    // Important: Use financedAmount if available, otherwise fallback to payment value
                    // The creditDetails might be in creditPayment.creditDetails
                    const financedAmount = creditPayment.creditDetails?.financedAmount || creditPayment.value;
                    const currentUsed = Number(customer.credit_used || 0);
                    const newUsed = Math.max(0, currentUsed - Number(financedAmount));

                    const { error: updError } = await supabase
                        .from('customers')
                        .update({ credit_used: newUsed })
                        .eq('id', sale.customer_id);

                    if (updError) {
                        console.error('Error updating customer credit_used:', updError);
                    } else {
                        await addAuditLog(
                            AuditActionType.UPDATE,
                            AuditEntityType.CUSTOMER,
                            sale.customer_id,
                            `Estorno de crédito (venda cancelada): -${formatCurrency(financedAmount)}. Novo total: ${formatCurrency(newUsed)}`,
                            userId,
                            userName
                        );
                    }
                }
            } catch (err) {
                console.error('Error reverting credit on cancellation:', err);
            }
        }
    }

    clearCache(['sales', 'products', 'customers']);

    // Return with info about trade-in products that were already sold
    return {
        ...updatedSale,
        customerId: updatedSale.customer_id,
        salespersonId: updatedSale.salesperson_id,
        cashSessionId: updatedSale.cash_session_id,
        warrantyTerm: updatedSale.warranty_term,
        tradeInAlreadySold: tradeInAlreadySoldProducts.length > 0 ? tradeInAlreadySoldProducts : undefined
    };
};

export const getCustomerSales = async (customerId: string): Promise<Sale[]> => {
    // Optimization: Reuse the cached 'sales' list instead of a specific DB query
    const allSales = await getSales();
    return allSales.filter(s => s.customerId === customerId);
};
