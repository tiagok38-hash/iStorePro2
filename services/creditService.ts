
import { supabase } from '../supabaseClient.ts';
import { CreditSettings, CreditInstallment, AuditActionType, AuditEntityType } from '../types.ts';
import { clearCache } from './cacheUtils.ts';
import { formatCurrency } from '../utils/formatters.ts';
import { addAuditLog } from './auditService.ts';
import { addFinancialTransaction } from './financialService.ts';

// Forward declarations for functions that still live in mockApi.ts
// These will be replaced by proper imports once those modules are extracted
let _syncCustomerCreditLimit: ((customerId: string) => Promise<number>) | null = null;

export const setSyncCustomerCreditLimit = (fn: (customerId: string) => Promise<number>) => {
    _syncCustomerCreditLimit = fn;
};

// ============================================================
// CREDIT MANAGEMENT
// ============================================================

export const getCreditSettings = async (): Promise<CreditSettings> => {
    try {
        const { data, error } = await supabase
            .from('credit_settings')
            .select('*')
            .single();

        if (error || !data) {
            // Return default if not found
            return { id: 'default', defaultInterestRate: 0, lateFeePercentage: 0 };
        }
        return {
            id: data.id,
            defaultInterestRate: Number(data.default_interest_rate),
            lateFeePercentage: Number(data.late_fee_percentage)
        };
    } catch (error) {
        console.error('Error getting credit settings:', error);
        return { id: 'default', defaultInterestRate: 0, lateFeePercentage: 0 };
    }
};

export const updateCreditSettings = async (settings: Partial<CreditSettings>): Promise<CreditSettings> => {
    // Check if exists
    const current = await getCreditSettings();

    const payload = {
        default_interest_rate: settings.defaultInterestRate,
        late_fee_percentage: settings.lateFeePercentage
    };

    if (current.id === 'default' || !current.id) {
        const { data, error } = await supabase
            .from('credit_settings')
            .insert([payload])
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id,
            defaultInterestRate: Number(data.default_interest_rate),
            lateFeePercentage: Number(data.late_fee_percentage)
        };
    } else {
        const { data, error } = await supabase
            .from('credit_settings')
            .update(payload)
            .eq('id', current.id)
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id,
            defaultInterestRate: Number(data.default_interest_rate),
            lateFeePercentage: Number(data.late_fee_percentage)
        };
    }
};

export const addCreditInstallments = async (installments: Partial<CreditInstallment>[]): Promise<CreditInstallment[]> => {
    const payload = installments.map(i => ({
        id: i.id, // Include ID if provided
        sale_id: i.saleId,
        customer_id: i.customerId,
        installment_number: i.installmentNumber,
        total_installments: i.totalInstallments,
        due_date: i.dueDate,
        amount: i.amount,
        status: i.status,
        amount_paid: i.amountPaid,
        interest_applied: i.interestApplied,
        penalty_applied: i.penaltyApplied
    }));

    const { data, error } = await supabase
        .from('credit_installments')
        .insert(payload)
        .select();

    if (error) {
        console.error('Error adding credit installments:', error);
        throw error;
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        saleId: d.sale_id,
        customerId: d.customer_id,
        installmentNumber: d.installment_number,
        totalInstallments: d.total_installments,
        dueDate: d.due_date,
        amount: Number(d.amount),
        status: d.status,
        amountPaid: Number(d.amount_paid),
        interestApplied: Number(d.interest_applied),
        penaltyApplied: Number(d.penalty_applied),
        paidAt: d.paid_at,
        paymentMethod: d.payment_method,
        observation: d.observation
    }));
};

export const getCreditInstallments = async (): Promise<CreditInstallment[]> => {
    const { data, error } = await supabase
        .from('credit_installments')
        .select(`
            *,
            customer:customers(name, phone),
            sale:sales(id)
        `)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error getting credit installments:', error);
        return [];
    }

    return (data || []).map((d: any) => ({
        id: d.id,
        saleId: d.sale_id,
        saleDisplayId: d.sale?.id || d.sale_id,
        customerId: d.customer_id,
        customerName: d.customer?.name || 'Cliente',
        customerPhone: d.customer?.phone || '',
        installmentNumber: d.installment_number,
        totalInstallments: d.total_installments,
        dueDate: d.due_date,
        amount: Number(d.amount),
        status: d.status,
        amountPaid: Number(d.amount_paid),
        interestApplied: Number(d.interest_applied),
        penaltyApplied: Number(d.penalty_applied),
        amortizationValue: Number(d.amortization_value || 0),
        interestValue: Number(d.interest_value || 0),
        remainingBalance: Number(d.remaining_balance || 0),
        paidAt: d.paid_at,
        paymentMethod: d.payment_method,
        observation: d.observation
    }));
};

