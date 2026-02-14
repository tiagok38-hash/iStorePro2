import React, { useState, useEffect } from 'react';
import { XIcon, CalculatorIcon, CalendarIcon, PercentIcon, AlertCircleIcon } from 'lucide-react';
import { formatCurrency, getCreditSettings } from '../../services/mockApi.ts';
import CustomDatePicker from '../CustomDatePicker.tsx';
import CurrencyInput from '../CurrencyInput.tsx';
import { calculateInstallmentDates } from '../../utils/creditUtils.ts';

interface NewCreditModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalAmount: number;
    onConfirm: (details: any) => void;
}

const NewCreditModal: React.FC<NewCreditModalProps> = ({ isOpen, onClose, totalAmount, onConfirm }) => {
    const [entryAmount, setEntryAmount] = useState(0);
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

    useEffect(() => {
        if (isOpen) {
            getCreditSettings().then(settings => {
                setDefaultSettings(settings);
                setInterestRate(settings.defaultInterestRate);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const amountToFinance = Math.max(0, totalAmount - entryAmount);

    // Calculate preview
    const totalWithInterest = applyInterest
        ? amountToFinance * (1 + (interestRate / 100))
        : amountToFinance;

    const installmentValue = installments > 0 ? totalWithInterest / installments : 0;

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

        onConfirm({
            entryAmount,
            installments,
            totalInstallments: installments,
            firstDueDate,
            frequency,
            applyInterest,
            interestRate: applyInterest ? interestRate : 0,
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

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total da Venda</label>
                        <div className="text-2xl font-black text-gray-900">{formatCurrency(totalAmount)}</div>
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
                            <div className="h-10 px-3 flex items-center bg-gray-100 rounded-xl font-bold text-gray-500 border border-gray-200">
                                {formatCurrency(amountToFinance)}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Plano (Parcelas)</label>
                            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden h-10">
                                <button onClick={() => setInstallments(Math.max(1, installments - 1))} className="px-3 hover:bg-gray-100 border-r border-gray-300 font-bold text-gray-600">-</button>
                                <input
                                    type="number"
                                    value={installments}
                                    onChange={e => setInstallments(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="flex-1 text-center font-black text-gray-900 outline-none"
                                />
                                <button onClick={() => setInstallments(installments + 1)} className="px-3 hover:bg-gray-100 border-l border-gray-300 font-bold text-gray-600">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Frequência</label>
                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value as any)}
                                className="w-full h-10 px-3 border border-gray-300 rounded-xl font-bold text-gray-800 bg-white"
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

                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${applyInterest ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${applyInterest ? 'translate-x-4' : ''}`}></div>
                                </div>
                                <span className="text-xs font-bold uppercase text-indigo-900 tracking-wide">Aplicar Juros?</span>
                            </label>
                            {applyInterest && (
                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-indigo-200">
                                    <input
                                        type="number"
                                        value={interestRate}
                                        onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
                                        className="w-12 text-right font-black text-indigo-700 outline-none text-sm"
                                    />
                                    <PercentIcon className="h-3 w-3 text-indigo-400" />
                                </div>
                            )}
                        </div>
                        {applyInterest && (
                            <div className="flex justify-between text-xs font-medium text-indigo-700 pt-2 border-t border-indigo-200/50">
                                <span>Acréscimo:</span>
                                <span>+{formatCurrency(totalWithInterest - amountToFinance)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="bg-gray-50 p-6 md:p-8 md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-gray-200">
                    <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Resumo do Parcelamento</h3>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-2 mb-4 max-h-[250px] md:max-h-full">
                        {previewInstallments.map(inst => (
                            <div key={inst.number} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Parcela {inst.number}/{installments}</span>
                                    <span className="text-xs font-bold text-gray-700">{new Date(inst.date).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <span className="font-black text-gray-900">{formatCurrency(inst.amount)}</span>
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
                            <button onClick={handleConfirm} className="py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors text-xs uppercase tracking-wider">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewCreditModal;
