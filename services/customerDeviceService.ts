
import { supabase } from '../supabaseClient.ts';
import { CustomerDevice, ElectronicType } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache } from './cacheUtils.ts';
import { fetchWithRetry } from './cacheUtils.ts';

// --- CUSTOMER DEVICES (Eletrônicos de Clientes) ---

const mapCustomerDevice = (d: any): CustomerDevice => ({
    id: d.id,
    customerId: d.customer_id,
    brand: d.brand,
    category: d.category,
    model: d.model,
    imei: d.imei || '',
    imei2: d.imei2 || '',
    serialNumber: d.serial_number || '',
    ean: d.ean || '',
    type: (d.type as ElectronicType) || 'Produtos Apple',
    color: d.color || '',
    storage: d.storage || '',
    rawModel: d.raw_model || '',
    soldInStore: d.sold_in_store || false,
    hasPreviousRepair: d.has_previous_repair || false,
    customerName: d.customer_name || '',
    customerCpf: d.customer_cpf || '',
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    observations: d.observations || '',
    history: [] // Histórico será carregado sob demanda se necessário
});

export const getCustomerDevices = async (): Promise<CustomerDevice[]> => {
    return fetchWithCache('customer_devices', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase.from('customer_devices').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching customer_devices:', error);
                throw error;
            }
            return (data || []).map(mapCustomerDevice);
        });
    });
};

export const addCustomerDevice = async (device: any): Promise<CustomerDevice> => {
    const { data: userCompanyId } = await supabase.rpc('get_my_company_id');
    const id = device.id || crypto.randomUUID();
    const now = getNowISO();

    const payload = {
        id,
        customer_id: device.customerId || null,
        brand: device.brand,
        category: device.category || device.type,
        model: device.model,
        imei: device.imei || device.imei1 || '',
        imei2: device.imei2 || '',
        serial_number: device.serialNumber || '',
        ean: device.ean || '',
        observations: device.observations || '',
        type: device.type || 'Produtos Apple',
        color: device.color || '',
        storage: device.storage || '',
        raw_model: device.rawModel || device.model,
        sold_in_store: device.soldInStore || false,
        has_previous_repair: device.hasPreviousRepair || false,
        customer_name: device.customerName,
        customer_cpf: device.customerCpf,
        company_id: userCompanyId,
        created_at: now,
        updated_at: now
    };

    const { data, error } = await supabase.from('customer_devices').insert([payload]).select().single();
    if (error) {
        console.error('Error adding customer_device:', error);
        throw error;
    }
    clearCache(['customer_devices']);
    return mapCustomerDevice(data);
};

export const updateCustomerDevice = async (id: string, device: any): Promise<CustomerDevice> => {
    const payload = {
        brand: device.brand,
        category: device.category || device.type,
        model: device.model,
        imei: device.imei || device.imei1 || '',
        imei2: device.imei2 || '',
        serial_number: device.serialNumber || '',
        ean: device.ean || '',
        observations: device.observations || '',
        type: device.type || 'Produtos Apple',
        color: device.color || '',
        storage: device.storage || '',
        raw_model: device.rawModel || device.model,
        sold_in_store: device.soldInStore || false,
        has_previous_repair: device.hasPreviousRepair || false,
        customer_name: device.customerName,
        customer_cpf: device.customerCpf,
        updated_at: getNowISO()
    };

    const { data, error } = await supabase.from('customer_devices').update(payload).eq('id', id).select().single();
    if (error) {
        console.error('Error updating customer_device:', error);
        throw error;
    }
    clearCache(['customer_devices']);
    return mapCustomerDevice(data);
};

export const deleteCustomerDevice = async (id: string): Promise<void> => {
    const { error } = await supabase.from('customer_devices').delete().eq('id', id);
    if (error) {
        console.error('Error deleting customer_device:', error);
        throw error;
    }
    clearCache(['customer_devices']);
};
