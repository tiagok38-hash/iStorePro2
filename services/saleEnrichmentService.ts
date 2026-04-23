/**
 * Script de Enriquecimento Retroativo de Vendas
 * 
 * Este utilitário varre todas as vendas no banco de dados e preenche
 * campos que estavam ausentes nos snapshots antigos (imei1, imei2,
 * serialNumber, model, productName, costPrice, additionalCostPrice).
 * 
 * Segurança:
 * - Nunca sobrescreve dados que já existem no snapshot
 * - Modo "dry-run" (simulação) para ver o que seria corrigido antes de aplicar
 * - Logs detalhados de cada correção
 */
import { supabase } from '../supabaseClient.ts';

export interface EnrichmentResult {
    totalSales: number;
    salesAnalyzed: number;
    salesUpdated: number;
    itemsEnriched: number;
    errors: string[];
    details: {
        saleId: string;
        itemIndex: number;
        productId: string;
        fieldsFixed: string[];
    }[];
}

/**
 * Executa o enriquecimento retroativo das vendas.
 * 
 * @param dryRun Se true, apenas simula e retorna o relatório sem alterar dados
 * @param batchSize Número de vendas processadas por vez (default: 100)
 */
export const enrichOldSales = async (dryRun: boolean = true, batchSize: number = 100): Promise<EnrichmentResult> => {
    const result: EnrichmentResult = {
        totalSales: 0,
        salesAnalyzed: 0,
        salesUpdated: 0,
        itemsEnriched: 0,
        errors: [],
        details: []
    };

    try {
        // 1. Contar total de vendas
        const { count } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'Rascunho');
        
        result.totalSales = count || 0;
        console.log(`[Enriquecimento] Total de vendas a analisar: ${result.totalSales}`);

        // 2. Processar em lotes
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const { data: sales, error: fetchError } = await supabase
                .from('sales')
                .select('id, items')
                .neq('status', 'Rascunho')
                .order('date', { ascending: false })
                .range(offset, offset + batchSize - 1);

            if (fetchError) {
                result.errors.push(`Erro ao buscar vendas (offset ${offset}): ${fetchError.message}`);
                break;
            }

            if (!sales || sales.length === 0) {
                hasMore = false;
                break;
            }

            // 3. Para cada venda, verificar itens incompletos
            for (const sale of sales) {
                result.salesAnalyzed++;
                const items = Array.isArray(sale.items)
                    ? sale.items
                    : (typeof sale.items === 'string' ? JSON.parse(sale.items) : []);

                if (!items || items.length === 0) continue;

                // Identificar itens que precisam de enriquecimento
                const incompleteItems: { index: number; productId: string }[] = [];
                
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (!item.productId) continue;

                    // Verificar se faltam dados críticos
                    const missingImei = !item.imei1 && !item.serialNumber;
                    const missingName = !item.productName && !item.model;
                    const missingCost = item.costPrice === undefined || item.costPrice === null;
                    
                    if (missingImei || missingName || missingCost) {
                        incompleteItems.push({ index: i, productId: item.productId });
                    }
                }

                if (incompleteItems.length === 0) continue;

                // 4. Buscar os produtos necessários em UMA query
                const productIds = [...new Set(incompleteItems.map(item => item.productId))];
                const { data: products, error: productError } = await supabase
                    .from('products')
                    .select('id, model, imei1, imei2, serialNumber, costPrice, additionalCostPrice, sku, brand, color, storage, condition')
                    .in('id', productIds);

                if (productError) {
                    result.errors.push(`Erro ao buscar produtos para venda ${sale.id}: ${productError.message}`);
                    continue;
                }

                const productMap = new Map<string, any>();
                (products || []).forEach(p => productMap.set(p.id, p));

                // 5. Enriquecer itens
                let saleModified = false;
                const updatedItems = items.map((item: any, idx: number) => {
                    const incompleteItem = incompleteItems.find(i => i.index === idx);
                    if (!incompleteItem) return item;

                    const product = productMap.get(incompleteItem.productId);
                    if (!product) {
                        // Produto foi permanentemente deletado - nada a fazer
                        return item;
                    }

                    const fieldsFixed: string[] = [];
                    const enriched = { ...item };

                    // REGRA: Nunca sobrescrever dados que já existem
                    if (!enriched.imei1 && product.imei1) {
                        enriched.imei1 = product.imei1;
                        fieldsFixed.push('imei1');
                    }
                    if (!enriched.imei2 && product.imei2) {
                        enriched.imei2 = product.imei2;
                        fieldsFixed.push('imei2');
                    }
                    if (!enriched.serialNumber && product.serialNumber) {
                        enriched.serialNumber = product.serialNumber;
                        fieldsFixed.push('serialNumber');
                    }
                    if (!enriched.model && product.model) {
                        enriched.model = product.model;
                        fieldsFixed.push('model');
                    }
                    if (!enriched.productName && product.model) {
                        enriched.productName = product.model;
                        fieldsFixed.push('productName');
                    }
                    if ((enriched.costPrice === undefined || enriched.costPrice === null || enriched.costPrice === 0) && product.costPrice) {
                        enriched.costPrice = product.costPrice;
                        fieldsFixed.push('costPrice');
                    }
                    if ((enriched.additionalCostPrice === undefined || enriched.additionalCostPrice === null) && product.additionalCostPrice) {
                        enriched.additionalCostPrice = product.additionalCostPrice;
                        fieldsFixed.push('additionalCostPrice');
                    }

                    if (fieldsFixed.length > 0) {
                        saleModified = true;
                        result.itemsEnriched++;
                        result.details.push({
                            saleId: sale.id,
                            itemIndex: idx,
                            productId: incompleteItem.productId,
                            fieldsFixed
                        });
                        console.log(`[Enriquecimento] Venda ${sale.id} item[${idx}] (${product.model}): ${fieldsFixed.join(', ')}`);
                    }

                    return enriched;
                });

                // 6. Salvar de volta no banco (apenas se não for dry-run)
                if (saleModified) {
                    if (!dryRun) {
                        const { error: updateError } = await supabase
                            .from('sales')
                            .update({ items: updatedItems })
                            .eq('id', sale.id);

                        if (updateError) {
                            result.errors.push(`Erro ao atualizar venda ${sale.id}: ${updateError.message}`);
                            continue;
                        }
                    }
                    result.salesUpdated++;
                }
            }

            offset += batchSize;
            if (sales.length < batchSize) hasMore = false;
        }

    } catch (err: any) {
        result.errors.push(`Erro fatal: ${err.message}`);
    }

    console.log(`[Enriquecimento] Finalizado! Modo: ${dryRun ? 'SIMULAÇÃO' : 'APLICADO'}`);
    console.log(`  Vendas analisadas: ${result.salesAnalyzed}`);
    console.log(`  Vendas corrigidas: ${result.salesUpdated}`);
    console.log(`  Itens enriquecidos: ${result.itemsEnriched}`);
    if (result.errors.length > 0) {
        console.warn(`  Erros: ${result.errors.length}`);
    }

    return result;
};
