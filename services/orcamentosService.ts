import { supabase } from '../supabaseClient.ts';
import { Orcamento, OrcamentoItem, OrcamentoStatus } from '../types.ts';
import { getNowISO } from '../utils/dateUtils.ts';
import { clearCache } from './mockApi.ts';

/**
 * Retorna os orçamentos, aplicando filtros de permissão.
 * @param userId ID do vendedor atual. Se não passado (Admin), retorna todos.
 */
export const getOrcamentos = async (userId?: string): Promise<Orcamento[]> => {
    let query = supabase
        .from('orcamentos')
        .select(`
            *,
            itens:orcamento_itens(*)
        `)
        .order('created_at', { ascending: false });

    if (userId) {
        query = query.eq('vendedor_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as unknown as Orcamento[];
};

/**
 * Cria um novo orçamento com seus itens.
 */
export const createOrcamento = async (
    orcamentoData: Partial<Orcamento>,
    itensData: Partial<OrcamentoItem>[],
    userId: string,
    userName: string
): Promise<Orcamento> => {
    // 1. Inserir Orçamento
    const { data: orcamento, error: orcErr } = await supabase
        .from('orcamentos')
        .insert([{
            ...orcamentoData,
            vendedor_id: userId,
            created_at: getNowISO(),
            updated_at: getNowISO()
        }])
        .select()
        .single();

    if (orcErr) throw orcErr;

    // 2. Transforma e insere Itens vinculados ao ID do novo Orçamento
    const itensToInsert = itensData.map(item => ({
        ...item,
        orcamento_id: orcamento.id,
        created_at: getNowISO()
    }));

    if (itensToInsert.length > 0) {
        const { error: itensErr } = await supabase
            .from('orcamento_itens')
            .insert(itensToInsert);

        if (itensErr) {
            // Em caso de erro nos itens, seria ideal apagar o orçamento (rollback)
            await supabase.from('orcamentos').delete().eq('id', orcamento.id);
            throw itensErr;
        }
    }

    // 3. Busca completo para retornar
    const { data: finalOrcamento, error: fetchErr } = await supabase
        .from('orcamentos')
        .select('*, itens:orcamento_itens(*)')
        .eq('id', orcamento.id)
        .single();

    if (fetchErr) throw fetchErr;

    // TODO: Adicionar AuditLog (import de mockApi pode causar conflito logico, mas como é um serviço separado, apenas limpamos cache por enquanto)
    clearCache(['orcamentos']);

    return finalOrcamento as unknown as Orcamento;
};

/**
 * Atualiza um orçamento e seus itens.
 */
export const updateOrcamento = async (
    id: string,
    orcamentoData: Partial<Orcamento>,
    itensData: Partial<OrcamentoItem>[] // Deve conter tudo, pois recriaremos
): Promise<Orcamento> => {

    const { error: orcErr } = await supabase
        .from('orcamentos')
        .update({
            ...orcamentoData,
            updated_at: getNowISO()
        })
        .eq('id', id);

    if (orcErr) throw orcErr;

    // Atualiza Itens (Estratégia mais simples: apagar todos os itens antigos e recriar)
    // Isso evita lógica complexa de sync de array. O `id` do item mudará, mas para orçamento costuma ser OK.
    const { error: delErr } = await supabase
        .from('orcamento_itens')
        .delete()
        .eq('orcamento_id', id);

    if (delErr) throw delErr;

    const itensToInsert = itensData.map(item => ({
        ...item,
        id: undefined, // Remove if exists so Postgres assigns a new UUID
        orcamento_id: id,
        created_at: getNowISO() // Ideally restore original date, but simplified for now
    }));

    if (itensToInsert.length > 0) {
        const { error: insErr } = await supabase
            .from('orcamento_itens')
            .insert(itensToInsert);
        if (insErr) throw insErr;
    }

    const { data: finalOrcamento, error: fetchErr } = await supabase
        .from('orcamentos')
        .select('*, itens:orcamento_itens(*)')
        .eq('id', id)
        .single();

    if (fetchErr) throw fetchErr;

    clearCache(['orcamentos']);
    return finalOrcamento as unknown as Orcamento;
};

/**
 * Atualiza status do Orçamento
 */
export const updateOrcamentoStatus = async (
    id: string,
    status: OrcamentoStatus,
    vendaId?: string
): Promise<void> => {
    const payload: Partial<Orcamento> = {
        status,
        updated_at: getNowISO()
    };

    if (status === 'convertido') {
        payload.convertido_em = getNowISO();
        if (vendaId) payload.venda_id = vendaId;
    }

    const { error } = await supabase
        .from('orcamentos')
        .update(payload)
        .eq('id', id);

    if (error) throw error;
    clearCache(['orcamentos']);
};

export const deleteOrcamento = async (id: string): Promise<void> => {
    // Delete items handled automatically by physical Cascade if setup in Postgres, 
    // but we can ensure here
    await supabase.from('orcamento_itens').delete().eq('orcamento_id', id);
    const { error } = await supabase.from('orcamentos').delete().eq('id', id);
    if (error) throw error;
    clearCache(['orcamentos']);
};

/**
 * Converte Orçamento -> Venda.
 * Reaproveita a function addSale existente no mockApi para manter toda a integridade 
 * de estoque, sessões de caixa e movimentação transacional já estabelecida.
 */
export const convertOrcamentoToSale = async (
    orcamento: Orcamento,
    userId: string,
    userName: string,
    openSessionId: string, // ID do caixa atual para vincular a venda
    openSessionDisplayId: number
): Promise<string> => {
    // Import delayed execution to prevent circular deps issues if any
    const { addSale } = await import('./mockApi.ts');

    if (!orcamento.itens || orcamento.itens.length === 0) {
        throw new Error("Orçamento não possui itens para conversão");
    }

    // Adaptando itens do Orçamento (OrcamentoItem) para formato de Items da Venda
    const adaptedItems = orcamento.itens.map(orcItem => {
        // Tentamos recuperar detalhes completos do produto para bater com as checagens do addSale
        // Se o produto não existir mais (deletado), a addSale pode rejeitar, mas passamos a key mínima.
        return {
            productId: orcItem.produto_id || 'unknown',
            quantity: orcItem.quantidade,
            salePrice: orcItem.preco_unitario_snapshot,
            discount: orcItem.desconto,
            // Detalhes estáticos salvos no momento do orçamento para não depender do banco atual:
            name: orcItem.nome_produto_snapshot,
            model: orcItem.sku_snapshot,
            isAccessory: orcItem.metadata_snapshot?.is_accessory || false,
            warrantyDays: orcItem.metadata_snapshot?.warranty_days || 0
        };
    });

    // Adaptando pagamentos baseado no snapshot do orçamento
    let adaptedPayments = [];
    const paymentSnap = orcamento.forma_pagamento_snapshot;
    if (paymentSnap) {
        // Assume payment method structure from Orçamento UI
        adaptedPayments.push({
            method: paymentSnap.metodo || 'Outro',
            value: orcamento.total_final,
            installments: paymentSnap.parcelas || 1,
            isCreditInstallment: paymentSnap.metodo === 'Crediário'
        });
    } else {
        // Fallback
        adaptedPayments.push({
            method: 'Dinheiro',
            value: orcamento.total_final,
            installments: 1
        });
    }

    // Construct the payload for addSale
    const salePayload = {
        customerId: orcamento.cliente_id, // can be null for unnamed consumers
        items: adaptedItems,
        payments: adaptedPayments,
        total: orcamento.total_final,
        discountTotal: orcamento.desconto_total,
        interestTotal: orcamento.juros_total,
        observations: `Venda convertida do orçamento ${orcamento.numero}. \r\n${orcamento.observacoes || ''}`,
        cashSessionId: openSessionId,
        cashSessionDisplayId: openSessionDisplayId
    };

    try {
        // 1. Aciona o engine já consolidado de Vendas (trata Estoque, Imeis, Sessões, Auditoria, Limites de Crédito)
        const newSale = await addSale(salePayload, userId, userName);

        // 2. Atualiza status do Orcamento
        await updateOrcamentoStatus(orcamento.id, 'convertido', newSale.id);

        return newSale.id;
    } catch (e: any) {
        throw new Error(`Erro na conversão: ${e.message}`);
    }
};
