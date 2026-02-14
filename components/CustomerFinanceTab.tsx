import React, { useState, useEffect } from 'react';
import { Customer } from '../types.ts';
import { formatCurrency, getSales } from '../services/mockApi.ts';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, ShieldAlert, History } from 'lucide-react';

interface CustomerFinanceTabProps {
    customer: Customer;
    onUpdate: (updatedData: Partial<Customer>) => void;
}

const CustomerFinanceTab: React.FC<CustomerFinanceTabProps> = ({ customer, onUpdate }) => {
    const [allowCredit, setAllowCredit] = useState(customer.allow_credit || false);
    const [creditLimit, setCreditLimit] = useState(customer.credit_limit || 0);
    const [creditUsed, setCreditUsed] = useState(customer.credit_used || 0); // In a real app, this should be calculated from open invoices
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
    const [adjustmentValue, setAdjustmentValue] = useState('');
    const [pendingSales, setPendingSales] = useState<any[]>([]);

    useEffect(() => {
        // Mock fetching pending sales for history
        // in real scenario: fetch sales where customerId = customer.id and status = pending/partial
        getSales().then(sales => {
            const customerSales = sales.filter(s =>
                s.customerId === customer.id &&
                s.payments.some(p => (p.method === 'Crediário' || p.method === 'Promissória'))
            );
            setPendingSales(customerSales);

            // Recalculate credit used based on open installments
            // This is a simplification. Real logic should sum open installments.
        });
    }, [customer.id]);

    const handleToggleCredit = () => {
        const newValue = !allowCredit;
        setAllowCredit(newValue);
        onUpdate({ allow_credit: newValue });
    };

    const handleOpenAdjustment = (type: 'increase' | 'decrease') => {
        setAdjustmentType(type);
        setAdjustmentValue('');
        setIsAdjustmentModalOpen(true);
    };

    const handleConfirmAdjustment = () => {
        const val = parseFloat(adjustmentValue.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (isNaN(val) || val <= 0) return;

        let newLimit = creditLimit;
        if (adjustmentType === 'increase') {
            newLimit += val;
        } else {
            newLimit = Math.max(0, newLimit - val);
        }

        setCreditLimit(newLimit);
        onUpdate({ credit_limit: newLimit });
        setIsAdjustmentModalOpen(false);

        // Here we would also save to credit_limit_history via API
    };

    const creditAvailable = Math.max(0, creditLimit - creditUsed);
    const usagePercentage = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* 1. Opções de Permissão */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldCheck size={16} /> Permissão de Crédito
                </h3>
                <div className="flex flex-col gap-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${!allowCredit
                        ? 'bg-red-50 border-red-200 shadow-sm'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!allowCredit ? 'border-red-500 bg-red-500' : 'border-gray-300'
                            }`}>
                            {!allowCredit && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input
                            type="radio"
                            name="creditPermission"
                            checked={!allowCredit}
                            onChange={handleToggleCredit}
                            className="hidden"
                        />
                        <div>
                            <p className={`text-sm font-bold ${!allowCredit ? 'text-red-700' : 'text-gray-700'}`}>Não permitir crediário</p>
                            <p className="text-xs text-gray-500">Bloqueia novas vendas no crediário/promissória.</p>
                        </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${allowCredit
                        ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${allowCredit ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                            }`}>
                            {allowCredit && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input
                            type="radio"
                            name="creditPermission"
                            checked={allowCredit}
                            onChange={handleToggleCredit}
                            className="hidden"
                        />
                        <div>
                            <p className={`text-sm font-bold ${allowCredit ? 'text-emerald-700' : 'text-gray-700'}`}>Sim, permitir limite de crédito</p>
                            <p className="text-xs text-gray-500">Habilita gestão de limite e desbloqueia vendas.</p>
                        </div>
                    </label>
                </div>
            </div>

            {/* 2. Display de Limite */}
            {allowCredit && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Limit Card */}
                    <div className="col-span-1 md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Limite Total Aprovado</p>
                                <p className="text-3xl font-black text-gray-800 mt-1">{formatCurrency(creditLimit)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleOpenAdjustment('decrease')}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Diminuir Limite"
                                >
                                    <TrendingDown size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOpenAdjustment('increase')}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                    title="Aumentar Limite"
                                >
                                    <TrendingUp size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
                            <div
                                className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
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

                    {/* Status Card */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col justify-center items-center text-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                            <ShieldCheck size={20} />
                        </div>
                        <p className="text-xs font-bold text-blue-800 uppercase mb-1">Status do Cŕedito</p>
                        <p className="text-sm text-blue-600 leading-tight">Cliente com crédito ativo e {creditAvailable >= 0 ? 'limite disponível' : 'limite excedido'}.</p>
                    </div>
                </div>
            )}

            {/* 3. Tabela de Histórico (Simples) */}
            {allowCredit && (
                <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <History size={16} /> Vendas em Aberto (Impactam o Limite)
                    </h3>
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        {pendingSales.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">Nenhuma venda em aberto.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Venda</th>
                                        <th className="px-4 py-3 text-right">Valor Aberto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {pendingSales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-600">{new Date(sale.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">#{sale.id.slice(0, 8)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-800">
                                                {formatCurrency(sale.total)} {/* Simplified, should show remaining balance */}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Adjustment Modal */}
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
                            <button
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmAdjustment}
                                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${adjustmentType === 'increase' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                                    }`}
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
