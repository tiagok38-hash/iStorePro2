/**
 * Serviço de Parâmetros Genéricos — Marcas, Categorias, Modelos, Grades,
 * Métodos de Pagamento, Condições, Locais de Armazenamento, Garantias,
 * Termos de Recebimento, Checklist, e parâmetros exclusivos de OS.
 * Extraído do mockApi.ts para modularização.
 */
import { supabase } from '../supabaseClient.ts';
import { AuditActionType, AuditEntityType } from '../types.ts';
import { fetchWithCache, clearCache, fetchWithRetry, METADATA_TTL } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

// --- GENERIC PARAMETERS (Brands, Categories, etc) ---

const getTable = async (table: string, cacheKey: string) => {
    return fetchWithCache(cacheKey, async () => {
        return fetchWithRetry(async () => {
            const res = await supabase.from(table).select('*');
            if (res.error) throw res.error;
            return res.data || [];
        });
    }, METADATA_TTL);
};

const addItem = async (table: string, data: any, cacheKey: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: newItem, error } = await supabase.from(table).insert([data]).select().single();
    if (error) {
        console.error(`Error adding item to ${table}:`, error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.CREATE,
        getTableEntityType(table),
        newItem.id,
        `Item adicionado em ${table}. Dados: ${JSON.stringify(data)}`,
        userId,
        userName
    );

    clearCache([cacheKey]);
    return newItem;
};

const updateItem = async (table: string, data: any, cacheKey: string, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: updated, error } = await supabase.from(table).update(data).eq('id', data.id).select().single();
    if (error) {
        console.error(`Error updating item in ${table}:`, error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.UPDATE,
        getTableEntityType(table),
        data.id,
        `Item atualizado em ${table}. Alterações: ${JSON.stringify(data)}`,
        userId,
        userName
    );

    clearCache([cacheKey]);
    return updated;
};

const deleteItem = async (table: string, id: string, cacheKey: string, userId: string = 'system', userName: string = 'Sistema') => {
    // Pegar infos antes de deletar
    const { data: item } = await supabase.from(table).select('*').eq('id', id).single();

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;

    if (item) {
        // Tentar pegar o melhor nome descritivo do item
        let itemName = item.name || item.model || item.type || id;
        
        // Formatar melhor para métodos de pagamento ou configurações que não tem "name" na raiz
        if (table.includes('payment_methods') && item.config?._meta_type) {
             itemName = item.name || item.config._meta_type;
        }

        await addAuditLog(
            AuditActionType.DELETE,
            getTableEntityType(table),
            id,
            `Item excluído de ${table}: ${itemName}`,
            userId,
            userName
        );
    }

    clearCache([cacheKey]);
};

const getTableEntityType = (table: string): AuditEntityType => {
    switch (table) {
        case 'products': return AuditEntityType.PRODUCT;
        case 'customers': return AuditEntityType.CUSTOMER;
        case 'suppliers': return AuditEntityType.SUPPLIER;
        case 'sales': return AuditEntityType.SALE;
        case 'purchase_orders': return AuditEntityType.PURCHASE_ORDER;
        case 'users': return AuditEntityType.USER;
        case 'payment_methods': return AuditEntityType.PAYMENT_METHOD;
        case 'brands': return AuditEntityType.BRAND;
        case 'categories': return AuditEntityType.CATEGORY;
        case 'product_models': return AuditEntityType.PRODUCT_MODEL;
        case 'grades': return AuditEntityType.GRADE;
        case 'grade_values': return AuditEntityType.GRADE_VALUE;
        case 'warranties': return AuditEntityType.WARRANTY;
        case 'storage_locations': return AuditEntityType.STORAGE_LOCATION;
        case 'product_conditions': return AuditEntityType.CONDITION;
        case 'receipt_terms': return AuditEntityType.RECEIPT_TERM;
        case 'permission_profiles': return AuditEntityType.PERMISSION_PROFILE;
        case 'cash_sessions': return AuditEntityType.CASH_SESSION;
        default: return AuditEntityType.PRODUCT;
    }
}

