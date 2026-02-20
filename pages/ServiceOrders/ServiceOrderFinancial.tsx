import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Plus, EyeIcon, TrashIcon, Search, Filter, CalendarDays, ChartBar } from 'lucide-react';
import { getServiceOrders } from '../../services/mockApi';
import { ServiceOrder } from '../../types';

interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string;
}

const ServiceOrderFinancial: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>(() => {
        const saved = localStorage.getItem('os_expenses');
        return saved ? JSON.parse(saved) : [];
    });

    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [expenseDesc, setExpenseDesc] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await getServiceOrders();
                setOrders(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, []);

    useEffect(() => {
        localStorage.setItem('os_expenses', JSON.stringify(expenses));
    }, [expenses]);

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        if (!expenseDesc || !expenseAmount) return;

        const newExpense: Expense = {
            id: Date.now().toString(),
            description: expenseDesc,
            amount: parseFloat(expenseAmount),
            date: new Date().toISOString()
        };

        setExpenses([newExpense, ...expenses]);
        setExpenseDesc('');
        setExpenseAmount('');
        setIsAddingExpense(false);
    };

    const handleDeleteExpense = (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta despesa?')) {
            setExpenses(expenses.filter(e => e.id !== id));
        }
    };

    const unifiedTimeline = useMemo(() => {
        let items: any[] = [];

        // Revenues from Service Orders that are closed/delivered
        orders.forEach(os => {
            if (os.status === 'Entregue' || os.status === 'Concluído') {
                items.push({
                    id: os.id,
                    date: os.exitDate || os.updatedAt || os.createdAt,
                    description: `OS #${os.displayId} - ${os.deviceModel}`,
                    category: 'Manutenção',
                    entity: os.customerName || 'Cliente Balcão',
                    value: os.total,
                    type: 'Receita',
                    status: 'Pago',
                    source: 'os',
                    original: os
                });
            }
        });

        // Expenses created manually
        expenses.forEach(exp => {
            items.push({
                id: exp.id,
                date: exp.date,
                description: exp.description,
                category: 'Despesa OS',
                entity: 'N/A',
                value: exp.amount,
                type: 'Despesa',
                status: 'Pago',
                source: 'manual',
                original: exp
            });
        });

        const filteredItems = items.filter(item => {
            const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.entity.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = !filterType || (filterType === 'income' ? item.type === 'Receita' : item.type === 'Despesa');
            const matchesStatus = !filterStatus || (filterStatus === 'paid' ? item.status === 'Pago' : item.status === filterStatus);
            let matchesDate = true;
            if (filterStartDate) {
                matchesDate = matchesDate && new Date(item.date) >= new Date(filterStartDate + 'T00:00:00');
            }
            if (filterEndDate) {
                matchesDate = matchesDate && new Date(item.date) <= new Date(filterEndDate + 'T23:59:59');
            }
            return matchesSearch && matchesType && matchesStatus && matchesDate;
        });

        return filteredItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, expenses, searchTerm, filterType, filterStatus, filterStartDate, filterEndDate]);

    const { totalPartsServiceCost, totalExpenses, totalRevenue, balance, netProfit } = useMemo(() => {
        const technicalRevenueOrders = orders.filter(os => os.status === 'Entregue' || os.status === 'Concluído');

        const partsCost = technicalRevenueOrders.reduce((acc, os) => {
            const itemsCost = os.items?.reduce((iAcc, item: any) => iAcc + (((item.cost || item.costPrice || 0) * item.quantity)), 0) || 0;
            return acc + itemsCost;
        }, 0);

        const expTotal = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
        const revTotal = technicalRevenueOrders.reduce((acc, os) => acc + (os.total || 0), 0);
        const bal = revTotal - expTotal;
        const profit = bal - partsCost;

        return {
            totalPartsServiceCost: partsCost,
            totalExpenses: expTotal,
            totalRevenue: revTotal,
            balance: bal,
            netProfit: profit
        };
    }, [orders, expenses]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const fmtDate = (d: string) => {
        if (!d) return '—';
        let datePart = d;
        if (d.includes('T')) {
            datePart = d.split('T')[0];
        }
        const parts = datePart.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return new Date(d).toLocaleDateString('pt-BR');
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-fade-in max-w-[1600px] mx-auto pb-24">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
                            <DollarSign className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-primary tracking-tight">Financeiro OS</h1>
                                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full hidden sm:block">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Controle de Caixa</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Controle as receitas de OS e registre despesas específicas.</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setIsAddingExpense(true)}
                        className="flex-1 md:flex-none h-12 px-6 bg-red-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 group"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        Nova Despesa
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3 transition-all duration-300 hover:shadow-md group">
                    <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl shadow-sm bg-green-50">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Receita de OS</p>
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{formatCurrency(totalRevenue)}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Entregues / Concluídas</p>
                    </div>
                </div>

                <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3 transition-all duration-300 hover:shadow-md group">
                    <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl shadow-sm bg-red-50">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Despesas de OS</p>
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{formatCurrency(totalExpenses)}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Lançamentos Manuais</p>
                    </div>
                </div>

                <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3 transition-all duration-300 hover:shadow-md group">
                    <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl shadow-sm bg-blue-50">
                            <CreditCard className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Saldo Líquido da Assistência</p>
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{formatCurrency(balance)}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Receitas - Despesas</p>
                    </div>
                </div>

                <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3 transition-all duration-300 hover:shadow-md group">
                    <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl shadow-sm ${netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <ChartBar className={`h-5 w-5 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Lucro Líquido</p>
                        <h3 className="text-2xl font-black text-gray-800 tracking-tight mt-0.5">{formatCurrency(netProfit)}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Descontando peças/serviços</p>
                    </div>
                </div>
            </div>

            {isAddingExpense && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setIsAddingExpense(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-black text-gray-900">Nova Despesa de Oficina</h2>
                        </div>
                        <form onSubmit={handleAddExpense} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Descrição *</label>
                                <input
                                    type="text"
                                    value={expenseDesc}
                                    onChange={(e) => setExpenseDesc(e.target.value)}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                                    placeholder="Ex: Compra de Telas, Luz..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Valor (R$) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={expenseAmount}
                                        onChange={(e) => setExpenseAmount(e.target.value)}
                                        className="w-full h-11 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="px-1 pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingExpense(false)}
                                    className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-200 transition-all hover:bg-red-600 flex items-center justify-center gap-2"
                                >
                                    Salvar Despesa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                {/* Filters Bar */}
                <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative group min-w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Pesquisar por descrição ou entidade..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-11 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all w-full text-gray-700"
                            />
                        </div>
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2 h-11">
                            <Filter className="h-4 w-4 text-gray-400 mx-2" />
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer text-gray-500 outline-none"
                            >
                                <option value="">Todos os Tipos</option>
                                <option value="income">Receitas</option>
                                <option value="expense">Despesas</option>
                            </select>
                            <div className="w-px h-6 bg-gray-200 mx-2"></div>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer text-gray-500 outline-none"
                            >
                                <option value="">Todos Status</option>
                                <option value="paid">Pago</option>
                                <option value="pending">Pendente</option>
                                <option value="overdue">Atrasado</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 h-11">
                            <CalendarDays className="h-4 w-4 text-gray-400 mr-3" />
                            <input
                                type="date"
                                value={filterStartDate}
                                onChange={e => setFilterStartDate(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 text-gray-500 outline-none uppercase tracking-wider"
                            />
                            <span className="text-gray-400 mx-3 font-black text-xs">ATÉ</span>
                            <input
                                type="date"
                                value={filterEndDate}
                                onChange={e => setFilterEndDate(e.target.value)}
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 text-gray-500 outline-none uppercase tracking-wider"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] border-b border-gray-200">
                                <th className="px-4 py-3 w-32">Data</th>
                                <th className="px-4 py-3">Descrição</th>
                                <th className="px-4 py-3">Categoria</th>
                                <th className="px-4 py-3">Entidade</th>
                                <th className="px-4 py-3 text-right">Valor</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Tipo</th>
                                <th className="px-4 py-3 text-center w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center">
                                        <span className="animate-spin inline-block w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full" />
                                        <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Carregando Informações...</p>
                                    </td>
                                </tr>
                            ) : unifiedTimeline.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center">
                                        <p className="text-sm font-bold text-gray-400">Nenhum evento financeiro encontrado para os filtros selecionados.</p>
                                    </td>
                                </tr>
                            ) : (
                                unifiedTimeline.map((item: any) => (
                                    <tr key={`${item.source}-${item.id}`} className="group hover:bg-gray-50/80 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-bold text-gray-500">{fmtDate(item.date)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${item.type === 'Receita' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                                <span className="font-bold text-gray-800 truncate max-w-[200px]" title={item.description}>
                                                    {item.description}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500`}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-gray-400 truncate max-w-[150px] block" title={item.entity}>
                                                {item.entity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-black ${item.type === 'Receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {item.type === 'Receita' ? '+' : '-'} {formatCurrency(item.value)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-100/50 text-emerald-700`}>
                                                <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500`}></div>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${item.type === 'Receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {item.source === 'manual' && (
                                                    <button
                                                        onClick={() => handleDeleteExpense(item.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Excluir Despesa"
                                                    >
                                                        <TrashIcon size={16} />
                                                    </button>
                                                )}
                                                {item.source === 'os' && (
                                                    <button
                                                        className="p-1.5 text-gray-300 hover:bg-gray-100 rounded-lg transition-colors cursor-not-allowed"
                                                        title="Receita integrada via Ordem de Serviço (Automático)"
                                                    >
                                                        <EyeIcon size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrderFinancial;
