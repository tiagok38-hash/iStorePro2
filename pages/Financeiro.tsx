import React, { useState, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Plus,
    TrendingUp, TrendingDown, DollarSign, Percent, Scale,
    Info, Edit2, Trash2, CheckCircle, X
} from 'lucide-react';
import { format, isSameMonth, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- MOCK DATA ---
const initialMockAccountPlans = [
    { id: 1, name: 'Aluguel', type: 'Despesa', classification: 'Fixa' },
    { id: 2, name: 'Fornecedores', type: 'Despesa', classification: 'Variável' },
    { id: 3, name: 'Energia Elétrica', type: 'Despesa', classification: 'Fixa' },
    { id: 4, name: 'Vendas à Vista', type: 'Receita', classification: 'Variável' },
    { id: 5, name: 'Serviços Técnicos', type: 'Receita', classification: 'Variável' },
    { id: 6, name: 'Salários', type: 'Despesa', classification: 'Fixa' },
    { id: 7, name: 'Crediário', type: 'Receita', classification: 'Variável' },
];

const initialMockTransactions = [
    { id: 1, type: 'Despesa', description: 'Aluguel do mês', accountPlanId: 1, clientSupplier: 'Imobiliária Central', paymentMethod: 'Transferência', dueDate: '2026-03-10', paidAt: null, value: 3500.00, fees: 0, createdBy: 'Admin' },
    { id: 2, type: 'Receita', description: 'Venda iPhone 13', accountPlanId: 4, clientSupplier: 'Maria Silva', paymentMethod: 'PIX', dueDate: '2026-03-05', paidAt: '2026-03-05', value: 4200.00, fees: 0, createdBy: 'Admin' },
    { id: 3, type: 'Despesa', description: 'Conta de Energia', accountPlanId: 3, clientSupplier: 'Enel', paymentMethod: 'Boleto', dueDate: '2026-03-15', paidAt: null, value: 850.00, fees: 5.50, createdBy: 'João' },
    { id: 4, type: 'Receita', description: 'Conserto Placa', accountPlanId: 5, clientSupplier: 'Carlos Oliveira', paymentMethod: 'Cartão de Crédito', dueDate: '2026-03-08', paidAt: null, value: 650.00, fees: 25.00, createdBy: 'Admin' },
    { id: 5, type: 'Despesa', description: 'Compra Telas', accountPlanId: 2, clientSupplier: 'Fornecedor XYZ', paymentMethod: 'PIX', dueDate: '2026-03-01', paidAt: '2026-03-01', value: 1200.00, fees: 0, createdBy: 'Admin' },
    { id: 6, type: 'Receita', description: 'Venda Parcelada', accountPlanId: 7, clientSupplier: 'Ana Souza', paymentMethod: 'Boleto', dueDate: '2026-03-20', paidAt: null, value: 1500.00, fees: 0, createdBy: 'João' },
];

// --- HELPER FORMATTERS ---
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

// --- COMPONENT ---
export default function Financeiro() {
    // --- STATE ---
    const [transactions, setTransactions] = useState(initialMockTransactions);
    const [accountPlans, setAccountPlans] = useState(initialMockAccountPlans);

    const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1)); // Start at Mar 2026 per mock data
    const [typeFilter, setTypeFilter] = useState('Todos'); // Todos | Receita | Despesa
    const [statusFilter, setStatusFilter] = useState('Todos'); // 'Todos' | 'Pendente' | 'Pago' | 'Vencido'
    const [planFilter, setPlanFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showAccountPlanModal, setShowAccountPlanModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<any>(null);

    const [animation, setAnimation] = useState<{ id: number, type: string, amount: number } | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // --- COMPUTED STATUS ---
    const getStatus = (t: any) => {
        if (t.paidAt) return 'Pago';
        const isOverdue = new Date(t.dueDate) < new Date(2026, 2, 8); // using mock 'today' as around Mar 8th 2026
        if (!t.paidAt && isOverdue) return 'Vencido';
        return 'Pendente';
    };

    const getPlanClassification = (planId: number) => {
        const p = accountPlans.find((pl) => pl.id === planId);
        return p ? p.classification : '';
    };

    const getPlanName = (planId: number) => {
        const p = accountPlans.find((pl) => pl.id === planId);
        return p ? p.name : '';
    };

    // --- FILTER TRANSACTIONS ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const dateMatch = isSameMonth(parseISO(t.dueDate), currentMonth);
            if (!dateMatch) return false;

            if (typeFilter !== 'Todos' && t.type !== typeFilter) return false;

            const status = getStatus(t);
            if (statusFilter !== 'Todos' && status !== statusFilter) return false;

            if (planFilter && t.accountPlanId.toString() !== planFilter) return false;

            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const descMatch = t.description.toLowerCase().includes(searchLower);
                const clientMatch = t.clientSupplier.toLowerCase().includes(searchLower);
                if (!descMatch && !clientMatch) return false;
            }

            return true;
        }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [transactions, currentMonth, typeFilter, statusFilter, planFilter, searchQuery]);

    // --- SUMMARY TOTALS ---
    const summary = useMemo(() => {
        let receitas = 0;
        let crediarios = 0;
        let despesas = 0;
        let taxas = 0;

        // Filter transactions only by current month for summary
        const monthTransactions = transactions.filter(t => isSameMonth(parseISO(t.dueDate), currentMonth));

        monthTransactions.forEach(t => {
            if (t.type === 'Receita') {
                if (getStatus(t) === 'Pago') receitas += t.value;
                if (getPlanName(t.accountPlanId).toLowerCase().includes('crediário')) {
                    crediarios += t.value;
                }
            } else if (t.type === 'Despesa') {
                if (getStatus(t) === 'Pago') despesas += t.value;
            }
            taxas += (t.fees || 0);
        });

        return {
            receitas,
            crediarios,
            despesas,
            taxas,
            saldo: receitas - despesas
        };
    }, [transactions, currentMonth, accountPlans]);

    // --- PAGINATION ---
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1;
    const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // --- ACTIONS ---
    const handleAddOrEditTransaction = (data: any) => {
        if (editingTransaction) {
            setTransactions(transactions.map(t => t.id === editingTransaction.id ? { ...t, ...data } : t));
        } else {
            setTransactions([...transactions, { id: Date.now(), ...data, createdBy: 'Admin' }]);
            setAnimation({ id: Date.now(), type: data.type, amount: data.value });
            setTimeout(() => setAnimation(null), 2500);
        }
        setShowTransactionModal(false);
        setEditingTransaction(null);
    };

    const handleDelete = (id: number) => {
        if (window.confirm('Deseja realmente excluir este lançamento?')) {
            setTransactions(transactions.filter(t => t.id !== id));
        }
    };

    const handleMarkAsPaid = (id: number) => {
        setTransactions(transactions.map(t => {
            if (t.id === id) {
                const today = new Date().toISOString().split('T')[0];
                return { ...t, paidAt: today };
            }
            return t;
        }));
    };

    const navMonth = (offset: number) => {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() + offset);
        setCurrentMonth(d);
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setTypeFilter('Todos');
        setStatusFilter('Todos');
        setPlanFilter('');
        setSearchInput('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    // --- NEW TRANSACTION/ACCOUNT PLAN MODAL COMPS ---
    const TransactionModal = () => {
        const formatToBRLInput = (valNum: number) => {
            return new Intl.NumberFormat("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(valNum);
        };

        const [type, setType] = useState(editingTransaction?.type || 'Despesa');
        const [description, setDescription] = useState(editingTransaction?.description || '');
        const [planId, setPlanId] = useState(editingTransaction?.accountPlanId || '');
        const [clientSup, setClientSup] = useState(editingTransaction?.clientSupplier || '');
        const [payMethod, setPayMethod] = useState(editingTransaction?.paymentMethod || 'Dinheiro');
        const [due, setDue] = useState(editingTransaction?.dueDate || new Date().toISOString().split('T')[0]);
        const [val, setVal] = useState(editingTransaction?.value ? formatToBRLInput(editingTransaction.value) : '');
        const [feesVal, setFeesVal] = useState(editingTransaction?.fees ? formatToBRLInput(editingTransaction.fees) : '');
        const [isPaid, setIsPaid] = useState(editingTransaction?.paidAt ? 'Sim' : 'Não');

        const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
            let value = e.target.value.replace(/\D/g, "");
            if (value === "") {
                setter("");
                return;
            }
            const numericValue = parseInt(value, 10) / 100;
            setter(formatToBRLInput(numericValue));
        };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            handleAddOrEditTransaction({
                type,
                description,
                accountPlanId: Number(planId),
                clientSupplier: clientSup,
                paymentMethod: payMethod,
                dueDate: due,
                value: parseFloat(val.toString().replace(/\./g, "").replace(",", ".")) || 0,
                fees: feesVal ? parseFloat(feesVal.toString().replace(/\./g, "").replace(",", ".")) : 0,
                paidAt: isPaid === 'Sim' ? new Date().toISOString().split('T')[0] : null
            });
        };

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h2 className="text-lg font-bold text-gray-900">
                            ⊕ {editingTransaction ? 'Editar' : 'Cadastrar'} Receita / Despesa
                        </h2>
                        <button onClick={() => { setShowTransactionModal(false); setEditingTransaction(null); }} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {/* Type Radio */}
                        <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" value="Despesa" checked={type === 'Despesa'} onChange={(e) => setType(e.target.value)} className="w-4 h-4 text-gray-900" />
                                <span className="text-sm font-medium">Despesa</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" value="Receita" checked={type === 'Receita'} onChange={(e) => setType(e.target.value)} className="w-4 h-4 text-gray-900" />
                                <span className="text-sm font-medium">Receita</span>
                            </label>
                        </div>

                        <div>
                            <input type="text" placeholder="Descrição" required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                        </div>

                        <div className="flex gap-2 relative z-50">
                            <select required value={planId} onChange={(e) => setPlanId(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none bg-white">
                                <option value="" disabled>Plano de Contas</option>
                                {accountPlans.filter(p => p.type === type).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => setShowAccountPlanModal(true)} className="px-3 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-700">
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <input type="text" placeholder="Cliente / Fornecedor" required value={clientSup} onChange={(e) => setClientSup(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                        </div>

                        <div className="flex gap-2">
                            <select required value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 outline-none bg-white">
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="Boleto">Boleto</option>
                                <option value="Transferência">Transferência</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Vencimento</label>
                                <input type="date" required value={due} onChange={(e) => setDue(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 cursor-text" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Valor</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-sm text-gray-500">R$</span>
                                    <input type="text" inputMode="decimal" required value={val} onChange={(e) => handleAmountChange(e, setVal)} placeholder="0,00" className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-gray-900" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Taxas</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-sm text-gray-500">R$</span>
                                    <input type="text" inputMode="decimal" value={feesVal} onChange={(e) => handleAmountChange(e, setFeesVal)} placeholder="0,00" className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-gray-900" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Já foi pago?</label>
                                <select value={isPaid} onChange={(e) => setIsPaid(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 bg-white">
                                    <option value="Não">Não</option>
                                    <option value="Sim">Sim</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors mt-4 shadow-md">
                            Salvar
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    const AccountPlanModal = () => {
        const [planName, setPlanName] = useState('');
        const [planType, setPlanType] = useState('Despesa');
        const [planClass, setPlanClass] = useState('Fixa');

        const handleSave = (e: React.FormEvent) => {
            e.preventDefault();
            setAccountPlans([...accountPlans, { id: Date.now(), name: planName, type: planType, classification: planClass }]);
            setShowAccountPlanModal(false);
        };

        return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h2 className="text-lg font-bold text-gray-900">⊕ Cadastrar Plano de Contas</h2>
                        <button onClick={() => setShowAccountPlanModal(false)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="p-4 space-y-4">
                        <div>
                            <input type="text" required placeholder="Plano de Contas" value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                            <select required value={planType} onChange={(e) => setPlanType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 bg-white">
                                <option value="Receita">Receita</option>
                                <option value="Despesa">Despesa</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Classificação</label>
                            <select required value={planClass} onChange={(e) => setPlanClass(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 bg-white">
                                <option value="Fixa">Fixa</option>
                                <option value="Variável">Variável</option>
                            </select>
                        </div>
                        <button type="submit" className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors shadow-md mt-2">
                            Salvar
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto bg-white min-h-screen text-gray-900">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Financeiro</h1>
                <button
                    onClick={() => { setEditingTransaction(null); setShowTransactionModal(true); }}
                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg"
                >
                    <Plus size={18} />
                    Cadastrar
                </button>
            </header>

            {/* Navigation & Filters Bar */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4 space-y-4">
                {/* Month nav */}
                <div className="flex items-center justify-center gap-4 bg-white py-2 rounded-lg border border-gray-200 max-w-sm mx-auto shadow-sm">
                    <button onClick={() => navMonth(-1)} className="p-1 hover:bg-gray-100 rounded-md"><ChevronLeft size={20} /></button>
                    <span className="font-bold w-40 text-center capitalize">
                        {format(currentMonth, 'MMMM/yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={() => navMonth(1)} className="p-1 hover:bg-gray-100 rounded-md"><ChevronRight size={20} /></button>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer hover:border-gray-400">
                        <option value="Todos">Todos</option>
                        <option value="Receita">Receita</option>
                        <option value="Despesa">Despesa</option>
                    </select>

                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer hover:border-gray-400">
                        <option value="Todos">Receita ou Despesa</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Pago">Pago</option>
                        <option value="Vencido">Vencido</option>
                    </select>

                    <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                        <span className="text-sm font-medium text-gray-600 ml-2">Filtrar:</span>
                        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[150px]">
                            <option value="">Plano de Contas</option>
                            {accountPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="relative flex-1">
                            <input
                                type="text" placeholder="Digite para Buscar"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchInput)}
                                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-gray-900 outline-none"
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        </div>
                        <button onClick={() => setSearchQuery(searchInput)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                            BUSCAR
                        </button>
                    </div>

                    <button onClick={clearFilters} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                        LIMPAR FILTROS
                    </button>
                    <button className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-2 shadow-sm shadow-green-200">
                        <span>Exportar</span>
                        <Search size={16} /> {/* Generic icon for export button as requested "with export icon" */}
                    </button>
                </div>
            </div>

            {/* Dash Cards (5 Cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Receitas */}
                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                            <TrendingUp size={16} />
                        </div>
                        <span className="text-sm font-medium">Receitas</span>
                        <Info size={14} className="text-gray-400 ml-auto" />
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(summary.receitas)}</div>
                </div>

                {/* Crediários */}
                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <DollarSign size={16} />
                        </div>
                        <span className="text-sm font-medium">Crediários</span>
                        <Info size={14} className="text-gray-400 ml-auto" />
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(summary.crediarios)}</div>
                </div>

                {/* Despesas */}
                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                            <TrendingDown size={16} />
                        </div>
                        <span className="text-sm font-medium">Despesas</span>
                        <Info size={14} className="text-gray-400 ml-auto" />
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(summary.despesas)}</div>
                </div>

                {/* Taxas */}
                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                            <Percent size={16} />
                        </div>
                        <span className="text-sm font-medium">Taxas</span>
                        <Info size={14} className="text-gray-400 ml-auto" />
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(summary.taxas)}</div>
                </div>

                {/* Saldo */}
                <div className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                            <Scale size={16} />
                        </div>
                        <span className="text-sm font-medium">Saldo</span>
                        <Info size={14} className="text-gray-400 ml-auto" />
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(summary.saldo)}</div>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100/50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                <th className="py-3 px-4">Vencimento</th>
                                <th className="py-3 px-4">Pagamento</th>
                                <th className="py-3 px-4">Criado por</th>
                                <th className="py-3 px-4">Plano de Contas</th>
                                <th className="py-3 px-4">Descrição</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 hidden md:table-cell">Tipo</th>
                                <th className="py-3 px-4 text-right">Taxas</th>
                                <th className="py-3 px-4 text-right">Valor</th>
                                <th className="py-3 px-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {paginatedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-8 text-center text-gray-500">Nenhum registro encontrado.</td>
                                </tr>
                            ) : paginatedTransactions.map((t) => {
                                const status = getStatus(t);
                                const statusColors = {
                                    'Pendente': 'bg-yellow-100 text-yellow-700',
                                    'Pago': 'bg-green-100 text-green-700',
                                    'Vencido': 'bg-red-100 text-red-700'
                                };
                                const classif = getPlanClassification(t.accountPlanId);
                                const typeColors = classif === 'Fixa' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';

                                return (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-4 whitespace-nowrap text-gray-700">{formatDate(t.dueDate)}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-gray-500">{formatDate(t.paidAt) || '—'}</td>
                                        <td className="py-3 px-4 text-gray-600">{t.createdBy}</td>
                                        <td className="py-3 px-4 font-medium text-gray-800">{getPlanName(t.accountPlanId)}</td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-gray-900">{t.description}</div>
                                            <div className="text-xs text-gray-500">{t.clientSupplier}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[status]}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 hidden md:table-cell">
                                            {classif && (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${typeColors}`}>
                                                    {classif}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-500 whitespace-nowrap">
                                            {formatCurrency(t.fees || 0)}
                                        </td>
                                        <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${t.type === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(t.value)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => { setEditingTransaction(t); setShowTransactionModal(true); }} className="text-gray-400 hover:text-blue-600 p-1 bg-gray-100 rounded-md hover:bg-blue-50 transition-colors" title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 p-1 bg-gray-100 rounded-md hover:bg-red-50 transition-colors" title="Excluir">
                                                    <Trash2 size={16} />
                                                </button>
                                                {t.paidAt === null && (
                                                    <button onClick={() => handleMarkAsPaid(t.id)} className="text-gray-400 hover:text-green-600 p-1 bg-gray-100 rounded-md hover:bg-green-50 transition-colors" title="Marcar como Pago">
                                                        <CheckCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Table Area */}
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm font-medium text-gray-600 flex items-center gap-4 order-2 sm:order-1">
                        <div>Total de registros: <span className="text-gray-900">{filteredTransactions.length}</span></div>
                        <div className="flex items-center gap-2">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"><ChevronLeft size={16} /></button>
                            <span>{currentPage} de {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 order-1 sm:order-2">
                        <div className="text-sm text-gray-600">
                            Total em Taxas: <span className="font-bold text-gray-900">{formatCurrency(filteredTransactions.reduce((acc, t) => acc + (t.fees || 0), 0))}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                            Valor Total: <span className="font-bold text-gray-900">
                                {formatCurrency(filteredTransactions.reduce((acc, t) => acc + (t.type === 'Receita' ? t.value : -t.value), 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showTransactionModal && <TransactionModal />}
            {showAccountPlanModal && <AccountPlanModal />}

            {/* Animation Overlay */}
            {animation && (
                <div key={animation.id} className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
                    <div className={`flex flex-col items-center justify-center
                        ${animation.type === 'Receita' ? 'text-green-500' : 'text-red-500'}`}
                        style={{
                            animation: 'finance-fade-out-up 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                        }}
                    >
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-2xl ${animation.type === 'Receita' ? 'bg-green-100 shadow-green-200' : 'bg-red-100 shadow-red-200'}`}>
                            {animation.type === 'Receita' ? <TrendingUp size={48} /> : <TrendingDown size={48} />}
                        </div>
                        <span className="text-5xl font-extrabold shadow-xl bg-white/90 px-6 py-3 rounded-full ring-1 ring-black/5 backdrop-blur-md">
                            {animation.type === 'Receita' ? '+' : '-'} {formatCurrency(animation.amount)}
                        </span>
                        <span className="text-xl font-bold bg-white/90 px-6 py-2 rounded-full mt-3 ring-1 ring-black/5 backdrop-blur-md shadow-lg text-gray-700">
                            {animation.type === 'Receita' ? 'Receita registrada com sucesso!' : 'Despesa registrada!'}
                        </span>
                    </div>
                    <style>{`
                        @keyframes finance-fade-out-up {
                            0% { opacity: 0; transform: translateY(80px) scale(0.6); }
                            15% { opacity: 1; transform: translateY(0) scale(1.15); }
                            30% { opacity: 1; transform: translateY(0) scale(1); }
                            70% { opacity: 1; transform: translateY(-30px) scale(1); }
                            100% { opacity: 0; transform: translateY(-150px) scale(0.8); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
