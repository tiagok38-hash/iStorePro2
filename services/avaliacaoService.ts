/**
 * Serviço do módulo de Avaliação Trade-In
 * Segue o padrão de catalogService.ts
 * Multi-tenant via company_id (isolado por RLS no Supabase)
 */
import { supabase } from '../supabaseClient.ts';
import {
    AvaliacaoSettings,
    AvaliacaoDevice,
    AvaliacaoCondition,
    AvaliacaoPart,
    AvaliacaoLead,
    AvaliacaoLeadStatus,
} from '../types.ts';
import { fetchWithRetry } from './cacheUtils.ts';

// ─────────────────────────────────────────────────────────────
// MAPPERS: DB (snake_case) → Frontend (camelCase)
// ─────────────────────────────────────────────────────────────

const mapSettings = (r: any): AvaliacaoSettings => ({
    id: r.id,
    companyId: r.company_id,
    isActive: r.is_active ?? true,
    welcomeMessage: r.welcome_message,
    logoUrl: r.logo_url,
    whatsapp: r.whatsapp,
    collectContact: r.collect_contact ?? true,
    floorValue: r.floor_value ?? 0,
    validityDays: r.validity_days,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
});

const mapDevice = (r: any): AvaliacaoDevice => ({
    id: r.id,
    companyId: r.company_id,
    brand: r.brand,
    model: r.model,
    storageOptions: r.storage_options || [],
    colorOptions: r.color_options || [],
    baseValues: r.base_values || {},
    isActive: r.is_active ?? true,
    displayOrder: r.display_order ?? 0,
    createdAt: r.created_at,
});

const mapCondition = (r: any): AvaliacaoCondition => ({
    id: r.id,
    companyId: r.company_id,
    label: r.label,
    description: r.description,
    deductionType: r.deduction_type || 'percentage',
    deductionValue: r.deduction_value ?? 0,
    icon: r.icon || '📱',
    displayOrder: r.display_order ?? 0,
    isActive: r.is_active ?? true,
});

const mapPart = (r: any): AvaliacaoPart => ({
    id: r.id,
    companyId: r.company_id,
    label: r.label,
    deductionType: r.deduction_type || 'fixed',
    deductionValue: r.deduction_value ?? 0,
    isActive: r.is_active ?? true,
    displayOrder: r.display_order ?? 0,
    requiresPhoto: r.requires_photo ?? false,
    requiresNote: r.requires_note ?? false,
});

const mapLead = (r: any): AvaliacaoLead => ({
    id: r.id,
    companyId: r.company_id,
    deviceBrand: r.device_brand,
    deviceModel: r.device_model,
    deviceStorage: r.device_storage,
    deviceColor: r.device_color,
    conditionLabel: r.condition_label,
    partsSelected: r.parts_selected || [],
    baseValue: r.base_value ?? 0,
    deductions: r.deductions || [],
    finalValue: r.final_value ?? 0,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    status: r.status as AvaliacaoLeadStatus,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
});

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────

export const getAvaliacaoSettings = async (): Promise<AvaliacaoSettings | null> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data ? mapSettings(data) : null;
    });
};

export const upsertAvaliacaoSettings = async (settings: Partial<AvaliacaoSettings>): Promise<AvaliacaoSettings> => {
    return fetchWithRetry(async () => {
        const payload: any = {
            is_active: settings.isActive ?? true,
            welcome_message: settings.welcomeMessage ?? null,
            logo_url: settings.logoUrl ?? null,
            whatsapp: settings.whatsapp ?? null,
            collect_contact: settings.collectContact ?? true,
            floor_value: settings.floorValue ?? 0,
            validity_days: settings.validityDays ?? null,
            updated_at: new Date().toISOString(),
        };

        if (settings.id) {
            // Update
            const { data, error } = await supabase
                .from('avaliacao_settings')
                .update(payload)
                .eq('id', settings.id)
                .select()
                .single();
            if (error) throw error;
            return mapSettings(data);
        } else {
            // Insert
            const { data, error } = await supabase
                .from('avaliacao_settings')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return mapSettings(data);
        }
    });
};

