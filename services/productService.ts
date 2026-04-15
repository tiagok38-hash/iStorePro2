
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient.ts';
import { Product, Customer, Sale, User, Supplier, PurchaseOrder, Brand, Category, ProductModel, Grade, GradeValue, TodaySale, Payment, AuditLog, AuditActionType, AuditEntityType, ProductConditionParameter, StorageLocationParameter, WarrantyParameter, PaymentMethodParameter, CardConfigData, CompanyInfo, PermissionProfile, PermissionSet, ReceiptTermParameter, CashSession, CashMovement, StockHistoryEntry, PurchaseItem, PriceHistoryEntry, TradeInEntry, Service, ServiceOrder, CatalogItem, TransactionCategory, FinancialTransaction, CrmDeal, CrmActivity, CrmColumn, CreditInstallment, CreditSettings, InventoryMovement, FinancialStatus, CustomerDevice, ElectronicType } from '../types.ts';
import { getNowISO, getTodayDateString, formatDateTimeBR } from '../utils/dateUtils.ts';
import { sendSaleNotification, sendPurchaseNotification } from './telegramService.ts';
import { calculateInstallmentDates, calculateFinancedAmount, generateAmortizationTable } from '../utils/creditUtils.ts';
import { sortProductsCommercial } from '../utils/productSorting.ts';

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

// --- PRODUCTS ---

export const mapProduct = (p: any): Product => ({
    ...p,
    supplierId: p.supplier_id || p.supplierId,
    storageLocation: p.storage_location || p.storageLocation,
    costPrice: p.cost_price || p.costPrice,
    totalCostPrice: (Number(p.cost_price || 0) + Number(p.additional_cost_price || 0)),
    wholesalePrice: p.wholesale_price || p.wholesalePrice,
    batteryHealth: p.battery_health || p.batteryHealth,
    serialNumber: p.serial_number || p.serialNumber,
    additionalCostPrice: p.additional_cost_price || p.additionalCostPrice,
    stockHistory: p.stock_history || p.stockHistory || [],
    priceHistory: p.price_history || p.priceHistory || [],
    createdAt: p.created_at || p.createdAt,
    updatedAt: p.updated_at || p.updatedAt,
    minimumStock: p.minimum_stock || p.minimumStock,
    createdBy: p.created_by || p.createdBy,
    createdByName: p.created_by_name || p.createdByName,
});

export const getProducts = async (filters: { model?: string, categoryId?: string, brandId?: string, onlyInStock?: boolean, select?: string } = {}): Promise<Product[]> => {
    const cacheKey = `products_${JSON.stringify(filters)}`;
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            let query = supabase.from('products').select(filters.select || '*');

            if (filters.model) query = query.ilike('model', `%${filters.model}%`);
            if (filters.categoryId) query = query.eq('category', filters.categoryId); // Prop is categoryId but col is category
            if (filters.brandId) query = query.eq('brand', filters.brandId); // Prop is brandId but col is brand
            if (filters.onlyInStock) query = query.gt('stock', 0);

            // Robustness: Always limit to a sane amount for general fetch (e.g. 1000 items)
            // If they need more, they should use specific search functions.
            const { data, error } = await query.order('createdAt', { ascending: false }).limit(1000);

            if (error) throw error;
            return (data || []).map(mapProduct);
        });
    });
};

// Specialized Search for high-volume data
export const searchProducts = async (term: string): Promise<Product[]> => {
    if (!term || term.length < 2) return [];

    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`model.ilike.%${term}%,imei1.ilike.%${term}%,imei2.ilike.%${term}%,"serialNumber".ilike.%${term}%`)
            .limit(50);

        if (error) throw error;
        return (data || []).map(mapProduct);
    });
};

// ==========================================
// SERVER-SIDE SEARCH ENGINE (PostgreSQL RPC)
// ==========================================
export interface SearchProductsParams {
    query: string;
    stockFilter?: 'all' | 'in_stock' | 'out_of_stock';
    conditionFilter?: string;
    locationFilter?: string;
    typeFilter?: string;
    sortOrder?: 'relevance' | 'newest' | 'oldest';
    limit?: number;
    offset?: number;
}

export interface SearchProductsResult {
    products: Product[];
    totalCount: number;
}

