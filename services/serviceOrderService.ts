
import { supabase } from '../supabaseClient.ts';
import { Service, ServiceOrder, AuditActionType, AuditEntityType, ReceiptTermParameter } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, fetchWithRetry, clearCache } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

// --- SERVICES ---

export const getServices = async (): Promise<Service[]> => {
    return fetchWithCache('services', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('services').select('*').order('name');
            if (error) throw error;
            return (data || []).map((s: any) => ({
                ...s,
                createdAt: s.created_at || s.createdAt,
                updatedAt: s.updated_at || s.updatedAt,
            }));
        });
    });
};

export const addService = async (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newService = {
        ...data,
        id: crypto.randomUUID(),
        created_at: getNowISO(),
        updated_at: getNowISO()
    };

    const { data: service, error } = await supabase.from('services').insert([newService]).select().single();

    if (error) {
        console.error('Error adding service:', error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.SERVICE,
        service.id,
        `Serviço criado: ${service.name}`
    );

    clearCache(['services']);
    return {
        ...service,
        createdAt: service.created_at,
        updatedAt: service.updated_at
    };
};

export const updateService = async (id: string, data: Partial<Service>) => {
    const updatePayload: any = { ...data, updated_at: getNowISO() };
    delete updatePayload.id;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;

    const { data: updated, error } = await supabase
        .from('services')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating service:', error);
        throw error;
    }

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SERVICE,
        id,
        `Serviço atualizado: ${updated.name}`
    );

    clearCache(['services']);
    return {
        ...updated,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
    };
};

export const deleteService = async (id: string) => {
    const { data: service } = await supabase.from('services').select('*').eq('id', id).single();

    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) {
        console.error('Error deleting service:', error);
        throw error;
    }

    if (service) {
        await addAuditLog(
            AuditActionType.DELETE,
            AuditEntityType.SERVICE,
            id,
            `Serviço excluído: ${service.name}`
        );
    }

    clearCache(['services']);
};


// --- SERVICE ORDERS ---

export const mapServiceOrderData = (so: any): ServiceOrder => ({
    ...so,
    customerId: so.customer_id,
    customerName: so.customer_name,
    deviceModel: so.device_model,
    serialNumber: so.serial_number,
    patternLock: so.pattern_lock,
    defectDescription: so.defect_description,
    technicalReport: so.technical_report,
    createdAt: so.created_at,
    updatedAt: so.updated_at,
    responsibleId: so.responsible_id,
    responsibleName: so.responsible_name,
    entryDate: so.entry_date,
    exitDate: so.exit_date,
    attendantId: so.attendant_id,
    attendantName: so.attendant_name,
    estimatedDate: so.estimated_date,
    attendantObservations: so.attendant_observations,
    customerDeviceId: so.customer_device_id,
    displayId: so.display_id,
    isOrcamentoOnly: so.is_orcamento_only,
    isQuick: so.is_quick,
    phone: so.phone,
    receiptTermId: so.receipt_term_id,
});

export const getServiceOrders = async (): Promise<ServiceOrder[]> => {
    return fetchWithCache('service_orders', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('service_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(mapServiceOrderData);
        });
    });
};

export const getServiceOrder = async (id: string): Promise<ServiceOrder | null> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase
            .from('service_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return mapServiceOrderData(data);
    });
};

