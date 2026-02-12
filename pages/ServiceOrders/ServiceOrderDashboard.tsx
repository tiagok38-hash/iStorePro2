
import React, { useState, useEffect } from 'react';
import {
    Clock,
    Calendar,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle2,
    XCircle,
    WrenchIcon,
    SmartphoneIcon,
    DollarSign,
    MoreVertical,
    ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    Cell,
    AreaChart,
    Area
} from 'recharts';

// --- MOCK DATA ---
const KPI_DATA = [
    { label: 'OS em Aberto', value: 12, change: '+2', status: 'neutral', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Em Análise', value: 5, change: '-1', status: 'good', icon: SmartphoneIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Aprovadas', value: 8, change: '+4', status: 'good', icon: WrenchIcon, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Concluídas Hoje', value: 15, change: '+12%', status: 'amazing', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const WEEKLY_FLOW_DATA = [
    { name: 'Seg', entrada: 4, saida: 3 },
    { name: 'Ter', entrada: 7, saida: 5 },
    { name: 'Qua', entrada: 5, saida: 8 },
    { name: 'Qui', entrada: 9, saida: 4 },
    { name: 'Sex', entrada: 12, saida: 10 },
    { name: 'Sab', entrada: 8, saida: 6 },
    { name: 'Dom', entrada: 0, saida: 0 },
];

const REVENUE_DATA = [
    { name: 'Serviços', value: 12500, color: '#7B61FF' },
    { name: 'Peças', value: 8300, color: '#3B82F6' },
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

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    // Greeting logic
    const hour = currentTime.getHours();
    let greeting = 'Bom dia';
    if (hour >= 12) greeting = 'Boa tarde';
    if (hour >= 18) greeting = 'Boa noite';

    return (
        <div className="space-y-6 pb-20 fade-in">
            {/* 1. Header & Greeting */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-primary">
                        {greeting}, <span className="text-secondary font-medium">Equipe Técnica.</span>
                    </h1>
                    <p className="text-secondary mt-1 flex items-center gap-2">
                        <Calendar size={14} />
                        <span className="capitalize">{formatDate(currentTime)}</span>
                        <span className="w-1 h-1 bg-secondary rounded-full mx-1" />
                        <Clock size={14} />
                        <span>{formatTime(currentTime)}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-sm font-bold text-emerald-600">Loja Aberta</span>
                    </div>
                    <button
                        onClick={() => navigate('/service-orders/new')}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2">
                        <WrenchIcon size={18} />
                        Nova OS
                    </button>
                </div>
            </div>

            {/* 2. Quick Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {KPI_DATA.map((kpi, idx) => (
                    <div key={idx} className="bg-white/70 backdrop-blur-sm border border-white/40 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform`}>
                                <kpi.icon size={24} strokeWidth={1.5} />
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${kpi.change.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {kpi.change}
                            </span>
                        </div>
                        <div>
                            <p className="text-secondary text-sm font-medium">{kpi.label}</p>
                            <h3 className="text-3xl font-black text-primary mt-1">{kpi.value}</h3>
                        </div>
                    </div>
                ))}
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
                            <BarChart data={WEEKLY_FLOW_DATA} barGap={8}>
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
                                    data={REVENUE_DATA}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {REVENUE_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                        {REVENUE_DATA.map((item, idx) => (
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
