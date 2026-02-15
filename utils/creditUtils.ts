import { AmortizationEntry } from '../types';

export const calculateInstallmentDates = (
    startDate: string,
    count: number,
    frequency: 'mensal' | 'quinzenal'
): string[] => {
    const dates: string[] = [];
    const [year, month, day] = startDate.split('-').map(Number);

    for (let i = 0; i < count; i++) {
        let nextDate = new Date(year, month - 1, day);

        if (frequency === 'mensal') {
            const targetMonth = month - 1 + (i + 1);
            nextDate = new Date(year, targetMonth, day);
            if (nextDate.getDate() !== day) {
                nextDate.setDate(0);
            }
        } else if (frequency === 'quinzenal') {
            nextDate = new Date(year, month - 1, day + ((i + 1) * 15));
        }

        dates.push(nextDate.toISOString().split('T')[0]);
    }

    return dates;
};

/**
 * Regra 2: Cálculo do valor total financiado (Juros Simples)
 * valor_total_financiado = valor_produto × (1 + taxa_juros_percentual)
 * valor_parcela = valor_total_financiado ÷ numero_parcelas
 */
export const calculateFinancedAmount = (
    productValue: number,
    interestRatePercent: number,
    installmentsCount: number
) => {
    const totalFinanced = productValue * (1 + (interestRatePercent / 100));
    const installmentAmount = totalFinanced / installmentsCount;

    return {
        totalFinanced,
        installmentAmount
    };
};

/**
 * Regra 4: Lógica de Amortização
 * valor_juros = saldo_devedor_atual × taxa_juros_percent_parcela
 * valor_amortizacao = valor_parcela − valor_juros
 * O saldo_devedor_atual deve atingir 0 ao final das parcelas seguindo a lógica da Amortização.
 * Nota: Para juros simples pré-fixados, a amortização é geralmente constante, 
 * mas seguindo a regra específica pedida:
 */
export const generateAmortizationTable = (
    totalFinanced: number,
    installmentAmount: number,
    installmentsCount: number,
    interestRatePercent: number
): AmortizationEntry[] => {
    const table: AmortizationEntry[] = [];
    let currentBalance = totalFinanced;

    // Taxa por parcela para o cálculo da amortização (Regra 4)
    // Se a taxa total de 10% é para o período, a taxa por parcela aproximada
    const ratePerInstallment = (interestRatePercent / 100) / installmentsCount;

    for (let i = 1; i <= installmentsCount; i++) {
        const interest = i === installmentsCount ? 0 : currentBalance * ratePerInstallment;
        let amortization = installmentAmount - interest;

        // Ajuste para a última parcela não sobrar resíduo
        if (i === installmentsCount) {
            amortization = currentBalance;
        }

        currentBalance -= amortization;

        table.push({
            number: i,
            installmentAmount: installmentAmount,
            amortization: parseFloat(amortization.toFixed(2)),
            interest: parseFloat(interest.toFixed(2)),
            remainingBalance: parseFloat(Math.max(0, currentBalance).toFixed(2))
        });
    }

    return table;
};

export const checkCreditLimit = (
    customer: { credit_limit?: number; credit_used?: number; allow_credit?: boolean; name: string },
    purchaseAmount: number // Aqui deve ser o valor_total_financiado conforme Regra 2
): { allowed: boolean; reason?: 'no_limit_set' | 'limit_exceeded' | 'credit_blocked' | 'limit_not_set'; available: number } => {

    // 1. Check if credit is allowed
    if (!customer.allow_credit) {
        return { allowed: false, reason: 'credit_blocked', available: 0 };
    }

    const limit = Number(customer.credit_limit || 0);
    const used = Number(customer.credit_used || 0);
    const available = Math.max(0, limit - used);

    if (limit <= 0) {
        return { allowed: false, reason: 'limit_not_set', available: 0 };
    }

    // 2. Regra 2: Se valor_total_financiado > limite_disponivel -> bloquear
    if (purchaseAmount > (available + 0.01)) { // Tolerância de centavos
        return { allowed: false, reason: 'limit_exceeded', available };
    }

    return { allowed: true, available };
};