export const getBrands = () => getTable('brands', 'brands');
export const addBrand = (data: any, userId?: string, userName?: string) => addItem('brands', data, 'brands', userId, userName);
export const updateBrand = (data: any, userId?: string, userName?: string) => updateItem('brands', data, 'brands', userId, userName);
export const deleteBrand = (id: string, userId?: string, userName?: string) => deleteItem('brands', id, 'brands', userId, userName);

export const getCategories = async () => {
    return fetchWithCache('categories', async () => {
        const { data, error } = await supabase.from('categories').select('*');
        if (error) throw error;
        return (data || []).map((c: any) => ({
            ...c,
            brandId: c.brand_id
        }));
    });
};
export const addCategory = (data: any, userId?: string, userName?: string) => {
    return addItem('categories', { name: data.name, brand_id: data.brandId, brandId: data.brandId }, 'categories', userId, userName);
};
export const updateCategory = (data: any, userId?: string, userName?: string) => {
    return updateItem('categories', { id: data.id, name: data.name, brand_id: data.brandId, brandId: data.brandId }, 'categories', userId, userName);
};
export const deleteCategory = (id: string, userId?: string, userName?: string) => deleteItem('categories', id, 'categories', userId, userName);

export const getProductModels = async () => {
    return fetchWithCache('product_models', async () => {
        const { data, error } = await supabase.from('product_models').select('*');
        if (error) throw error;
        return (data || []).map((m: any) => ({
            ...m,
            categoryId: m.category_id || m.categoryId,
            imageUrl: m.image_url || m.imageUrl || m.photo_url || m.photoUrl
        }));
    });
};

export const addProductModel = (data: any, userId?: string, userName?: string) => {
    const payload = { 
        name: data.name, 
        category_id: data.categoryId, 
        categoryId: data.categoryId,
        image_url: data.imageUrl 
    };
    return addItem('product_models', payload, 'product_models', userId, userName);
};

export const updateProductModel = (data: any, userId?: string, userName?: string) => {
    const payload = { 
        id: data.id, 
        name: data.name, 
        category_id: data.categoryId, 
        categoryId: data.categoryId,
        image_url: data.imageUrl 
    };
    return updateItem('product_models', payload, 'product_models', userId, userName);
};

export const deleteProductModel = (id: string, userId?: string, userName?: string) => deleteItem('product_models', id, 'product_models', userId, userName);

export const getGrades = () => getTable('grades', 'grades');
export const addGrade = (data: any, userId?: string, userName?: string) => addItem('grades', data, 'grades', userId, userName);
export const updateGrade = (data: any, userId?: string, userName?: string) => updateItem('grades', data, 'grades', userId, userName);
export const deleteGrade = (id: string, userId?: string, userName?: string) => deleteItem('grades', id, 'grades', userId, userName);

export const getGradeValues = async () => {
    return fetchWithCache('grade_values', async () => {
        const { data, error } = await supabase.from('grade_values').select('*');
        if (error) throw error;
        return (data || []).map((v: any) => ({
            ...v,
            gradeId: v.grade_id
        }));
    });
};
export const addGradeValue = (data: any, userId?: string, userName?: string) => {
    return addItem('grade_values', { name: data.name, grade_id: data.gradeId, gradeId: data.gradeId }, 'grade_values', userId, userName);
};
export const updateGradeValue = (data: any, userId?: string, userName?: string) => {
    return updateItem('grade_values', { id: data.id, name: data.name, grade_id: data.gradeId, gradeId: data.gradeId }, 'grade_values', userId, userName);
};
export const deleteGradeValue = (id: string, userId?: string, userName?: string) => deleteItem('grade_values', id, 'grade_values', userId, userName);

