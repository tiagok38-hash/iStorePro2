
import { supabase } from '../supabaseClient.ts';
import { CatalogItem } from '../types.ts';
import { fetchWithCache, clearCache, fetchWithRetry } from './cacheUtils.ts';

// ===== CATALOG MODULE =====

const mapCatalogItem = (item: any): CatalogItem => ({
    id: item.id,
    productId: item.product_id,
    displayOrder: item.display_order || 0,
    costPrice: item.cost_price || 0,
    salePrice: item.sale_price || 0,
    cardPrice: item.card_price || 0,
    installments: item.installments || 1,
    section: item.section || 'Destaques',
    isActive: item.is_active ?? true,
    imageUrl: item.image_url,
    imageUrls: (item.image_urls && item.image_urls.length > 0) ? item.image_urls : (item.image_url ? [item.image_url] : []),
    condition: item.condition || 'Novo',
    batteryHealth: item.battery_health,
    productName: item.product_name || '',
    productBrand: item.product_brand || '',
    productCategory: item.product_category || '',
    description: item.description || '',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
});

export const getCatalogItems = async (): Promise<CatalogItem[]> => {
    return fetchWithCache('catalog_items', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;
            return (data || []).map(mapCatalogItem);
        });
    });
};

export const logCatalogEvent = async (eventType: 'PAGE_VIEW' | 'WHATSAPP_CLICK' | 'CART_ADD', catalogItemId?: string, productId?: string, companyId?: string) => {
    try {
        const payload: any = {
            event_type: eventType,
            catalog_item_id: catalogItemId || null,
            product_id: productId || null
        };
        if (companyId) {
            payload.company_id = companyId;
        }
        await supabase.from('catalog_events').insert([payload]);
    } catch (e) {
        console.error('Failed to log catalog event:', e);
    }
};

export const getActiveCatalogItems = async (): Promise<CatalogItem[]> => {
    return fetchWithCache('catalog_items_active', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (error) throw error;
            return (data || []).map(mapCatalogItem);
        });
    });
};

export const getPublicCatalogData = async (slug: string): Promise<any> => {
    return fetchWithCache(`public_catalog_${slug}`, async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.rpc('get_public_catalog', { p_slug: slug });

            if (error) throw error;

            // Map data types correctly
            const row = data.company;
            const mappedCompany = {
                id: row.id,
                name: row.name,
                razaoSocial: row.razao_social,
                logoUrl: row.logo_url || row.logoUrl || '',
                cnpj: row.cnpj,
                inscricaoEstadual: row.inscricao_estadual,
                address: row.address,
                numero: row.numero,
                complemento: row.complemento,
                bairro: row.bairro,
                city: row.city,
                state: row.state,
                cep: row.cep,
                email: row.email,
                whatsapp: row.whatsapp,
                instagram: row.instagram,
                isCatalogOnline: row.is_catalog_online ?? true,
                catalogOfflineMessage: row.catalog_offline_message,
                catalogOfflineImageUrl: row.catalog_offline_image_url,
            };

            return {
                company: mappedCompany,
                items: (data.items || []).map(mapCatalogItem),
                sections: (data.sections || []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    emoji: s.emoji || '📦',
                    displayOrder: s.display_order || 0
                })),
                categories: data.categories || [],
                methods: data.paymentMethods || []
            };
        });
    }, 60 * 1000); // 1 minute cache for public viewers
};

export const addCatalogItem = async (item: Partial<CatalogItem>): Promise<CatalogItem> => {
    return fetchWithRetry(async () => {
        const payload: any = {
            product_id: item.productId,
            display_order: item.displayOrder || 0,
            cost_price: item.costPrice || 0,
            sale_price: item.salePrice || 0,
            card_price: item.cardPrice || 0,
            installments: item.installments || 1,
            section: item.section || 'Destaques',
            is_active: item.isActive ?? true,
            image_url: item.imageUrl || (item.imageUrls && item.imageUrls[0]) || null,
            image_urls: item.imageUrls || [],
            condition: item.condition || 'Novo',
            battery_health: item.batteryHealth,
            product_name: item.productName || '',
            product_brand: item.productBrand || '',
            product_category: item.productCategory || '',
            description: item.description || '',
        };

        const { data, error } = await supabase
            .from('catalog_items')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
        return mapCatalogItem(data);
    });
};

