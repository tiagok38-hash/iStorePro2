import React, { useState, useEffect, useMemo } from 'react';
import { XIcon, CalculatorIcon, CalendarIcon, PercentIcon, AlertCircleIcon, Edit2Icon, CheckIcon, InfoIcon } from 'lucide-react';
import { formatCurrency, getCreditSettings, updateCustomer } from '../../services/mockApi.ts';
import CustomDatePicker from '../CustomDatePicker.tsx';
import CurrencyInput from '../CurrencyInput.tsx';
import { calculateInstallmentDates } from '../../utils/creditUtils.ts';
import { useToast } from '../../contexts/ToastContext.tsx';

interface NewCreditModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number;
    availableLimit: number;
    customerLimit?: number;
    customerUsed?: number;
    customerId?: string;
    onConfirm: (details: any) => void;
    onUpdateLimit?: (newLimit: number) => void | Promise<void>;
}

const NewCreditModal: React.FC<NewCreditModalProps> = ({ isOpen, onClose, totalAmount, availableLimit, customerLimit, customerUsed, customerId, onConfirm, onUpdateLimit }) => {
    const [entryAmount, setEntryAmount] = useState(0);
    const [financedAmount, setFinancedAmount] = useState(totalAmount);
    const [installments, setInstallments] = useState(1);
    const [frequency, setFrequency] = useState<'mensal' | 'quinzenal'>('mensal');
    const { showToast } = useToast();
    
    const getDefaultDate = (freq: 'mensal' | 'quinzenal') => {
        const d = new Date();
        if (freq === 'mensal') {
            d.setMonth(d.getMonth() + 1);
        } else {
            d.setDate(d.getDate() + 15);
        }
        return d.toISOString().split('T')[0];
    };

    const [firstDueDate, setFirstDueDate] = useState(() => getDefaultDate('mensal'));
    const [applyInterest, setApplyInterest] = useState(false);
    const [interestRate, setInterestRate] = useState(0);
    const [defaultSettings, setDefaultSettings] = useState({ defaultInterestRate: 0, lateFeePercentage: 0 });

    const [isEditingLimit, setIsEditingLimit] = useState(false);
    const [editedLimit, setEditedLimit] = useState(0);
    const [localTotalLimit, setLocalTotalLimit] = useState(customerLimit !== undefined ? customerLimit : availableLimit);

    useEffect(() => {
        if (customerLimit !== undefined) {
            setLocalTotalLimit(Number(customerLimit));
        } else {
            setLocalTotalLimit(Number(availableLimit));
        }
    }, [customerLimit, availableLimit]);

    // Limite disponível REAL: total configurado menos o já utilizado.
    // Se o limite total for 0 (não configurado), o limite disponível também é 0, jamais negativo.
    const actualAvailableLimit = useMemo(() => {
        const total = localTotalLimit;
        const used = customerUsed !== undefined ? Number(customerUsed) : 0;

        // Se o limite total não foi configurado (zero), disponível = 0
        if (total <= 0) return 0;

        // Disponível = total - usado, mínimo 0
        return Math.max(0, total - used);
    }, [localTotalLimit, customerUsed]);

    const hasLimitConfigured = localTotalLimit > 0;

    useEffect(() => {
        if (isOpen) {
            setEntryAmount(0);
            setFinancedAmount(totalAmount);
            setFrequency('mensal');
            setFirstDueDate(getDefaultDate('mensal'));
            getCreditSettings().then(settings => {
                setDefaultSettings(settings);
                setInterestRate(settings.defaultInterestRate);
            });
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, totalAmount]);

    useEffect(() => {
        if (isOpen) {
            setFirstDueDate(getDefaultDate(frequency));
        }
    }, [frequency, isOpen]);

    const totalWithInterest = applyInterest
        ? financedAmount * (1 + (interestRate / 100))
        : financedAmount;

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    // Limite excedido: só verifica se o limite está configurado (> 0)
    const limitExceeded = hasLimitConfigured && totalWithInterest > actualAvailableLimit;
    // Sem limite configurado: exibe aviso diferente mas não bloqueia
    const noLimitConfigured = !hasLimitConfigured;

    const previewInstallments = useMemo(() => {
        const dates = calculateInstallmentDates(firstDueDate, installments, frequency);
        return dates.map((date, index) => ({
            number: index + 1,
            date,
            amount: installmentValue
        }));
    }, [firstDueDate, installments, frequency, installmentValue]);

    const handleConfirm = async () => {
        let currentLimitExceeded = limitExceeded;

        if (isEditingLimit) {
            const limitToSave = Number(editedLimit);
            setLocalTotalLimit(limitToSave);
            try {
                if (onUpdateLimit) await onUpdateLimit(limitToSave);
                else if (customerId) await updateCustomer({ id: customerId, credit_limit: limitToSave });
                showToast('Limite de crédito atualizado com sucesso!', 'success');
            } catch (err) {
                console.error('Failed to auto-save limit:', err);
                showToast('Erro ao atualizar limite de crédito.', 'error');
            }
            setIsEditingLimit(false);

            const newUsed = customerUsed !== undefined ? Number(customerUsed) : 0;
            const newAvailable = Math.max(0, editedLimit - newUsed);
            currentLimitExceeded = editedLimit > 0 && totalWithInterest > newAvailable;
        }

        if (installments < 1 || currentLimitExceeded) return;

        onConfirm({
            entryAmount,
            financedAmount,
            installments,
            totalInstallments: installments,
            firstDueDate,
            frequency,
            applyInterest,
            interestRate: applyInterest ? interestRate : 0,
            installmentValue,
            installmentsPreview: previewInstallments
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in py-6">
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row animate-scale-in my-auto overflow-hidden">
                
                {/* ─── Painel Esquerdo ─── */}
                <div className="p-6 md:p-8 flex-1 space-y-6 min-w-0">
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-indigo-600">
                            <div className="p-2.5 bg-indigo-50 rounded-2xl">
                                <CalculatorIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Gerar Crediário</h2>
                                <p className="text-xs text-gray-400 font-medium">Configure as condições de parcelamento</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {/* KPIs: Valor Total + Limite do Cliente */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Valor total da venda */}
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl p-4 border border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Valor Total da Venda</p>
                            <p className="text-2xl font-black text-indigo-900">{formatCurrency(totalAmount)}</p>
                        </div>

                        {/* Limite do cliente */}
                        <div className={`rounded-2xl p-4 border ${limitExceeded ? 'bg-red-50 border-red-200' : noLimitConfigured ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${limitExceeded ? 'text-red-400' : noLimitConfigured ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    Limite do Cliente
                                </p>
                                {/* Botão editar limite */}
                                {isEditingLimit ? (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setIsEditingLimit(false);
                                                setLocalTotalLimit(editedLimit);
                                                try {
                                                    if (onUpdateLimit) await onUpdateLimit(editedLimit);
                                                    else if (customerId) await updateCustomer({ id: customerId, credit_limit: editedLimit });
                                                    showToast('Limite atualizado!', 'success');
                                                } catch (err) {
                                                    console.error('Failed to update limit:', err);
                                                }
                                            }}
                                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all shadow-sm active:scale-95"
                                        >
                                            <CheckIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setIsEditingLimit(false)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                                            <XIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setEditedLimit(localTotalLimit); setIsEditingLimit(true); }}
                                        className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-indigo-500 transition-colors"
                                        title="Editar limite total"
                                    >
                                        <Edit2Icon className="w-3 h-3" />
                                        Editar
                                    </button>
                                )}
                            </div>

                            {isEditingLimit ? (
                                <div className="mt-1">
                                    <CurrencyInput
                                        value={editedLimit}
                                        onChange={setEditedLimit}
                                        className="w-full h-9 text-sm font-bold border-indigo-300 focus:ring-indigo-200"
                                        placeholder="Novo limite total"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-1 mt-1">
                                    <div className="flex items-baseline gap-2">
                                        <p className={`text-xl font-black ${limitExceeded ? 'text-red-700' : noLimitConfigured ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {noLimitConfigured ? 'Não configurado' : formatCurrency(actualAvailableLimit)}
                                        </p>
                                        {!noLimitConfigured && (
                                            <span className="text-[10px] text-gray-400 font-bold">disponível</span>
                                        )}
                                    </div>
                                    {!noLimitConfigured && (
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            Total: {formatCurrency(localTotalLimit)} · Utilizado: {formatCurrency(customerUsed || 0)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Alertas */}
                    {limitExceeded && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
                            <AlertCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-red-700">Limite Excedido</p>
                                <p className="text-xs text-red-600 mt-0.5">
                                    O valor a parcelar ({formatCurrency(totalWithInterest)}) excede o limite disponível do cliente ({formatCurrency(actualAvailableLimit)}).
                                    Aumente o limite ou reduza o valor parcelado.
                                </p>
                            </div>
                        </div>
                    )}

                    {noLimitConfigured && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
                            <InfoIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-700">Limite não configurado</p>
                                <p className="text-xs text-amber-600 mt-0.5">
                                    Este cliente não possui um limite de crédito definido. Clique em "Editar" para configurar um limite, ou confirme sem limite (não recomendado).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Campos: Entrada + Valor a Parcelar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                Entrada <span className="text-gray-400 font-normal normal-case">(opcional)</span>
                            </label>
                            <CurrencyInput value={entryAmount} onChange={setEntryAmount} className="bg-gray-50 font-bold text-gray-800 h-12 text-base" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Valor a Parcelar</label>
                            <CurrencyInput
                                value={financedAmount}
                                onChange={setFinancedAmount}
                                className={`h-12 text-base font-bold ${limitExceeded ? 'text-red-600 border-red-300 focus:ring-red-200' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Campos: Plano + Frequência + Vencimento */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Parcelas</label>
                            <input
                                type="number"
                                min="1"
                                value={installments}
                                onChange={e => setInstallments(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full h-12 px-4 border border-gray-300 rounded-xl font-black text-gray-900 text-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Frequência</label>
                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value as any)}
                                className="w-full h-12 px-4 border border-gray-300 rounded-xl font-bold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all"
                            >
                                <option value="mensal">Mensal</option>
                                <option value="quinzenal">Quinzenal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">1º Vencimento</label>
                            <CustomDatePicker value={firstDueDate} onChange={setFirstDueDate} className="w-full h-12" />
                        </div>
                    </div>

                    {/* Juros */}
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <div className="flex items-center justify-between gap-4">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative flex-shrink-0">
                                    <input type="checkbox" checked={applyInterest} onChange={() => setApplyInterest(!applyInterest)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </div>
                                <div>
                                    <span className={`text-sm font-bold transition-colors ${applyInterest ? 'text-indigo-900' : 'text-gray-500'}`}>Aplicar Juros?</span>
                                    {applyInterest && (
                                        <p className="text-[10px] text-indigo-500 font-medium mt-0.5">
                                            Total com juros: {formatCurrency(totalWithInterest)}
                                        </p>
                                    )}
                                </div>
                            </label>

                            {applyInterest && (
                                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-indigo-200 shadow-sm animate-fade-in-left flex-shrink-0">
                                    <PercentIcon className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-indigo-600 whitespace-nowrap">Taxa:</span>
                                    <input
                                        type="number"
                                        value={interestRate}
                                        onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
                                        className="w-20 h-9 border border-indigo-200 rounded-lg font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 text-center text-sm"
                                        placeholder="0,00"
                                    />
                                    <span className="text-xs font-bold text-indigo-400">%</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Painel Direito: Resumo ─── */}
                <div className="bg-gray-50 p-6 md:p-8 md:w-80 lg:w-96 flex flex-col border-t md:border-t-0 md:border-l border-gray-200">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Resumo do Parcelamento</h3>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-2 mb-4 max-h-[220px] md:max-h-[320px]">
                        {previewInstallments.map(inst => (
                            <div key={inst.number} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-gray-800 uppercase">
                                        Parcela {inst.number}/{installments}
                                    </span>
                                    <span className="text-xs font-bold text-gray-500 whitespace-nowrap">
                                        {inst.date.split('-').reverse().join('/')}
                                    </span>
                                </div>
                                <span className="font-black text-gray-900 whitespace-nowrap text-sm">{formatCurrency(inst.amount)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-200">
                        {/* Resumo financeiro */}
                        <div className="space-y-2 text-sm">
                            {entryAmount > 0 && (
                                <div className="flex justify-between text-gray-500">
                                    <span className="text-xs font-bold">Entrada</span>
                                    <span className="font-bold text-gray-700">{formatCurrency(entryAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-gray-500">
                                <span className="text-xs font-bold">Valor parcelado</span>
                                <span className="font-bold text-gray-700">{formatCurrency(financedAmount)}</span>
                            </div>
                            {applyInterest && interestRate > 0 && (
                                <div className="flex justify-between text-indigo-500">
                                    <span className="text-xs font-bold">Juros ({interestRate}%)</span>
                                    <span className="font-bold">+{formatCurrency(totalWithInterest - financedAmount)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <span className="text-xs text-indigo-600 font-black uppercase tracking-wider">Total a Pagar</span>
                            <span className="text-xl font-black text-indigo-700">{formatCurrency(totalWithInterest + entryAmount)}</span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider border border-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={limitExceeded || installments < 1}
                                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition-all text-xs uppercase tracking-wider ${
                                    limitExceeded || installments < 1
                                        ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-95'
                                }`}
                            >
                                Confirmar
                            </button>
                        </div>

                        {noLimitConfigured && !limitExceeded && (
                            <p className="text-[10px] text-amber-600 text-center font-medium">
                                ⚠️ Confirmando sem limite configurado para o cliente.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewCreditModal;
