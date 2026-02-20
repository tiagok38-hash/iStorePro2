import React, { useState, useEffect } from 'react';
import { XIcon, CalculatorIcon, CalendarIcon, PercentIcon, AlertCircleIcon, Edit2Icon, CheckIcon } from 'lucide-react';
import { formatCurrency, getCreditSettings, updateCustomer } from '../../services/mockApi.ts';
import CustomDatePicker from '../CustomDatePicker.tsx';
import CurrencyInput from '../CurrencyInput.tsx';
import { calculateInstallmentDates } from '../../utils/creditUtils.ts';

interface NewCreditModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number;
    availableLimit: number; // New prop
    customerId?: string;
    onConfirm: (details: any) => void;
    onUpdateLimit?: (newLimit: number) => void;
}

const NewCreditModal: React.FC<NewCreditModalProps> = ({ isOpen, onClose, totalAmount, availableLimit, customerId, onConfirm, onUpdateLimit }) => {
    const [entryAmount, setEntryAmount] = useState(0);
    const [financedAmount, setFinancedAmount] = useState(totalAmount);
    const [installments, setInstallments] = useState(1);
    const [frequency, setFrequency] = useState<'mensal' | 'quinzenal'>('mensal');
    const [firstDueDate, setFirstDueDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1); // Default next month
        return d.toISOString().split('T')[0];
    });
    const [applyInterest, setApplyInterest] = useState(false);
    const [interestRate, setInterestRate] = useState(0);
    const [defaultSettings, setDefaultSettings] = useState({ defaultInterestRate: 0, lateFeePercentage: 0 });

    const [isEditingLimit, setIsEditingLimit] = useState(false);
    const [editedLimit, setEditedLimit] = useState(0);
    const [currentLimit, setCurrentLimit] = useState(availableLimit);

    useEffect(() => {
        setCurrentLimit(availableLimit);
    }, [availableLimit]);

    useEffect(() => {
        if (isOpen) {
            setEntryAmount(0);
            setFinancedAmount(totalAmount);
            getCreditSettings().then(settings => {
                setDefaultSettings(settings);
                setInterestRate(settings.defaultInterestRate);
            });
        }
    }, [isOpen, totalAmount]);

    if (!isOpen) return null;

    // Regra 2: Cálculo do valor total financiado (Juros Simples)
    // valor_total_financiado = valor_produto × (1 + taxa_juros_percentual)
    const totalWithInterest = applyInterest
        ? financedAmount * (1 + (interestRate / 100))
        : financedAmount;

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

    const limitExceeded = totalWithInterest > currentLimit;

    // Calculate dates logic moved to utility
    // We only preview date logic here for visualization if we implemented the full calculator
    // But since the requirement asks for a preview...



    const getPreviewDates = () => {
        // Simple preview based on state
        const dates = calculateInstallmentDates(firstDueDate, installments, frequency);
        return dates.map((date, index) => ({
            number: index + 1,
            date,
            amount: installmentValue
        }));
    };

    const previewInstallments = getPreviewDates();

    const handleConfirm = () => {
        if (installments < 1) return;
        if (limitExceeded) return; // Prevent confirmation if limit exceeded

        onConfirm({
            entryAmount,
            financedAmount, // Explicitly return financed amount
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

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg md:max-w-2xl flex flex-col md:flex-row overflow-hidden animate-scale-in">
                {/* Left Panel - Inputs */}
                <div className="p-6 md:p-8 flex-1 space-y-5">
                    <div className="flex items-center gap-3 mb-2 text-indigo-600">
                        <CalculatorIcon className="h-6 w-6" />
                        <h2 className="text-xl font-black uppercase tracking-tight">Gerar Crediário</h2>
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total da Venda</label>
                            <div className="text-[19px] font-black text-gray-900">{formatCurrency(totalAmount)}</div>
                        </div>
                        <div className="text-right">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Limite Disponível</label>
                            <div className="flex items-center justify-end gap-2">
                                {isEditingLimit ? (
                                    <div className="flex items-center gap-1 animate-scale-in">
                                        <div style={{ width: '112px' }}>
                                            <CurrencyInput
                                                value={editedLimit}
                                                onChange={setEditedLimit}
                                                className="w-full h-8 text-sm font-bold border-indigo-300 focus:ring-indigo-200"
                                                placeholder="Novo Limite"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();

                                                setIsEditingLimit(false);
                                                // Optimistic update of local UI state
                                                setCurrentLimit(editedLimit);

                                                if (onUpdateLimit) {
                                                    onUpdateLimit(editedLimit);
                                                } else if (customerId) {
                                                    updateCustomer({ id: customerId, credit_limit: editedLimit })
                                                        .catch(err => {
                                                            console.error('Failed to update limit:', err);
                                                            setCurrentLimit(availableLimit);
                                                        });
                                                }
                                            }}
                                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all shadow-md active:scale-95"
                                        >
                                            <CheckIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setIsEditingLimit(false)}
                                            className="p-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setEditedLimit(currentLimit); setIsEditingLimit(true); }}>
                                        <div className={`text-sm font-bold transition-colors ${limitExceeded ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {formatCurrency(currentLimit)}
                                        </div>
                                        <Edit2Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Entrada (Opcional)</label>
                            <CurrencyInput
                                value={entryAmount}
                                onChange={setEntryAmount}
                                className="bg-gray-50 font-bold text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Valor a Parcelar</label>
                            <CurrencyInput
                                value={financedAmount}
                                onChange={setFinancedAmount}
                                className={`${limitExceeded ? 'text-red-600 border-red-300 focus:ring-red-200' : ''}`}
                            />
                        </div>
                    </div>

                    {limitExceeded && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 animate-fade-in">
                            <AlertCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-red-700">Limite Excedido</p>
                                <p className="text-xs text-red-600">O valor parcelado excede o limite disponível do cliente. Aumente a entrada para continuar.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Plano (Parcelas)</label>
                            <input
                                type="number"
                                min="1"
                                value={installments}
                                onChange={e => setInstallments(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full h-10 px-3 border border-gray-300 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Frequência</label>
                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value as any)}
                                className="w-full h-10 px-3 border border-gray-300 rounded-xl font-bold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            >
                                <option value="mensal">Mensal</option>
                                <option value="quinzenal">Quinzenal</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">1º Vencimento</label>
                        <CustomDatePicker value={firstDueDate} onChange={setFirstDueDate} className="w-full" />
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3 transition-all hover:border-indigo-200">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={applyInterest}
                                        onChange={() => setApplyInterest(!applyInterest)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </div>
                                <span className={`text-xs font-bold uppercase tracking-wide transition-colors ${applyInterest ? 'text-indigo-900' : 'text-gray-500'}`}>Aplicar Juros?</span>
                            </label>

                            {applyInterest && (
                                <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-sm animate-fade-in-left">
                                    <span className="text-xs font-bold text-indigo-700">Taxa (%):</span>
                                    <input
                                        type="number"
                                        value={interestRate}
                                        onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
                                        className="w-20 h-9 px-2 border border-indigo-200 rounded-lg font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 text-center bg-white shadow-sm"
                                        placeholder="0.00"
                                    />
                                    <PercentIcon className="h-3.5 w-3.5 text-indigo-400" />
                                </div>
                            )}
                        </div>
                        {applyInterest && (
                            <div className="flex justify-between text-xs font-medium text-indigo-700 pt-2 border-t border-indigo-200/50">
                                <span>Acréscimo:</span>
                                <span>+{formatCurrency(totalWithInterest - financedAmount)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="bg-gray-50 p-6 md:p-8 md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-gray-200">
                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Resumo do Parcelamento</h3>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-2 mb-4 max-h-[250px] md:max-h-full">
                        {previewInstallments.map(inst => (
                            <div key={inst.number} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-gray-800 uppercase truncate max-w-[100px]">Parcela {inst.number}/{installments}</span>
                                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{new Date(inst.date).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <span className="font-black text-gray-900 whitespace-nowrap">{formatCurrency(inst.amount)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">Total a Pagar</span>
                            <span className="text-lg font-black text-indigo-600">{formatCurrency(totalWithInterest + entryAmount)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={onClose} className="py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider">Cancelar</button>
                            <button
                                onClick={handleConfirm}
                                disabled={limitExceeded}
                                className={`py-3 text-white rounded-xl font-bold shadow-lg transition-colors text-xs uppercase tracking-wider ${limitExceeded ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default NewCreditModal;
