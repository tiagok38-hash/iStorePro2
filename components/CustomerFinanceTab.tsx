import React, { useState, useEffect, useCallback } from 'react';
import { Customer } from '../types.ts';
import { formatCurrency, syncCustomerCreditLimit, updateCustomer } from '../services/mockApi.ts';
import { TrendingUp, TrendingDown, ShieldCheck, RefreshCcw, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient.ts';

interface CustomerFinanceTabProps {
    customer: Customer;
    onUpdate: (updatedData: Partial<Customer>) => void;
}

interface Installment {
    id: string;
    saleId: string;
    installmentNumber: number;
    totalInstallments: number;
    dueDate: string;
    amount: number;
    amountPaid: number;
    status: 'pending' | 'partial' | 'overdue' | 'paid';
}

const CustomerFinanceTab: React.FC<CustomerFinanceTabProps> = ({ customer, onUpdate }) => {
    const [allowCredit, setAllowCredit] = useState(customer.allow_credit || false);
    const [creditLimit, setCreditLimit] = useState(customer.credit_limit || 0);
    const [creditUsed, setCreditUsed] = useState(customer.credit_used || 0);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
    const [adjustmentValue, setAdjustmentValue] = useState('');
    const [openInstallments, setOpenInstallments] = useState<Installment[]>([]);
    const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // ─── Sincroniza estados internos quando o prop customer muda ──────────────
    useEffect(() => {
        setCreditLimit(customer.credit_limit || 0);
        setAllowCredit(customer.allow_credit || false);
        setCreditUsed(customer.credit_used || 0);
    }, [customer.credit_limit, customer.allow_credit, customer.credit_used]);

    // ─── Busca parcelas em aberto diretamente da tabela credit_installments ───
    // ÚNICA FONTE DE VERDADE — mesmos dados da página de Crediários.
    // Suporta múltiplos crediários por venda e formas de pagamento mistas.
    const fetchOpenInstallments = useCallback(async () => {
        setIsLoadingInstallments(true);
        try {
            const { data, error } = await supabase
                .from('credit_installments')
                .select('id, sale_id, installment_number, total_installments, due_date, amount, amount_paid, status')
                .eq('customer_id', customer.id)
                .in('status', ['pending', 'partial', 'overdue'])
                .order('due_date', { ascending: true });

            if (error) throw error;

            const today = new Date().toISOString().split('T')[0];
            const mapped: Installment[] = (data || []).map((d: any) => ({
                id: d.id,
                saleId: d.sale_id,
                installmentNumber: d.installment_number,
                totalInstallments: d.total_installments,
                dueDate: d.due_date,
                amount: Number(d.amount),
                amountPaid: Number(d.amount_paid),
                // Reclassifica como overdue se vencida mas não marcada ainda
                status: (d.status !== 'paid' && d.due_date < today) ? 'overdue' : d.status,
            }));

            setOpenInstallments(mapped);
        } catch (err) {
            console.error('[CustomerFinanceTab] Erro ao buscar parcelas:', err);
        } finally {
            setIsLoadingInstallments(false);
        }
    }, [customer.id]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const newUsed = await syncCustomerCreditLimit(customer.id);
            setCreditUsed(newUsed);
            onUpdate({ credit_used: newUsed });
            await fetchOpenInstallments();
        } catch (err) {
            console.error('Failed to sync credit:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    // Na carga inicial, apenas busca as parcelas sem chamar syncCustomerCreditLimit.
    // O sync completo (que chama onUpdate e pode causar re-renders em cascata)
    // só é executado quando o usuário clica manualmente no botão de atualizar.
    useEffect(() => {
        fetchOpenInstallments();
    }, [fetchOpenInstallments]);


    const handleToggleCredit = () => {
        const newValue = !allowCredit;
        setAllowCredit(newValue);
        onUpdate({ allow_credit: newValue });
        updateCustomer({ id: customer.id, allow_credit: newValue }).catch(err => {
            console.error('Failed to auto-save allow_credit:', err);
        });
    };

    const handleOpenAdjustment = (type: 'increase' | 'decrease') => {
        setAdjustmentType(type);
        setAdjustmentValue('');
        setIsAdjustmentModalOpen(true);
    };

    const handleConfirmAdjustment = () => {
        const val = parseFloat(adjustmentValue.replace(/\./g, '').replace(',', '.'));
        if (isNaN(val) || val <= 0) return;

        let newLimit = Number(creditLimit || 0);
        if (adjustmentType === 'increase') {
            newLimit += val;
        } else {
            newLimit = Math.max(0, newLimit - val);
        }

        setCreditLimit(newLimit);
        onUpdate({ credit_limit: newLimit });
        setIsAdjustmentModalOpen(false);

        updateCustomer({ id: customer.id, credit_limit: newLimit }).catch(err => {
            console.error('Failed to auto-save credit limit:', err);
        });
    };

    const creditAvailable = Math.max(0, creditLimit - creditUsed);
    const usagePercentage = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

    // Agrupa parcelas por venda para exibição clara
    const installmentsBySale = openInstallments.reduce<Record<string, Installment[]>>((acc, inst) => {
        if (!acc[inst.saleId]) acc[inst.saleId] = [];
        acc[inst.saleId].push(inst);
        return acc;
    }, {});

    const getStatusIcon = (status: string, dueDate: string) => {
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = status === 'overdue' || (status !== 'paid' && dueDate < today);
        if (isOverdue) return <AlertCircle size={14} className="text-red-500" />;
        if (status === 'partial') return <Clock size={14} className="text-amber-500" />;
        return <Clock size={14} className="text-blue-400" />;
    };

    const getStatusLabel = (status: string, dueDate: string) => {
        const today = new Date().toISOString().split('T')[0];
        if (status === 'overdue' || (status !== 'paid' && dueDate < today)) return 'Vencida';
        if (status === 'partial') return 'Parcial';
        return 'Em aberto';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* 1. Permissão de Crédito */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldCheck size={16} /> Permissão de Crédito
                </h3>
                <div className="flex flex-col gap-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${!allowCredit
                        ? 'bg-red-50 border-red-200 shadow-sm'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!allowCredit ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                            {!allowCredit && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input type="radio" name="creditPermission" checked={!allowCredit} onChange={handleToggleCredit} className="hidden" />
                        <div>
                            <p className={`text-sm font-bold ${!allowCredit ? 'text-red-700' : 'text-gray-700'}`}>Não permitir crediário</p>
                            <p className="text-xs text-gray-500">Bloqueia novas vendas no crediário.</p>
                        </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${allowCredit
                        ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${allowCredit ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                            {allowCredit && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input type="radio" name="creditPermission" checked={allowCredit} onChange={handleToggleCredit} className="hidden" />
                        <div>
                            <p className={`text-sm font-bold ${allowCredit ? 'text-emerald-700' : 'text-gray-700'}`}>Sim, permitir limite de crédito</p>
                            <p className="text-xs text-gray-500">Habilita gestão de limite e desbloqueia vendas.</p>
                        </div>
                    </label>
                </div>
            </div>

            {/* 2. Display de Limite */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Limite Total Aprovado</p>
                            <p className="text-3xl font-black text-gray-800 mt-1">{formatCurrency(creditLimit)}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
                                title="Sincronizar Saldo"
                            >
                                <RefreshCcw size={18} />
                            </button>
                            <button type="button" onClick={() => handleOpenAdjustment('decrease')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Diminuir Limite">
                                <TrendingDown size={18} />
                            </button>
                            <button type="button" onClick={() => handleOpenAdjustment('increase')} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Aumentar Limite">
                                <TrendingUp size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                            className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-gray-500">Utilizado: <span className="text-gray-800 font-bold">{formatCurrency(creditUsed)}</span> ({usagePercentage.toFixed(0)}%)</span>
                        <span className={`${creditAvailable < 0 ? 'text-red-600' : 'text-emerald-600'} font-bold`}>
                            Disponível: {formatCurrency(creditAvailable)}
                        </span>
                    </div>
                </div>

                <div className={`${allowCredit ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-red-50 border-red-100 text-red-600'} border rounded-2xl p-5 flex flex-col justify-center items-center text-center`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${allowCredit ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                        <ShieldCheck size={20} />
                    </div>
                    <p className={`text-xs font-bold uppercase mb-1 ${allowCredit ? 'text-blue-800' : 'text-red-800'}`}>Status do Crédito</p>
                    <p className="text-sm leading-tight">
                        {allowCredit
                            ? `Cliente com crédito ativo e ${creditAvailable >= 0 ? 'limite disponível' : 'limite excedido'}.`
                            : `Crédito bloqueado para este cliente.`}
                    </p>
                </div>
            </div>

            {/* 3. Parcelas em Aberto — mesma fonte da página de Crediários */}
            <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Calendar size={16} /> Parcelas em Aberto
                    {openInstallments.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full">
                            {openInstallments.length}
                        </span>
                    )}
                </h3>

                {isLoadingInstallments ? (
                    <div className="p-8 text-center text-gray-400 text-sm">Carregando parcelas...</div>
                ) : openInstallments.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                        <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm font-medium">Nenhuma parcela em aberto.</p>
                        <p className="text-gray-400 text-xs mt-1">O saldo devedor deste cliente é zero.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        {Object.entries(installmentsBySale).map(([saleId, saleInstallments]) => {
                            const saleTotal = saleInstallments.reduce((s, i) => s + Math.max(0, i.amount - i.amountPaid), 0);
                            const hasOverdue = saleInstallments.some(i => {
                                const today = new Date().toISOString().split('T')[0];
                                return i.status === 'overdue' || i.dueDate < today;
                            });

                            return (
                                <div key={saleId} className={`border-b border-gray-100 last:border-b-0 ${hasOverdue ? 'bg-red-50/30' : ''}`}>
                                    {/* Cabeçalho da Venda */}
                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                            Venda #{saleId.slice(0, 8)}
                                        </span>
                                        <span className={`text-xs font-black ${hasOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                                            {formatCurrency(saleTotal)} em aberto
                                        </span>
                                    </div>

                                    {/* Parcelas desta venda */}
                                    <table className="w-full text-sm text-left">
                                        <tbody className="divide-y divide-gray-50">
                                            {saleInstallments.map(inst => {
                                                const remaining = Math.max(0, inst.amount - inst.amountPaid);
                                                const today = new Date().toISOString().split('T')[0];
                                                const isOverdue = inst.status === 'overdue' || inst.dueDate < today;

                                                return (
                                                    <tr key={inst.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2.5">
                                                            <div className="flex items-center gap-2">
                                                                {getStatusIcon(inst.status, inst.dueDate)}
                                                                <span className="text-xs font-bold text-gray-700">
                                                                    Parcela {inst.installmentNumber}/{inst.totalInstallments}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                                                                <Calendar size={12} />
                                                                {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className={`text-xs font-black ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                                                                    {formatCurrency(remaining)}
                                                                </span>
                                                                {inst.status === 'partial' && (
                                                                    <span className="text-[10px] text-gray-400">
                                                                        de {formatCurrency(inst.amount)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                                isOverdue ? 'bg-red-100 text-red-700' :
                                                                inst.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {getStatusLabel(inst.status, inst.dueDate)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}

                        {/* Rodapé com total */}
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-t border-gray-200">
                            <span className="text-xs font-bold text-gray-500 uppercase">Total em Aberto</span>
                            <span className="text-base font-black text-red-600">{formatCurrency(creditUsed)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Ajuste de Limite */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-slide-up">
                        <h3 className="text-lg font-black text-gray-800 mb-4">
                            {adjustmentType === 'increase' ? 'Aumentar Limite' : 'Diminuir Limite'}
                        </h3>

                        <div className="mb-4">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Valor do Ajuste (R$)</label>
                            <input
                                type="text"
                                autoFocus
                                value={adjustmentValue}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/[^\d]/g, '');
                                    const formatted = (parseInt(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                    setAdjustmentValue(v ? formatted : '');
                                }}
                                placeholder="0,00"
                                className="w-full text-2xl font-bold p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent outline-none text-center"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsAdjustmentModalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50">
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAdjustment}
                                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${adjustmentType === 'increase' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerFinanceTab;