// ─────────────────────────────────────────────────────────────
// DEVICES
// ─────────────────────────────────────────────────────────────

export const getAvaliacaoDevices = async (): Promise<AvaliacaoDevice[]> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_devices')
            .select('*')
            .order('display_order', { ascending: true })
            .order('brand', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapDevice);
    });
};

export const addAvaliacaoDevice = async (device: Omit<AvaliacaoDevice, 'id' | 'companyId' | 'createdAt'>): Promise<AvaliacaoDevice> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_devices')
            .insert([{
                brand: device.brand,
                model: device.model,
                storage_options: device.storageOptions,
                color_options: device.colorOptions,
                base_values: device.baseValues,
                is_active: device.isActive ?? true,
                display_order: device.displayOrder ?? 0,
            }])
            .select()
            .single();
        if (error) throw error;
        return mapDevice(data);
    });
};

export const updateAvaliacaoDevice = async (id: string, updates: Partial<AvaliacaoDevice>): Promise<AvaliacaoDevice> => {
    return fetchWithRetry(async () => {
        const payload: any = { updated_at: new Date().toISOString() };
        if (updates.brand !== undefined) payload.brand = updates.brand;
        if (updates.model !== undefined) payload.model = updates.model;
        if (updates.storageOptions !== undefined) payload.storage_options = updates.storageOptions;
        if (updates.colorOptions !== undefined) payload.color_options = updates.colorOptions;
        if (updates.baseValues !== undefined) payload.base_values = updates.baseValues;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;

        const { data, error } = await supabase
            .from('avaliacao_devices')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapDevice(data);
    });
};

export const deleteAvaliacaoDevice = async (id: string): Promise<void> => {
    return fetchWithRetry(async () => {
        const { error } = await supabase.from('avaliacao_devices').delete().eq('id', id);
        if (error) throw error;
    });
};

// ─────────────────────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────────────────────

export const getAvaliacaoConditions = async (): Promise<AvaliacaoCondition[]> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_conditions')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapCondition);
    });
};

export const addAvaliacaoCondition = async (condition: Omit<AvaliacaoCondition, 'id' | 'companyId'>): Promise<AvaliacaoCondition> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_conditions')
            .insert([{
                label: condition.label,
                description: condition.description ?? null,
                deduction_type: condition.deductionType,
                deduction_value: condition.deductionValue,
                icon: condition.icon || '📱',
                display_order: condition.displayOrder ?? 0,
                is_active: condition.isActive ?? true,
            }])
            .select()
            .single();
        if (error) throw error;
        return mapCondition(data);
    });
};

export const updateAvaliacaoCondition = async (id: string, updates: Partial<AvaliacaoCondition>): Promise<AvaliacaoCondition> => {
    return fetchWithRetry(async () => {
        const payload: any = {};
        if (updates.label !== undefined) payload.label = updates.label;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.deductionType !== undefined) payload.deduction_type = updates.deductionType;
        if (updates.deductionValue !== undefined) payload.deduction_value = updates.deductionValue;
        if (updates.icon !== undefined) payload.icon = updates.icon;
        if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;

        const { data, error } = await supabase
            .from('avaliacao_conditions')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapCondition(data);
    });
};

export const deleteAvaliacaoCondition = async (id: string): Promise<void> => {
    return fetchWithRetry(async () => {
        const { error } = await supabase.from('avaliacao_conditions').delete().eq('id', id);
        if (error) throw error;
    });
};

// ─────────────────────────────────────────────────────────────
// PARTS
// ─────────────────────────────────────────────────────────────

export const getAvaliacaoParts = async (): Promise<AvaliacaoPart[]> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_parts')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapPart);
    });
};

