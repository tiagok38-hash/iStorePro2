/**
 * Serviço de Informações da Empresa.
 * Extraído do mockApi.ts para modularização.
 */
import { supabase } from '../supabaseClient.ts';
import { CompanyInfo, AuditActionType, AuditEntityType } from '../types.ts';
import { fetchWithCache, clearCache, fetchWithRetry } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

export const getCompanyInfo = async (): Promise<CompanyInfo | null> => {
    return fetchWithCache('company_info', async () => {
        return fetchWithRetry(async () => {
            const { data: userCompanyId } = await supabase.rpc('get_my_company_id');
            const query = supabase.from('companies').select('*');
            if (userCompanyId) query.eq('id', userCompanyId);

            const res = await query.single();
            if (res.error) return { name: 'Sua Empresa' } as CompanyInfo;
            const row = res.data;
            // Map snake_case database columns to camelCase frontend fields
            // Use localStorage fallback for logo if column doesn't exist
            const logoFromDb = row.logo_url || row.logoUrl;
            const logoFromStorage = typeof window !== 'undefined' ? localStorage.getItem('company_logo_fallback') : null;
            return {
                id: row.id,
                slug: row.slug,
                name: row.name,
                razaoSocial: row.razao_social,
                logoUrl: logoFromDb || logoFromStorage || '',
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
                telegramBotToken: row.telegram_bot_token || '',
                telegramChatId: row.telegram_chat_id || '',
            } as CompanyInfo;
        }, 2, 500);
    });
};

export const updateCompanyInfo = async (data: CompanyInfo, userId: string = 'system', userName: string = 'Sistema') => {
    const { data: userCompanyId } = await supabase.rpc('get_my_company_id');

    // Map camelCase frontend fields to snake_case database columns
    const payload: Record<string, any> = {
        name: data.name,
        razao_social: data.razaoSocial,
        logo_url: data.logoUrl ?? null, // Allow null/empty to remove logo
        cnpj: data.cnpj,
        inscricao_estadual: data.inscricaoEstadual,
        address: data.address,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        city: data.city,
        state: data.state,
        cep: data.cep,
        email: data.email,
        whatsapp: data.whatsapp,
        instagram: data.instagram,
        is_catalog_online: data.isCatalogOnline,
        catalog_offline_message: data.catalogOfflineMessage,
        catalog_offline_image_url: data.catalogOfflineImageUrl,
        telegram_bot_token: data.telegramBotToken ?? null,
        telegram_chat_id: data.telegramChatId ?? null,
    };

    // We must use the userCompanyId since RLS dictates they can only UPDATE their own company
    if (!userCompanyId) {
        throw new Error('Empresa não encontrada para este usuário.');
    }

    // Try to save with logo_url first
    let result = await supabase.from('companies').update(payload).eq('id', userCompanyId).select().single();

    // If logo_url column doesn't exist, retry without it
    if (result.error && result.error.message.includes('logo_url')) {
        console.warn('logo_url column not found, saving without logo');
        const { logo_url, ...payloadWithoutLogo } = payload;
        // Store logo in localStorage as fallback
        if (data.logoUrl) {
            localStorage.setItem('company_logo_fallback', data.logoUrl);
        } else {
            localStorage.removeItem('company_logo_fallback');
        }
        result = await supabase.from('companies').update(payloadWithoutLogo).eq('id', userCompanyId).select().single();
    } else if (!result.error) {
        // Logo was saved to DB successfully, clear localStorage fallback
        localStorage.removeItem('company_logo_fallback');
    }

    if (result.error) throw result.error;

    await addAuditLog(
        AuditActionType.UPDATE,
        AuditEntityType.USER, // Or a dynamic SYSTEM entity
        result.data.id, // Use the ID from the updated record
        `Dados da empresa atualizados por ${userName}`,
        userId,
        userName
    );

    clearCache(['company_info']);
    window.dispatchEvent(new CustomEvent('companyInfoUpdated'));
    return result.data;
};