export const searchProductsRPC = async (params: SearchProductsParams): Promise<SearchProductsResult> => {
    const {
        query,
        stockFilter = 'in_stock',
        conditionFilter = 'Todos',
        locationFilter = 'Todos',
        typeFilter = 'Todos',
        sortOrder = 'relevance',
        limit = 15,
        offset = 0
    } = params;

    return fetchWithRetry(async () => {
        // Strict Enforcement for iPhones: Fetch all, sort locally, slice.
        const isIphoneSearch = query.trim().toLowerCase().includes('iphone');
        const fetchLimit = isIphoneSearch ? 2000 : limit;
        const fetchOffset = isIphoneSearch ? 0 : offset;

        const { data, error } = await supabase.rpc('search_products', {
            p_query: query,
            p_stock_filter: stockFilter,
            p_condition_filter: conditionFilter,
            p_location_filter: locationFilter,
            p_type_filter: typeFilter,
            p_sort_order: query.trim() ? sortOrder : (sortOrder === 'relevance' ? 'newest' : sortOrder),
            p_limit: fetchLimit,
            p_offset: fetchOffset
        });

        let rows = data || [];
        let totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

        // Fallback for fast identifier searching (IMEI, SN, SKU) >= 4 digits
        const cleanQuery = query.trim();
        if (cleanQuery.length >= 4 && !cleanQuery.includes(' ')) {
            try {
                let identifierQuery = supabase
                    .from('products')
                    .select('*')
                    .or(`imei1.ilike.${cleanQuery}%,imei2.ilike.${cleanQuery}%,serialNumber.ilike.${cleanQuery}%,sku.ilike.${cleanQuery}%`)
                    .limit(fetchLimit);

                if (stockFilter === 'in_stock') identifierQuery = identifierQuery.gt('stock', 0);
                else if (stockFilter === 'out_of_stock') identifierQuery = identifierQuery.eq('stock', 0);

                if (conditionFilter !== 'Todos') identifierQuery = identifierQuery.eq('condition', conditionFilter);
                if (locationFilter !== 'Todos') identifierQuery = identifierQuery.eq('storageLocation', locationFilter);

                const { data: identifierData } = await identifierQuery;

                if (identifierData && identifierData.length > 0) {
                    const validIdentifierRows = identifierData.filter((p: any) => {
                        if (typeFilter === 'Produtos Apple') return (p.brand || '').toLowerCase() === 'apple';
                        if (typeFilter === 'Produtos Variados') return (p.brand || '').toLowerCase() !== 'apple';
                        if (typeFilter === 'Produtos de troca') return p.origin === 'Troca' || p.origin === 'Comprado de Cliente';
                        if (typeFilter === 'Com Comissão') return p.commission_enabled === true;
                        return true;
                    });

                    const existingIds = new Set(rows.map((r: any) => r.id));
                    const newRows = validIdentifierRows.filter((r: any) => !existingIds.has(r.id));

                    rows = [...newRows, ...rows];
                    totalCount = Math.max(totalCount, rows.length);
                }
            } catch (err) {
                console.warn('Fallback identifier search failed:', err);
            }
        }

        if (error && rows.length === 0) {
            console.warn('searchProductsRPC failed, will throw:', error);
            throw error;
        }

        let products: Product[] = rows.map((p: any) => ({
            ...p,
            supplierId: p.supplier_id || p.supplierId,
            storageLocation: p.storage_location || p.storageLocation,
            costPrice: p.cost_price || p.costPrice,
            wholesalePrice: p.wholesale_price || p.wholesalePrice,
            batteryHealth: p.battery_health || p.batteryHealth,
            serialNumber: p.serial_number || p.serialNumber,
            additionalCostPrice: p.additional_cost_price || p.additionalCostPrice,
            stockHistory: p.stock_history || p.stockHistory,
            priceHistory: p.price_history || p.priceHistory,
            createdAt: p.created_at || p.createdAt,
            updatedAt: p.updated_at || p.updatedAt,
            minimumStock: p.minimum_stock || p.minimumStock,
            createdBy: p.created_by || p.createdBy,
            createdByName: p.created_by_name || p.createdByName,
        }));

        if (isIphoneSearch && products.length > 0) {
            // Apply strict deterministic ordering in memory
            products.sort((a, b) => sortProductsCommercial(
                a,
                b,
                sortOrder as any,
                (item) => ({ salePrice: item.price, costPrice: item.costPrice || 0 })
            ));
            // Slice the requested pagination window
            products = products.slice(offset, offset + limit);
        }

        return { products, totalCount };
    });
};

export const getProductsByPurchaseForLabels = async (purchaseId: string): Promise<Product[]> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('id, model, brand, sku, serialNumber, imei1, imei2, barcodes, price, createdAt, condition, color, storage, warranty, purchaseOrderId')
            .eq('purchaseOrderId', purchaseId)
            .order('createdAt', { ascending: true });

        if (error) {
            console.error('Error fetching products by purchase for labels:', error);
            throw error;
        }

        // Map camelCase
        return (data || []).map((p: any) => ({
            ...p,
            serialNumber: p.serial_number || p.serialNumber,
            purchaseOrderId: p.purchase_order_id || p.purchaseOrderId || p.purchaseId,
            createdAt: p.created_at || p.createdAt,
        }));
    });
};

