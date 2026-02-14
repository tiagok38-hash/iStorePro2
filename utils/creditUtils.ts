export const calculateInstallmentDates = (
    startDate: string,
    count: number,
    frequency: 'mensal' | 'quinzenal'
): string[] => {
    const dates: string[] = [];
    // Assumindo que startDate vem como YYYY-MM-DD
    const [year, month, day] = startDate.split('-').map(Number);

    // Usamos data local para evitar problemas de fuso horário pulando dia
    let current = new Date(year, month - 1, day);

    for (let i = 0; i < count; i++) {
        // Criamos uma nova data baseada na data original para evitar drift de dias (ex: 31 -> 28 -> 28)
        let nextDate = new Date(year, month - 1, day);

        if (frequency === 'mensal') {
            nextDate.setMonth(nextDate.getMonth() + (i + 1));

            // Tratamento para dia 31 em meses que não tem 31
            // Se o dia original era 31, e o próximo mês tem menos dias, o JS joga para o próximo mês.
            // Ex: 31/01 + 1 mês -> 03/03 (se fev tiver 28). Queremos 28/02.
            // Mas com a logica acima de setMonth no original, ele pode pular.
            // Melhor abordagem: Setar o dia para 1, adicionar meses, subtrair um dia se necessario ou usar date-fns.
            // Simplificação manual:

            // Re-calculating correctly:
            const targetMonth = month - 1 + (i + 1);
            nextDate = new Date(year, targetMonth, day);

            // Se o dia mudou (ex: era 31 e virou 1, 2 or 3 do mes seguinte), volta para o último dia do mês correto
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

export const checkCreditLimit = (
    customer: { credit_limit?: number; credit_used?: number; allow_credit?: boolean; name: string },
    purchaseAmount: number
): { allowed: boolean; reason?: 'no_limit_set' | 'limit_exceeded' | 'credit_blocked'; available: number } => {

    // 1. Check if credit is allowed
    if (!customer.allow_credit) {
        return { allowed: false, reason: 'credit_blocked', available: 0 };
    }

    const limit = customer.credit_limit || 0;
    const used = customer.credit_used || 0;
    const available = Math.max(0, limit - used);

    // 2. Check if purchase fits in available limit
    if (purchaseAmount > available) {
        return { allowed: false, reason: 'limit_exceeded', available };
    }

    return { allowed: true, available };
};