export const getPublicServiceOrderTracking = async (id: string): Promise<{ os: ServiceOrder | null, company: any | null, receiptTerm: ReceiptTermParameter | null }> => {
    return fetchWithRetry(async () => {
        const { data, error } = await supabase.rpc('get_public_os_tracking', { p_os_id: id });

        if (error) {
            console.error('RPC Error fetching public OS:', error);
            return { os: null, company: null, receiptTerm: null };
        }

        if (!data || data.error) {
            console.warn('RPC returned business error or empty data:', data?.error || 'No data');
            return { os: null, company: null, receiptTerm: null };
        }

        const osData = data.os;
        const companyData = data.company;

        if (!osData) {
            console.warn('OS data missing from RPC result');
            return { os: null, company: null, receiptTerm: null };
        }

        const mappedOs = mapServiceOrderData(osData);

        const mappedCompany = companyData ? {
            id: companyData.id,
            name: companyData.name,
            razaoSocial: companyData.razao_social,
            logoUrl: companyData.logo_url || companyData.logoUrl || '',
            cnpj: companyData.cnpj,
            inscricaoEstadual: companyData.inscricao_estadual,
            address: companyData.address,
            numero: companyData.numero,
            complemento: companyData.complemento,
            bairro: companyData.bairro,
            city: companyData.city,
            state: companyData.state,
            cep: companyData.cep,
            email: companyData.email,
            whatsapp: companyData.whatsapp,
            instagram: companyData.instagram,
            isCatalogOnline: companyData.is_catalog_online ?? true,
            catalogOfflineMessage: companyData.catalog_offline_message,
            catalogOfflineImageUrl: companyData.catalog_offline_image_url,
        } : null;

        const termData = data.receiptTerm;
        const mappedTerm = termData ? {
            ...termData,
            warrantyTerm: termData.warrantyTerm || termData.warranty_term,
            warrantyExclusions: termData.warrantyExclusions || termData.warranty_exclusions,
            imageRights: termData.imageRights || termData.image_rights,
        } : null;

        return { os: mappedOs, company: mappedCompany, receiptTerm: mappedTerm };
    });
};