export const addProduct = async (data: any, userId: string = 'system', userName: string = 'Sistema'): Promise<Product> => {
    const {
        selectedCustomerId,
        stockHistory,
        priceHistory,
        createdByName,
        ...rest
    } = data;
    const now = getNowISO();

    const imei1 = rest.imei1?.trim() || null;
    const imei2 = rest.imei2?.trim() || null;
    const serialNumber = rest.serialNumber?.trim() || null;

    // PROFESSIONAL DEVICE LIFECYCLE: Check if IMEI/Serial already exists
    let existingProduct = null;

    if (imei1 || imei2 || serialNumber) {
        try {
            // Use separate queries to safely handle special characters that break PostgREST .or() string parser
            let existing: any = null;

            if (serialNumber) {
                const { data } = await supabase.from('products').select('*').eq('serialNumber', serialNumber).limit(1);
                if (data && data.length > 0) existing = data[0];
            }

            if (!existing && imei1) {
                const { data } = await supabase.from('products').select('*').or(`imei1.eq.${imei1},imei2.eq.${imei1}`).limit(1);
                if (data && data.length > 0) existing = data[0];
            }

            if (!existing && imei2) {
                const { data } = await supabase.from('products').select('*').or(`imei1.eq.${imei2},imei2.eq.${imei2}`).limit(1);
                if (data && data.length > 0) existing = data[0];
            }

            existingProduct = existing;
        } catch (e: any) {
            if (e.message === 'SEARCH_TIMEOUT') {
                console.warn('[addProduct] Search timed out. Proceeding as new product.');
                existingProduct = null;
            } else {
                throw e;
            }
        }
    }

    // If product exists, check its status
    if (existingProduct) {
        if (existingProduct.stock > 0) {
            // ❌ BLOCK: Product is currently in stock (real duplicate)
            throw new Error(`Este produto já está em estoque com IMEI/Serial: ${imei1 || imei2 || serialNumber}`);
        }

        // ✅ REACTIVATE: Product was sold, now being repurchased

        const newStock = data.stock !== undefined ? data.stock : 1;
        const newStockHistoryEntry = {
            id: crypto.randomUUID(),
            oldStock: 0,
            newStock: newStock,
            adjustment: newStock,
            reason: data.origin === 'Troca' ? 'Recompra (Troca)' : 'Reentrada',
            timestamp: now,
            changedBy: userName,
            details: data.origin === 'Troca' ? 'Produto retornou via troca no PDV' : 'Produto reativado no sistema'
        };

        const existingHistory = existingProduct.stockHistory || [];

        const updatePayload: any = {
            stock: newStock,
            costPrice: data.costPrice,
            price: data.price,
            wholesalePrice: data.wholesalePrice,
            condition: data.condition,
            storageLocation: data.storageLocation,
            warranty: data.warranty || existingProduct.warranty,
            origin: data.origin || 'Recompra',
            supplier_id: data.supplierId || existingProduct.supplier_id,
            updatedAt: now,
            createdAt: now,
            createdBy: userId,
            createdByName: userName,
            stockHistory: [...existingHistory, newStockHistoryEntry]
        };

        // Simple UPDATE without requiring response
        const { error: updateError } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', existingProduct.id);

        if (updateError) throw updateError;


        // Return the merged product data
        const reactivatedProduct = { ...existingProduct, ...updatePayload };

        // Fire-and-forget audit log (non-blocking)
        addAuditLog(
            AuditActionType.STOCK_LAUNCH,
            AuditEntityType.PRODUCT,
            existingProduct.id,
            `Produto reativado (${data.origin || 'Recompra'}): ${existingProduct.model}. Estoque: 0 → ${newStock}.`,
            userId,
            userName
        ).catch(e => console.warn('[addProduct] Audit log failed:', e));

        clearCache(['products']);
        return reactivatedProduct as Product;
    }

    // ✅ NEW PRODUCT: IMEI/Serial doesn't exist, create it

    // If this is a trade-in from a customer (selectedCustomerId), find or create linked supplier
    let resolvedSupplierId = data.supplierId;
    let resolvedSupplierName = data.supplier || data.supplierName;

    if (selectedCustomerId && !resolvedSupplierId) {
        // This is a trade-in from a customer - find or create a supplier linked to this customer
        try {
            const { data: customer } = await supabase.from('customers').select('*').eq('id', selectedCustomerId).single();
            if (customer) {
                // Use the findOrCreateSupplierFromCustomer function (defined later in the file)
                // For now, inline the logic to avoid circular dependency issues
                const { data: existingSupplier } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('linked_customer_id', selectedCustomerId)
                    .maybeSingle();

                if (existingSupplier) {
                    resolvedSupplierId = existingSupplier.id;
                    resolvedSupplierName = existingSupplier.name;
                } else {
                    // Create a new supplier linked to this customer
                    const newSupplierData = {
                        name: customer.name,
                        email: customer.email || null,
                        phone: customer.phone || null,
                        linked_customer_id: selectedCustomerId,
                        instagram: customer.instagram || null
                    };
                    const { data: createdSupplier } = await supabase
                        .from('suppliers')
                        .insert([newSupplierData])
                        .select()
                        .single();

                    if (createdSupplier) {
                        resolvedSupplierId = createdSupplier.id;
                        resolvedSupplierName = createdSupplier.name;
                        clearCache(['suppliers']);

                    }
                }
            }
        } catch (e) {
            console.warn('[addProduct] Could not find/create supplier from customer:', e);
            // Fallback to using customer ID directly
            resolvedSupplierId = selectedCustomerId;
        }
    } else if (!resolvedSupplierName && resolvedSupplierId) {
        // Just resolve the supplier name
        try {
            const { data: s } = await supabase.from('suppliers').select('name').eq('id', resolvedSupplierId).maybeSingle();
            if (s) resolvedSupplierName = s.name;
        } catch (e) {
            console.warn('[addProduct] Could not resolve supplier name:', e);
        }
    }

    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const nextSku = `#${(count || 0) + 1}`;

    const productData: any = {
        name: data.name,
        brand: data.brand,
        model: data.model,
        color: data.color,
        storage: data.storage || data.storageCapacity,
        condition: data.condition,
        price: data.price,
        costPrice: data.costPrice,
        wholesalePrice: data.wholesalePrice,
        stock: data.stock,
        sku: data.sku || nextSku,
        category: data.category,
        supplier_id: resolvedSupplierId || null, // Use the resolved supplier ID
        // supplier: is removed because it's not in the DB
        imei1: imei1,
        imei2: imei2,
        serialNumber: serialNumber,
        batteryHealth: data.batteryHealth,
        origin: data.origin,
        storageLocation: data.storageLocation,
        warranty: data.warranty,
        createdAt: now,
        updatedAt: now,
        // Track who created the product
        createdBy: data.createdBy || userId || null,
        createdByName: data.createdByName || userName || null,
        // Trade-in and purchase extras
        photos: data.photos || [],
        accessories: data.accessories || [],
        checklist: data.checklist || null,
        additionalCostPrice: data.additionalCostPrice || 0,
        variations: data.variations || [],
        observations: data.observations || null,
        apple_warranty_until: (() => {
            if (data.apple_warranty_until && typeof data.apple_warranty_until === 'string' && data.apple_warranty_until.trim()) {
                const aw = data.apple_warranty_until.trim();
                // Handle DD/MM/YYYY format from TradeInModal
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(aw)) {
                    const [dd, mm, yyyy] = aw.split('/');
                    return `${yyyy}-${mm}-${dd}`;
                }
                return aw;
            }
            return null;
        })(),
        // Add initial stock history entry for traceability (only if stock > 0)
        // Trade-in products (stock: 0) will have their history added when the sale is finalized
        stockHistory: data.stock === 0 ? [] : [{
            id: crypto.randomUUID(),
            oldStock: 0,
            newStock: data.stock || 1,
            adjustment: data.stock || 1,
            reason: data.origin === 'Troca' ? 'Entrada via Troca' : (data.origin === 'Comprado de Cliente' ? 'Compra de Cliente' : 'Cadastro Inicial'),
            timestamp: now,
            changedBy: data.createdByName || userName || 'Sistema',
            details: (data.origin === 'Troca' || data.origin === 'Comprado de Cliente')
                ? `Produto recebido via ${data.origin === 'Troca' ? 'troca' : 'compra de cliente'}. Fornecedor: ${resolvedSupplierName || 'N/A'}. Custo: R$ ${(data.costPrice || 0).toFixed(2)}`
                : `Produto cadastrado manualmente.`
        }]
    };

    Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

    // Sanitize UUID fields to prevent 400 Bad Request from Supabase
    const uuidFields = ['supplier_id', 'categoryId', 'brandId'];
    uuidFields.forEach(f => {
        if (productData[f] && typeof productData[f] === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productData[f])) {
            productData[f] = null;
        }
    });

    // INSERT and get the created product with its database-generated ID
    let createdProduct: any = null;

    try {
        const insertQuery = supabase.from('products').insert([productData]).select().single();
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('INSERT_TIMEOUT')), 15000)
        );

        const result = await Promise.race([insertQuery, timeout]) as any;
        if (result.error) throw result.error;

        createdProduct = result.data;
    } catch (e: any) {
        if (e.message === 'INSERT_TIMEOUT') {
            console.warn('[addProduct] Insert timed out, but proceeding anyway (product may have been created)');
            // Fallback: generate a local ID (this is a last resort)
            createdProduct = { ...productData, id: crypto.randomUUID() };
        } else {
            // Real error - throw it
            throw e;
        }
    }

    if (!createdProduct) {
        throw new Error('Falha ao criar produto - sem resposta do banco de dados');
    }

    // Fire-and-forget audit log (non-blocking)
    addAuditLog(
        AuditActionType.STOCK_LAUNCH,
        AuditEntityType.PRODUCT,
        createdProduct.id,
        `Entrada de estoque (${createdProduct.origin || 'Cadastro'}): ${createdProduct.model}. Estoque: ${createdProduct.stock}.`,
        userId,
        userName
    ).catch(e => console.warn('[addProduct] Audit log failed:', e));

    clearCache(['products']);
    return createdProduct as Product;
};

