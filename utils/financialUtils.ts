import { Product } from '../types.ts';

/**
 * Retorna o custo unitário de um item de venda utilizando o snapshot salvo na época da venda.
 * Faz o fallback para o custo atual do produto caso o snapshot não esteja disponível.
 * Isso garante que vendas passadas reflitam o lucro real da época, sem distorção por mudanças futuras de custo.
 * 
 * @param item O item da venda (pode conter costPrice e additionalCostPrice)
 * @param product O produto correspondente no estoque atual
 * @returns O custo unitário total (base + adicional)
 */
export const getItemCostSnapshot = (item: any, product?: Product | null): number => {
    const snapshotCost = item.costPrice !== undefined
        ? (item.costPrice || 0)
        : (product?.costPrice || 0);
        
    const snapshotAdditional = item.additionalCostPrice !== undefined
        ? (item.additionalCostPrice || 0)
        : (product?.additionalCostPrice || 0);
        
    return snapshotCost + snapshotAdditional;
};
