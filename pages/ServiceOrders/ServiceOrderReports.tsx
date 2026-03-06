import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Package, Wrench, Users, TrendingUp, AlertCircle, Download, ChevronRight } from 'lucide-react';
import { getServiceOrders, getOsParts, getOsPartsStockStats, formatCurrency, OsPart } from '../../services/mockApi';
import { ServiceOrder } from '../../types';

type ReportTab = 'stock' | 'services' | 'technicians' | 'os';

const ServiceOrderReports: React.FC = () => {
    const [activeReport, setActiveReport] = useState<ReportTab>('stock');
    const [orders, setOrders] = useState<ServiceOrder[]>([]);
    const [osParts, setOsParts] = useState<OsPart[]>([]);
    const [loading, setLoading] = useState(true);

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

    // OS Parts Stats
    const partsStats = useMemo(() => {
        const active = osParts.filter(p => p.isActive);
        const totalQty = active.reduce((acc, p) => acc + (p.stock || 0), 0);
        const totalCost = active.reduce((acc, p) => acc + (p.costPrice || 0) * (p.stock || 0), 0);
        const totalSaleValue = active.reduce((acc, p) => acc + (p.salePrice || 0) * (p.stock || 0), 0);
        const lowStock = active.filter(p => p.stock > 0 && p.minimumStock !== undefined && p.stock <= (p.minimumStock || 0));
        const outOfStock = active.filter(p => p.stock === 0);
        return { active, totalQty, totalCost, totalSaleValue, lowStock, outOfStock };
    }, [osParts]);

    // Technicians performance
    const techStats = useMemo(() => {
        const map = new Map<string, { name: string; completed: number; revenue: number }>();
        orders.filter(o => o.status === 'Entregue' || o.status === 'Concluído').forEach(o => {
            const tech = o.responsibleName || 'Sem técnico';
            const current = map.get(tech) || { name: tech, completed: 0, revenue: 0 };
            current.completed++;
            current.revenue += o.total || 0;
            map.set(tech, current);
        });
        return Array.from(map.values()).sort((a, b) => b.completed - a.completed);
    }, [orders]);

    // Service type stats
    const serviceTypeStats = useMemo(() => {
        const map = new Map<string, { name: string; count: number; revenue: number }>();
        orders.filter(o => o.status === 'Entregue' || o.status === 'Concluído').forEach(o => {
            (o.items || []).filter(item => item.type === 'service').forEach(item => {
                const key = item.description;
                const curr = map.get(key) || { name: key, count: 0, revenue: 0 };
                curr.count += item.quantity;
                curr.revenue += item.price * item.quantity;
                map.set(key, curr);
            });
        });
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [orders]);

    const REPORTS = [
        { key: 'stock' as ReportTab, label: 'Estoque OS', icon: Package, color: 'bg-amber-100 text-amber-700 border-amber-300' },
        { key: 'services' as ReportTab, label: 'Serviços', icon: Wrench, color: 'bg-blue-100 text-blue-700 border-blue-300' },
        { key: 'technicians' as ReportTab, label: 'Técnicos', icon: Users, color: 'bg-violet-100 text-violet-700 border-violet-300' },
        { key: 'os' as ReportTab, label: 'Ordens de Serviço', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
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
                                <p className="text-xs text-gray-400 mt-0.5">Top 10 por faturamento (OS entregues)</p>
                            </div>
                            {serviceTypeStats.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">Nenhum serviço registrado ainda.</div>
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
                                <p className="text-xs text-gray-400 mt-0.5">OS concluídas e receita gerada</p>
                            </div>
                            {techStats.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">Nenhuma OS concluída ainda.</div>
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
                                    { label: 'Total OS', value: orders.length, color: 'text-gray-800' },
                                    { label: 'Entregues', value: orders.filter(o => o.status === 'Entregue' || o.status === 'Concluído').length, color: 'text-emerald-600' },
                                    { label: 'Em aberto', value: orders.filter(o => !['Entregue', 'Concluído', 'Cancelada'].includes(o.status)).length, color: 'text-orange-500' },
                                    { label: 'Canceladas', value: orders.filter(o => o.status === 'Cancelada').length, color: 'text-red-600' },
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
                                    {['Orçamento', 'Análise', 'Aprovado', 'Em Reparo', 'Aguardando Peça', 'Pronto', 'Entregue', 'Cancelada'].map(status => {
                                        const count = orders.filter(o => o.status === status).length;
                                        const pct = orders.length > 0 ? (count / orders.length) * 100 : 0;
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