export const updateProduct = async (data: any, userId?: string, userName?: string) => {
    // 1. Fetch current product to compare prices
    const { data: currentProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', data.id).maybeSingle();

    // If product not found (RLS or doesn't exist), still try to update
    if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
    }

    // Use data as fallback if currentProduct is null
    const existingProduct = currentProduct || data;

    const {
        selectedCustomerId,
        stockHistory,
        priceHistory: inputPriceHistory,
        ...rest
    } = data;
    const now = getNowISO();

    // Build the update payload
    const updatePayload: any = {
        ...rest,
        updatedAt: now
    };

    // Fix: Remove keys that are likely names (like 'iPad') from UUID columns to prevent crash
    const uuidFields = ['categoryId', 'brandId', 'supplierId'];
    uuidFields.forEach(f => {
        if (updatePayload[f] && typeof updatePayload[f] === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatePayload[f])) {
            delete updatePayload[f];
        }
    });

    // Sanitize: convert empty string observations to null
    if (updatePayload.observations === '') {
        updatePayload.observations = null;
    }

    // Sanitize: ensure apple_warranty_until is a valid ISO string or null (never undefined)
    if (updatePayload.apple_warranty_until !== undefined) {
        if (!updatePayload.apple_warranty_until) {
            updatePayload.apple_warranty_until = null;
        } else if (typeof updatePayload.apple_warranty_until === 'string' && updatePayload.apple_warranty_until.trim()) {
            // Keep as-is (already a valid ISO string from the form)
        } else {
            updatePayload.apple_warranty_until = null;
        }
    }

    // Track price changes for history
    const existingPriceHistory = existingProduct.priceHistory || [];
    let priceHistoryUpdated = false;

    // If sale price changed, add to price history
    if (existingProduct.price !== data.price) {
        // Log price change to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Preço de venda alterado de ${formatCurrency(existingProduct.price)} para ${formatCurrency(data.price)}`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to priceHistory column
        const newPriceEntry = {
            id: crypto.randomUUID(),
            oldPrice: existingProduct.price,
            newPrice: data.price,
            priceType: 'sale',
            changedBy: userName || 'Sistema',
            timestamp: now
        };
        existingPriceHistory.push(newPriceEntry);
        priceHistoryUpdated = true;
    }

    // If wholesale price changed, add to price history
    if (data.wholesalePrice !== undefined && existingProduct.wholesalePrice !== data.wholesalePrice) {
        // Log wholesale price change to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Preço de atacado alterado de ${formatCurrency(existingProduct.wholesalePrice || 0)} para ${formatCurrency(data.wholesalePrice)}`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to priceHistory column
        const newWholesaleEntry = {
            id: crypto.randomUUID(),
            oldPrice: existingProduct.wholesalePrice || 0,
            newPrice: data.wholesalePrice,
            priceType: 'wholesale',
            changedBy: userName || 'Sistema',
            timestamp: now
        };
        existingPriceHistory.push(newWholesaleEntry);
        priceHistoryUpdated = true;
    }

    // If cost price changed, add to price history
    if (data.costPrice !== undefined && existingProduct.costPrice !== data.costPrice) {
        // Log cost price change to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Preço de custo alterado de ${formatCurrency(existingProduct.costPrice || 0)} para ${formatCurrency(data.costPrice)}`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to priceHistory column
        const newCostEntry = {
            id: crypto.randomUUID(),
            oldPrice: existingProduct.costPrice || 0,
            newPrice: data.costPrice,
            priceType: 'cost',
            changedBy: userName || 'Sistema',
            timestamp: now
        };
        existingPriceHistory.push(newCostEntry);
        priceHistoryUpdated = true;
    }

    if (priceHistoryUpdated) {
        updatePayload.priceHistory = existingPriceHistory;
    }

    // --- LOCATION CHANGE TRACKING ---
    const existingStockHistory = existingProduct.stockHistory || [];
    let stockHistoryUpdated = false;

    if (data.storageLocation !== undefined && existingProduct.storageLocation !== data.storageLocation) {
        // Log to audit_logs
        await addAuditLog(
            AuditActionType.UPDATE,
            AuditEntityType.PRODUCT,
            data.id,
            `Local de estoque alterado de "${existingProduct.storageLocation || 'N/A'}" para "${data.storageLocation}"`,
            userId || 'system',
            userName || 'Sistema'
        );

        // Add to stockHistory column
        const newLocationEntry: StockHistoryEntry = {
            id: crypto.randomUUID(),
            oldStock: existingProduct.stock, // Stock volume doesn't change
            newStock: existingProduct.stock,
            adjustment: 0,
            reason: 'Alteração de Local',
            timestamp: now,
            changedBy: userName || 'Sistema',
            previousLocation: existingProduct.storageLocation || 'N/A',
            newLocation: data.storageLocation
        };
        existingStockHistory.push(newLocationEntry);
        stockHistoryUpdated = true;
    }

    if (stockHistoryUpdated) {
        updatePayload.stockHistory = existingStockHistory;
    }
    // --------------------------------

    // Try to update with priceHistory
    let updatedRows, error;
    try {
        const query = supabase.from('products').update(updatePayload).eq('id', data.id).select();

        // Safety timeout to prevent infinite loading spinners
        const res: any = await Promise.race([
            query,
            new Promise((_, reject) => setTimeout(() => reject(new Error('A atualização demorou muito e foi cancelada por segurança. Verifique se as alterações foram salvas.')), 15000))
        ]);

        updatedRows = res.data;
        error = res.error;
    } catch (e: any) {
        if (e.name === 'AbortError' || e.message?.includes('aborted')) {
            // Translating the cryptic AbortError to something the user can understand
            throw new Error('A conexão foi interrompida durante a atualização. Por favor, verifique sua internet e tente novamente.');
        }
        throw e;
    }

    if (error) throw error;

    const updated = (updatedRows && updatedRows.length > 0) ? updatedRows[0] : { ...existingProduct, ...updatePayload };

    if (!updatedRows || updatedRows.length === 0) {
        console.warn('mockApi: Product updated successfully but returned no data (likely RLS). Using local payload.');
    }
    clearCache(['products']);
    return updated;
};