export const getReceiptTerms = async () => {
    return fetchWithCache('receipt_terms', async () => {
        const { data, error } = await supabase.from('receipt_terms').select('*');
        if (error) throw error;
        return (data || []).map((term: any) => ({
            ...term,
            // DB has camelCase columns, but we ensure consistency
            warrantyTerm: term.warrantyTerm || term.warranty_term,
            warrantyExclusions: term.warrantyExclusions || term.warranty_exclusions,
            imageRights: term.imageRights || term.image_rights || term.imageRights
        }));
    });
};

export const addReceiptTerm = (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const payload = {
        name: data.name || '',
        warrantyTerm: data.warrantyTerm || null,
        warranty_term: data.warrantyTerm || null,
        warrantyExclusions: data.warrantyExclusions || null,
        warranty_exclusions: data.warrantyExclusions || null,
        imageRights: data.imageRights || null,
        image_rights: data.imageRights || null,
    };
    return addItem('receipt_terms', payload, 'receipt_terms', userId, userName);
};

export const updateReceiptTerm = (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const { id, ...rest } = data;
    const payload = {
        id,
        name: rest.name || '',
        warrantyTerm: rest.warrantyTerm || null,
        warranty_term: rest.warrantyTerm || null,
        warrantyExclusions: rest.warrantyExclusions || null,
        warranty_exclusions: rest.warrantyExclusions || null,
        imageRights: rest.imageRights || null,
        image_rights: rest.imageRights || null,
    };
    return updateItem('receipt_terms', payload, 'receipt_terms', userId, userName);
};

export const deleteReceiptTerm = (id: string, userId: string = 'system', userName: string = 'Sistema') => deleteItem('receipt_terms', id, 'receipt_terms', userId, userName);

const serializePaymentMethod = (data: any) => {
    const { type, active, allowInternalNotes, config, variations, ...rest } = data;
    const safeConfig = config || {};
    return {
        ...rest,
        config: {
            ...safeConfig,
            _meta_type: type || 'cash',
            _meta_active: active !== undefined ? active : true,
            _meta_allow_internal_notes: allowInternalNotes !== undefined ? allowInternalNotes : false,
            _meta_variations: variations || []
        }
    };
};

const deserializePaymentMethod = (data: any) => {
    if (!data) return data;
    return {
        ...data,
        type: data.config?._meta_type || 'cash',
        active: data.config?._meta_active !== undefined ? data.config._meta_active : true,
        allowInternalNotes: data.config?._meta_allow_internal_notes !== undefined ? data.config._meta_allow_internal_notes : false,
        variations: data.config?._meta_variations || []
    };
};

export const getPaymentMethods = async () => {
    return fetchWithCache('payment_methods', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('payment_methods').select('*');
            if (error) throw error;
            return data;
        }).then(data => {
            if (!data || data.length === 0) {
                return [
                    { id: '1', name: 'Dinheiro', type: 'cash', active: true },
                    { id: '2', name: 'Pix', type: 'cash', active: true },
                    { id: '3', name: 'Cartão Débito', type: 'card', active: true },
                    { id: '4', name: 'Cartão Crédito', type: 'card', active: true },
                    { id: '5', name: 'Crediário', type: 'cash', active: true }
                ];
            }
            return data.map(deserializePaymentMethod);
        });
    });
};

export const addPaymentMethod = (data: any, userId?: string, userName?: string) => {
    const paymentMethod = serializePaymentMethod(data);
    if (!paymentMethod.id) {
        paymentMethod.id = crypto.randomUUID();
    }
    return addItem('payment_methods', paymentMethod, 'payment_methods', userId, userName);
};
export const updatePaymentMethod = (data: any, userId?: string, userName?: string) => updateItem('payment_methods', serializePaymentMethod(data), 'payment_methods', userId, userName);
export const deletePaymentMethod = (id: string, userId?: string, userName?: string) => deleteItem('payment_methods', id, 'payment_methods', userId, userName);

