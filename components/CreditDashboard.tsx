import React, { useState, useEffect, useMemo } from 'react';
import {
    ClockIcon, ErrorIcon as AlertCircleIcon, CalendarDaysIcon as CalendarIcon, SearchIcon, WhatsAppIcon,
    FilterIcon, CheckIcon as CheckCircleIcon, Cog6ToothIcon as SettingsIcon,
    ChevronDownIcon
} from './icons';
import {
    CreditInstallment, Customer
} from '../types.ts';
import {
    getCreditInstallments, formatCurrency, getCustomers, updateCreditSettings, getCreditSettings
} from '../services/mockApi.ts';
import InstallmentPaymentModal from './modals/InstallmentPaymentModal.tsx';
import CreditSettingsModal from './modals/CreditSettingsModal.tsx';
import StatusBadge from './StatusBadge.tsx';
import { CarnetPrintButton } from './print/CarnetPrintButton';
import { useUser } from '../contexts/UserContext.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

const CreditDashboard: React.FC = () => {
    const { user } = useUser();
    const { showToast } = useToast();
    const [installments, setInstallments] = useState<CreditInstallment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'active' | 'all' | 'pending' | 'overdue' | 'paid'>('active');
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
            if (filterStatus === 'active') {
                filtered = filtered.filter(i => i.status !== 'paid');
            } else if (filterStatus === 'overdue') {
                const today = new Date().toISOString().split('T')[0];
                filtered = filtered.filter(i => i.status !== 'paid' && new Date(i.dueDate) < new Date(today));
            } else {
                filtered = filtered.filter(i => i.status === filterStatus || (filterStatus === 'pending' && i.status === 'partial'));
            }
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(i => {
                const customerMatch = (i as any).customerName?.toLowerCase()?.includes(lower);
                const saleDisplayMatch = i.saleDisplayId?.toString()?.toLowerCase()?.includes(lower);
                const saleIdMatch = i.saleId?.toLowerCase()?.includes(lower);
                const idMatch = i.id?.toLowerCase()?.includes(lower);

                return customerMatch || saleDisplayMatch || saleIdMatch || idMatch;
            });
        }

        return filtered;
    }, [installments, filterStatus, searchTerm]);


    const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

    const toggleCustomer = (customerId: string) => {
        setExpandedCustomers(prev => ({ ...prev, [customerId]: !prev[customerId] }));
    };

    const groupedData = useMemo(() => {
        const groups: Record<string, {
            customerId: string;
            customerName: string;
            customerPhone: string;
            installments: CreditInstallment[];
            totalOpen: number;
            overdueCount: number;
        }> = {};

        filteredInstallments.forEach(inst => {
            const cid = inst.customerId || 'unknown';
            if (!groups[cid]) {
                groups[cid] = {
                    customerId: cid,
                    customerName: (inst as any).customerName || 'Cliente sem Nome',
                    customerPhone: (inst as any).customerPhone || '',
                    installments: [],
                    totalOpen: 0,
                    overdueCount: 0
                };
            }
            groups[cid].installments.push(inst);
            if (inst.status !== 'paid') {
                groups[cid].totalOpen += (inst.amount - inst.amountPaid);
                const isLate = new Date(inst.dueDate) < new Date(new Date().toISOString().split('T')[0]);
                if (isLate) groups[cid].overdueCount++;
            }
        });

        return Object.values(groups).sort((a, b) => a.customerName.localeCompare(b.customerName));
    }, [filteredInstallments]);


    const handlePaymentSuccess = (updated: CreditInstallment) => {
        setInstallments(prev => prev.map(i => i.id === updated.id ? updated : i));
        // Recalculate stats will happen due to useEffect
    };

    const handleWhatsapp = (inst: CreditInstallment) => {
        const customerName = (inst as any).customerName || 'Cliente';
        const dueDate = new Date(inst.dueDate).toLocaleDateString('pt-BR');
        const amount = formatCurrency(inst.amount - inst.amountPaid);
        const storeName = "iStorePro";

        const message = `Olá *${customerName}*,\n\nPassando para lembrar que sua parcela de *${amount}* na *${storeName}* venceu dia *${dueDate}*.\n\nPodemos enviar a chave Pix para regularização?`;

        let phone = (inst as any).customerPhone || '';
        if (!phone) {
            showToast('Cliente sem telefone cadastrado', 'error');
            return;
        }

        // Clean phone: remove non-digits and ensure 55 prefix
        phone = phone.replace(/\D/g, '');
        if (!phone.startsWith('55')) phone = '55' + phone;

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
                        onClick={() => setFilterStatus('active')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Ativos
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
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos
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

            {/* Customer Groups */}
            <div className="space-y-4">
                {groupedData.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-gray-400 italic font-medium">
                        Nenhum registro encontrado.
                    </div>
                ) : groupedData.map((group) => (
                    <div key={group.customerId} className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm transition-all">
                        {/* Customer Summary Row */}
                        <div
                            onClick={() => toggleCustomer(group.customerId)}
                            className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">
                                    {group.customerName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{group.customerName}</h3>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs font-bold text-gray-500">{group.installments.length} {group.installments.length === 1 ? 'crediário' : 'crediários'}</span>
                                        {group.overdueCount > 0 && (
                                            <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                {group.overdueCount} em atraso
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Saldo em Aberto</p>
                                    <p className={`text-lg font-black ${group.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(group.totalOpen)}</p>
                                </div>
                                <div className={`transition-transform duration-300 ${expandedCustomers[group.customerId] ? 'rotate-180' : ''}`}>
                                    <ChevronDownIcon className="h-5 w-5 text-gray-300" />
                                </div>
                            </div>
                        </div>

                        {/* Expandable Installments Table */}
                        {expandedCustomers[group.customerId] && (
                            <div className="bg-gray-50/50 border-t border-gray-100 animate-slide-down">
                                <div className="overflow-x-auto text-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-100/30">
                                                <th className="pl-6 sm:pl-10 py-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Parcela</th>
                                                <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Vencimento</th>
                                                <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Valor</th>
                                                <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center">Status</th>
                                                <th className="pr-6 sm:pr-10 py-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {group.installments.map((inst) => {
                                                const isLate = inst.status !== 'paid' && new Date(inst.dueDate) < new Date(new Date().toISOString().split('T')[0]);
                                                return (
                                                    <tr key={inst.id} className="hover:bg-white transition-colors">
                                                        <td className="pl-6 sm:pl-10 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-black text-gray-900">#{inst.installmentNumber}/{inst.totalInstallments}</span>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Venda #{(inst as any).saleDisplayId}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <CalendarIcon className={`h-4 w-4 ${isLate ? 'text-red-400' : 'text-gray-400'}`} />
                                                                <span className={`text-sm font-bold ${isLate ? 'text-red-600' : 'text-gray-700'}`}>
                                                                    {new Date(inst.dueDate).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </div>
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
                                                        <td className="pr-6 sm:pr-10 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {inst.status !== 'paid' && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedInstallment(inst); }}
                                                                        className="h-8 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                                                                    >
                                                                        Baixar
                                                                    </button>
                                                                )}

                                                                {(isLate || inst.status === 'pending' || inst.status === 'partial') && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleWhatsapp(inst); }}
                                                                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100"
                                                                        title="Lembrete WhatsApp"
                                                                    >
                                                                        <WhatsAppIcon size={14} />
                                                                    </button>
                                                                )}

                                                                <div onClick={(e) => e.stopPropagation()}>
                                                                    <CarnetPrintButton
                                                                        saleId={(inst as any).saleId}
                                                                        installments={group.installments.filter(i => (i as any).saleId === (inst as any).saleId)}
                                                                        buttonLabel=""
                                                                        className="h-8 px-3 border border-gray-300 text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <InstallmentPaymentModal
                isOpen={!!selectedInstallment}
                onClose={() => setSelectedInstallment(null)}
                installment={selectedInstallment}
                onPaymentSuccess={handlePaymentSuccess}
                userId={user?.id}
                userName={user?.name}
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