export const updateCatalogItem = async (id: string, updates: Partial<CatalogItem>): Promise<CatalogItem> => {
    return fetchWithRetry(async () => {
        const payload: any = {};
        if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
        if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
        if (updates.salePrice !== undefined) payload.sale_price = updates.salePrice;
        if (updates.cardPrice !== undefined) payload.card_price = updates.cardPrice;
        if (updates.installments !== undefined) payload.installments = updates.installments;
        if (updates.section !== undefined) payload.section = updates.section;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.imageUrls !== undefined) { payload.image_urls = updates.imageUrls; payload.image_url = updates.imageUrls[0] || null; }
        if (updates.condition !== undefined) payload.condition = updates.condition;
        if (updates.batteryHealth !== undefined) payload.battery_health = updates.batteryHealth;
        if (updates.productName !== undefined) payload.product_name = updates.productName;
        if (updates.productBrand !== undefined) payload.product_brand = updates.productBrand;
        if (updates.productCategory !== undefined) payload.product_category = updates.productCategory;
        if (updates.description !== undefined) payload.description = updates.description;
        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('catalog_items')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
        return mapCatalogItem(data);
    });
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
    return fetchWithRetry(async () => {
        const { error } = await supabase
            .from('catalog_items')
            .delete()
            .eq('id', id);

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
    });
};

export const deleteCatalogItems = async (ids: string[]): Promise<void> => {
    return fetchWithRetry(async () => {
        const { error } = await supabase
            .from('catalog_items')
            .delete()
            .in('id', ids);

        if (error) throw error;
        clearCache(['catalog_items', 'catalog_items_active']);
    });
};

// ======= Catalog Sections =======
export const getCatalogSections = async (): Promise<{ id: string; name: string; emoji: string; displayOrder: number; sortOrder?: string }[]> => {
    // Try to fetch from Supabase
    try {
        const { data, error } = await supabase
            .from('catalog_sections')
            .select('*')
            .order('display_order', { ascending: true });

        if (!error && data) {
            return data.map(d => ({
                id: d.id,
                name: d.name,
                emoji: d.emoji,
                displayOrder: d.display_order,
                sortOrder: d.sort_order || 'newest'
            }));
        }
    } catch (e) {
        console.error('Error fetching sections from Supabase:', e);
    }

    // Fallback to local storage
    const stored = localStorage.getItem('catalog_sections');
    if (stored) return JSON.parse(stored);

    return [
        { id: '1', name: 'Destaques', emoji: '⭐', displayOrder: 0, sortOrder: 'newest' },
        { id: '2', name: 'iPhones Seminovos', emoji: '📱', displayOrder: 1, sortOrder: 'newest' },
        { id: '3', name: 'iPhones Lacrados', emoji: '📦', displayOrder: 2, sortOrder: 'newest' },
        { id: '4', name: 'Acessórios Apple', emoji: '🎧', displayOrder: 3, sortOrder: 'newest' },
        { id: '5', name: 'Promoções', emoji: '🔥', displayOrder: 4, sortOrder: 'newest' },
        { id: '6', name: 'Outros', emoji: '📋', displayOrder: 5, sortOrder: 'newest' },
    ];
};

export const addCatalogSection = async (section: { name: string; emoji: string; displayOrder: number; sortOrder?: string }) => {
    try {
        const { data, error } = await supabase
            .from('catalog_sections')
            .insert([{
                name: section.name,
                emoji: section.emoji,
                display_order: section.displayOrder,
                sort_order: section.sortOrder || 'newest'
            }])
            .select()
            .single();

        if (!error && data) {
            return {
                id: data.id,
                name: data.name,
                emoji: data.emoji,
                displayOrder: data.display_order,
                sortOrder: data.sort_order
            };
        }
    } catch (e) {
        console.error('Error adding section to Supabase:', e);
    }

    // Fallback
    const sections = await getCatalogSections();
    const newSection = { ...section, id: crypto.randomUUID(), sortOrder: section.sortOrder || 'newest' };
    const updated = [...sections, newSection];
    localStorage.setItem('catalog_sections', JSON.stringify(updated));
    return newSection;
};

export const updateCatalogSection = async (id: string, updates: Partial<{ name: string; emoji: string; displayOrder: number; sortOrder: string }>) => {
    try {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
        if (updates.displayOrder !== undefined) dbUpdates.display_order = updates.displayOrder;
        if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

        const { error } = await supabase
            .from('catalog_sections')
            .update(dbUpdates)
            .eq('id', id);

        if (error) throw error;
    } catch (e) {
        console.error('Error updating section in Supabase:', e);
    }

    // Fallback
    const sections = await getCatalogSections();
    const updated = sections.map(s => s.id === id ? { ...s, ...updates } : s);
    localStorage.setItem('catalog_sections', JSON.stringify(updated));
};

export const deleteCatalogSection = async (id: string) => {
    return fetchWithRetry(async () => {
        const { error } = await supabase.from('catalog_sections').delete().eq('id', id);
        if (error) throw error;
        clearCache(['catalog_sections']);
    });
};