export const getProductConditions = () => getTable('product_conditions', 'product_conditions');
export const addProductCondition = (data: any, userId?: string, userName?: string) => addItem('product_conditions', data, 'product_conditions', userId, userName);
export const updateProductCondition = (data: any, userId?: string, userName?: string) => updateItem('product_conditions', data, 'product_conditions', userId, userName);
export const deleteProductCondition = (id: string, userId?: string, userName?: string) => deleteItem('product_conditions', id, 'product_conditions', userId, userName);

export const getChecklistItems = () => getTable('checklist_items', 'checklist_items');
export const addChecklistItem = (data: any, userId?: string, userName?: string) => addItem('checklist_items', data, 'checklist_items', userId, userName);
export const updateChecklistItem = (data: any, userId?: string, userName?: string) => updateItem('checklist_items', data, 'checklist_items', userId, userName);
export const deleteChecklistItem = (id: string, userId?: string, userName?: string) => deleteItem('checklist_items', id, 'checklist_items', userId, userName);


export const getStorageLocations = () => getTable('storage_locations', 'storage_locations');
export const addStorageLocation = (data: any, userId?: string, userName?: string) => addItem('storage_locations', data, 'storage_locations', userId, userName);
export const updateStorageLocation = (data: any, userId?: string, userName?: string) => updateItem('storage_locations', data, 'storage_locations', userId, userName);
export const deleteStorageLocation = (id: string, userId?: string, userName?: string) => deleteItem('storage_locations', id, 'storage_locations', userId, userName);

export const getWarranties = async () => {
    return fetchWithCache('warranties', async () => {
        const { data, error } = await supabase.from('warranties').select('*');
        if (error) throw error;
        return (data || []).map((w: any) => ({
            ...w,
            warrantyTerm: w.warrantyTerm || w.warranty_term
        }));
    });
};
export const addWarranty = (data: any, userId?: string, userName?: string) =>
    addItem('warranties', { name: data.name, days: data.days ?? 0, warranty_term: data.warrantyTerm }, 'warranties', userId, userName);
export const updateWarranty = (data: any, userId?: string, userName?: string) =>
    updateItem('warranties', { id: data.id, name: data.name, days: data.days ?? 0, warranty_term: data.warrantyTerm }, 'warranties', userId, userName);
export const deleteWarranty = (id: string, userId?: string, userName?: string) => deleteItem('warranties', id, 'warranties', userId, userName);

// ==============================================================
// OS-EXCLUSIVE PARAMETER FUNCTIONS
// Usam tabelas próprias (os_*) — NÃO afetam o ERP Principal.
// ==============================================================

// --- OS Warranties (os_warranties) ---
export const getOsWarranties = async () => {
    return fetchWithCache('os_warranties', async () => {
        const { data, error } = await supabase.from('os_warranties').select('*');
        if (error) throw error;
        return (data || []).map((w: any) => ({ ...w }));
    });
};
export const addOsWarranty = (data: any, userId?: string, userName?: string) =>
    addItem('os_warranties', { name: data.name, days: data.days ?? null }, 'os_warranties', userId, userName);
export const updateOsWarranty = (data: any, userId?: string, userName?: string) =>
    updateItem('os_warranties', { id: data.id, name: data.name, days: data.days ?? null }, 'os_warranties', userId, userName);
export const deleteOsWarranty = (id: string, userId?: string, userName?: string) =>
    deleteItem('os_warranties', id, 'os_warranties', userId, userName);

// --- OS Product Conditions (os_product_conditions) ---
export const getOsProductConditions = () => getTable('os_product_conditions', 'os_product_conditions');
export const addOsProductCondition = (data: any, userId?: string, userName?: string) =>
    addItem('os_product_conditions', data, 'os_product_conditions', userId, userName);
export const updateOsProductCondition = (data: any, userId?: string, userName?: string) =>
    updateItem('os_product_conditions', data, 'os_product_conditions', userId, userName);
