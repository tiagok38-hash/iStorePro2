import React, { useState, useEffect } from 'react';
import { CloseIcon as XIcon, BanknotesIcon as BanknoteIcon, CalendarDaysIcon as CalendarIcon, ErrorIcon as AlertTriangleIcon, CheckIcon as CheckCircleIcon } from '../icons.tsx';
import { formatCurrency, getCreditSettings, payInstallment } from '../../services/mockApi.ts';
import CurrencyInput from '../CurrencyInput.tsx';
import { CreditInstallment } from '../../types.ts';

interface InstallmentPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    installment: CreditInstallment | null;
    onPaymentSuccess: (updatedInstallment: CreditInstallment) => void;
    userId?: string;
    userName?: string;
}

// Retorna data no formato YYYY-MM-DD no fuso local
const toLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const InstallmentPaymentModal: React.FC<InstallmentPaymentModalProps> = ({ isOpen, onClose, installment, onPaymentSuccess, userId, userName }) => {
    const [amountToPay, setAmountToPay] = useState(0);
    const [penalty, setPenalty] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [observation, setObservation] = useState('');
    const [paymentDate, setPaymentDate] = useState(toLocalDateString(new Date()));
    const [isLate, setIsLate] = useState(false);
    const [lateDays, setLateDays] = useState(0);
    const [settings, setSettings] = useState({ defaultInterestRate: 0, lateFeePercentage: 0 });
    const [isProcessing, setIsProcessing] = useState(false);

    const today = toLocalDateString(new Date());
    const isRetroactive = paymentDate < today;

    useEffect(() => {
        if (isOpen && installment) {
            getCreditSettings().then(setSettings);

            const remaining = installment.amount - installment.amountPaid;

            const due = new Date(installment.dueDate);
            const now = new Date();
            due.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);

            const diffTime = now.getTime() - due.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            setIsLate(diffDays > 0);
            setLateDays(diffDays > 0 ? diffDays : 0);

            let calculatedPenalty = 0;
            if (diffDays > 0) {
                calculatedPenalty = (remaining * (settings.lateFeePercentage || 0)) / 100;
            }

            setAmountToPay(remaining);
            setPenalty(calculatedPenalty);
            setObservation('');
            setPaymentDate(toLocalDateString(new Date()));
            setPaymentMethod('Dinheiro');
        }
    }, [isOpen, installment, settings.lateFeePercentage]);

    if (!isOpen || !installment) return null;

    const totalDue = (installment.amount - installment.amountPaid) + penalty;
    const isPayingFull = amountToPay >= (totalDue - 0.01);

    // Monta observação final: junta nota de data retroativa (se houver) com obs do usuário
    const buildFinalObservation = (): string => {
        const parts: string[] = [];
        if (isRetroactive) {
            const [y, m, d] = paymentDate.split('-');
            const dateFormatted = `${d}/${m}/${y}`;
            parts.push(`Baixa retroativa — pagamento recebido em ${dateFormatted}`);
        }
        if (observation.trim()) parts.push(observation.trim());
        return parts.join(' | ');
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            // Converte a data escolhida para ISO (meio-dia local para evitar virada de fuso)
            const [y, m, d] = paymentDate.split('-').map(Number);
            const paymentDateISO = new Date(y, m - 1, d, 12, 0, 0).toISOString();

            const updated = await payInstallment(
                installment.id,
                amountToPay,
                paymentMethod,
                penalty,
                buildFinalObservation(),
                userId,
                userName,
                paymentDateISO
            );
            onPaymentSuccess(updated);
            onClose();
        } catch (error) {
            console.error('Payment error', error);
            alert('Erro ao processar pagamento');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-gray-900 flex items-center gap-2">
                            <BanknoteIcon className="h-5 w-5 text-gray-500" />
                            Baixa de Parcela
                        </h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">Parcela {installment.installmentNumber} de {installment.totalInstallments}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400"><XIcon className="h-5 w-5" /></button>
                </div>

                <div className="p-6 space-y-4">

                    {/* Vencimento + Valor */}
                    <div className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-gray-400">Vencimento</span>
                            <span className={`text-sm font-black ${isLate ? 'text-red-500' : 'text-gray-800'}`}>
                                {new Date(installment.dueDate).toLocaleDateString('pt-BR')}
                                {isLate && ` (${lateDays} dias atraso)`}
                            </span>
                        </div>
                        <div className="text-right flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-gray-400">Valor Original</span>
                            <span className="text-base font-black text-gray-800">{formatCurrency(installment.amount)}</span>
                        </div>
                    </div>

                    {/* Multa / Juros (se atrasado) */}
                    {isLate && (
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 animate-slide-down">
                            <div className="flex items-center gap-2 mb-2 text-red-600">
                                <AlertTriangleIcon className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-wide">Parcela em Atraso</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-red-800">Multa / Juros</label>
                                <div className="w-24">
                                    <CurrencyInput
                                        value={penalty}
                                        onChange={setPenalty}
                                        className="bg-white border-red-200 text-red-600 font-bold text-right h-8 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {/* DATA DO PAGAMENTO */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                Data do Pagamento
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                max={today}
                                onChange={e => setPaymentDate(e.target.value)}
                                className={`w-full h-10 px-3 border rounded-xl font-bold text-sm outline-none focus:ring-2 transition-colors
                                    ${isRetroactive
                                        ? 'bg-amber-50 border-amber-300 text-amber-800 focus:ring-amber-400/20'
                                        : 'bg-white border-gray-200 text-gray-800 focus:ring-indigo-500/20'
                                    }`}
                            />
                            {isRetroactive && (
                                <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                                    <AlertTriangleIcon className="h-3 w-3" />
                                    Data retroativa — a observação será registrada automaticamente
                                </p>
                            )}
                        </div>

                        {/* VALOR A PAGAR */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-end mb-1">
                                <label className="block text-xs font-bold text-gray-700 uppercase">Valor a Pagar</label>
                                <span className="text-[10px] font-bold text-gray-400">Total Devido: {formatCurrency(totalDue)}</span>
                            </div>
                            <CurrencyInput
                                value={amountToPay}
                                onChange={setAmountToPay}
                                className="h-12 text-lg bg-gray-50 font-black text-gray-900 border-gray-200 focus:border-indigo-500 transition-colors pr-4"
                            />
                            {!isPayingFull && (
                                <p className="text-[10px] font-bold text-orange-500 mt-1 flex items-center gap-1">
                                    <AlertTriangleIcon className="h-3 w-3" />
                                    Pagamento Parcial: Restará {formatCurrency(totalDue - amountToPay)}
                                </p>
                            )}
                        </div>

                        {/* FORMA DE PAGAMENTO */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Forma de Pagamento</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="Pix">Pix</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                            </select>
                        </div>

                        {/* OBSERVAÇÃO */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Observação (Opcional)</label>
                            <input
                                type="text"
                                value={observation}
                                onChange={e => setObservation(e.target.value)}
                                className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-300"
                                placeholder="Ex: Pago via transferência, recibo nº..."
                            />
                            {isRetroactive && observation.trim() === '' && (
                                <p className="text-[10px] text-gray-400 mt-1">
                                    A nota de baixa retroativa já será registrada automaticamente na observação.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <button
                        onClick={handleConfirm}
                        disabled={amountToPay <= 0 || isProcessing}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                    >
                        {isProcessing ? 'Processando...' : (
                            <>
                                <CheckCircleIcon className="h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                                Confirmar Pagamento
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallmentPaymentModal;
