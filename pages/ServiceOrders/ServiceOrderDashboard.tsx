import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle2,
    WrenchIcon,
    SmartphoneIcon,
    DollarSign,
    ArrowRight,
    Users,
    Package,
    ClipboardList,
    PieChart as PieChartIcon,
    Zap,
    Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getServiceOrders, getOsPartsStockStats } from '../../services/mockApi';
import { ServiceOrder } from '../../types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

// --- Constants ---
const KPI_CONFIG = [
    { key: 'Aberto', label: 'OS em Aberto', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { key: 'Análise', label: 'Em Análise', icon: SmartphoneIcon, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { key: 'Aprovado', label: 'Aprovadas', icon: WrenchIcon, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { key: 'Pronto', label: 'Prontas p/ Entrega', icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

const AGENDA_ITEMS = [
    { id: 1, time: '09:00', title: 'Entrega iPhone 13 Pro', customer: 'João Silva', type: 'delivery' },
    { id: 2, time: '10:30', title: 'Análise MacBook Air M1', customer: 'Maria Oliveira', type: 'analysis' },
    { id: 3, time: '14:00', title: 'Reparo Placa Samsung S22', customer: 'Carlos Edu', type: 'repair' },
    { id: 4, time: '16:15', title: 'Orçamento iPad Air', customer: 'Ana Clara', type: 'budget' },
];

const ServiceOrderDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [expenses, setExpenses] = useState<any[]>(() => {
        const saved = localStorage.getItem('os_expenses');
        return saved ? JSON.parse(saved) : [];
    });
    const [isLoading, setIsLoading] = useState(true);
    const [periodFilter, setPeriodFilter] = useState('month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [osPartsStats, setOsPartsStats] = useState<{ totalParts: number; totalCost: number; totalSaleValue: number; lowStockCount: number } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [data, partsStats] = await Promise.all([
                getServiceOrders(),
                getOsPartsStockStats(),
            ]);
            setOrders(data || []);
            setOsPartsStats(partsStats);
            // Update expenses from local storage in case they changed
            const saved = localStorage.getItem('os_expenses');
            if (saved) setExpenses(JSON.parse(saved));
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Greeting logic
    const hour = new Date().getHours();
    let greeting = 'Bom dia';
    if (hour >= 12) greeting = 'Boa tarde';
    if (hour >= 18) greeting = 'Boa noite';

    // Filtering logic
    const filteredOrders = useMemo(() => orders.filter(os => {
        const date = new Date(os.exitDate || os.updatedAt || os.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (periodFilter === 'today') {
            return date >= today;
        }
        if (periodFilter === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayEnd = new Date(today);
            yesterdayEnd.setMilliseconds(-1);
            return date >= yesterday && date <= yesterdayEnd;
        }
        if (periodFilter === 'week') {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return date >= weekStart;
        }
        if (periodFilter === 'month') {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            return date >= monthStart;
        }
        if (periodFilter === 'custom' && customStartDate && customEndDate) {
            const start = new Date(customStartDate + 'T00:00:00');
            const end = new Date(customEndDate + 'T23:59:59');
            return date >= start && date <= end;
        }
        return true;
    }), [orders, periodFilter, customStartDate, customEndDate]);

    const filteredExpenses = useMemo(() => expenses.filter(exp => {
        const date = new Date(exp.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (periodFilter === 'today') {
            return date >= today;
        }
        if (periodFilter === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayEnd = new Date(today);
            yesterdayEnd.setMilliseconds(-1);
            return date >= yesterday && date <= yesterdayEnd;
        }
        if (periodFilter === 'week') {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return date >= weekStart;
        }
        if (periodFilter === 'month') {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            return date >= monthStart;
        }
        if (periodFilter === 'custom' && customStartDate && customEndDate) {
            const start = new Date(customStartDate + 'T00:00:00');
            const end = new Date(customEndDate + 'T23:59:59');
            return date >= start && date <= end;
        }
        return true;
    }), [expenses, periodFilter, customStartDate, customEndDate]);

    const totalRevenue = useMemo(() => filteredOrders
        .filter(os => os.status === 'Entregue' || os.status === 'Concluído')
        .reduce((acc, os) => acc + (os.total || 0), 0), [filteredOrders]);

    const totalExpenses = useMemo(() => filteredExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0), [filteredExpenses]);

    // Compute chart data dynamically
    const weeklyFlowData = useMemo(() => {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const flow = days.map(name => ({ name, entrada: 0, saida: 0 }));

        filteredOrders.forEach(os => {
            const entryDate = new Date(os.entryDate || os.createdAt);
            flow[entryDate.getDay()].entrada += 1;

            if (os.exitDate && (os.status === 'Entregue' || os.status === 'Concluído')) {
                const exitDate = new Date(os.exitDate);
                flow[exitDate.getDay()].saida += 1;
            }
        });

        // Reorder to start from Monday for better visualization in Brazil
        return [...flow.slice(1), flow[0]];
    }, [filteredOrders]);

    const revenueChartData = useMemo(() => {
        let services = 0;
        let parts = 0;

        filteredOrders.forEach(os => {
            if (os.status === 'Entregue' || os.status === 'Concluído') {
                os.items.forEach(item => {
                    if (item.type === 'service') services += (item.price * item.quantity);
                    else parts += (item.price * item.quantity);
                });
            }
        });

        return [
            { name: 'Serviços', value: services, color: '#7B61FF' },
            { name: 'Peças', value: parts, color: '#3B82F6' },
        ];
    }, [filteredOrders]);

    return (
        <div className="space-y-6 pb-20 fade-in">
            {/* 1. Header & Greeting */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden">
                <div className="flex-shrink-0">
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-primary">
                        {greeting}.
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:justify-end">
                    <button
                        onClick={() => navigate('/service-orders/customers')}
                        className="h-11 px-4 py-2.5 bg-cyan-100 text-cyan-800 rounded-xl font-black shadow-sm border-2 border-cyan-300 hover:bg-cyan-200 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <Users size={16} />
                        Clientes
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/financial')}
                        className="h-11 px-4 py-2.5 bg-emerald-100 text-emerald-800 rounded-xl font-black shadow-sm border-2 border-emerald-300 hover:bg-emerald-200 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <DollarSign size={16} />
                        Financeiro
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/products')}
                        className="h-11 px-4 py-2.5 bg-amber-100 text-amber-800 rounded-xl font-black shadow-sm border-2 border-amber-300 hover:bg-amber-200 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <Package size={16} />
                        Peças e Serviços
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/list')}
                        className="h-11 px-4 py-2.5 bg-violet-100 text-violet-800 rounded-xl font-black shadow-sm border-2 border-violet-300 hover:bg-violet-200 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <ClipboardList size={16} />
                        Ordens de Serviço
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/reports')}
                        className="h-11 px-4 py-2.5 bg-rose-100 text-rose-800 rounded-xl font-black shadow-sm border-2 border-rose-300 hover:bg-rose-200 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <PieChartIcon size={16} />
                        Relatórios
                    </button>

                    <button
                        onClick={() => navigate('/service-orders/list?quickOS=1')}
                        className="h-11 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-black shadow-lg shadow-amber-500/20 border-2 border-transparent hover:bg-amber-600 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap"
                    >
                        <Zap size={16} className="fill-white" />
                        OS Rápida
                    </button>

                    <button
                        onClick={() => navigate('/service-orders/new')}
                        className="h-11 px-5 py-2.5 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 border-2 border-transparent hover:scale-105 transition-transform text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <Wrench size={16} />
                        Nova OS
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-white/40 shadow-sm">
                <button
                    onClick={() => setPeriodFilter('today')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${periodFilter === 'today' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-white'}`}
                >
                    Hoje
                </button>
                <button
                    onClick={() => setPeriodFilter('yesterday')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${periodFilter === 'yesterday' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-white'}`}
                >
                    Ontem
                </button>
                <button
                    onClick={() => setPeriodFilter('week')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${periodFilter === 'week' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-white'}`}
                >
                    Semana
                </button>
                <button
                    onClick={() => setPeriodFilter('month')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${periodFilter === 'month' ? 'bg-primary text-white shadow-md' : 'text-secondary hover:bg-white'}`}
                >
                    Mês
                </button>
                <div className="flex items-center gap-2 ml-auto">
                    <div className={`flex items-center gap-2 p-1 rounded-xl transition-all ${periodFilter === 'custom' ? 'bg-white shadow-sm border border-gray-100' : ''}`}>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => {
                                setCustomStartDate(e.target.value);
                                setPeriodFilter('custom');
                            }}
                            className="bg-transparent text-[10px] font-bold outline-none !border-none p-1 focus:ring-0"
                        />
                        <span className="text-gray-300">|</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => {
                                setCustomEndDate(e.target.value);
                                setPeriodFilter('custom');
                            }}
                            className="bg-transparent text-[10px] font-bold outline-none !border-none p-1 focus:ring-0"
                        />
                    </div>
                </div>
            </div>

            {/* Financial & Status KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Financial Totals */}
                <div className="bg-white/70 backdrop-blur-sm border border-white/40 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingUp size={100} className="text-emerald-500" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600">
                            <TrendingUp size={24} strokeWidth={1.5} />
                        </div>
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium">Total Receitas</p>
                        <h3 className="text-2xl font-black text-emerald-600 mt-1">{isLoading ? '...' : formatCurrency(totalRevenue)}</h3>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-sm border border-white/40 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingDown size={100} className="text-red-500" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl bg-red-100 text-red-600">
                            <TrendingDown size={24} strokeWidth={1.5} />
                        </div>
                    </div>
                    <div>
                        <p className="text-secondary text-sm font-medium">Total Despesas</p>
                        <h3 className="text-2xl font-black text-red-600 mt-1">{isLoading ? '...' : formatCurrency(totalExpenses)}</h3>
                    </div>
                </div>

                {/* Status KPIs */}
                {KPI_CONFIG.map((config, idx) => {
                    const count = filteredOrders.filter(os => os.status === config.key).length;
                    return (
                        <div key={idx} className="bg-white/70 backdrop-blur-sm border border-white/40 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${config.bg} ${config.color} group-hover:scale-110 transition-transform`}>
                                    <config.icon size={24} strokeWidth={1.5} />
                                </div>
                            </div>
                            <div>
                                <p className="text-secondary text-sm font-medium">{config.label}</p>
                                <h3 className="text-2xl font-black text-primary mt-1">{isLoading ? '...' : count}</h3>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Card de Estoque Exclusivo de OS */}
            {osPartsStats && (
                <div
                    onClick={() => navigate('/service-orders/products')}
                    className="cursor-pointer bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                                <Package size={22} strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-amber-700 uppercase tracking-widest">Estoque Peças OS</p>
                                <p className="text-[10px] text-amber-500 font-semibold">Separado do ERP principal</p>
                            </div>
                        </div>
                        <ArrowRight size={18} className="text-amber-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/80 rounded-xl p-3 border border-amber-100">
                            <p className="text-xs text-gray-500 font-semibold uppercase">Qtd. Itens</p>
                            <p className="text-xl font-black text-gray-800 mt-0.5">{osPartsStats.totalParts}</p>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-amber-100">
                            <p className="text-xs text-gray-500 font-semibold uppercase">Custo Total</p>
                            <p className="text-sm font-black text-gray-700 mt-0.5">{formatCurrency(osPartsStats.totalCost)}</p>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-amber-100">
                            <p className="text-xs text-gray-500 font-semibold uppercase">Valor Venda</p>
                            <p className="text-sm font-black text-emerald-600 mt-0.5">{formatCurrency(osPartsStats.totalSaleValue)}</p>
                        </div>
                    </div>
                    {osPartsStats.lowStockCount > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-red-600 font-bold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                            <AlertCircle size={14} />
                            {osPartsStats.lowStockCount} peça(s) com estoque abaixo do mínimo
                        </div>
                    )}
                </div>
            )}

            {/* 3. Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 3.1 Weekly Flow Chart (Bar) */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm border border-white/40 p-6 rounded-3xl shadow-sm">

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-lg text-primary">Fluxo Semanal</h3>
                            <p className="text-sm text-secondary">Entrada vs. Saída de Aparelhos</p>
                        </div>
                        <div className="flex gap-2 text-xs font-medium">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-accent rounded-full"></span> Entrada</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-full"></span> Saída</span>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyFlowData} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="entrada" fill="#7B61FF" radius={[6, 6, 6, 6]} barSize={20} />
                                <Bar dataKey="saida" fill="#34D399" radius={[6, 6, 6, 6]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3.2 Agenda / Schedule */}
                <div className="bg-white/95 backdrop-blur-xl border border-gray-100 p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-black text-[22px] text-gray-900 tracking-tight">Agenda do Dia</h3>
                        <button className="text-accent text-sm font-bold hover:opacity-80 transition-opacity">Ver tudo</button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto max-h-[350px] custom-scrollbar pr-2 mb-2">
                        {AGENDA_ITEMS.map((item) => (
                            <div key={item.id} className="flex items-center gap-5 group cursor-pointer">
                                <div className="w-[52px] h-[52px] bg-gray-50/80 rounded-full flex flex-col items-center justify-center shrink-0 border border-gray-100 transition-all group-hover:scale-105 group-hover:shadow-sm">
                                    <span className="text-[15px] font-black text-gray-700 leading-none">{item.time.split(':')[0]}</span>
                                    <span className="text-[11px] font-bold text-gray-400 mt-0.5">:{item.time.split(':')[1]}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-[17px] text-gray-900 truncate group-hover:text-accent transition-colors">{item.title}</h4>
                                    <p className="text-[13px] text-gray-500 truncate mt-0.5">{item.customer}</p>
                                </div>
                                <div className={`w-2 h-2 rounded-full shrink-0
                                    ${item.type === 'delivery' ? 'bg-[#21CD92]' :
                                        item.type === 'analysis' ? 'bg-[#FCAF3B]' :
                                            item.type === 'repair' ? 'bg-[#3B82F6]' : 'bg-[#9853F0]'}
                                `} />
                            </div>
                        ))}
                    </div>

                    <button className="mt-4 w-full py-3.5 border border-dashed border-gray-300 rounded-[20px] text-gray-500 text-[15px] font-semibold hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50/50 transition-all flex items-center justify-center gap-2">
                        <Calendar size={18} strokeWidth={2} />
                        Agendar Compromisso
                    </button>
                </div>
            </div>

            {/* 4. Secondary Grid: Financials & Active Warranties */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 4.1 Revenue Donut */}
                <div className="bg-white/70 backdrop-blur-sm border border-white/40 p-6 rounded-3xl shadow-sm">
                    <h3 className="font-bold text-lg text-primary mb-2">Receita Técnica</h3>
                    <p className="text-sm text-secondary mb-6">Peças vs. Mão de Obra</p>

                    <div className="flex items-center justify-center h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={revenueChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {revenueChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                        {revenueChartData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <div>
                                    <p className="text-xs text-secondary">{item.name}</p>
                                    <p className="text-sm font-bold text-primary">R$ {item.value.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4.2 Warranties List */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm border border-white/40 text-primary p-6 rounded-3xl shadow-sm relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div>
                            <h3 className="font-bold text-lg">Garantias Ativas</h3>
                            <p className="text-secondary text-sm">Aparelhos em período de cobertura</p>
                        </div>
                        <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">
                            Total: 24
                        </div>
                    </div>

                    <div className="space-y-3 relative z-10">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 hover:shadow-md transition-all cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-primary">iPhone 11 - Troca de Tela</p>
                                        <p className="text-xs text-secondary">Cliente: Marcos Paulo • Expira em 15 dias</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                        ))}
                    </div>

                    <button className="mt-6 text-sm text-center w-full text-secondary hover:text-primary transition-colors relative z-10 font-medium">
                        Ver todas as garantias
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrderDashboard;