export const payInstallment = async (
    id: string,
    amountPaid: number,
    method: string,
    penalty: number,
    observation?: string,
    userId?: string,
    userName?: string
): Promise<CreditInstallment> => {
    const now = new Date().toISOString();

    // First get current installment to check total and get customer name
    const { data: current, error: fetchError } = await supabase
        .from('credit_installments')
        .select('*, customer:customers(name, id)')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    const totalDue = Number(current.amount) + penalty;
    const newAmountPaid = Number(current.amount_paid) + amountPaid;

    // Determine status
    let newStatus = 'pending';
    if (newAmountPaid >= totalDue - 0.01) {
        newStatus = 'paid';
    } else if (newAmountPaid > 0) {
        newStatus = 'partial';
    }

    const { data, error } = await supabase
        .from('credit_installments')
        .update({
            amount_paid: newAmountPaid,
            penalty_applied: penalty,
            status: newStatus,
            paid_at: now,
            payment_method: method,
            observation: observation
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    // --- Amortization Logic (Regra 4) ---
    try {
        if (current.sale_id) {
            const { data: sale } = await supabase
                .from('sales')
                .select('*')
                .eq('id', current.sale_id)
                .single();

            if (sale) {
                const interestRate = Number(sale.interest_rate || 0);
                const installmentsCount = Number(current.total_installments || 1);
                const ratePerInstallment = (interestRate / 100) / installmentsCount;

                let currentDebt = Number(sale.current_debt_balance || 0);

                // Recuperar saldo se for venda antiga
                if (currentDebt <= 0) {
                    const { data: installments } = await supabase
                        .from('credit_installments')
                        .select('amount, amount_paid')
                        .eq('sale_id', sale.id)
                        .in('status', ['pending', 'partial', 'overdue']);
                    currentDebt = (installments || []).reduce((sum, inst) => sum + (Number(inst.amount) - Number(inst.amount_paid)), 0);
                }

                const calculatedInterest = currentDebt * ratePerInstallment;
                const amortizationPart = Math.max(0, amountPaid - calculatedInterest);
                const newDebtBalance = Math.max(0, currentDebt - amortizationPart);

                await supabase.from('sales').update({
                    current_debt_balance: newDebtBalance
                }).eq('id', sale.id);

                await supabase.from('credit_installments').update({
                    interest_value: calculatedInterest,
                    amortization_value: amortizationPart,
                    remaining_balance: newDebtBalance
                }).eq('id', id);

                // Regra 6: Atualizar total credit_used do cliente
                if (current.customer_id && _syncCustomerCreditLimit) {
                    const newTotalUsed = await _syncCustomerCreditLimit(current.customer_id);

                    await addAuditLog(
                        AuditActionType.UPDATE,
                        AuditEntityType.CUSTOMER,
                        current.customer_id,
                        `Pagamento efetuado: Amortizado ${formatCurrency(amortizationPart)} | Juros: ${formatCurrency(calculatedInterest)} | Novo total devedor: ${formatCurrency(newTotalUsed)}`,
                        userId,
                        userName
                    );
                }
            }
        }
    } catch (restorationError) {
        console.error('payInstallment: Amortization logic error:', restorationError);
    }

    // Create a FinancialTransaction for this payment ("Receita")
    try {
        const { data: categories } = await supabase
            .from('transaction_categories')
            .select('id, name')
            .eq('type', 'income')
            .limit(1);

        const categoryId = categories && categories.length > 0 ? categories[0].id : null;

        if (categoryId) {
            const customerName = current.customer?.name || 'Cliente Desconhecido';
            const description = `Recebimento Parc. ${current.installment_number}/${current.total_installments} - ${customerName}`;

            await addFinancialTransaction({
                type: 'income',
                description: description,
                amount: amountPaid,
                category_id: categoryId,
                due_date: now.split('T')[0],
                payment_date: now.split('T')[0],
                status: 'paid',
                payment_method: method,
                entity_name: customerName,
                is_recurring: false,
                notes: `Ref. Venda #${current.sale_id || '?'}. Obs: ${observation || ''}`
            }, userId, userName);
        } else {
            console.warn('payInstallment: No income category found, skipping financial transaction creation.');
        }
    } catch (ftError) {
        console.error('payInstallment: Error creating financial transaction:', ftError);
    }

    clearCache(['credit_installments', 'customers', 'financial_transactions']);

    return {
        id: data.id,
        saleId: data.sale_id,
        saleDisplayId: data.sale_id,
        customerId: data.customer_id,
        customerName: current.customer?.name || 'Cliente',
        customerPhone: current.customer?.phone || '',
        installmentNumber: data.installment_number,
        totalInstallments: data.total_installments,
        dueDate: data.due_date,
        amount: Number(data.amount),
        status: data.status,
        amountPaid: Number(data.amount_paid),
        interestApplied: Number(data.interest_applied),
        penaltyApplied: Number(data.penalty_applied),
        paidAt: data.paid_at,
        paymentMethod: data.payment_method,
        observation: data.observation
    };
};

export const updateInstallmentPaymentMethod = async (id: string, newMethod: string): Promise<void> => {
    const { error } = await supabase
        .from('credit_installments')
        .update({ payment_method: newMethod })
        .eq('id', id);

    if (error) throw error;
    clearCache(['credit_installments']);
};
