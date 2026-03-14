import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Package, Wrench, Users, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { getServiceOrders, getOsParts, formatCurrency, OsPart } from '../../services/mockApi';
import { ServiceOrder } from '../../types';

type ReportTab = 'stock' | 'services' | 'technicians' | 'os';
type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const getStartOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const getEndOfDay = (d: Date) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };

const computePeriodDates = (period: PeriodKey): { start: Date; end: Date } => {
    const now = new Date();
    switch (period) {
        case 'today':
            return { start: getStartOfDay(now), end: getEndOfDay(now) };
        case 'yesterday': {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            return { start: getStartOfDay(y), end: getEndOfDay(y) };
        }
        case 'week': {
            const s = new Date(now);
            s.setDate(s.getDate() - s.getDay());
            return { start: getStartOfDay(s), end: getEndOfDay(now) };
        }
        case 'month': {
            const s = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: getStartOfDay(s), end: getEndOfDay(now) };
        }
        default:
            return { start: getStartOfDay(now), end: getEndOfDay(now) };
    }
};

const formatDateInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const ServiceOrderReports: React.FC = () => {
    const [activeReport, setActiveReport] = useState<ReportTab>('stock');
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [osParts, setOsParts] = useState<OsPart[]>([]);
    const [loading, setLoading] = useState(true);

    // Period filter
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month');
    const initDates = computePeriodDates('month');
    const [startDate, setStartDate] = useState(formatDateInput(initDates.start));
    const [endDate, setEndDate] = useState(formatDateInput(initDates.end));

    const handlePeriodChange = (period: PeriodKey) => {
        setSelectedPeriod(period);
        if (period !== 'custom') {
            const { start, end } = computePeriodDates(period);
            setStartDate(formatDateInput(start));
            setEndDate(formatDateInput(end));
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [ordersData, partsData] = await Promise.all([
                    getServiceOrders(),
                    getOsParts(false),
                ]);
                setOrders(ordersData || []);
                setOsParts(partsData || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Filter orders by date
    const filteredOrders = useMemo(() => {
        const start = getStartOfDay(new Date(startDate + 'T00:00:00'));
        const end = getEndOfDay(new Date(endDate + 'T23:59:59'));
        return orders.filter(o => {
            const d = new Date(o.createdAt || o.entryDate);
            return d >= start && d <= end;
        });
    }, [orders, startDate, endDate]);

    // OS Parts Stats (not date-filtered — stock is always current)
    const partsStats = useMemo(() => {
        const active = osParts.filter(p => p.isActive);
        const totalQty = active.reduce((acc, p) => acc + (p.stock || 0), 0);
        const totalCost = active.reduce((acc, p) => acc + (p.costPrice || 0) * (p.stock || 0), 0);
        const totalSaleValue = active.reduce((acc, p) => acc + (p.salePrice || 0) * (p.stock || 0), 0);
        const lowStock = active.filter(p => p.stock > 0 && p.minimumStock !== undefined && p.stock <= (p.minimumStock || 0));
        const outOfStock = active.filter(p => p.stock === 0);
        return { active, totalQty, totalCost, totalSaleValue, lowStock, outOfStock };
    }, [osParts]);

    // Technicians performance (date filtered)
    const techStats = useMemo(() => {
        const map = new Map<string, { name: string; completed: number; revenue: number }>();
        filteredOrders.filter(o => o.status === 'Entregue e Faturado' || o.status === 'Concluído').forEach(o => {
            const tech = o.responsibleName || 'Sem técnico';
            const current = map.get(tech) || { name: tech, completed: 0, revenue: 0 };
            current.completed++;
            current.revenue += o.total || 0;
            map.set(tech, current);
        });
        return Array.from(map.values()).sort((a, b) => b.completed - a.completed);
    }, [filteredOrders]);

    // Service type stats (date filtered)
    const serviceTypeStats = useMemo(() => {
        const map = new Map<string, { name: string; count: number; revenue: number }>();
        filteredOrders.filter(o => o.status === 'Entregue e Faturado' || o.status === 'Concluído').forEach(o => {
            (o.items || []).filter(item => item.type === 'service').forEach(item => {
                const key = item.description;
                const curr = map.get(key) || { name: key, count: 0, revenue: 0 };
                curr.count += item.quantity;
                curr.revenue += item.price * item.quantity;
                map.set(key, curr);
            });
        });
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [filteredOrders]);

    const REPORTS = [
        { key: 'stock' as ReportTab, label: 'Estoque OS', icon: Package, color: 'bg-amber-100 text-amber-700 border-amber-300' },
        { key: 'services' as ReportTab, label: 'Serviços', icon: Wrench, color: 'bg-blue-100 text-blue-700 border-blue-300' },
        { key: 'technicians' as ReportTab, label: 'Técnicos', icon: Users, color: 'bg-violet-100 text-violet-700 border-violet-300' },
        { key: 'os' as ReportTab, label: 'Ordens de Serviço', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    ];

    const PERIOD_BUTTONS: { key: PeriodKey; label: string }[] = [
        { key: 'today', label: 'Hoje' },
        { key: 'yesterday', label: 'Ontem' },
        { key: 'week', label: 'Semana' },
        { key: 'month', label: 'Mês' },
    ];

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                    <BarChart2 size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Relatórios — OS</h1>
                    <p className="text-sm text-gray-500">Dados exclusivos do módulo de Ordens de Serviço</p>
                </div>
            </div>

            {/* Period Filter Bar — Fixed */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Período:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {PERIOD_BUTTONS.map(btn => (
                            <button
                                key={btn.key}
                                onClick={() => handlePeriodChange(btn.key)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${selectedPeriod === btn.key
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 ml-auto px-4 h-10 bg-white border border-gray-200 rounded-full shadow-sm">
                        <Calendar size={14} className="text-gray-400" />
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setSelectedPeriod('custom'); }}
                                className="!bg-transparent !border-0 text-xs font-bold text-gray-700 outline-none !p-0"
                            />
                            <span className="text-[10px] text-gray-400 font-extrabold uppercase">até</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setSelectedPeriod('custom'); }}
                                className="!bg-transparent !border-0 text-xs font-bold text-gray-700 outline-none !p-0"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Report selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {REPORTS.map(r => (
                    <button
                        key={r.key}
                        onClick={() => setActiveReport(r.key)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${activeReport === r.key ? r.color + ' shadow-md scale-[1.02]' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                    >
                        <r.icon size={18} />
                        <span className="text-sm font-black">{r.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* STOCK REPORT */}
                    {activeReport === 'stock' && (
                        <div className="space-y-4">
                            {/* Summary KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total de Peças</p>
                                    <p className="text-3xl font-black text-gray-800 mt-1">{partsStats.totalQty}</p>
                                    <p className="text-xs text-gray-400">{partsStats.active.length} SKUs ativos</p>
                                </div>
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Custo Total</p>
                                    <p className="text-2xl font-black text-gray-800 mt-1">{formatCurrency(partsStats.totalCost)}</p>
                                    <p className="text-xs text-gray-400">investimento em peças</p>
                                </div>
                                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Valor de Venda</p>
                                    <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(partsStats.totalSaleValue)}</p>
                                    <p className="text-xs text-gray-400">potencial de faturamento</p>
                                </div>
                                <div className={`rounded-2xl p-5 border shadow-sm ${partsStats.lowStock.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                    <p className={`text-xs font-semibold uppercase tracking-wide ${partsStats.lowStock.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Alertas</p>
                                    <p className={`text-3xl font-black mt-1 ${partsStats.lowStock.length > 0 ? 'text-red-700' : 'text-gray-800'}`}>{partsStats.lowStock.length + partsStats.outOfStock.length}</p>
                                    <p className="text-xs text-gray-400">{partsStats.lowStock.length} baixos · {partsStats.outOfStock.length} esgotados</p>
                                </div>
                            </div>

                            {/* Estoque baixo / zerado */}
                            {(partsStats.lowStock.length > 0 || partsStats.outOfStock.length > 0) && (
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                    <p className="text-sm font-black text-red-700 flex items-center gap-2 mb-3">
                                        <AlertCircle size={16} />
                                        Peças que precisam de reposição
                                    </p>
                                    <div className="space-y-2">
                                        {[...partsStats.outOfStock, ...partsStats.lowStock].slice(0, 8).map(p => (
                                            <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded-xl px-4 py-2 border border-red-100">
                                                <span className="font-semibold text-gray-800">{p.name}</span>
                                                <span className={`font-black ${p.stock === 0 ? 'text-red-600' : 'text-orange-500'}`}>
                                                    {p.stock === 0 ? 'Esgotado' : `${p.stock} restante(s)`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lista completa */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="font-black text-gray-800">Todas as Peças em Estoque OS</h3>
                                    <span className="text-xs text-gray-400 font-semibold">{partsStats.active.filter(p => p.stock > 0).length} com estoque</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Peça</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Custo Unit.</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Custo Total</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor Venda</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {partsStats.active.filter(p => p.stock > 0).map(p => (
                                                <tr key={p.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3">
                                                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                                                        <p className="text-xs text-gray-400">{[p.brand, p.category, p.model].filter(Boolean).join(' · ')}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-700">{p.stock}</td>
                                                    <td className="px-4 py-3 text-right text-sm text-gray-600">{formatCurrency(p.costPrice)}</td>
                                                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">{formatCurrency(p.costPrice * p.stock)}</td>
                                                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">{formatCurrency(p.salePrice * p.stock)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td className="px-6 py-3 text-sm font-black text-gray-800">TOTAL</td>
                                                <td className="px-4 py-3 text-center text-sm font-black text-gray-800">{partsStats.totalQty}</td>
                                                <td className="px-4 py-3" />
                                                <td className="px-4 py-3 text-right text-sm font-black text-gray-800">{formatCurrency(partsStats.totalCost)}</td>
                                                <td className="px-4 py-3 text-right text-sm font-black text-emerald-600">{formatCurrency(partsStats.totalSaleValue)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SERVICES REPORT */}
                    {activeReport === 'services' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-black text-gray-800">Serviços Mais Realizados</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Top 10 por faturamento (OS entregues no período)</p>
                            </div>
                            {serviceTypeStats.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">Nenhum serviço registrado no período.</div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Serviço</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Receita</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {serviceTypeStats.map((svc, idx) => (
                                            <tr key={svc.name} className="hover:bg-gray-50">
                                                <td className="px-6 py-3 text-sm font-black text-gray-400">#{idx + 1}</td>
                                                <td className="px-6 py-3 text-sm font-semibold text-gray-800">{svc.name}</td>
                                                <td className="px-4 py-3 text-center text-sm text-gray-600">{svc.count}</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">{formatCurrency(svc.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* TECHNICIANS REPORT */}
                    {activeReport === 'technicians' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-black text-gray-800">Desempenho por Técnico</h3>
                                <p className="text-xs text-gray-400 mt-0.5">OS concluídas e receita gerada no período</p>
                            </div>
                            {techStats.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">Nenhuma OS concluída no período.</div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Técnico</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">OS Concluídas</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Receita Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {techStats.map(tech => (
                                            <tr key={tech.name} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-black text-sm">
                                                            {tech.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-800">{tech.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-black">{tech.completed}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right text-sm font-bold text-emerald-600">{formatCurrency(tech.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* OS OVERVIEW REPORT */}
                    {activeReport === 'os' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total OS', value: filteredOrders.length, color: 'text-gray-800' },
                                    { label: 'Entregues', value: filteredOrders.filter(o => o.status === 'Entregue e Faturado' || o.status === 'Concluído').length, color: 'text-emerald-600' },
                                    { label: 'Em aberto', value: filteredOrders.filter(o => !['Entregue e Faturado', 'Concluído', 'Cancelada'].includes(o.status)).length, color: 'text-orange-500' },
                                    { label: 'Canceladas', value: filteredOrders.filter(o => o.status === 'Cancelada').length, color: 'text-red-600' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{stat.label}</p>
                                        <p className={`text-3xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100">
                                    <h3 className="font-black text-gray-800">Status das Ordens de Serviço</h3>
                                </div>
                                <div className="p-6 space-y-3">
                                    {['Orçamento', 'Análise', 'Aprovado', 'Em Reparo', 'Aguardando Peça', 'Pronto', 'Entregue e Faturado', 'Cancelada'].map(status => {
                                        const count = filteredOrders.filter(o => o.status === status).length;
                                        const pct = filteredOrders.length > 0 ? (count / filteredOrders.length) * 100 : 0;
                                        return (
                                            <div key={status} className="flex items-center gap-3">
                                                <span className="text-sm font-semibold text-gray-600 w-36 shrink-0">{status}</span>
                                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-violet-500 transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-black text-gray-700 w-8 text-right">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ServiceOrderReports;