export const deleteProduct = async (id: string, userId: string = 'system', userName: string = 'Sistema') => {
    // Pegar infos do produto antes de deletar para o log e verificação de estoque
    const { data: product } = await supabase.from('products').select('*').eq('id', id).single();

    // Verificação de Segurança: Impedir exclusão se houver vendas vinculadas ativas (Exceto Canceladas)
    // REGRA: Só bloqueia se a venda ativa for MAIS RECENTE que a entrada atual no estoque.
    // Se o produto foi recomprado depois da venda, essa venda pertence a um ciclo anterior
    // e não deve impedir o cancelamento da entrada atual.
    const { data: activeSales } = await supabase
        .from('sales')
        .select('id, createdAt, created_at')
        .neq('status', 'Cancelada')
        .contains('items', JSON.stringify([{ productId: id }]));

    if (activeSales && activeSales.length > 0) {
        // Pegar a data de recompra (createdAt do produto, que é atualizado a cada recompra)
        const productCreatedAt = product?.createdAt || product?.created_at;
        const productEntryDate = productCreatedAt ? new Date(productCreatedAt).getTime() : 0;

        // Filtrar apenas vendas que são MAIS RECENTES que a entrada atual do produto
        // Vendas antigas (de ciclos anteriores) não devem bloquear
        const blockingSales = activeSales.filter((sale: any) => {
            const saleDateStr = sale.createdAt || sale.created_at;
            if (!saleDateStr) return true; // Se não tem data, bloqueia por segurança
            const saleDate = new Date(saleDateStr).getTime();
            // A venda bloqueia apenas se ela for DEPOIS da entrada no estoque
            return saleDate >= productEntryDate;
        });

        if (blockingSales.length > 0) {
            throw new Error('Este produto possui vendas registradas e não pode ser excluído. Cancele as vendas associadas antes de excluir.');
        }
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;

    if (product) {
        await addAuditLog(
            AuditActionType.DELETE,
            AuditEntityType.PRODUCT,
            id,
            `Produto excluído: ${product.model} (${product.brand})`,
            userId,
            userName
        );
    }

    clearCache(['products']);
};

export const updateProductStock = async (id: string, newStock: number, reason: string = 'Ajuste Manual', userId?: string, userName?: string) => {
    const { data: currentProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    const now = getNowISO();
    const adjustment = newStock - currentProduct.stock;

    // Build update payload
    const updatePayload: any = {
        stock: newStock,
        updatedAt: now
    };

    if (adjustment !== 0) {
        await addAuditLog(
            AuditActionType.STOCK_ADJUST,
            AuditEntityType.PRODUCT,
            id,
            `Estoque ajustado manualmente. Anterior: ${currentProduct.stock}, Novo: ${newStock} (Ajuste: ${adjustment > 0 ? '+' : ''}${adjustment})`,
            userId || 'user',
            userName || 'Usuário'
        );

        // Add to stockHistory column
        const existingStockHistory = currentProduct.stockHistory || [];
        const newStockEntry = {
            id: crypto.randomUUID(),
            oldStock: currentProduct.stock,
            newStock: newStock,
            adjustment: adjustment,
            reason: reason,
            timestamp: now,
            changedBy: userName || 'Usuário'
        };
        updatePayload.stockHistory = [...existingStockHistory, newStockEntry];
    }

    const { data, error } = await supabase.from('products').update(updatePayload).eq('id', id).select().single();

    if (error) throw error;
    clearCache(['products']);
    return data;
};

export const updateMultipleProducts = async (updates: { id: string; price?: number; costPrice?: number; wholesalePrice?: number; storageLocation?: string; quantityToMove?: number; commission_enabled?: boolean; commission_type?: 'fixed' | 'percentage'; commission_value?: number; discount_limit_type?: 'fixed' | 'percentage'; discount_limit_value?: number }[], userId?: string, userName?: string) => {
    const now = getNowISO();

    const updatedSummaries: any[] = [];
    for (const u of updates) {
        const { data: currentProduct } = await supabase.from('products').select('*').eq('id', u.id).maybeSingle();
        if (!currentProduct) continue;

        const payload: any = {};
        const existingPriceHistory = currentProduct.priceHistory || [];
        let priceHistoryUpdated = false;

        const isApple = currentProduct.brand?.toLowerCase() === 'apple' || ['iphone', 'ipad', 'macbook', 'apple watch', 'airpods'].includes(currentProduct.category?.toLowerCase() || '');
        const displayBrand = isApple ? '' : (currentProduct.brand || '');
        const rawDesc = `${displayBrand} ${currentProduct.model || ''}${currentProduct.color && !(currentProduct.model || '').toLowerCase().includes(currentProduct.color.toLowerCase()) ? ' ' + currentProduct.color : ''} ${currentProduct.storage || ''}`;
        const finalDesc = rawDesc.replace(/\s+/g, ' ').trim();

        // Collect summary info with name
        updatedSummaries.push({
            id: u.id,
            model: finalDesc,
            price: u.price,
            costPrice: u.costPrice,
            wholesalePrice: u.wholesalePrice,
            location: u.storageLocation,
            commission_enabled: u.commission_enabled,
            commission_value: u.commission_value
        });

        // Handle sale price update
        if (u.price !== undefined) {
            payload.price = u.price;
            if (currentProduct.price !== u.price) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Preço de venda alterado de ${formatCurrency(currentProduct.price)} para ${formatCurrency(u.price)}`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // Add to priceHistory column
                const newPriceEntry = {
                    id: crypto.randomUUID(),
                    oldPrice: currentProduct.price,
                    newPrice: u.price,
                    priceType: 'sale',
                    changedBy: userName || 'Atualização em Massa',
                    timestamp: now
                };
                existingPriceHistory.push(newPriceEntry);
                priceHistoryUpdated = true;
            }
        }

        // Handle wholesale price update
        if (u.wholesalePrice !== undefined) {
            payload.wholesalePrice = u.wholesalePrice;
            if (currentProduct.wholesalePrice !== u.wholesalePrice) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Preço de atacado alterado de ${formatCurrency(currentProduct.wholesalePrice || 0)} para ${formatCurrency(u.wholesalePrice)}`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // Add to priceHistory column
                const newWholesaleEntry = {
                    id: crypto.randomUUID(),
                    oldPrice: currentProduct.wholesalePrice || 0,
                    newPrice: u.wholesalePrice,
                    priceType: 'wholesale',
                    changedBy: userName || 'Atualização em Massa',
                    timestamp: now
                };
                existingPriceHistory.push(newWholesaleEntry);
                priceHistoryUpdated = true;
            }
        }

        // Handle cost price update
        if (u.costPrice !== undefined) {
            payload.costPrice = u.costPrice;
            if (currentProduct.costPrice !== u.costPrice) {
                // Log to audit_logs
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Preço de custo alterado de ${formatCurrency(currentProduct.costPrice || 0)} para ${formatCurrency(u.costPrice)}`,
                    userId || 'system',
                    userName || 'Atualização em Massa'
                );

                // Add to priceHistory column
                const newCostEntry = {
                    id: crypto.randomUUID(),
                    oldPrice: currentProduct.costPrice || 0,
                    newPrice: u.costPrice,
                    priceType: 'cost',
                    changedBy: userName || 'Atualização em Massa',
                    timestamp: now
                };
                existingPriceHistory.push(newCostEntry);
                priceHistoryUpdated = true;
            }
        }

        // Handle storage location update
        if (u.storageLocation !== undefined) {
            const qtyToMove = u.quantityToMove || currentProduct.stock;
            const isPartialTransfer = qtyToMove < currentProduct.stock;

            if (isPartialTransfer) {
                // PARTIAL TRANSFER: Split the record
                const remainingStock = currentProduct.stock - qtyToMove;
                payload.stock = remainingStock;

                // Create and insert new record for the moved quantity
                const { id: _, ...productCopy } = currentProduct;
                const newProductData = {
                    ...productCopy,
                    id: crypto.randomUUID(),
                    stock: qtyToMove,
                    storageLocation: u.storageLocation,
                    createdAt: now,
                    updatedAt: now,
                    stockHistory: [{
                        id: crypto.randomUUID(),
                        oldStock: 0,
                        newStock: qtyToMove,
                        adjustment: qtyToMove,
                        reason: `Transferência de Local (Massa) - Origem: ${currentProduct.storageLocation || 'N/A'}`,
                        timestamp: now,
                        changedBy: userName || 'Atualização em Massa',
                        previousLocation: currentProduct.storageLocation || 'N/A',
                        newLocation: u.storageLocation
                    }]
                };

                await supabase.from('products').insert(newProductData);

                // Log to audit_logs for the original product
                await addAuditLog(
                    AuditActionType.UPDATE,
                    AuditEntityType.PRODUCT,
                    u.id,
                    `Atualização em Massa: Transferido ${qtyToMove} un para "${u.storageLocation}". Estoque restante local original: ${remainingStock}`,
                    userId || 'system',
                    userName || 'Sistema'
                );
            } else {
                // FULL TRANSFER: Original logic
                payload.storageLocation = u.storageLocation;
                if (currentProduct.storageLocation !== u.storageLocation) {
                    // Log to audit_logs
                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.PRODUCT,
                        u.id,
                        `Atualização em Massa: Local de estoque alterado de "${currentProduct.storageLocation || 'N/A'}" para "${u.storageLocation}"`,
                        userId || 'system',
                        userName || 'Atualização em Massa'
                    );

                    // --- LOCATION CHANGE TRACKING (BULK) ---
                    const existingStockHistory = currentProduct.stockHistory || [];
                    const newLocationEntry: StockHistoryEntry = {
                        id: crypto.randomUUID(),
                        oldStock: currentProduct.stock,
                        newStock: currentProduct.stock,
                        adjustment: 0,
                        reason: 'Alteração de Local',
                        timestamp: now,
                        changedBy: userName || 'Atualização em Massa',
                        previousLocation: currentProduct.storageLocation || 'N/A',
                        newLocation: u.storageLocation
                    };
                    existingStockHistory.push(newLocationEntry);
                    payload.stockHistory = existingStockHistory;
                }
            }
        }

        // Handle commission fields update
        if (u.commission_enabled !== undefined) {
            payload.commission_enabled = u.commission_enabled;
        }
        if (u.commission_type !== undefined) {
            payload.commission_type = u.commission_type;
        }
        if (u.commission_value !== undefined) {
            payload.commission_value = u.commission_value;
        }
        if (u.discount_limit_type !== undefined) {
            payload.discount_limit_type = u.discount_limit_type;
        }
        if (u.discount_limit_value !== undefined) {
            payload.discount_limit_value = u.discount_limit_value;
        }

        // Log commission changes
        const commissionChanged = (
            (u.commission_enabled !== undefined && currentProduct.commission_enabled !== u.commission_enabled) ||
            (u.commission_type !== undefined && currentProduct.commission_type !== u.commission_type) ||
            (u.commission_value !== undefined && currentProduct.commission_value !== u.commission_value) ||
            (u.discount_limit_type !== undefined && currentProduct.discount_limit_type !== u.discount_limit_type) ||
            (u.discount_limit_value !== undefined && currentProduct.discount_limit_value !== u.discount_limit_value)
        );

        if (commissionChanged) {
            const parts = [];
            if (u.commission_enabled !== undefined) parts.push(`Comissão: ${u.commission_enabled ? 'Ativada' : 'Desativada'}`);
            if (u.commission_type !== undefined) parts.push(`Tipo: ${u.commission_type === 'fixed' ? 'Fixo' : 'Percentual'}`);
            if (u.commission_value !== undefined) parts.push(`Valor: ${u.commission_value}`);
            if (u.discount_limit_type !== undefined) parts.push(`Limite Desc. Tipo: ${u.discount_limit_type === 'fixed' ? 'Fixo' : 'Percentual'}`);
            if (u.discount_limit_value !== undefined) parts.push(`Limite Desc. Valor: ${u.discount_limit_value}`);

            await addAuditLog(
                AuditActionType.UPDATE,
                AuditEntityType.PRODUCT,
                u.id,
                `Atualização em Massa (Comissão): ${parts.join(', ')}`,
                userId || 'system',
                userName || 'Atualização em Massa'
            );
        }

        if (priceHistoryUpdated) {
            payload.priceHistory = existingPriceHistory;
        }

        if (Object.keys(payload).length > 0) {
            payload.updatedAt = now;
            await supabase.from('products').update(payload).eq('id', u.id);
        }
    }

    // Log a summary for the entire bulk operation
    if (updatedSummaries.length > 0) {
        // We create a special audit log for the batch operation
        await addAuditLog(
            AuditActionType.BULK_PRICE_UPDATE,
            AuditEntityType.PRODUCT,
            'batch-' + Date.now(),
            JSON.stringify({
                count: updatedSummaries.length,
                timestamp: now,
                user: userName || 'Sistema',
                updates: updatedSummaries.slice(0, 100) // Store up to 100 products in detail
            }),
            userId || 'system',
            userName || 'Sistema'
        );
    }

    clearCache(['products', 'audit_logs']);
};
