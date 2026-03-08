
import { supabase } from '../supabaseClient.ts';
import { BancoHorasFuncionario, BancoHoras, AuditActionType } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { fetchWithCache, clearCache, fetchWithRetry } from './cacheUtils.ts';
import { addAuditLog } from './auditService.ts';

// --- BANCO DE HORAS ---

export const getBancoHorasFuncionarios = async (): Promise<BancoHorasFuncionario[]> => {
    return fetchWithCache('banco_horas_funcionarios', async () => {
        const { data, error } = await supabase
            .from('banco_horas_funcionarios')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        return data as BancoHorasFuncionario[];
    });
};

export const saveBancoHorasFuncionario = async (payload: Partial<BancoHorasFuncionario>): Promise<BancoHorasFuncionario> => {
    const dataToSave = {
        name: payload.name,
        active: payload.active !== false,
        funcao: payload.funcao,
        data_nascimento: payload.data_nascimento || null,
        cpf: payload.cpf,
        rg: payload.rg,
        whatsapp: payload.whatsapp,
        endereco: payload.endereco,
        cep: payload.cep,
        numero: payload.numero,
        bairro: payload.bairro,
        cidade: payload.cidade,
        estado: payload.estado,
        valor_salario: payload.valor_salario,
        valor_hora: payload.valor_hora,
        bonus_salarial: payload.bonus_salarial,
        data_admissao: payload.data_admissao || null
    };

    if (payload.id) {
        const { data, error } = await supabase
            .from('banco_horas_funcionarios')
            .update(dataToSave)
            .eq('id', payload.id)
            .select()
            .single();
        if (error) throw error;
        clearCache(['banco_horas_funcionarios', 'banco_horas_all']);
        return data;
    } else {
        const { data, error } = await supabase
            .from('banco_horas_funcionarios')
            .insert([dataToSave])
            .select()
            .single();
        if (error) throw error;
        clearCache(['banco_horas_funcionarios']);
        return data as BancoHorasFuncionario;
    }
};

export const deleteBancoHorasFuncionario = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('banco_horas_funcionarios')
        .delete()
        .eq('id', id);
    if (error) throw error;
    clearCache(['banco_horas_funcionarios']);
};

export const getBancoHoras = async (): Promise<any[]> => {
    return fetchWithCache('banco_horas_all', async () => {
        return fetchWithRetry(async () => {
            const { data, error } = await supabase
                .from('banco_horas')
                .select(`
                    *,
                    funcionarios:banco_horas_funcionarios!banco_horas_funcionario_id_fkey(name),
                    payer:users!banco_horas_usuario_pagamento_id_fkey(name)
                `)
                .order('data_trabalho', { ascending: false });

            if (error) throw error;

            return (data || []).map(item => ({
                ...item,
                funcionario_nome: item.funcionarios?.name,
                usuario_pagamento_nome: item.payer?.name
            }));
        });
    });
};

export const addBancoHoras = async (item: Partial<BancoHoras>, userId?: string, userName?: string): Promise<any> => {
    const { data, error } = await supabase
        .from('banco_horas')
        .insert([{ ...item, status: 'PENDING' }])
        .select()
        .single();

    if (error) throw error;

    await addAuditLog(
        AuditActionType.CREATE as any,
        'BANCO_HORAS' as any,
        data.id,
        `Adicionou banco de horas: ${data.id}`,
        userId || '',
        userName || ''
    );

    clearCache(['banco_horas']);
    return data;
};

export const updateBancoHoras = async (id: string, item: Partial<BancoHoras>, userId: string, userName: string): Promise<void> => {
    const { error } = await supabase
        .from('banco_horas')
        .update(item)
        .eq('id', id);

    if (error) throw error;

    await addAuditLog(
        AuditActionType.UPDATE as any,
        'BANCO_HORAS' as any,
        id,
        `Editou banco de horas: ${id}`,
        userId,
        userName
    );

    clearCache(['banco_horas']);
};

export const deleteBancoHoras = async (id: string, userId: string, userName: string): Promise<void> => {
    const { error } = await supabase
        .from('banco_horas')
        .delete()
        .eq('id', id);

    if (error) throw error;

    await addAuditLog(
        AuditActionType.DELETE as any,
        'BANCO_HORAS' as any,
        id,
        `Excluiu banco de horas: ${id}`,
        userId,
        userName
    );

    clearCache(['banco_horas']);
};


export const payBancoHoras = async (id: string, userId: string, userName: string): Promise<any> => {
    const { data, error } = await supabase
        .from('banco_horas')
        .update({
            status: 'PAID',
            data_pagamento: getNowISO(),
            usuario_pagamento_id: userId
        })
        .eq('id', id)
        .eq('status', 'PENDING') // Security: only pending can be paid
        .select()
        .single();

    if (error) throw error;

    await addAuditLog(
        AuditActionType.UPDATE as any,
        'BANCO_HORAS' as any,
        id,
        `Pagou banco de horas: ${id}`,
        userId,
        userName
    );

    clearCache(['banco_horas']);
    return data;
};

export const payMultipleBancoHoras = async (ids: string[], userId: string, userName: string): Promise<void> => {
    if (!ids.length) return;

    const { error } = await supabase
        .from('banco_horas')
        .update({
            status: 'PAID',
            data_pagamento: getNowISO(),
            usuario_pagamento_id: userId
        })
        .in('id', ids)
        .eq('status', 'PENDING');

    if (error) throw error;

    await addAuditLog(
        AuditActionType.UPDATE as any,
        'BANCO_HORAS' as any,
        'MULTIPLE',
        `Pagou ${ids.length} registros de banco de horas`,
        userId,
        userName
    );

    clearCache(['banco_horas']);
};