export const addAvaliacaoPart = async (part: Omit<AvaliacaoPart, 'id' | 'companyId'>): Promise<AvaliacaoPart> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_parts')
            .insert([{
                label: part.label,
                deduction_type: part.deductionType,
                deduction_value: part.deductionValue,
                is_active: part.isActive ?? true,
                display_order: part.displayOrder ?? 0,
                requires_photo: part.requiresPhoto ?? false,
                requires_note: part.requiresNote ?? false,
            }])
            .select()
            .single();
        if (error) throw error;
        return mapPart(data);
    });
};

export const updateAvaliacaoPart = async (id: string, updates: Partial<AvaliacaoPart>): Promise<AvaliacaoPart> => {
    return fetchWithRetry(async () => {
        const payload: any = {};
        if (updates.label !== undefined) payload.label = updates.label;
        if (updates.deductionType !== undefined) payload.deduction_type = updates.deductionType;
        if (updates.deductionValue !== undefined) payload.deduction_value = updates.deductionValue;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
        if (updates.requiresPhoto !== undefined) payload.requires_photo = updates.requiresPhoto;
        if (updates.requiresNote !== undefined) payload.requires_note = updates.requiresNote;

        const { data, error } = await supabase
            .from('avaliacao_parts')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapPart(data);
    });
};

export const deleteAvaliacaoPart = async (id: string): Promise<void> => {
    return fetchWithRetry(async () => {
        const { error } = await supabase.from('avaliacao_parts').delete().eq('id', id);
        if (error) throw error;
    });
};

// ─────────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────────

export const getAvaliacaoLeads = async (): Promise<AvaliacaoLead[]> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_leads')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapLead);
    });
};

export const submitAvaliacaoLead = async (lead: Omit<AvaliacaoLead, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'status'> & { companyId: string }): Promise<AvaliacaoLead> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('avaliacao_leads')
            .insert([{
                company_id: lead.companyId,
                device_brand: lead.deviceBrand,
                device_model: lead.deviceModel,
                device_storage: lead.deviceStorage ?? null,
                device_color: lead.deviceColor ?? null,
                condition_label: lead.conditionLabel,
                parts_selected: lead.partsSelected,
                base_value: lead.baseValue,
                deductions: lead.deductions,
                final_value: lead.finalValue,
                customer_name: lead.customerName ?? null,
                customer_phone: lead.customerPhone ?? null,
                customer_email: lead.customerEmail ?? null,
                status: 'new',
            }])
            .select()
            .single();
        if (error) throw error;
        return mapLead(data);
    });
};

export const updateAvaliacaoLeadStatus = async (id: string, status: AvaliacaoLeadStatus, notes?: string): Promise<void> => {
    return fetchWithRetry(async () => {
        const payload: any = { status, updated_at: new Date().toISOString() };
        if (notes !== undefined) payload.notes = notes;
        const { error } = await supabase.from('avaliacao_leads').update(payload).eq('id', id);
        if (error) throw error;
    });
};

// ─────────────────────────────────────────────────────────────
// PUBLIC: sem autenticação, via RPC com slug
// ─────────────────────────────────────────────────────────────

export interface PublicAvaliacaoData {
    settings: AvaliacaoSettings | null;
    devices: AvaliacaoDevice[];
    conditions: AvaliacaoCondition[];
    parts: AvaliacaoPart[];
    company: { id: string; name: string; slug: string; whatsapp?: string; logoUrl?: string } | null;
}

export const getPublicAvaliacaoData = async (slug: string): Promise<PublicAvaliacaoData> => {
    const { data, error } = await supabase.rpc('get_public_avaliacao', { p_slug: slug });

    if (error) throw error;
    if (!data || data.error) throw new Error('Loja não encontrada');

    return {
        settings: data.settings ? mapSettings(data.settings) : null,
        devices: (data.devices || []).map(mapDevice),
        conditions: (data.conditions || []).map(mapCondition),
        parts: (data.parts || []).map(mapPart),
        company: data.company ? {
            id: data.company.id,
            name: data.company.name,
            slug: data.company.slug,
            whatsapp: data.company.whatsapp,
            logoUrl: data.company.logo_url,
        } : null,
    };
};