export const addServiceOrder = async (data: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'displayId'>) => {
    // Generate sequential unique Display ID
    const { data: maxRow } = await supabase
        .from('service_orders')
        .select('display_id')
        .order('display_id', { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextDisplayId = (maxRow?.display_id ?? 0) + 1;

    const newOrder: any = {
        ...data,
        display_id: nextDisplayId,
        customer_id: data.customerId,
        customer_name: data.customerName,
        device_model: data.deviceModel,
        serial_number: data.serialNumber,
        pattern_lock: data.patternLock,
        defect_description: data.defectDescription,
        technical_report: data.technicalReport,
        responsible_id: data.responsibleId,
        responsible_name: data.responsibleName,
        attendant_id: (data as any).attendantId || null,
        attendant_name: (data as any).attendantName || null,
        entry_date: data.entryDate,
        exit_date: data.exitDate || null,
        estimated_date: (data as any).estimatedDate || null,
        attendant_observations: data.attendantObservations || null,
        customer_device_id: data.customerDeviceId || null,
        is_orcamento_only: (data as any).isOrcamentoOnly ?? false,
        is_quick: (data as any).isQuick ?? false,
        phone: (data as any).phone || null,
        receipt_term_id: data.receiptTermId || null,
        cancellation_reason: data.cancellationReason || null,
    };

    const uuidFields = ['customer_id', 'responsible_id', 'attendant_id', 'customer_device_id'];
    const _uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    uuidFields.forEach(field => {
        const val = newOrder[field];
        if (!val || (typeof val === 'string' && !_uuidRegex.test(val))) {
            newOrder[field] = null;
        }
    });

    const camelCaseKeys = [
        'customerId', 'customerName', 'deviceModel', 'serialNumber',
        'patternLock', 'defectDescription', 'technicalReport',
        'responsibleId', 'responsibleName', 'attendantId', 'attendantName',
        'entryDate', 'exitDate', 'estimatedDate',
        'attendantObservations', 'customerDeviceId', 'isOrcamentoOnly', 'isQuick', 'phone',
        'cancellationReason', 'isEdited', 'receiptTermId'
    ];
    camelCaseKeys.forEach(key => delete newOrder[key]);

    const payload = Object.fromEntries(
        Object.entries(newOrder).filter(([_, v]) => v !== undefined)
    );

    const { data: created, error } = await supabase.from('service_orders').insert([payload]).select().single();

    if (error) throw error;

    await addAuditLog(
        AuditActionType.CREATE,
        AuditEntityType.SERVICE_ORDER,
        created.id,
        `OS #${created.display_id} criada para ${created.customer_name}`
    );

    clearCache(['service_orders']);
    return {
        ...created,
        customerId: created.customer_id,
        customerName: created.customer_name,
        deviceModel: created.device_model,
        serialNumber: created.serial_number,
        patternLock: created.pattern_lock,
        defectDescription: created.defect_description,
        technicalReport: created.technical_report,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
        responsibleId: created.responsible_id,
        responsibleName: created.responsible_name,
        entryDate: created.entry_date,
        exitDate: created.exit_date,
        attendantObservations: created.attendant_observations,
        customerDeviceId: created.customer_device_id,
        displayId: created.display_id,
        isOrcamentoOnly: created.is_orcamento_only,
        isQuick: created.is_quick,
        phone: created.phone,
        receiptTermId: created.receipt_term_id,
    };
};

export const updateServiceOrder = async (id: string, data: Partial<ServiceOrder>) => {
    const updatePayload: any = {
        ...data,
        updated_at: getNowISO()
    };

    if (data.status === 'Entregue' && (!data.exitDate && !updatePayload.exit_date)) {
        updatePayload.exit_date = getNowISO();
    }

    if (data.customerId !== undefined) updatePayload.customer_id = data.customerId;
    if (data.customerName !== undefined) updatePayload.customer_name = data.customerName;
    if (data.deviceModel !== undefined) updatePayload.device_model = data.deviceModel;
    if (data.serialNumber !== undefined) updatePayload.serial_number = data.serialNumber;
    if (data.patternLock !== undefined) updatePayload.pattern_lock = data.patternLock;
    if (data.defectDescription !== undefined) updatePayload.defect_description = data.defectDescription;
    if (data.technicalReport !== undefined) updatePayload.technical_report = data.technicalReport;
    if (data.responsibleId !== undefined) updatePayload.responsible_id = data.responsibleId;
    if (data.responsibleName !== undefined) updatePayload.responsible_name = data.responsibleName;
    if ((data as any).attendantId !== undefined) updatePayload.attendant_id = (data as any).attendantId;
    if ((data as any).attendantName !== undefined) updatePayload.attendant_name = (data as any).attendantName;
    if (data.entryDate !== undefined) updatePayload.entry_date = data.entryDate;
    if (data.exitDate !== undefined) updatePayload.exit_date = data.exitDate;
    if ((data as any).estimatedDate !== undefined) updatePayload.estimated_date = (data as any).estimatedDate;
    if (data.attendantObservations !== undefined) updatePayload.attendant_observations = data.attendantObservations;
    if (data.customerDeviceId !== undefined) updatePayload.customer_device_id = data.customerDeviceId;
    if ((data as any).isOrcamentoOnly !== undefined) updatePayload.is_orcamento_only = (data as any).isOrcamentoOnly;
    if ((data as any).isQuick !== undefined) updatePayload.is_quick = (data as any).isQuick;
    if ((data as any).phone !== undefined) updatePayload.phone = (data as any).phone;
    if (data.receiptTermId !== undefined) updatePayload.receipt_term_id = data.receiptTermId;
    if (data.cancellationReason !== undefined) updatePayload.cancellation_reason = data.cancellationReason;
    if ((data as any).isEdited !== undefined) updatePayload.is_edited = (data as any).isEdited;

    const uuidFields = ['customer_id', 'responsible_id', 'attendant_id', 'customer_device_id'];
    const _uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    uuidFields.forEach(field => {
        const val = updatePayload[field];
        if (!val || (typeof val === 'string' && !_uuidRegex.test(val))) {
            updatePayload[field] = null;
        }
    });

    const camelCaseKeys = [
        'id', 'customerId', 'customerName', 'deviceModel', 'serialNumber',
        'patternLock', 'defectDescription', 'technicalReport',
        'responsibleId', 'responsibleName', 'attendantId', 'attendantName',
        'entryDate', 'exitDate', 'estimatedDate',
        'attendantObservations', 'customerDeviceId', 'isOrcamentoOnly',
        'createdAt', 'updatedAt', 'displayId', 'isQuick', 'phone', 'cancellationReason', 'isEdited', 'receiptTermId'
    ];
    camelCaseKeys.forEach(key => delete updatePayload[key]);

    const payload = Object.fromEntries(
        Object.entries(updatePayload).filter(([_, v]) => v !== undefined)
    );

    const { data: updated, error } = await supabase
        .from('service_orders')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.SERVICE_ORDER,
        id,
        "Ordem de serviço atualizada"
    );

    clearCache(['service_orders']);
    return {
        ...updated,
        customerId: updated.customer_id,
        customerName: updated.customer_name,
        deviceModel: updated.device_model,
        serialNumber: updated.serial_number,
        patternLock: updated.pattern_lock,
        defectDescription: updated.defect_description,
        technicalReport: updated.technical_report,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        responsibleId: updated.responsible_id,
        responsibleName: updated.responsible_name,
        entryDate: updated.entry_date,
        exitDate: updated.exit_date,
        attendantObservations: updated.attendant_observations,
        customerDeviceId: updated.customer_device_id,
        displayId: updated.display_id,
        isOrcamentoOnly: updated.is_orcamento_only,
        cancellationReason: updated.cancellation_reason,
        receiptTermId: updated.receipt_term_id,
    };
};

export const deductOsPartsStock = async (
    serviceOrderId: string,
    serviceOrderDisplayId: number,
    items: any[]
): Promise<void> => {
    const partItems = items.filter((item: any) => item.type === 'part' && item.catalogItemId);
    if (partItems.length === 0) return;

    for (const item of partItems) {
        const { data: part, error: fetchError } = await supabase
            .from('os_parts')
            .select('id, stock, name')
            .eq('id', item.catalogItemId)
            .single();

        if (fetchError || !part) continue;

        const newStock = Math.max(0, (part.stock || 0) - (item.quantity || 1));

        await supabase
            .from('os_parts')
            .update({ stock: newStock, updated_at: getNowISO() })
            .eq('id', item.catalogItemId);

        await supabase
            .from('os_part_usage_history')
            .insert([{
                os_part_id: item.catalogItemId,
                service_order_id: serviceOrderId,
                service_order_display_id: serviceOrderDisplayId,
                part_name: part.name || item.description,
                quantity: item.quantity || 1,
                action: 'deducted',
                created_at: getNowISO()
            }]);
    }

    clearCache(['os_parts_false', 'os_parts_true']);
};

export const returnOsPartsStock = async (
    serviceOrderId: string
): Promise<void> => {
    const { data: usageRecords, error } = await supabase
        .from('os_part_usage_history')
        .select('*')
        .eq('service_order_id', serviceOrderId)
        .eq('action', 'deducted');

    if (error || !usageRecords || usageRecords.length === 0) return;

    for (const record of usageRecords) {
        const { data: part } = await supabase
            .from('os_parts')
            .select('id, stock')
            .eq('id', record.os_part_id)
            .single();

        if (!part) continue;

        const newStock = (part.stock || 0) + (record.quantity || 1);
        await supabase
            .from('os_parts')
            .update({ stock: newStock, updated_at: getNowISO() })
            .eq('id', record.os_part_id);
    }

    await supabase
        .from('os_part_usage_history')
        .update({ action: 'returned', updated_at: getNowISO() })
        .eq('service_order_id', serviceOrderId)
        .eq('action', 'deducted');

    clearCache(['os_parts_false', 'os_parts_true']);
};

export const getOsPartUsageHistory = async (osPartId: string): Promise<any[]> => {
    const { data, error } = await supabase
        .from('os_part_usage_history')
        .select('*')
        .eq('os_part_id', osPartId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((r: any) => ({
        id: r.id,
        osPartId: r.os_part_id,
        serviceOrderId: r.service_order_id,
        serviceOrderDisplayId: r.service_order_display_id,
        partName: r.part_name,
        quantity: r.quantity,
        action: r.action,
        createdAt: r.created_at,
    }));
};
