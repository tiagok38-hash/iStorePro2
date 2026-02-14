import React, { useState, useEffect, useMemo } from 'react';
import {
    ClockIcon, AlertCircleIcon, CalendarIcon, SearchIcon, PhoneIcon,
    FilterIcon, ArrowUpRightIcon, CheckCircleIcon, Settings as SettingsIcon
} from 'lucide-react';
import {
    CreditInstallment, Customer
} from '../types.ts';
import {
    getCreditInstallments, formatCurrency, getCustomers, updateCreditSettings, getCreditSettings
} from '../services/mockApi.ts';
import InstallmentPaymentModal from './modals/InstallmentPaymentModal.tsx';
import CreditSettingsModal from './modals/CreditSettingsModal.tsx';
import StatusBadge from './StatusBadge.tsx';
import { CarnetPrintButton } from './print/CarnetPrintButton.tsx';

const CreditDashboard: React.FC = () => {
    const [installments, setInstallments] = useState<CreditInstallment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInstallment, setSelectedInstallment] = useState<CreditInstallment | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({ defaultInterestRate: 0, lateFeePercentage: 0 });
    const [stats, setStats] = useState({ toReceive: 0, overdue: 0, receivedToday: 0 });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [data, creditConfig] = await Promise.all([
                getCreditInstallments(),
                getCreditSettings()
            ]);
            setInstallments(data);
            setSettings(creditConfig);
        } catch (error) {
            console.error("Error fetching credit data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Calcula KPIs
    useEffect(() => {
        if (!installments.length) return;

        const today = new Date().toISOString().split('T')[0];

        const toReceive = installments
            .filter(i => i.status === 'pending' || i.status === 'partial')
            .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

        const overdue = installments
            .filter(i => {
                if (i.status === 'paid') return false;
                return new Date(i.dueDate) < new Date(today);
            })
            .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);

        const receivedToday = installments
            .filter(i => i.paidAt && i.paidAt.startsWith(today))
            .reduce((sum, i) => {
                // This is an approximation since we don't track individual payments in separate table yet, 
                // but for now let's assume if it was paid today, the whole amountPaid is recent
                // A more correct approach would be to have a payment history table. 
                // For this MVP, we use the `paidAt` timestamp.
                return sum + i.amountPaid;
            }, 0);

        setStats({ toReceive, overdue, receivedToday });

    }, [installments]);


    const filteredInstallments = useMemo(() => {
        let filtered = installments;

        if (filterStatus !== 'all') {
            if (filterStatus === 'overdue') {
                const today = new Date().toISOString().split('T')[0];
                filtered = filtered.filter(i => i.status !== 'paid' && new Date(i.dueDate) < new Date(today));
            } else {
                filtered = filtered.filter(i => i.status === filterStatus || (filterStatus === 'pending' && i.status === 'partial'));
            }
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(i =>
                (i as any).customerName?.toLowerCase().includes(lower) ||
                i.saleDisplayId?.toString().includes(lower) ||
                i.id.includes(lower)
            );
        }

        return filtered;
    }, [installments, filterStatus, searchTerm]);


    const handlePaymentSuccess = (updated: CreditInstallment) => {
        setInstallments(prev => prev.map(i => i.id === updated.id ? updated : i));
        // Recalculate stats will happen due to useEffect
    };

    const handleWhatsapp = (inst: CreditInstallment) => {
        // We need customer phone. 
        // Best approach: check if we have it in `inst`. 
        // If the API isn't returning it yet, we might fallback or update API. 
        // Let's update `getCreditInstallments` in mockApi to fetch phone.
        // Assuming it's there as `(inst as any).customerPhone` or nested.

        // Construct message
        const customerName = (inst as any).customerName || 'Cliente';
        const dueDate = new Date(inst.dueDate).toLocaleDateString('pt-BR');
        const amount = formatCurrency(inst.amount - inst.amountPaid);
        const storeName = "iStorePro"; // Or dynamic from settings/company context

        const message = `Olá *${customerName}*,\n\nPassando para lembrar que sua parcela de *${amount}* na *${storeName}* venceu dia *${dueDate}*.\n\nPodemos enviar a chave Pix para regularização?`;

        // Check if we have phone
        // Verify mockApi change in next step. For now assume we might have it or user will pick contact manually if web.
        // Actually wa.me needs a number. If null, maybe open empty?
        // Let's use a generic number or try to find it.
        const phone = (inst as any).customerPhone || '';

        const encoded = encodeURIComponent(message);
        const url = `https://wa.me/${phone}?text=${encoded}`;
        window.open(url, '_blank');
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Carregando carteira de crediário...</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Actions */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-violet-200 transition-all shadow-sm"
                >
                    <SettingsIcon size={16} className="text-violet-600" />
                    Configurações
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-3xl border border-white/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ClockIcon className="h-16 w-16 text-indigo-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">A Receber Total</div>
                        <div className="text-2xl font-black text-gray-900">{formatCurrency(stats.toReceive)}</div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-3xl border border-white/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertCircleIcon className="h-16 w-16 text-red-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Em Atraso</div>
                        <div className="text-2xl font-black text-red-600">{formatCurrency(stats.overdue)}</div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-3xl border border-white/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircleIcon className="h-16 w-16 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Recebido Hoje</div>
                        <div className="text-2xl font-black text-emerald-700">{formatCurrency(stats.receivedToday)}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 p-1 bg-gray-100/50 rounded-xl">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setFilterStatus('pending')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Pendente
                    </button>
                    <button
                        onClick={() => setFilterStatus('overdue')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === 'overdue' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Atrasados
                    </button>
                    <button
                        onClick={() => setFilterStatus('paid')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === 'paid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Pagos
                    </button>
                </div>

                <div className="relative w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar cliente, venda..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 h-10 w-full md:w-64 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:font-normal"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Vencimento</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cliente / Venda</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Parcela</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Valor</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredInstallments.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-medium">Nenhum registro encontrado.</td>
                            </tr>
                        ) : filteredInstallments.map((inst) => {
                            const isLate = inst.status !== 'paid' && new Date(inst.dueDate) < new Date(new Date().toISOString().split('T')[0]);
                            return (
                                <tr key={inst.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className={`h-4 w-4 ${isLate ? 'text-red-400' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-bold ${isLate ? 'text-red-600' : 'text-gray-700'}`}>
                                                {new Date(inst.dueDate).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-gray-900">{(inst as any).customerName}</span>
                                            <span className="text-xs font-medium text-gray-500">Venda #{(inst as any).saleDisplayId}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                                            {inst.installmentNumber}/{inst.totalInstallments}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-gray-900">{formatCurrency(inst.amount)}</span>
                                            {inst.status === 'partial' && (
                                                <span className="text-[10px] font-bold text-orange-500">
                                                    Restam: {formatCurrency(inst.amount - inst.amountPaid)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <StatusBadge status={isLate ? 'Atrasado' : inst.status === 'paid' ? 'Pago' : inst.status === 'partial' ? 'Parcial' : 'Pendente'} />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {inst.status !== 'paid' && (
                                            <button
                                                onClick={() => setSelectedInstallment(inst)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors font-bold text-xs uppercase tracking-wider border border-indigo-100 hover:border-indigo-200 shadow-sm"
                                            >
                                                Baixar
                                            </button>
                                        )}
                                        {inst.status !== 'paid' && (isLate || inst.status === 'pending' || inst.status === 'partial') && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const phone = (inst as any).customer?.phone || (inst as any).customerPhone || '';
                                                    // Assuming we have phone. If not, we might need to fetch or it's in the joined data.
                                                    // In getCreditInstallments mockApi, we joined 'customer:customers(name)'.
                                                    // We need to ensure we join 'phone' too. 

                                                    // Let's optimize this: first update mockApi to return phone, then use it here.
                                                    // But for now, let's just put the logic assuming phone "might" be there or we handle the click to fetch.
                                                    // better: use a handler function.
                                                    handleWhatsapp(inst);
                                                }}
                                                className="ml-2 p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors font-bold text-xs uppercase tracking-wider border border-emerald-100 hover:border-emerald-200 shadow-sm"
                                                title="Enviar cobrança via WhatsApp"
                                            >
                                                <PhoneIcon size={16} />
                                            </button>
                                        )}

                                        <div className="inline-block ml-2">
                                            <CarnetPrintButton
                                                saleId={(inst as any).saleId}
                                                installments={[inst]}
                                                buttonLabel=""
                                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 shadow-sm"
                                            />
                                        </div>

                                        {inst.status === 'paid' && (
                                            <CheckCircleIcon className="h-5 w-5 text-emerald-400 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <InstallmentPaymentModal
                isOpen={!!selectedInstallment}
                onClose={() => setSelectedInstallment(null)}
                installment={selectedInstallment}
                onPaymentSuccess={handlePaymentSuccess}
            />

            <CreditSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => {
                    setIsSettingsOpen(false);
                    fetchData(); // Reload settings
                }}
            />
        </div>
    );
};

export default CreditDashboard;