export const deleteOsProductCondition = (id: string, userId?: string, userName?: string) =>
    deleteItem('os_product_conditions', id, 'os_product_conditions', userId, userName);

// --- OS Storage Locations (os_storage_locations) ---
export const getOsStorageLocations = () => getTable('os_storage_locations', 'os_storage_locations');
export const addOsStorageLocation = (data: any, userId?: string, userName?: string) =>
    addItem('os_storage_locations', data, 'os_storage_locations', userId, userName);
export const updateOsStorageLocation = (data: any, userId?: string, userName?: string) =>
    updateItem('os_storage_locations', data, 'os_storage_locations', userId, userName);
export const deleteOsStorageLocation = (id: string, userId?: string, userName?: string) =>
    deleteItem('os_storage_locations', id, 'os_storage_locations', userId, userName);

// --- OS Payment Methods (os_payment_methods) ---
export const getOsPaymentMethods = async () => {
    return fetchWithCache('os_payment_methods', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('os_payment_methods').select('*');
            if (error) throw error;
            return data;
        }).then(data => {
            if (!data || data.length === 0) {
                return [
                    { id: 'os_1', name: 'Dinheiro', type: 'cash', active: true },
                    { id: 'os_2', name: 'Pix', type: 'cash', active: true },
                    { id: 'os_3', name: 'Cartão Débito', type: 'card', active: true },
                    { id: 'os_4', name: 'Cartão Crédito', type: 'card', active: true },
                    { id: 'os_5', name: 'Crediário', type: 'cash', active: true }
                ];
            }
            return data.map(deserializePaymentMethod);
        });
    });
};
export const addOsPaymentMethod = (data: any, userId?: string, userName?: string) => {
    const paymentMethod = serializePaymentMethod(data);
    if (!paymentMethod.id) paymentMethod.id = 'os_' + crypto.randomUUID();
    return addItem('os_payment_methods', paymentMethod, 'os_payment_methods', userId, userName);
};
export const updateOsPaymentMethod = (data: any, userId?: string, userName?: string) =>
    updateItem('os_payment_methods', serializePaymentMethod(data), 'os_payment_methods', userId, userName);
export const deleteOsPaymentMethod = (id: string, userId?: string, userName?: string) =>
    deleteItem('os_payment_methods', id, 'os_payment_methods', userId, userName);

// --- OS Receipt Terms (os_receipt_terms) ---
export const getOsReceiptTerms = async () => {
    return fetchWithCache('os_receipt_terms', async () => {
        const { data, error } = await supabase.from('os_receipt_terms').select('*');
        if (error) throw error;
        return (data || []).map((term: any) => ({
            ...term,
            warrantyTerm: term.warrantyTerm || term.warranty_term,
            warrantyExclusions: term.warrantyExclusions || term.warranty_exclusions,
            imageRights: term.imageRights || term.image_rights,
        }));
    });
};

export const addOsReceiptTerm = (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const payload = {
        name: data.name || '',
        warrantyTerm: data.warrantyTerm || null,
        warrantyExclusions: data.warrantyExclusions || null,
        imageRights: data.imageRights || null,
    };
    return addItem('os_receipt_terms', payload, 'os_receipt_terms', userId, userName);
};

export const updateOsReceiptTerm = (data: any, userId: string = 'system', userName: string = 'Sistema') => {
    const { id, ...rest } = data;
    const payload = {
        id,
        name: rest.name || '',
        warrantyTerm: rest.warrantyTerm || null,
        warrantyExclusions: rest.warrantyExclusions || null,
        imageRights: rest.imageRights || null,
    };
    return updateItem('os_receipt_terms', payload, 'os_receipt_terms', userId, userName);
};

export const deleteOsReceiptTerm = (id: string, userId: string = 'system', userName: string = 'Sistema') =>
    deleteItem('os_receipt_terms', id, 'os_receipt_terms', userId, userName);

// --- fin OS-exclusive parameters ---
