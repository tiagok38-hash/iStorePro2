import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock,
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
    PieChart as PieChartIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getServiceOrders } from '../../services/mockApi';
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
    { key: 'Aberto', label: 'OS em Aberto', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { key: 'Análise', label: 'Em Análise', icon: SmartphoneIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { key: 'Aprovado', label: 'Aprovadas', icon: WrenchIcon, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { key: 'Pronto', label: 'Prontas p/ Entrega', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const AGENDA_ITEMS = [
    { id: 1, time: '09:00', title: 'Entrega iPhone 13 Pro', customer: 'João Silva', type: 'delivery' },
    { id: 2, time: '10:30', title: 'Análise MacBook Air M1', customer: 'Maria Oliveira', type: 'analysis' },
    { id: 3, time: '14:00', title: 'Reparo Placa Samsung S22', customer: 'Carlos Edu', type: 'repair' },
    { id: 4, time: '16:15', title: 'Orçamento iPad Air', customer: 'Ana Clara', type: 'budget' },
];

const ServiceOrderDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [expenses, setExpenses] = useState<any[]>(() => {
        const saved = localStorage.getItem('os_expenses');
        return saved ? JSON.parse(saved) : [];
    });
    const [isLoading, setIsLoading] = useState(true);
    const [periodFilter, setPeriodFilter] = useState('month'); // today, yesterday, week, month, custom
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        loadData();
        return () => clearInterval(timer);
    }, []);

    const loadData = async () => {
        try {
            const data = await getServiceOrders();
            setOrders(data || []);
            // Update expenses from local storage in case they changed
            const saved = localStorage.getItem('os_expenses');
            if (saved) setExpenses(JSON.parse(saved));
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Greeting logic
    const hour = currentTime.getHours();
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-primary">
                        {greeting}.
                    </h1>
                    <p className="text-secondary mt-1 flex items-center gap-2">
                        <Calendar size={14} />
                        <span className="capitalize">{formatDate(currentTime)}</span>
                        <span className="w-1 h-1 bg-secondary rounded-full mx-1" />
                        <Clock size={14} />
                        <span>{formatTime(currentTime)}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                    <button
                        onClick={() => navigate('/service-orders/customers')}
                        className="px-5 py-3 bg-cyan-50/50 text-cyan-700 rounded-xl font-black shadow-sm border-2 border-cyan-200/80 hover:bg-cyan-100 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <Users size={16} />
                        Clientes
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/financial')}
                        className="px-5 py-3 bg-emerald-50/50 text-emerald-700 rounded-xl font-black shadow-sm border-2 border-emerald-200/80 hover:bg-emerald-100 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <DollarSign size={16} />
                        Financeiro
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/products')}
                        className="px-5 py-3 bg-amber-50/50 text-amber-700 rounded-xl font-black shadow-sm border-2 border-amber-200/80 hover:bg-amber-100 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <Package size={16} />
                        Peças e Serviços
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/list')}
                        className="px-5 py-3 bg-violet-50/50 text-violet-700 rounded-xl font-black shadow-sm border-2 border-violet-200/80 hover:bg-violet-100 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <ClipboardList size={16} />
                        Ordens de Serviço
                    </button>
                    <button
                        onClick={() => navigate('/service-orders/reports')}
                        className="px-5 py-3 bg-rose-50/50 text-rose-700 rounded-xl font-black shadow-sm border-2 border-rose-200/80 hover:bg-rose-100 hover:scale-105 transition-all text-[11px] uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
                        <PieChartIcon size={16} />
                        Relatórios
                    </button>

                    <button
                        onClick={() => navigate('/service-orders/new')}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap">
                        <WrenchIcon size={18} />
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
                <div className="bg-white/70 backdrop-blur-sm border border-white/40 p-6 rounded-3xl shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-primary">Agenda do Dia</h3>
                        <button className="text-accent text-sm font-bold hover:underline">Ver tudo</button>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                        {AGENDA_ITEMS.map((item) => (
                            <div key={item.id} className="flex gap-3 p-3 rounded-2xl hover:bg-white transition-colors border border-transparent hover:border-gray-100 group cursor-pointer">
                                <div className="flex flex-col items-center justify-center min-w-[50px] bg-gray-50 rounded-xl px-2 py-1">
                                    <span className="text-xs font-bold text-secondary">{item.time.split(':')[0]}</span>
                                    <span className="text-[10px] text-gray-400">:{item.time.split(':')[1]}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm text-primary truncate">{item.title}</h4>
                                    <p className="text-xs text-secondary truncate">{item.customer}</p>
                                </div>
                                <div className={`w-2 h-2 rounded-full mt-2
                                    ${item.type === 'delivery' ? 'bg-emerald-500' :
                                        item.type === 'analysis' ? 'bg-amber-500' :
                                            item.type === 'repair' ? 'bg-blue-500' : 'bg-purple-500'}
                                `} />
                            </div>
                        ))}
                    </div>

                    <button className="mt-4 w-full py-3 border border-dashed border-gray-300 rounded-xl text-secondary text-sm font-medium hover:bg-white hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2">
                        <Calendar size={16} />
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
