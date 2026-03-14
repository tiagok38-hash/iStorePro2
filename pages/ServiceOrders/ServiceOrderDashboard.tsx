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
import {
    calculateWarrantyExpiry,
    getRemainingDays,
    formatDateBR,
    getWarrantyStatus
} from '../../utils/dateUtils';
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

    // Sync custom date inputs with period filter
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let start = new Date(today);
        let end = new Date(today);

        if (periodFilter === 'today') {
            // start and end are already today
        } else if (periodFilter === 'yesterday') {
            start.setDate(today.getDate() - 1);
            end.setDate(today.getDate() - 1);
        } else if (periodFilter === 'week') {
            const dayOfweek = today.getDay();
            start.setDate(today.getDate() - dayOfweek); // Sunday
            // end is today
        } else if (periodFilter === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            // end is today
        } else if (periodFilter === 'custom') {
            return; // Don't override if user is setting it
        }

        const toISO = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setCustomStartDate(toISO(start));
        setCustomEndDate(toISO(end));
    }, [periodFilter]);

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
        if (!customStartDate || !customEndDate) return true;

        const date = new Date(os.exitDate || os.updatedAt || os.createdAt);
        const start = new Date(customStartDate + 'T00:00:00');
        const end = new Date(customEndDate + 'T23:59:59');

        return date >= start && date <= end;
    }), [orders, customStartDate, customEndDate]);

    const filteredExpenses = useMemo(() => expenses.filter(exp => {
        if (!customStartDate || !customEndDate) return true;

        const date = new Date(exp.date);
        const start = new Date(customStartDate + 'T00:00:00');
        const end = new Date(customEndDate + 'T23:59:59');

        return date >= start && date <= end;
    }), [expenses, customStartDate, customEndDate]);

    const totalRevenue = useMemo(() => filteredOrders
        .filter(os => os.status === 'Entregue' || os.status === 'Concluído')
        .reduce((acc, os) => acc + (os.total || 0), 0), [filteredOrders]);

    const totalExpenses = useMemo(() => filteredExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0), [filteredExpenses]);

    // Compute chart data dynamically
    const weeklyFlowData = useMemo(() => {
        const flow = [
            { name: 'Dom', receita: 0, despesas: 0, lucro: 0, custoOS: 0 },
            { name: 'Seg', receita: 0, despesas: 0, lucro: 0, custoOS: 0 },
            { name: 'Ter', receita: 0, despesas: 0, lucro: 0, custoOS: 0 },
            { name: 'Qua', receita: 0, despesas: 0, lucro: 0, custoOS: 0 },
            { name: 'Qui', receita: 0, despesas: 0, lucro: 0, custoOS: 0 },
            { name: 'Sex', receita: 0, despesas: 0, lucro: 0, custoOS: 0 },
            { name: 'Sáb', receita: 0, despesas: 0, lucro: 0, custoOS: 0 }
        ];

        filteredOrders.forEach(os => {
            if (os.status === 'Entregue' || os.status === 'Concluído') {
                const exitDateStr = os.exitDate || os.updatedAt || os.createdAt;
                const exitDate = new Date(exitDateStr);
                if (exitDate instanceof Date && !isNaN(exitDate.getTime())) {
                    flow[exitDate.getDay()].receita += (os.total || 0);

                    let osCost = 0;
                    os.items.forEach(item => {
                        osCost += (item.cost || 0) * item.quantity;
                    });
                    flow[exitDate.getDay()].custoOS += osCost;
                }
            }
        });

        filteredExpenses.forEach(exp => {
            const expDateStr = exp.date || exp.createdAt;
            const expDate = new Date(expDateStr);
            if (expDate instanceof Date && !isNaN(expDate.getTime())) {
                const day = expDate.getDay();
                flow[day].despesas -= (exp.amount || 0); // Torna negativo para o gráfico descer
            }
        });

        flow.forEach(day => {
            day.lucro = day.receita + day.despesas - day.custoOS;
        });

        // Reorder to start from Monday for better visualization in Brazil
        return [...flow.slice(1), flow[0]];
    }, [filteredOrders, filteredExpenses]);

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

    const servicesRanking = useMemo(() => {
        const counts: Record<string, { count: number, name: string }> = {};
        filteredOrders.forEach(os => {
            if (os.status === 'Entregue' || os.status === 'Concluído') {
                os.items.forEach(item => {
                    if (item.type === 'service') {
                        if (!counts[item.description]) {
                            counts[item.description] = { count: 0, name: item.description };
                        }
                        counts[item.description].count += item.quantity;
                    }
                });
            }
        });
        return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [filteredOrders]);

    const techniciansRanking = useMemo(() => {
        const counts: Record<string, { count: number, name: string }> = {};
        filteredOrders.forEach(os => {
            if (os.status === 'Entregue' || os.status === 'Concluído') {
                const techName = os.responsibleName || 'Não Informado';
                if (!counts[techName]) {
                    counts[techName] = { count: 0, name: techName };
                }
                counts[techName].count += 1;
            }
        });
        return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [filteredOrders]);

    const weeklyTotals = useMemo(() => {
        let receita = 0;
        let despesas = 0;
        let lucro = 0;
        weeklyFlowData.forEach(d => {
            receita += d.receita;
            despesas += d.despesas;
            lucro += d.lucro;
        });
        return { receita, despesas, lucro };
    }, [weeklyFlowData]);

    const activeWarranties = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return orders
            .filter(os => (os.status === 'Entregue' || os.status === 'Concluído') && os.exitDate)
            .map(os => {
                const itemWarranties = os.items
                    .filter(item => item.warranty && item.warranty !== 'Sem garantia')
                    .map(item => ({
                        description: item.description,
                        expiry: calculateWarrantyExpiry(os.exitDate!, item.warranty || '')
                    }))
                    .filter(w => w.expiry && getWarrantyStatus(w.expiry) !== 'expired');

                if (itemWarranties.length === 0) return null;

                // Encontra a maior data de expiração entre os itens
                const maxExpiry = new Date(Math.max(...itemWarranties.map(w => w.expiry!.getTime())));

                return {
                    id: os.id,
                    displayId: os.displayId,
                    customerName: os.customerName,
                    deviceModel: os.deviceModel,
                    expiry: maxExpiry,
                    remainingDays: getRemainingDays(maxExpiry)
                };
            })
            .filter(Boolean)
            .sort((a, b) => (a?.expiry?.getTime() || 0) - (b?.expiry?.getTime() || 0)) as any[];
    }, [orders]);

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
            <div className="flex flex-wrap items-center gap-2 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-gray-200/60 shadow-[0_0_15px_rgba(0,0,0,0.1)]">
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

            {/* Financial & Status KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Financial Totals */}
                <div className="card-premium p-5 group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingUp size={100} className="text-emerald-500" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600">
                            <TrendingUp size={24} strokeWidth={1.5} />
                        </div>
                    </div>
                    <div>
                        <p className="text-secondary text-base font-semibold">Total Receitas</p>
                        <h3 className="text-3xl font-black text-emerald-600 mt-1">{isLoading ? '...' : formatCurrency(totalRevenue)}</h3>
                    </div>
                </div>

                <div className="card-premium p-5 group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingDown size={100} className="text-red-500" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl bg-red-100 text-red-600">
                            <TrendingDown size={24} strokeWidth={1.5} />
                        </div>
                    </div>
                    <div>
                        <p className="text-secondary text-base font-semibold">Total Despesas</p>
                        <h3 className="text-3xl font-black text-red-600 mt-1">{isLoading ? '...' : formatCurrency(totalExpenses)}</h3>
                    </div>
                </div>

                {/* Status KPIs */}
                {KPI_CONFIG.map((config, idx) => {
                    const count = filteredOrders.filter(os => os.status === config.key).length;
                    return (
                        <div key={idx} className="card-premium p-5 group overflow-hidden relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${config.bg} ${config.color} group-hover:scale-110 transition-transform`}>
                                    <config.icon size={24} strokeWidth={1.5} />
                                </div>
                            </div>
                            <div>
                                <p className="text-secondary text-base font-semibold">{config.label}</p>
                                <h3 className="text-3xl font-black text-primary mt-1">{isLoading ? '...' : count}</h3>
                            </div>
                        </div>
                    );
                })}
            </div>



            {/* 3. Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 3.1 Weekly Flow Chart (Bar) */}
                <div className="lg:col-span-2 card-premium p-8 flex flex-col">

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-black text-2xl text-primary">Fluxo Semanal</h3>
                            <p className="text-base font-medium text-secondary mt-1">Balanço Financeiro (Receita vs Despesas)</p>
                            <div className="flex gap-4 mt-3">
                                <div className={weeklyTotals.lucro >= 0 ? "bg-emerald-100 px-4 py-1.5 rounded-xl border border-emerald-200" : "bg-red-100 px-4 py-1.5 rounded-xl border border-red-200"}>
                                    <span className={`text-sm ${weeklyTotals.lucro >= 0 ? "text-emerald-600" : "text-red-600"} font-black`}>
                                        {formatCurrency(weeklyTotals.lucro)} {weeklyTotals.lucro >= 0 ? "Lucro" : "Prejuízo"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 text-sm font-black text-gray-600">
                            <span className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 bg-blue-500 rounded-full"></span>
                                Receita: {formatCurrency(weeklyTotals.receita)}
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 bg-red-400 rounded-full"></span>
                                Despesas: {formatCurrency(weeklyTotals.despesas)}
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 bg-emerald-400 rounded-full"></span>
                                Lucro (R - D): {formatCurrency(weeklyTotals.lucro)}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyFlowData} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13, fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13, fontWeight: 'bold' }} tickFormatter={(value) => `R$ ${value}`} />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="receita" name="Receita" fill="#3B82F6" radius={[4, 4, 4, 4]} barSize={12} />
                                <Bar dataKey="despesas" name="Despesas" fill="#F87171" radius={[4, 4, 4, 4]} barSize={12} />
                                <Bar dataKey="lucro" name="Lucro (R - D)" fill="#10B981" radius={[4, 4, 4, 4]} barSize={12} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3.2 Agenda / Schedule */}
                <div
                    onClick={() => navigate('/service-orders/list')}
                    className="cursor-pointer bg-white/95 backdrop-blur-xl border border-gray-200/80 p-8 rounded-[32px] shadow-[0_0_15px_rgba(0,0,0,0.1)] flex flex-col hover:shadow-[0_0_25px_rgba(0,0,0,0.15)] transition-all group"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-black text-[24px] text-gray-900 tracking-tight">Agenda do Dia</h3>
                            <p className="text-sm text-gray-500 font-medium mt-1">Próximos compromissos</p>
                        </div>
                        <button className="text-accent text-sm font-black hover:opacity-80 transition-opacity bg-accent/10 hover:bg-accent/20 px-4 py-2 rounded-xl">Ver tudo</button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center py-10 gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <Calendar size={28} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-base font-black text-gray-500">Nenhum compromisso hoje</p>
                            <p className="text-sm text-gray-400 font-medium mt-1">As OS prontas para entrega aparecerão aqui</p>
                        </div>
                        <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-xl">
                            {orders.filter(os => os.status === 'Pronto').length} OS pronta{orders.filter(os => os.status === 'Pronto').length !== 1 ? 's' : ''} para entrega
                        </span>
                    </div>
                </div>
            </div>

            {/* Nova grade Inferior: Estoque e Rankings (Middle Section) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Card de Estoque Exclusivo de OS */}
                {osPartsStats && (
                    <div
                        onClick={() => navigate('/service-orders/products')}
                        className="cursor-pointer card-premium p-6  flex flex-col justify-between group"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
                                        <Package size={28} strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-amber-700 uppercase tracking-widest">Estoque Peças/Insumos</p>
                                        <p className="text-xs text-amber-500 font-bold mt-0.5">Separado do ERP principal</p>
                                    </div>
                                </div>
                                <div className="p-2 bg-amber-50 rounded-full group-hover:bg-amber-100 transition-colors">
                                    <ArrowRight size={20} className="text-amber-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="bg-white/90 rounded-2xl p-4 border border-amber-100/60 shadow-sm">
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Qtd. Itens</p>
                                    <p className="text-3xl font-black text-gray-800 mt-1">{osPartsStats.totalParts}</p>
                                </div>
                                <div className="bg-white/90 rounded-2xl p-4 border border-amber-100/60 shadow-sm">
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Valor Venda</p>
                                    <p className="text-2xl font-black text-emerald-600 mt-2">{formatCurrency(osPartsStats.totalSaleValue)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Card Peças com Urgência */}
                {osPartsStats && osPartsStats.lowStockCount > 0 ? (
                    <div
                        onClick={() => navigate('/service-orders/products?filter=low')}
                        className="cursor-pointer card-premium p-6  flex flex-col justify-between relative overflow-hidden group"
                    >
                        <div className="absolute -right-8 -top-8 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                            <AlertCircle size={180} className="text-red-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-red-100 text-red-600 rounded-2xl group-hover:scale-110 transition-transform">
                                    <AlertCircle size={28} strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-red-700 uppercase tracking-widest">Peças com Urgência</p>
                                    <p className="text-xs text-red-500 font-bold mt-0.5">Atingiram limite de estoque mínimo</p>
                                </div>
                            </div>
                            <div className="mt-8 text-center bg-red-50/80 backdrop-blur-sm py-5 px-4 rounded-2xl border border-red-100/80 shadow-sm group-hover:bg-red-50 transition-colors">
                                <span className="text-lg font-black text-red-600 block">
                                    {osPartsStats.lowStockCount} {osPartsStats.lowStockCount === 1 ? 'peça precisa' : 'peças precisam'} de reposição
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card-premium p-6  flex flex-col items-center justify-center text-center opacity-60">
                        <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
                        <p className="text-lg font-black text-gray-600">Estoque Saudável</p>
                        <p className="text-sm text-gray-400 font-medium">Nenhuma peça com urgência</p>
                    </div>
                )}

                {/* 3. Ranking de Serviços */}
                <div className="card-premium p-6  flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl">
                            <Wrench size={26} strokeWidth={2} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-primary uppercase tracking-widest">Ranking Serviços</h3>
                            <p className="text-xs text-secondary font-bold mt-0.5">Mais prestados no período</p>
                        </div>
                    </div>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {servicesRanking.length > 0 ? servicesRanking.map((s, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white/90 p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-purple-200 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-xs font-black text-purple-600 bg-purple-100 px-2.5 py-1 rounded-xl">#{idx + 1}</span>
                                    <span className="text-sm font-black text-gray-700 truncate" title={s.name}>{s.name}</span>
                                </div>
                                <span className="text-sm font-black text-white bg-purple-500 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm">{s.count}</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center pt-8 pb-4">
                                <p className="text-sm font-bold text-gray-400">Nenhum serviço registrado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Secondary Grid: Financials, Technicians & Active Warranties */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* 4.1 Revenue Donut */}
                <div className="card-premium p-6  flex flex-col">
                    <h3 className="font-black text-xl text-primary mb-1">Receita Técnica</h3>
                    <p className="text-sm font-bold text-secondary mb-6">Peças vs. Mão de Obra</p>

                    <div className="flex items-center justify-center h-[200px] mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={revenueChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {revenueChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-auto">
                        {revenueChartData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                                <div>
                                    <p className="text-xs font-bold text-secondary uppercase tracking-wider">{item.name}</p>
                                    <p className="text-base font-black text-primary mt-0.5">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4.2 Ranking de Técnicos (Moved from above, now occupies 1 column) */}
                <div className="card-premium p-6  flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
                            <Users size={26} strokeWidth={2} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm text-primary uppercase tracking-widest">Ranking Técnicos</h3>
                            <p className="text-xs text-secondary font-bold mt-0.5">Serviços feitos no período</p>
                        </div>
                    </div>
                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {techniciansRanking.length > 0 ? techniciansRanking.map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white/90 p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-xs font-black text-blue-600 bg-blue-100 px-2.5 py-1 rounded-xl">#{idx + 1}</span>
                                    <span className="text-sm font-black text-gray-700 truncate" title={t.name}>{t.name}</span>
                                </div>
                                <span className="text-sm font-black text-white bg-blue-500 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm">{t.count}</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center pt-8 pb-4">
                                <p className="text-sm font-bold text-gray-400">Nenhum técnico registrado</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4.3 Warranties List (Takes 2 columns) */}
                <div className="lg:col-span-2 card-premium text-primary p-8 relative overflow-hidden flex flex-col">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />

                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                            <h3 className="font-black text-[24px]">Garantias Ativas</h3>
                            <p className="text-secondary text-sm font-bold mt-1">Aparelhos em período de cobertura</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                        {activeWarranties.length > 0 ? (
                            <div className="space-y-3">
                                {activeWarranties.slice(0, 6).map((w, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/90 p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-emerald-200 transition-all group/item">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <SmartphoneIcon size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-gray-900 truncate">OS-{w.displayId} • {w.deviceModel}</p>
                                                </div>
                                                <p className="text-xs font-bold text-gray-400 truncate">{w.customerName}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expira em</p>
                                                <p className="text-xs font-black text-primary">{formatDateBR(w.expiry)}</p>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${w.remainingDays <= 7 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                {w.remainingDays} dias
                                            </div>
                                            <button 
                                                onClick={() => navigate(`/service-orders/edit/${w.id}`)}
                                                className="p-2 hover:bg-emerald-50 rounded-lg text-gray-400 hover:text-emerald-600 transition-all opacity-0 group-hover/item:opacity-100"
                                            >
                                                <ArrowRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-4 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                                    <CheckCircle2 size={28} className="text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-base font-black text-gray-500">Nenhuma garantia ativa</p>
                                    <p className="text-sm text-gray-400 font-medium mt-1">Garantias de OS concluídas aparecerão aqui</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrderDashboard;
